# LEVL — What I Did, and What You Do Next

Written in plain English. No jargon without an explanation.

**Date:** 18 August 2026
**Where things stand:** 🟡 Nearly ready. Nothing dangerous is left in the app.
Four jobs remain and **all four are yours** — I physically cannot do them from
here.

---

# PART 1 — The short version

I audited the whole app, found some serious problems, fixed them, and tested
that the fixes actually work.

**The most important thing to understand:** before today, any person who signed
up for LEVL could read **every other user's entire workout history**. I proved
it — I logged in as one test account and pulled up 610 workout records belonging
to twenty other people. That is now fixed and I re-tested it: the same account
now sees zero records belonging to strangers.

**The second most important thing:** your push notifications had never worked.
Not once, ever. Not a single notification had been delivered since you built the
feature. That's fixed too.

**What's left for you:** make a new app build, flick two switches in Supabase,
put two web pages online, and fill in the App Store form. That's it.

---

# PART 2 — What I found, in plain English

## 🔴 The four serious problems (all now fixed)

### 1. Everyone could read everyone's workouts

**What was wrong:** Your database has rules about who can see what. You'd written
good rules — "you can see your own workouts, and your friends' workouts". But an
older, sloppier rule from months ago was still sitting there saying "anyone
logged in can see everything". When two rules disagree, the database uses the
**most permissive** one. So the good rules did nothing.

**Why it matters:** Your privacy policy promises "your training log is private".
It wasn't. If anyone had noticed, that's the story about LEVL, and you don't
recover from it.

**Proof it's fixed:** I logged in as a real test account and counted. Before:
610 workout records from 20 strangers. After: **0**. (That account still sees 191
records — those belong to its 2 actual friends, which is the feature working
correctly.)

### 2. Anyone could add themselves as your friend

**What was wrong:** To become someone's friend, the app checked "are you one of
the two people in this friendship?" — but never "did the other person agree?".
So anyone could declare themselves your friend without asking.

**Why it matters:** Friends can see your friends-only Check In **photographs**.
A stranger could have made themselves your friend and looked at your progress
photos. You'd have just seen a random person appear in your friends list.

**Proof it's fixed:** I tried it. The database now refuses: *"new row violates
row-level security policy"*.

### 3. Anyone at all could spam every LEVL user with notifications

**What was wrong:** The app carries a key so it can talk to your database. That
key is inside the app and anyone can extract it — that's normal and fine, because
the database rules are supposed to limit what it can do. But the rule for
notifications said "anyone can create a notification for anyone". No account
needed.

**Why it matters:** Once push notifications worked, anyone could have sent
unlimited fake notifications to every single LEVL user. Harassment, scam
messages, or just enough noise that everybody turns notifications off forever.

**Proof it's fixed:** I tried it without logging in at all. Refused: *"permission
denied for table notifications"*.

### 4. One heavy leg press would silently destroy someone's data

**What was wrong:** The app lets you log a leg press up to 700 kg. The database
refused anything over 400 kg. When they disagreed, the app tried to upload your
last 30 days of workouts **all in one go** — so one 450 kg leg press caused the
*entire batch* to be rejected. And it re-sent the same batch every time, so it
failed forever. And the error was hidden.

**Why it matters:** That person's workouts would stop reaching the cloud
permanently. Their duel scores would freeze. Their leaderboard position would
freeze. And nothing anywhere would say why.

**Proof it's fixed:** The database limit is now 720 kg, and the app uploads in
small batches so one bad row can only ever cost you that one row — and it now
tells you instead of hiding it.

---

## 🎉 Push notifications now actually work

Your notification system was pointed at **the wrong web address**. It was sending
every notification to the Supabase *website* — the page you look at in your
browser — instead of to your notification program.

Every single attempt got the reply "405: you can't do that here". Three attempts
recorded, three failures, **zero notifications ever delivered**.

I pointed it at the right address and adjusted a security setting that was also
blocking it. Then I sent a test notification and got back:

> `{"ok":true, "handled":1, "results":[{"kind":"reward","skipped":"no-token"}]}`

That's the first success this project has ever recorded. ("skipped: no-token"
means it worked perfectly and correctly noticed that test user has no phone
registered — I chose a user with no phone on purpose so nobody's phone actually
buzzed.)

⚠️ **One part is still untested:** the very last hop, from the notification
service to an actual iPhone. That needs a real phone and a real build. It's in
your test list below.

---

## 🛡️ Content safety (needed for App Store approval)

Apple requires apps where users post things to have **four** safety features.
You had three of them, and they were good:

| Apple requires | You had it? |
|---|---|
| A way to report bad content | ✅ Yes |
| A way to block people | ✅ Yes |
| A published contact address | ✅ Yes |
| **A filter that catches bad content** | ❌ **Nothing at all** |

The missing one is the one Apple lists first, and LEVL is an app where people
post photos of their bodies. This was, in my judgement, the single most likely
reason you'd have been rejected.

**What I added:**
- A list of 122 banned words, checked against every comment, caption, username
  and display name. You can add or remove words yourself in Supabase without
  needing a new app build.
- If **three different people** report the same post, it hides itself
  automatically — even while you're asleep.

I was careful about a classic mistake here. A naive filter that just looks for
"rape" inside text would block someone writing **"I ate grapes"**. Mine matches
whole words only, and also catches people swapping letters for numbers
(`p0rn` → `porn`). I tested 13 cases including that exact grapes example — all
correct.

---

## 🔧 Other things I fixed

| What | Why it mattered |
|---|---|
| **Duel results could be faked** | Either player could simply declare themselves the winner and collect the reward. Now the server works out the winner from actual logged workouts. |
| **Deleting a workout didn't really delete it** | If you logged 300 kg by mistake and deleted it, it stayed in the cloud forever — sitting at the top of the leaderboard you'd already corrected it out of. |
| **Rank collapsed if you took time off** | Two weeks off with flu took you from Grandmaster to Bronze instantly, with nothing explaining it. Now your rank is held for 14 days, then fades over another 14 — and the app tells you it's happening and how long you have. |
| **The startup screen took 3.5 seconds** | Every single time you opened the app, even standing at a rack between sets. Now 1.4 seconds. |
| **Signing up asked for 6 fields before showing you anything** | Weight, height, age, sex, activity, experience — all before you saw a single thing the app does. Now you log your first set, see the XP land, *then* it asks. You can skip it. |
| **Post owners could rewrite your comments** | They could change what you wrote and leave your name on it. Now they can only hide it. |
| **Anyone could steal duel invite codes** | Every invite code in the system was readable by every user. Now only yours. |
| **Password minimum was 6 characters** | Now 8. |
| **iPad** | You were telling Apple the app works on iPad. It doesn't — every screen is designed for a phone. Now it's iPhone-only, which removes a likely rejection. |
| **A fake microphone permission** | The app asked for microphone access with Apple's default placeholder text, for a feature you don't have. Apple rejects that. Removed. |
| **The leaderboard was full of dead accounts** | Now only shows people who've actually trained recently, and opens on your friends if you have any. |
| **"Export my data" was hidden** | Your privacy policy promises it. It existed, but only on the logged-out screen where a logged-in user could never find it. Now it's in Settings. |
| **The intro never mentioned your best idea** | The last intro slide was about cosmetic rewards. It's now about Verified Sessions — the one thing no competitor can copy. |

---

## 🧪 How I checked my own work

- **Every fix was tested by re-running the original attack.** I didn't just
  write the fix and assume.
- **Every database change was rehearsed first** on a copy that I threw away, so
  nothing was applied blind.
- **Your test suite**: 48 engine checks (I added 14), 216 screen checks, 191
  interaction checks. All passing.
- **I was wrong five times during this audit** and corrected each in the
  documents: three features I said were missing were already built, and two
  problems I flagged were already handled correctly. Where the audit is wrong, I
  left a note saying so rather than quietly deleting it.

---

# PART 3 — What YOU need to do

Four jobs. Do them in this order.

---

## ✅ JOB 1 — Put your Privacy Policy and Terms online (do this FIRST)

> **Correction to an earlier version of this document.** This used to be Job 3,
> after the build. That was wrong. Your privacy policy address is baked *into*
> the app when it is built, so building before this step means building twice.
> Sorry — my mistake, not yours.

**Why this matters:** Apple requires a working link to your privacy policy, and
they check it. Right now those links point at **claude.ai** — my servers, not
yours. That's fragile and it looks odd on an App Store listing.

**A second reason:** your code currently exists **only on your laptop**. There is
no backup anywhere. If the laptop dies, LEVL is gone. This job fixes both
problems at once.

### Step by step

1. Go to **github.com** and sign in (create a free account if you don't have one)
2. Click the **+** in the top right → **New repository**
3. Name it `levl`
4. Choose **Public** *(see the note below before deciding)*
5. **Don't** tick any of the "add a README" boxes
6. Click **Create repository**
7. GitHub shows you a page with commands. Come back to Terminal and run:

```bash
cd ~/LEVL
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/levl.git
```

*(replace `YOUR-USERNAME` with your actual GitHub username)*

```bash
git push -u origin main
```

8. Back on GitHub: your repo → **Settings** → **Pages** (left sidebar)
9. Under "Branch", choose **main** and the **/docs** folder → **Save**
10. Wait about 2 minutes, then your pages are live at:
    - `https://YOUR-USERNAME.github.io/levl/privacy.html`
    - `https://YOUR-USERNAME.github.io/levl/terms.html`
11. **Send me those two links** and I'll put them into the app.

### 📌 Public or private? Your call.

- **Public** = anyone can read your source code. Free GitHub Pages hosting.
- **Private** = only you can see it. But **GitHub Pages needs a paid plan** for
  private repos.

If you don't want your source public, tell me and I'll set it up differently —
a second, tiny public repo containing *only* the two legal pages, with your
actual code staying private. That's about 5 extra minutes.

**Either way, push the code somewhere today.** The backup matters more than the
hosting.

---

## ✅ JOB 2 — Supabase settings (5 minutes)

Go to **supabase.com** and open your LEVL project.

### 2a. Leaked-password protection — ❌ not available, and already handled

**If you tried this and got "available on Pro Plans and up" — that's expected.**
Supabase gates that feature behind a paid plan. You did nothing wrong.

**You don't need it.** I've built the same protection into the app itself, for
free. When someone signs up or changes their password, LEVL now checks it
against the Have I Been Pwned database of passwords exposed in real data
breaches, and refuses the ones that appear there.

*Your password is never sent anywhere.* The app hashes it, sends only the first
5 characters of that hash, gets back several hundred possible matches, and
compares them on your phone. The server can't tell which one you asked about,
and never sees the password.

I tested it live. `Password1!` — which passes every "use a capital, a number and
a symbol" rule you've ever seen — has been exposed **584,516 times** and is now
rejected. A random password passes.

Supabase's dashboard will still warn you this feature is off. **Ignore it** —
you're covered a different way.

**Still worth doing while you're in there:** find **Minimum password length** and
set it to **8**, so the server agrees with the app. That part is free.

### 2b. Change the push notification password
1. Left sidebar → **Edge Functions** → click **push** → **Secrets** (or
   **Settings**)
2. Find `PUSH_HOOK_SECRET`. Replace its value with a new random string — mash the
   keyboard, 40+ characters, letters and numbers.
3. **Copy that exact same value.**
4. Left sidebar → **Database** → **Webhooks** → click **levl_push** → find the
   header called `x-levl-secret` → paste the same value there.
5. Save both.

⚠️ **Both must match exactly.** If you change one and not the other,
notifications stop working. That's why I didn't do this myself — I could only
reach one of the two places.

*This isn't urgent. It's a tidy-up. Anyone who could read the old value already
has full access to your database.*

---

## ✅ JOB 3 — Make a new app build

**Do this only after Jobs 1 and 2**, so the new policy links are inside the
binary.

**Why:** The database is now stricter than the app currently on your phone. The
version your testers have will fail when they try to accept a friend request or
answer a duel. The fixed app code is ready and waiting — it just needs building.

You needed a new build anyway; several other changes require one.

**What to do** — open Terminal, and run these one at a time:

```bash
cd ~/LEVL
```

```bash
git checkout main
```

```bash
git merge prelaunch-hardening
```

```bash
eas build --platform ios --profile production
```

The build takes roughly 15–25 minutes. When it finishes, submit it to TestFlight
as you normally do.

**Until you do this, tell your testers:** adding friends and accepting duels
won't work on the current version.

---

## ✅ JOB 4 — Fill in App Store Connect

Go to **appstoreconnect.apple.com**.

| Field | What to put |
|---|---|
| Privacy Policy URL | The GitHub Pages link from Job 3 |
| Support URL / email | `Levlup18@gmail.com` |
| Age Rating | **12+** minimum (because users post content) |
| App Privacy | Tick: Email, User Content, Health & Fitness, Identifiers, Usage Data, Diagnostics. All "linked to the user". **Nothing** used for tracking. |

### ⚠️ The one people forget

**Create a demo account for the Apple reviewer**, and put its email and password
in the "App Review Information" notes box.

Seed it with a few friends, a couple of Check Ins, and one active duel. A
reviewer who signs up fresh sees three empty tabs and cannot tell what your app
does. That alone gets apps rejected.

Also write a sentence in the notes explaining what a Check In and a Verified
Session are.

---

# PART 4 — Before you submit: test on your phone

Once your new build is on TestFlight:

1. **Delete LEVL from your phone completely.** Reinstall from TestFlight.
2. Create a brand-new account. Time how long until you log your first set —
   it should be well under a minute now.
3. Check the profile questions appear **after** your first set, and that you can
   skip them.
4. Force-close the app. Reopen. **You should still be logged in.**
5. Log a **450 kg leg press**. Close and reopen the app. It must still be there.
   *(This is the exact thing that used to silently break everything.)*
6. Turn on **Airplane Mode**. Log three sets. It should all work. Turn wifi back
   on and check they sync.
7. **Get a friend to install it too.** Send a friend request, accept it, comment
   on each other's Check In.
8. **Fully close the app** (swipe it away) and have them comment again.
   **A notification should appear on your lock screen.** ← this is the one part
   I couldn't test.
9. Tap that notification. It should open straight to the comment.
10. On a spare throwaway account: Settings → Delete account → type DELETE.
    Confirm you can't log back in.

The full detailed test list is in **LEVL-PRE-LAUNCH-AUDIT.md**, section R.

---

# PART 5 — Honest about what I couldn't check

I want to be clear about the limits of what I've verified.

| Thing | Status |
|---|---|
| Database security | ✅ Tested by re-running the actual attacks |
| Push notification plumbing | ✅ Tested up to the notification service |
| **Push arriving on a real iPhone** | ❌ **Needs your phone** |
| The app running on a device at all | ❌ Needs a build — I can't run iOS here |
| How the new screens look | ❌ Needs your eyes |
| App Store Connect | ❌ No access |
| Whether Apple approves | ❌ Nobody can promise this |

I also want to flag one thing I did **not** do: I didn't add crash reporting
(Sentry) or over-the-air updates. Both need changes to the app's native
foundations, and getting those wrong days before submission could break your
build entirely. They're worth doing in your *next* release, not this one. Right
now, if a user hits a crash, you won't know unless they email you — and any fix
needs a full App Store review.

---

# Quick reference

| Order | Job | Time | Blocking submission? |
|---|---|---|---|
| 1st | GitHub + legal pages | 20 min | **Yes** — Apple checks the privacy link, and the link must be in the build |
| 2nd | Supabase settings | 5 min | No — done, apart from the minimum-length setting |
| 3rd | New app build | 25 min | **Yes** |
| 4th | App Store Connect | 30 min | **Yes** |
| 5th | Test on your phone | 45 min | **Yes** — please don't skip it |

⚠️ **The order matters.** The privacy policy address is compiled into the app, so
GitHub must come before the build or you will build twice.

**Documents in this repo:**
- `LEVL-NEXT-STEPS.md` ← you are here
- `LEVL-LAUNCH-CHECKLIST.md` — the tick-list version
- `LEVL-PRE-LAUNCH-AUDIT.md` — the full technical audit

---

# APPENDIX — Working with pull requests

`gh` (the GitHub command-line tool) is installed. One thing left before it works:

```bash
gh auth login
```

Answer: **GitHub.com** → **HTTPS** → **Y** to authenticate git → **Login with a
web browser**. It shows you an 8-character code, you paste it into the browser
page it opens. Done once, forever.

While you're there, fix how your commits are labelled. Right now they say
`matteo@Mac.lan`, which is a name your Mac invented — GitHub can't link those
commits to your account, so they show as an unknown author. Get your private
GitHub address from **github.com → Settings → Emails** (it looks like
`1234567+j9dyc6wfw8-code@users.noreply.github.com`), then:

```bash
git config --global user.email "PASTE-THAT-HERE"
```

Old commits keep the old address; new ones will be right.

## The routine, for any future change

Four commands. The first one is the one that matters — never work directly on
`main` again.

```bash
git checkout -b what-im-changing
```

...make the changes, then:

```bash
git add -A && git commit -m "what changed and why"
```

```bash
git push
```

```bash
gh pr create --fill
```

`git push` works without extra arguments now — I've set `push.autoSetupRemote`,
which saves you the `-u origin branch-name` incantation every time.

To merge it once you're happy:

```bash
gh pr merge --squash --delete-branch
```

## Why bother, when it's just you?

Three reasons that apply even to a solo project:

1. **`main` always works.** Half-finished work lives on a branch, so the thing
   you'd ship in an emergency is never broken.
2. **Your tests run before you merge, not after.** GitHub runs the 48/216/191
   checks on every push. A PR shows you a green tick or a red cross *before* the
   change reaches `main`.
3. **You get a written record.** The PR page holds the reasoning next to the
   diff. In four months, when you're wondering why rank protection decays over
   14 days, that's where the answer is.

## About this session's work

It's already on `main` and pushed, so there is no PR for it — a PR needs a
branch holding changes `main` doesn't have yet, and `main` has them all. The
history is at
**github.com/j9dyc6wfw8-code/LEVL/commits/main**, and each commit message
explains its own reasoning.

Next change onwards, use the routine above.
