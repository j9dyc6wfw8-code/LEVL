-- ASCEND — friend-duel integrity and atomic invite claims
--
-- Run AFTER sql/duel_invites.sql in Supabase SQL Editor. Safe to run again.
-- This is the database-side half of the July 2026 Duel patch:
--   • no self-duels
--   • one active friend duel per player, even across simultaneous phones
--   • one invite code can be claimed exactly once

alter table public.duels
  add column if not exists player_one_reward_claimed boolean not null default false;
alter table public.duels
  add column if not exists player_two_reward_claimed boolean not null default false;

create or replace function public.enforce_friend_duel_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  entering_active boolean := false;
  first_player text;
  second_player text;
begin
  if new.player_one is null or new.player_two is null then
    raise exception 'A duel needs two players.' using errcode = 'P0001';
  end if;

  if new.player_one = new.player_two then
    raise exception 'You cannot duel yourself.' using errcode = 'P0001';
  end if;

  if new.status in ('pending', 'active')
     and (new.start_date is null or new.end_date is null or new.end_date <= new.start_date) then
    raise exception 'This duel has an invalid time window.' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    entering_active := new.status = 'active';
  elsif tg_op = 'UPDATE' then
    entering_active := new.status = 'active'
      and (
        old.status is distinct from 'active'
        or old.player_one is distinct from new.player_one
        or old.player_two is distinct from new.player_two
      );
  end if;

  if entering_active then
    -- Transaction-scoped locks close the tiny race where two devices try to
    -- activate different duels for the same player at exactly the same time.
    first_player := least(new.player_one::text, new.player_two::text);
    second_player := greatest(new.player_one::text, new.player_two::text);
    perform pg_advisory_xact_lock(hashtextextended(first_player, 0));
    perform pg_advisory_xact_lock(hashtextextended(second_player, 0));

    if exists (
      select 1
      from public.duels d
      where d.status = 'active'
        and d.id is distinct from new.id
        and (
          d.player_one in (new.player_one, new.player_two)
          or d.player_two in (new.player_one, new.player_two)
        )
    ) then
      raise exception 'One of these players already has an active duel.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_friend_duel_integrity() from public;

drop trigger if exists enforce_friend_duel_integrity_trigger on public.duels;
create trigger enforce_friend_duel_integrity_trigger
before insert or update on public.duels
for each row execute function public.enforce_friend_duel_integrity();

-- Claims an invite and creates its active duel in one transaction. SELECT ...
-- FOR UPDATE means a second claimant waits, then sees that the code was used.
drop function if exists public.claim_duel_invite(text);
create or replace function public.claim_duel_invite(p_code text, p_expected_uid uuid)
returns setof public.duels
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.duel_invites%rowtype;
  v_duel public.duels%rowtype;
  v_start timestamptz := now();
  v_days int;
begin
  if v_uid is null then
    raise exception 'Sign in to join the duel.' using errcode = 'P0001';
  end if;
  if p_expected_uid is null or p_expected_uid <> v_uid then
    raise exception 'Account changed. Open the invite again.' using errcode = 'P0001';
  end if;

  select * into v_inv
  from public.duel_invites
  where upper(code) = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'Invite not found or expired.' using errcode = 'P0001';
  end if;
  if v_inv.status <> 'open' then
    raise exception 'That invite was already used.' using errcode = 'P0001';
  end if;
  if v_inv.creator = v_uid then
    raise exception 'That is your invite. Send it to a friend.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.duels d
    where d.status = 'active'
      and (
        d.player_one in (v_uid, v_inv.creator)
        or d.player_two in (v_uid, v_inv.creator)
      )
  ) then
    raise exception 'Finish the current duel first.' using errcode = 'P0001';
  end if;

  v_days := greatest(1, least(coalesce(v_inv.days, 7), 30));

  insert into public.duels (
    player_one, player_two, status, start_date, end_date,
    player_one_score, player_two_score, reward
  ) values (
    v_uid, v_inv.creator, 'active', v_start, v_start + make_interval(days => v_days),
    0, 0, coalesce(v_inv.reward, 500)
  ) returning * into v_duel;

  update public.duel_invites
  set status = 'claimed', claimed_by = v_uid
  where id = v_inv.id;

  -- Notification failure must never roll back a valid duel claim.
  begin
    insert into public.notifications (user_id, kind, payload, read)
    values (
      v_inv.creator,
      'duel_challenge',
      jsonb_build_object('from', v_uid, 'duel_id', v_duel.id, 'started', true),
      false
    );
  exception when others then
    null;
  end;

  return next v_duel;
end;
$$;

revoke all on function public.claim_duel_invite(text, uuid) from public;
grant execute on function public.claim_duel_invite(text, uuid) to authenticated;

-- Claims every unclaimed winning reward for the signed-in player. The row
-- locks make this exactly-once across two phones refreshing together.
drop function if exists public.claim_friend_duel_rewards();
create or replace function public.claim_friend_duel_rewards(p_expected_uid uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_duel public.duels%rowtype;
  v_total integer := 0;
begin
  if v_uid is null then
    raise exception 'Sign in to claim duel rewards.' using errcode = 'P0001';
  end if;
  if p_expected_uid is null or p_expected_uid <> v_uid then
    raise exception 'Account changed. Refresh Duels and try again.' using errcode = 'P0001';
  end if;

  for v_duel in
    select *
    from public.duels d
    where d.status = 'complete'
      and d.winner = v_uid
      and (
        (d.player_one = v_uid and not coalesce(d.player_one_reward_claimed, false))
        or
        (d.player_two = v_uid and not coalesce(d.player_two_reward_claimed, false))
      )
    for update
  loop
    if v_duel.player_one = v_uid then
      update public.duels set player_one_reward_claimed = true where id = v_duel.id;
    else
      update public.duels set player_two_reward_claimed = true where id = v_duel.id;
    end if;
    v_total := v_total + greatest(0, coalesce(v_duel.reward, 0)::integer);
  end loop;

  return v_total;
end;
$$;

revoke all on function public.claim_friend_duel_rewards(uuid) from public;
grant execute on function public.claim_friend_duel_rewards(uuid) to authenticated;

-- Make the two pushed UI channels live when the standard Supabase publication
-- exists. Row Level Security still decides which changes each user receives.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['duels', 'notifications'] loop
      if to_regclass('public.' || table_name) is not null
         and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = table_name
         ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
