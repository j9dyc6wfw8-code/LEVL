# Turning on real push notifications

Plain steps. Do them in order. Nothing here needs coding.

**What you get when this is done:** a friend requests you, comments on your
Check In, or a duel finishes — and your phone buzzes **even if LEVL is closed**.

**Time:** about 15 minutes.

---

## Before you start

You need three things:

| Thing | Where to get it |
|---|---|
| Your **project ref** | Supabase dashboard → Project Settings → General → "Reference ID". A short code like `pndocotsoadxoklqwzys` |
| A **secret password** you invent | Any long random string. Open a terminal and run `openssl rand -hex 32` — copy what it prints |
| The **Supabase CLI** | Run `npm install -g supabase` |

Keep the secret somewhere safe. You'll paste it twice.

---

## Step 1 — Log in to Supabase from your computer

```bash
supabase login
```

A browser opens. Approve it.

Then connect this project (replace with your own project ref):

```bash
supabase link --project-ref pndocotsoadxoklqwzys
```

---

## Step 2 — Upload the sender

From the project folder:

```bash
supabase functions deploy push
```

When it finishes it prints a URL like:

```
https://pndocotsoadxoklqwzys.supabase.co/functions/v1/push
```

**Copy that URL.** You need it in Step 4.

---

## Step 3 — Give it your secret

Replace `PASTE_YOUR_SECRET_HERE` with the random string you made:

```bash
supabase secrets set PUSH_HOOK_SECRET=PASTE_YOUR_SECRET_HERE
```

That's the only secret you must set. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are provided automatically — don't set those.

---

## Step 4 — Tell the database to call it

This is the only part done in the browser.

1. Open your Supabase dashboard
2. Left sidebar → **Database**
3. Click **Webhooks**
4. Click **Create a new hook**
5. Fill it in exactly like this:

| Field | What to put |
|---|---|
| Name | `levl_push` |
| Table | `notifications` |
| Events | tick **Insert** only |
| Type | **HTTP Request** |
| Method | **POST** |
| URL | the URL from Step 2 |

6. Under **HTTP Headers**, click *Add header* and add:

| Header name | Header value |
|---|---|
| `x-levl-secret` | your secret from Step 3 |

7. Click **Create webhook**

---

## Step 5 — Turn notifications on in the app

On your phone, in LEVL:

1. Open **Settings**
2. Turn on **Check In reminders**
3. Say **Allow** when iOS asks about notifications

This is what registers your phone. Without it there's nowhere to send.

> You only need to do this once per phone. If you reinstall the app, do it again.

---

## Step 6 — Test it

Easiest test with two phones (or a friend):

1. Have them send you a friend request
2. **Close LEVL completely** — swipe it away
3. Your phone should buzz within a few seconds

If it works, you're done.

---

## If nothing arrives

Work down this list — it's in order of how often each one is the cause.

**1. Did you allow notifications?**
iPhone Settings → LEVL → Notifications → "Allow Notifications" must be on.

**2. Is your phone registered?**
Dashboard → **Table Editor** → `check_in_preferences`. Find your row. The
`expo_push_token` column must **not** be empty. If it is, redo Step 5.

**3. Did the database try to call the sender?**
Dashboard → **Database** → **Webhooks** → click `levl_push` → look at the log.
- No entries at all → the webhook isn't firing. Re-check Step 4.
- Entries with `401` → the secret doesn't match. Redo Step 3, making sure the
  header value in Step 4 is character-for-character identical.

**4. What did the sender say?**
Dashboard → **Edge Functions** → `push` → **Logs**. Each attempt prints a
result. Common ones:

| Message | What it means | Fix |
|---|---|---|
| `no-token` | That user's phone isn't registered | Redo Step 5 on their phone |
| `muted` | They switched that category off | Settings → notification switches |
| `device-not-registered` | App was uninstalled. Token auto-cleared | Reinstall, redo Step 5 |
| `unauthorised` | Secret mismatch | Redo Step 3 |

**5. Testing on a simulator?**
It will never work. Apple push requires a real device. Use your phone.

---

## Two honest limitations

**TestFlight and dev builds need push credentials.** Expo handles this when you
build with EAS, but if pushes work on Android and never on iOS, run:

```bash
npx eas credentials
```

and make sure a **Push Notification key** exists for iOS. Without it, Apple
silently drops everything.

**Streak and duel reminders are separate.** Those already work and need none of
this — they're scheduled on the phone itself, so they fire with no internet and
no server. This setup is only for things *other people* trigger: friend
requests, comments, reactions and duel results.

---

## What each piece does

| File | Job |
|---|---|
| `supabase/functions/push/index.ts` | Reads the recipient's token and preferences, then asks Apple/Google to deliver. Respects each notification switch, and clears tokens for uninstalled apps |
| `sql/2808_push_notifications.sql` | **Optional.** Does Step 4 in SQL instead of the dashboard, if you'd rather have it in version control |

Nothing about this changes the app itself, so it needs no App Store update.
