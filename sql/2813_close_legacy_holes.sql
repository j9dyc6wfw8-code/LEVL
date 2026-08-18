-- ============================================================================
-- 2813 — CLOSE THE LEGACY HOLES (pre-launch P0)
--
-- Run AFTER 2812_app_config_and_telemetry.sql. Idempotent. Non-destructive:
-- nothing here deletes a row. It only removes permissions that should never
-- have existed and moves two writes behind functions that check consent.
--
-- WHY THIS FILE EXISTS
-- 2801-2812 built a careful, correct permission model on top of an older,
-- permissive one — and never removed the old one. RLS policies are OR-ed, so a
-- single leftover `using (true)` cancels out every scoped policy written after
-- it. Three of those survived, and each was reproduced against production
-- before this file was written:
--
--   1. `workouts readable` (using auth.role() = 'authenticated')
--      Acting as one real user, `select count(*) from workouts` returned 628 —
--      of which 610 belonged to twenty other people. Every user's complete
--      training history was readable by every other user. The Privacy Policy
--      says the training log is private. It was not.
--
--   2. `friends` INSERT with check (auth.uid() = user_one OR = user_two)
--      Consent was never checked, only participation. Inserting a friendship
--      edge with a stranger succeeded. Because friendship is the key to
--      friends-only Check Ins, that granted a stranger someone's private
--      progress PHOTOGRAPHS — and the victim gained a friend they never added.
--
--   3. `notifications` INSERT with check (true), granted to `public`
--      `public` includes `anon`, which is the role the shipped API key runs as.
--      With no account at all, an insert addressed to another user succeeded —
--      and the levl_push trigger turns every such row into a real push. Anyone
--      who pulled the anon key out of the IPA could push arbitrary text to
--      every LEVL user.
--
-- And one silent data-loss defect, fixed in section 4:
--
--   4. levl_validate_workout() rejected anything over 400 kg while the client
--      allows 700 kg (Leg Press), 520 (Rack Pull), 500 (Hip Thrust). The app
--      accepts the set; the database refuses it; pushWorkouts sends up to 500
--      rows in ONE statement so the whole batch aborts; recentWorkoutEntries
--      re-sends the same poisoned row on every sync forever; and the error is
--      swallowed. One heavy leg press ended that user's cloud sync silently.
--
-- ORDER MATTERS: run this BEFORE fixing the push webhook URL. Fixing push
-- while section 3 is still open arms a spam cannon.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. workouts — stop every signed-in account reading everyone's training log
--
--    The three scoped policies from sql/workouts.sql already cover every
--    legitimate read: your own rows, your friends' rows, and an active duel
--    partner's rows inside that duel's window. Dropping the blanket policy
--    leaves those three in force and removes nothing anyone needs.
-- ---------------------------------------------------------------------------

drop policy if exists "workouts readable" on public.workouts;

-- The live duel-partner policy had drifted to `status in ('active','pending')`.
-- A PENDING challenge is one the other person has not accepted yet — it must
-- not open your training log. Narrow it back to active duels only.
drop policy if exists "read duel partner workouts" on public.workouts;
create policy "read duel partner workouts"
  on public.workouts for select to authenticated
  using (
    exists (
      select 1 from public.duels d
      where d.status = 'active'
        and workouts.date >= d.start_date
        and workouts.date <= d.end_date
        and (
          (d.player_one = auth.uid() and d.player_two = workouts.user_id)
          or
          (d.player_two = auth.uid() and d.player_one = workouts.user_id)
        )
    )
  );

-- Deleting a set in the app never reached the cloud: there was no DELETE policy
-- at all, and workoutService only ever upserts. Since 2811 derives best_e1rm,
-- weekly_xp and consistency FROM this table, a mistyped 300 kg bench that the
-- user deleted locally sat at the top of the leaderboard permanently.
drop policy if exists "delete own workouts" on public.workouts;
create policy "delete own workouts"
  on public.workouts for delete to authenticated
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 2. friends — a friendship needs BOTH people
--
--    The client wrote the edge itself (friendService.acceptRequest), which is
--    why the policy had to be permissive. Move the write into a SECURITY
--    DEFINER function that verifies a pending request actually exists, then
--    remove the client's INSERT entirely. After this there is exactly one way
--    to become someone's friend, and it requires them to have asked.
-- ---------------------------------------------------------------------------

create or replace function public.accept_friend_request(p_sender uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  a  uuid;
  b  uuid;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if p_sender is null or p_sender = me then
    raise exception 'That is not a valid request.' using errcode = 'P0001';
  end if;

  -- THE CHECK THAT WAS MISSING: they must have asked, and it must still stand.
  if not exists (
    select 1 from public.friend_requests r
    where r.sender = p_sender and r.receiver = me and r.status = 'pending'
  ) then
    raise exception 'No pending request from that person.' using errcode = 'P0001';
  end if;

  -- A block on either side outranks a stale request.
  if public.levl_is_blocked(me, p_sender) then
    raise exception 'That account is blocked.' using errcode = 'P0001';
  end if;

  update public.friend_requests
     set status = 'accepted'
   where sender = p_sender and receiver = me;

  -- One ordered edge per pair, matching the convention in friendService.
  a := least(me::text, p_sender::text)::uuid;
  b := greatest(me::text, p_sender::text)::uuid;
  insert into public.friends (user_one, user_two)
  values (a, b)
  on conflict do nothing;
end;
$$;

revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;

-- No INSERT policy on `friends` at all now. The function above runs as the
-- table owner, so it is unaffected; a client INSERT has nowhere to land.
drop policy if exists "create own friendships" on public.friends;

-- SELECT (own edges) and DELETE (unfriend) stay exactly as they were.

-- friend_requests UPDATE was granted to sender OR receiver with no column
-- restriction, so a SENDER could mark their own request 'accepted'. Split it:
-- the receiver answers, the sender may only re-open a request they already own
-- (which is what friendService.sendRequest's upsert does after a decline).
drop policy if exists "update own friend_requests" on public.friend_requests;
drop policy if exists "update own requests"       on public.friend_requests;
drop policy if exists "receiver answers request"  on public.friend_requests;
drop policy if exists "sender resends request"    on public.friend_requests;

create policy "receiver answers request"
  on public.friend_requests for update to authenticated
  using (auth.uid() = receiver)
  with check (auth.uid() = receiver);

create policy "sender resends request"
  on public.friend_requests for update to authenticated
  using (auth.uid() = sender)
  with check (auth.uid() = sender and status = 'pending');

-- Cancelling an unanswered request is a delete, and there was no way to do it.
drop policy if exists "sender cancels request" on public.friend_requests;
create policy "sender cancels request"
  on public.friend_requests for delete to authenticated
  using (auth.uid() = sender and status = 'pending');


-- ---------------------------------------------------------------------------
-- 3. notifications — only the person who did the thing may announce it
--
--    Every notification now goes through levl_notify(), which derives the
--    sender from auth.uid() (so `from` cannot be forged), refuses kinds the
--    client has no business sending, and — the important part — checks that
--    the caller ACTUALLY DID the thing they are notifying about. A friend
--    request notification requires a real pending request; a duel notification
--    requires a real shared duel.
--
--    The database's own triggers (levl_notify_social for reactions and
--    comments, claim_duel_invite) insert as the table owner and are completely
--    unaffected by anything below.
-- ---------------------------------------------------------------------------

-- Supports the flood guard's lookup without scanning the table.
create index if not exists notifications_from_recent_idx
  on public.notifications ((payload->>'from'), created_at desc);

create or replace function public.levl_notify(
  p_user    uuid,
  p_kind    text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or p_user is null then
    return;                                    -- best-effort: never raise
  end if;

  -- Only the kinds the app actually sends. Anything else is a client that has
  -- been tampered with, or a kind somebody added without reading this.
  if p_kind not in ('friend_request', 'duel_challenge', 'duel_result') then
    return;
  end if;

  -- You may notify yourself only about a duel result (it is a record of your
  -- own duel ending, and the resolving device writes both sides).
  if p_user = me and p_kind <> 'duel_result' then
    return;
  end if;

  -- A block silences the notification in both directions.
  if public.levl_is_blocked(p_user, me) then
    return;
  end if;

  -- THE CHECK THAT WAS MISSING: prove the caller did the thing.
  if p_kind = 'friend_request' then
    if not exists (
      select 1 from public.friend_requests r
      where r.sender = me and r.receiver = p_user and r.status = 'pending'
    ) then return; end if;

  else  -- duel_challenge | duel_result
    if not exists (
      select 1 from public.duels d
      where (d.player_one = me and d.player_two = p_user)
         or (d.player_two = me and d.player_one = p_user)
         or (p_user = me and (d.player_one = me or d.player_two = me))
    ) then return; end if;
  end if;

  -- Flood guard. Twenty notifications an hour is far above any honest use of
  -- the app and far below anything that could be called an attack.
  if (
    select count(*) from public.notifications n
    where n.created_at > now() - interval '1 hour'
      and n.payload->>'from' = me::text
  ) >= 20 then
    return;
  end if;

  insert into public.notifications (user_id, kind, payload, read)
  values (
    p_user,
    p_kind,
    -- `from` is stamped from auth.uid(), so it can never be forged. The push
    -- Edge Function resolves it to a display name.
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('from', me),
    false
  );
exception when others then
  return;   -- a notification must never break the action that produced it
end;
$$;

revoke all on function public.levl_notify(uuid, text, jsonb) from public, anon;
grant execute on function public.levl_notify(uuid, text, jsonb) to authenticated;

-- Close the door. Both the policy and the raw grant have to go: the policy
-- allowed it and the grant is what `anon` was using.
drop policy if exists "insert notifications for anyone" on public.notifications;
revoke insert on public.notifications from anon, authenticated;

-- Reading and marking-as-read stay owner-scoped, exactly as before.


-- ---------------------------------------------------------------------------
-- 4. workouts — make the server's ceiling agree with the client's
--
--    The client's per-exercise ceilings (LIFT_CAPS_KG in src/engine/engine.js)
--    top out at 700 kg for Leg Press. 720 clears that with headroom while still
--    refusing anything physically impossible. Weight is normalised to kilograms
--    first, so a pound-unit user is measured on the same scale rather than
--    against a separate 900 that meant 408 kg.
--
--    Everything else is unchanged and already agrees with the client:
--      reps     <= 50   == INTEGRITY.MAX_REPS
--      duration <= 360  == INTEGRITY.MAX_CARDIO_MIN
--      xp       <= 4000 == INTEGRITY.DAILY_XP_CAP
-- ---------------------------------------------------------------------------

create or replace function public.levl_validate_workout()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  w_kg numeric;
begin
  if new.reps is not null and (new.reps < 0 or new.reps > 50) then
    raise exception 'workout rejected: reps % outside 0-50', new.reps
      using errcode = 'P0001';
  end if;

  w_kg := coalesce(new.weight, 0) * (case when new.unit = 'lb' then 0.45359237 else 1 end);
  if w_kg > 720 then
    raise exception 'workout rejected: % kg is above the plausible ceiling', round(w_kg)
      using errcode = 'P0001';
  end if;
  if coalesce(new.weight, 0) < 0 then
    raise exception 'workout rejected: negative weight' using errcode = 'P0001';
  end if;

  if new.duration is not null and new.duration > 360 then
    raise exception 'workout rejected: % minutes exceeds the daily cardio ceiling', new.duration
      using errcode = 'P0001';
  end if;
  if new.xp_earned is not null and (new.xp_earned < 0 or new.xp_earned > 4000) then
    raise exception 'workout rejected: xp_earned % outside 0-4000', new.xp_earned
      using errcode = 'P0001';
  end if;
  if new.date is not null and new.date > now() + interval '1 day' then
    raise exception 'workout rejected: dated in the future' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- The trigger itself is unchanged; replacing the function is enough.


-- ============================================================================
-- VERIFY — paste these into the SQL editor after running the file.
-- ============================================================================
--
-- 1. The blanket workout policy is gone. Expect exactly three SELECT policies:
--    "read own workouts", "read friends workouts", "read duel partner workouts".
--
--    select policyname, cmd from pg_policies
--     where schemaname='public' and tablename='workouts' order by cmd, policyname;
--
-- 2. `friends` has no INSERT policy, and `notifications` has none either.
--
--    select tablename, policyname, cmd from pg_policies
--     where schemaname='public' and tablename in ('friends','notifications')
--     order by tablename, cmd;
--
-- 3. anon can no longer write notifications. Expect zero rows.
--
--    select grantee, privilege_type from information_schema.role_table_grants
--     where table_schema='public' and table_name='notifications'
--       and grantee in ('anon','authenticated') and privilege_type='INSERT';
--
-- 4. Live proof, as a real user. Substitute two real ids. Every count must be
--    only that user's own rows, and both inserts must be refused.
--
--    begin;
--      select set_config('role','authenticated',true);
--      select set_config('request.jwt.claims','{"sub":"<USER_A>","role":"authenticated"}',true);
--      select count(*) from public.workouts where user_id <> '<USER_A>';   -- expect 0
--      insert into public.friends (user_one,user_two) values ('<USER_A>','<USER_B>');
--        -- expect: new row violates row-level security policy
--    rollback;
--
--    begin;
--      select set_config('role','anon',true);
--      insert into public.notifications (user_id,kind,payload,read)
--        values ('<USER_B>','duel_challenge','{}'::jsonb,false);
--        -- expect: permission denied for table notifications
--    rollback;
--
-- 5. A heavy but real lift is accepted; an impossible one is not.
--
--    select public.levl_validate_workout;    -- exists
--    -- 450 kg leg press: inserts fine.  900 kg: rejected.
