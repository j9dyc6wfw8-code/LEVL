# ASCEND — realtime duel workouts

This build keeps the original six-tab structure and upgrades the friend-duel
data path, live evidence view, history and safety rules.

## Required database step

Before deploying the JavaScript, open Supabase → SQL Editor and run these files
in order:

1. `sql/realtime_duel_workouts.sql`
2. `sql/duel_invites.sql`
3. `sql/duel_integrity_patch.sql`

The migration is safe to rerun. It:

- creates or repairs the public `workouts` table;
- fixes the upsert key to `(user_id, client_id)`;
- records lift/cardio type, weight unit, RPE, and distance on new rows;
- lets authenticated friends read shared history and lets non-friend duel
  partners read only rows inside their active duel window, while keeping private
  save blobs private;
- adds `workouts` to the `supabase_realtime` publication.

The integrity patch prevents overlapping active Duels, makes invite claims
atomic and grants winner coins exactly once. The app records forfeits as
completed results.

## What now happens

1. A logged set is saved locally as before.
2. After the existing 1.5-second debounce, the set is upserted into `workouts`.
3. Only after that succeeds, the player's score is recalculated from the server
   workout rows inside the exact start/end window.
4. The opponent receives the duel score change and workout-table change over
   Supabase Realtime.
5. The open duel page refreshes both workout feeds in a short debounced batch.

The screen also refreshes when returning to the foreground and every 15 seconds
as a fallback. A disconnected Realtime channel therefore delays an update but
does not leave the page permanently stale.

## Two-device test

Use two signed-in accounts with one active friend duel.

1. Keep the Duel tab open on account B.
2. On account A, log `Bench Press · 60 kg × 8`.
3. After the sync debounce, account B should show:
   - the updated XP score;
   - a new workout/session group;
   - `Bench Press`;
   - `60 kg × 8`;
   - the set's XP and PR marker when applicable.
4. Log several sets within 90 minutes. They should remain inside one workout
   group while the set count increases.
5. Repeat with an lb account. New rows should display the logger's unit, not the
   viewer's preferred unit.
6. Background account B, log another set on A, then reopen B. Foreground refresh
   should immediately reconcile the feed.
7. Disable network briefly, log on A, reconnect, and foreground the app. The
   rolling 30-day reconciliation should upload the missed row.
8. Confirm a pending challenge starts its full countdown only when accepted.
9. Try joining a second Duel and confirm it is blocked.
10. Forfeit and confirm the winner/loss record appears on both accounts.
11. Complete a win and refresh from two devices; the coin reward should appear
    once, never twice.

## Status labels

- `LIVE WORKOUT ACTIVITY` — both filtered workout channels are subscribed.
- `AUTO-REFRESHING` — the page is using foreground/manual/15-second refresh
  while a channel connects or is unavailable.

If the label never becomes live, confirm that `workouts` appears under the
`supabase_realtime` publication. The supplied SQL normally handles this.

## Deploy

No native dependency or entitlement changed. After the SQL migration, this can
ship through the same JavaScript update process already used by the project.
