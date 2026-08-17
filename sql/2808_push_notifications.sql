-- ===========================================================================
-- LEVL — 2808: real push notifications
--
-- OPTIONAL. Only run this if you want the trigger in version control instead of
-- clicking a Database Webhook together in the dashboard. Both do the same thing
-- (a webhook IS a pg_net trigger under the hood) — the dashboard route is fewer
-- steps and keeps no secret in the database, so PUSH-SETUP.md recommends it.
--
-- What this does: whenever a row lands in public.notifications, fire-and-forget
-- an HTTP POST at the `push` Edge Function, which looks up the recipient's Expo
-- token and sends the actual Apple/Android notification.
--
-- Idempotent — safe to re-run.
-- ===========================================================================

-- pg_net gives us async HTTP from Postgres. Async matters: the insert that
-- caused the notification must not wait on a network call to Expo.
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Secrets live in Vault, never in a table and never in this file.
--
-- Run these TWO lines once (replace the values), then the trigger below can
-- read them. Vault encrypts at rest; a plain table would not.
--
--   select vault.create_secret(
--     'https://YOUR-PROJECT-REF.supabase.co/functions/v1/push', 'levl_push_url');
--   select vault.create_secret('YOUR-LONG-RANDOM-SECRET', 'levl_push_secret');
--
-- To change one later:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'levl_push_url'), 'new-value');
-- ---------------------------------------------------------------------------

create or replace function public.levl_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
begin
  -- Missing config is not an error. Push is an enhancement; the in-app inbox
  -- still works, so we must never block the insert that got us here.
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'levl_push_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'levl_push_secret';
  exception when others then
    return null;
  end;

  if v_url is null or v_url = '' then
    return null;
  end if;

  -- Fire and forget. net.http_post queues the request and returns immediately.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'content-type',  'application/json',
                 'x-levl-secret', coalesce(v_secret, '')
               ),
    body    := jsonb_build_object(
                 'type',   'INSERT',
                 'table',  'notifications',
                 'record', to_jsonb(new)
               ),
    timeout_milliseconds := 5000
  );

  return null;
exception when others then
  -- Same rule as the reaction/comment triggers in 2802: a notification must
  -- never roll back the action that produced it.
  return null;
end;
$$;

drop trigger if exists levl_push_after_notification on public.notifications;

create trigger levl_push_after_notification
  after insert on public.notifications
  for each row
  execute function public.levl_push_on_notification();

-- ---------------------------------------------------------------------------
-- Helpful index: the Edge Function reads token + switches by user_id on every
-- send, and check_in_preferences_push_idx (2801) is partial on enabled/
-- notify_check_in, so it does not serve this lookup.
-- ---------------------------------------------------------------------------
create index if not exists check_in_preferences_user_token_idx
  on public.check_in_preferences (user_id)
  where expo_push_token is not null;

-- ---------------------------------------------------------------------------
-- Verify
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'public.notifications'::regclass;
--
-- Watch the queue (pg_net records every call):
--   select id, status_code, created
--     from net._http_response order by created desc limit 10;
-- ---------------------------------------------------------------------------
