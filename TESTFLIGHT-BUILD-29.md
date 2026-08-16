# LEVL Build 29 → TestFlight

A complete walkthrough. It assumes you know nothing about the tools involved.

**Rough timing:** Part 1 ten minutes · Part 2 fifteen minutes · Part 3 ten
minutes of typing then half an hour of waiting · Part 4 ten minutes.

Do the parts in order. Inside each part, do the steps in order.

> **You will not need to open Xcode.** Apple's computers build the app for you
> in the cloud. Your Mac only sends the code and waits.

---

# PART 1 — Supabase (the database)

Supabase is where LEVL stores everything that isn't on your phone: accounts,
friends, duels, and now Check In photos and comments. Build 29 adds new tables,
and they have to exist before anyone uses the app.

**If you skip this,** the app installs perfectly and then fails the instant
someone tries to post a Check In.

### Step 1 — Run the five database files, in order

1. Go to **supabase.com** and sign in.
2. Click your LEVL project.
3. In the left sidebar, click **SQL Editor**.
4. Click **New query** (top of the screen).

Now, one file at a time:

- Open the file from your project folder (they're in the `sql/` folder)
- Select everything in it (**⌘A**) and copy (**⌘C**)
- Click into the big empty box in Supabase and paste (**⌘V**)
- Press the green **Run** button (bottom right, or **⌘↵**)
- Wait for it to finish before starting the next one

| Order | File to run |
|---|---|
| 1st | `sql/2801_social_core.sql` |
| 2nd | `sql/2802_check_ins.sql` |
| 3rd | `sql/2803_social_rls.sql` |
| 4th | `sql/2804_social_storage.sql` |
| 5th | `sql/2805_social_xp.sql` |

**What success looks like:** a green box saying **"Success. No rows returned"**.
That's correct — these files build things, they don't look things up.

**If you see a red error:** stop. Don't run the next one. Send me the message.
Nothing will be half-done — the database checks the whole file before it does
anything, so a failed file changes nothing at all.

### Step 2 — Check the photo storage was created

Still in Supabase, click **Storage** in the left sidebar.

You should see a bucket named **check-ins**, labelled **Private**.

If it's there, Part 1 worked. If it isn't, file number 4 didn't run — go back
and run `sql/2804_social_storage.sql` again.

---

# PART 2 — Apple's developer website

**This is the part that goes wrong most often.** Not because it's hard, but
because Apple's website hides things in unexpected places. Go slowly and it's
fine.

### First, what you're actually doing and why

Your app is about to become **two programs instead of one**.

There's LEVL itself. And there's a second, tiny program that draws the workout
timer on your Lock Screen and the little LEVL square on your Home Screen. iOS
treats that little program as genuinely separate — it runs on its own, even when
LEVL is closed. That's how it can keep counting your rest timer.

Because they're separate programs, three things are true:

1. **Each needs its own ID.** An "identifier" is just a unique name Apple uses
   to tell apps apart. LEVL already has one: `com.matteo.ascend`. The widget
   needs its own: `com.matteo.ascend.LevlWidgets`.
2. **They need a shared box to pass notes through.** Two separate programs can't
   normally see each other's data. Apple calls this shared box an **App Group**.
   It's how LEVL tells the widget "you're level 27, and you've checked in today".
3. **LEVL needs permission slips** for the new things it does: send
   notifications, and read Apple Health.

The next three steps set up exactly those three things.

> **A note on doing this by hand.** The build tool can sometimes create some of
> this for you automatically. Doing it yourself first costs fifteen minutes and
> means you'll never hit the confusing version of the failure. If you get to a
> step and find the thing already exists, that's fine — move on.

---

### Step 3 — Create the shared box (the App Group)

1. Go to **developer.apple.com/account** and sign in.
2. Click **Certificates, Identifiers & Profiles**. (If you don't see it, look
   for a section called "Program resources" on the main page.)
3. In the **left sidebar**, click **Identifiers**.

Now the bit people miss:

4. Look at the **top right** of the list. There's a dropdown menu that currently
   says **App IDs**. Click it and change it to **App Groups**.

   The list will go empty. That's expected — you haven't made one yet.

5. Click the blue **⊕** button next to the word "Identifiers" at the top left.
6. A list of types appears. Select **App Groups**. Click **Continue**.
7. Fill in two boxes:

   - **Description:** `LEVL App Group`
   - **Identifier:** `group.com.matteo.ascend`

8. Click **Continue**, then **Register**.

⚠️ **Type that identifier exactly.** Lowercase, dots where shown, starts with the
word `group.`. One wrong character and the widget will install fine but show
nothing forever — with no error message telling you why.

**Success looks like:** `group.com.matteo.ascend` now appears in the list.

---

### Step 4 — Give LEVL its new permissions

1. Still in **Identifiers**, change that top-right dropdown **back to App IDs**.
2. Find and click **com.matteo.ascend** in the list. (The Name column probably
   says "LEVL" or "ascend".)

You'll see a long list of capabilities with checkboxes. Scroll through and tick:

- ☑️ **Sign in with Apple** — *should already be ticked. Leave it alone.*
- ☑️ **Push Notifications**
- ☑️ **HealthKit**
- ☑️ **App Groups**

3. **For App Groups only**, there's an extra step. After ticking the box, a
   **Configure** button appears next to it. Click it. Tick
   `group.com.matteo.ascend` in the list that opens. Click **Continue**.

4. Click **Save** (top right).

5. A warning popup may appear saying this will affect existing provisioning
   profiles. Click **Confirm**. This is normal and expected — the build tool
   regenerates those automatically.

**Success looks like:** you're back on the identifier list, no error shown.

> **What did you just do?** You told Apple "this app is allowed to send
> notifications, read Health data, and use that shared box." Apple checks this
> list when your build is submitted. If the app's code asks for something that
> isn't ticked here, the build gets rejected at the last second with an error
> about "entitlements" — which is why this step exists.

---

### Step 5 — Create the widget's own ID

1. Still in **Identifiers** with the dropdown on **App IDs**, click the blue **⊕**
   again.
2. Select **App IDs**. Click **Continue**.
3. It asks what type. Select **App**. Click **Continue**.
4. Fill in:

   - **Description:** `LEVL Widgets`
   - **Bundle ID:** click the **Explicit** option (not Wildcard), then type:

     `com.matteo.ascend.LevlWidgets`

     ⚠️ Capital L, capital W, no spaces. It must match exactly.

5. Scroll down the capabilities list and tick:

   - ☑️ **App Groups** → click **Configure** → tick `group.com.matteo.ascend` →
     **Continue**

6. Click **Continue**, then **Register**.

**Success looks like:** `com.matteo.ascend.LevlWidgets` appears in your
identifier list alongside `com.matteo.ascend`.

> **You do not need to tick anything about Live Activities or Widgets.** There
> is no checkbox for those — they work automatically once the widget program
> exists. I've already set the required setting inside the app's code.

Part 2 done. Everything else happens on your Mac.

---

# PART 3 — Building the app

### What "building" means

Right now LEVL is a folder of text files. Building turns that into a real,
installable iPhone app. It happens on Apple's computers in the cloud — you send
the code up, wait, and get a finished app back. Your Mac just types the
instructions.

### Step 6 — Open Terminal and go to the project

**Terminal** is the app where you type commands instead of clicking. Open it:

- Press **⌘Space**, type `Terminal`, press **Return**.

You'll get a mostly-blank window with a blinking cursor. That's normal.

Now you need to tell it which folder to work in. The easy way:

1. Type `cd ` — that's the letters c, d, then **a space**. Don't press Return.
2. Find your LEVL project folder in Finder.
3. **Drag the folder onto the Terminal window.** The full path appears
   automatically.
4. *Now* press **Return**.

The cursor line should change to show you're inside the folder.

### Step 7 — Fix a Mac setting that breaks the build

Your Mac's Terminal isn't set to handle international characters, and one of the
build tools crashes on that with a baffling `Unicode Normalization` error. Fix it
permanently — copy this whole line, paste it, press Return:

```bash
echo 'export LANG=en_US.UTF-8' >> ~/.zshrc
```

Nothing visible happens. That's correct.

**Now close the Terminal window completely and open a new one**, then do Step 6
again (`cd `, drag folder, Return). The setting only applies to new windows.

### Step 8 — Connect the project to the build service

Copy, paste, Return:

```bash
npx eas-cli init
```

Answer its questions:

| It asks | You answer |
|---|---|
| Which account to use | Choose **bossman123** with the arrow keys, press Return |
| "Would you like to create a project?" | Type `y`, press Return |
| Confirms the project name | Press Return to accept |

**What this did:** it wrote an ID number into your app's settings file. Without
it, push notifications can never work — not now, not later. That's the only
reason this step exists.

### Step 9 — Start the build

Copy, paste, Return:

```bash
npx eas-cli build --profile production --platform ios
```

Now it asks several questions. Here's every one and what to say:

| It asks | You answer | Why |
|---|---|---|
| "Do you want to log in to your Apple account?" | **Yes** | It needs to fetch the settings you made in Part 2 |
| Your Apple ID and password | Type them | Same login as developer.apple.com |
| Two-factor code | Type the code from your phone | Normal Apple security |
| "Would you like to set up Push Notifications?" | **Yes** | |
| "Generate a new Apple Distribution Certificate?" | **Yes** | This is your signature. Letting it manage this is the easy path |
| "Generate a new Apple Provisioning Profile?" | **Yes** | |
| **Anything mentioning `com.matteo.ascend.LevlWidgets`** | **Yes to all of it** | This is the widget. Saying no here breaks the Lock Screen timer |

Then it uploads your code and starts building.

**This takes 20 to 40 minutes.** You can close Terminal — the build carries on
without you. Watch it at **expo.dev** → your project → **Builds**.

You'll get an email when it's finished.

---

### If the build fails

Don't panic, and don't re-read the whole log. Scroll to the very bottom and find
the **first line containing the word `error`**.

Almost every failure is one of these three, and all three are Part 2 mistakes:

| The error says something like | What went wrong | Fix |
|---|---|---|
| "No profiles for `com.matteo.ascend.LevlWidgets`" | Step 5 wasn't done, or the ID has a typo | Redo Step 5, check every capital letter |
| "doesn't support the HealthKit capability" | Step 4's HealthKit box wasn't ticked, or Save wasn't clicked | Redo Step 4 |
| "App Group ... not found" or "not available" | Step 3's identifier is misspelled | Check it's exactly `group.com.matteo.ascend` |

Fix it on developer.apple.com, then just run Step 9 again. You don't need to
redo Steps 6–8.

If it's none of those three, send me the error line.

---

# PART 4 — Getting it onto your phone

### Step 10 — Send the finished build to Apple

When the build is done, back in Terminal (in the project folder again):

```bash
npx eas-cli submit --profile production --platform ios
```

It shows a list of your builds. Pick the one you just made — it'll be at the top
— with the arrow keys, press Return.

This uploads to App Store Connect. Takes about five minutes.

### Step 11 — Wait for Apple to process it

1. Go to **appstoreconnect.apple.com** and sign in.
2. Click **My Apps**.
3. Click **LEVL**.
4. Click the **TestFlight** tab along the top.

Your build appears with a yellow **"Processing"** label next to it.

**This takes 10 to 30 minutes** and there is nothing you can do to speed it up.
Apple is scanning the app. Go make a coffee.

### Step 12 — Answer the one question Apple asks

When processing finishes, a small ⚠️ warning triangle appears next to the build.
Click it.

It asks about encryption. Answer:

> **"Does your app use encryption?"** → **No**

Then click through to save.

**Why "No" is correct:** the question is really asking whether you've written
your own custom encryption, which would need an export licence. LEVL only uses
the standard secure connection every app and website uses, which doesn't count.
This is already declared in the app's settings — you're just confirming it.

### Step 13 — Install it

1. On your iPhone, install the **TestFlight** app from the App Store if you
   don't have it.
2. Back in App Store Connect → TestFlight → in the left sidebar under **Internal
   Testing**, click your tester group (or create one and add yourself using your
   Apple ID email).
3. Add the new build to that group if it isn't there already.
4. Open **TestFlight** on your iPhone. LEVL appears. Tap **Install**.

Done. 🎉

---

# Before you let other people test it

Everything above gets LEVL onto **your own** phone. That's "Internal Testing" and
needs no review.

To send it to **other people** ("External Testing"), Apple reviews it first —
usually a day or two. They will check the following.

### You need a privacy policy — this is not optional

Any app that touches Apple Health **must** have one. Add it at App Store Connect
→ your app → **App Information** → **Privacy Policy URL**.

It needs to say, in plain language:

- Check In photographs are stored on Supabase's servers
- Comments and friend connections are stored
- **Apple Health data is only ever read to show you on your own phone. It is
  never uploaded anywhere and never shown to anyone else.** *(This is genuinely
  true of the app, and Apple does check it.)*
- Email addresses are used for signing in only and are never shown to other
  users

I have not written this for you — legal text has to come from you or a lawyer.

### Fill in the App Privacy questionnaire

App Store Connect → your app → **App Privacy** → **Edit**. Declare:

| Data type | What to say |
|---|---|
| Photos or Videos | Collected · Linked to the user · App Functionality |
| User Content | Collected · Linked to the user · App Functionality |
| Health & Fitness | Collected · **Not** linked to the user · App Functionality |
| Contact Info (email) | Collected · Linked to the user · App Functionality |
| Identifiers | Collected · Linked to the user · App Functionality |

### The four social-app rules

Apple requires all four of these for any app where users can post publicly.
**All four are already built.** You just need to know where they are in case a
reviewer asks:

| What Apple requires | Where it is in LEVL |
|---|---|
| Users can report content | Tap the **···** on any Check In → Report. Also long-press any comment. |
| Users can block people | Tap the **···** on any Check In → Block |
| Users can delete their own posts | Tap the **···** on your own Check In → Delete |
| Users can see who they've blocked | Tap your avatar (top right) → Privacy → Blocked people |

### What to write in "Notes for Review"

Reviewers get a blank app unless you give them an account. Paste this in, filling
in the first line:

```
Test account: [make one in the app, then put the email and password here]

The Check In feature uses the front and rear cameras together. Cameras
are unavailable in the iOS Simulator, so please review on a physical
device.

Apple Health is read only to display the user's own activity inside the
app. It is never uploaded to our servers and is never visible to other
users. It does not affect any score, level, rank or competitive result.
```

---

# Two things that aren't finished

Neither one blocks TestFlight. Both are worth knowing about.

### 1. Notifications work halfway

**Working now, nothing to set up:** the daily Check In reminder, and the rest
timer alert between sets. Your phone schedules those itself.

**Not working yet:** your phone buzzing when a *friend* reacts to your Check In,
comments on it, or challenges you to a duel. Those are caused by someone else's
phone, so they need a small piece of code running on a server.

They aren't invisible in the meantime — they already show up live inside the app
under the bell icon. They just don't light up your Lock Screen.

When you want that, it's one Supabase Edge Function. Ask me and I'll write it.

### 2. Nobody has used this on a real iPhone yet

Everything compiles and the app assembles correctly, but I have no way to tap
through it. When your TestFlight build arrives, check these six things **in this
order** — they're the ones most likely to be wrong:

1. Log a set. A **green bar** appears at the top of the screen. Lock your phone —
   the workout should appear on the Lock Screen. Tap it — it should open LEVL on
   the exact exercise you were doing.
2. Tap **Finish** on that green bar. The Lock Screen display should vanish.
3. Force-quit LEVL in the middle of a workout, then reopen it. There should be
   **no leftover workout stuck on your Lock Screen**.
4. Do a Check In. It should say **"Both cameras captured together"** on your
   iPhone.
5. Turn on Airplane Mode, then do a Check In. It should say it's saved and
   waiting. Turn the internet back on — it should post by itself, **once**.
6. Post a Check In, delete it, then post another. The second one should give
   you **0 XP**.

If any of those six misbehave, tell me the number and what happened instead.
