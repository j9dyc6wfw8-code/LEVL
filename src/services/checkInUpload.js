// ============================================================================
// LEVL — checkInUpload
//
// Getting a Check In from the camera to the feed, over gym wifi.
//
// THE PROBLEM THIS SOLVES
// Gyms have terrible signal. A Check In that silently fails, or that posts
// twice, or that eats the photograph, is worse than no feature. So the whole
// flow is modelled as a small resumable state machine persisted to disk:
//
//   captured → compressed → front-uploaded → rear-uploaded → posted → awarded
//
// Every stage is idempotent and the pending job survives the app being killed.
// Retrying picks up where it stopped rather than starting again.
//
// WHY IT CANNOT DOUBLE-POST
//   • The storage path is generated ONCE, when the job is created, so a retried
//     upload overwrites the same object instead of adding a second one.
//   • `check_ins` has UNIQUE (user_id, local_date); a retry after a response
//     that was lost in transit comes back as "here is your existing row".
//   • XP comes from a server ledger keyed on (user, date, kind), so it is paid
//     at most once per day no matter how many times this runs.
//
// PRIVACY
// Both photographs are re-encoded before they leave the device. Re-encoding
// drops all EXIF — including GPS, which AVFoundation never wrote in the first
// place, and camera/serial metadata, which it does. Nothing about where a
// person trains is uploaded.
// ============================================================================

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Directory, Paths } from 'expo-file-system';
import { stGet, stSet, stDel } from './platform';
import * as checkIns from './supabase/checkInService';
import { cachedUserId } from './supabase/authService';

const PENDING_KEY = 'levl.checkIn.pending.v1';

// 1440px on the long edge: a Pro Max is 1290pt wide at 3x, so this is sharp
// edge to edge while landing around 400-700 KB per photo. Bigger would be
// invisible on a phone and painful on gym wifi.
const MAX_EDGE = 1440;
const QUALITY = 0.82;

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/* ---------------------------------------------------------------------------
 * Local storage for the captured photographs
 *
 * The camera writes to the temp directory, which iOS may clear at any moment.
 * A pending Check In has to survive that, so the compressed copies are moved
 * into the document directory and only deleted once the post succeeds.
 * ------------------------------------------------------------------------ */

function pendingDir() {
  const dir = new Directory(Paths.document, 'levl-check-ins');
  try { if (!dir.exists) dir.create({ intermediates: true }); } catch (e) {}
  return dir;
}

async function compressTo(sourceUri, destName) {
  const context = ImageManipulator.manipulate(sourceUri);
  context.resize({ width: MAX_EDGE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

  // saveAsync writes to the cache directory, which is evictable. Move it
  // somewhere the system will not reclaim while the upload is pending.
  const dest = new File(pendingDir(), destName);
  try { if (dest.exists) dest.delete(); } catch (e) {}
  try {
    new File(saved.uri).move(dest);
  } catch (e) {
    // move can fail across volumes; a copy is an acceptable fallback.
    new File(saved.uri).copy(dest);
  }
  return dest.uri;
}

function safeDelete(uri) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch (e) { /* best effort */ }
}

/* ---------------------------------------------------------------------------
 * The pending job
 * ------------------------------------------------------------------------ */

export async function readPending() {
  try {
    const raw = await stGet(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function writePending(job) {
  try { await stSet(PENDING_KEY, JSON.stringify(job)); } catch (e) {}
}

async function clearPending(job) {
  if (job) {
    safeDelete(job.frontUri);
    safeDelete(job.rearUri);
  }
  try { await stDel(PENDING_KEY); } catch (e) {}
}

// Throw the pending job away at the user's request (they retook, or gave up).
export async function discardPending() {
  const job = await readPending();
  await clearPending(job);
  return true;
}

/**
 * Compress the capture and record the intent to post. Returns the job.
 *
 * This happens BEFORE any network call, so the photographs are safe on disk
 * from the moment the shutter fires. If the upload never succeeds, the job is
 * still here on next launch and the app can offer to retry.
 */
export async function createPending({
  frontUri,
  rearUri,
  localDate,
  timezone,
  visibility,
  primaryPhoto,
  workoutSessionId,
  altText,
  caption,
  windowEndMinute,
  notifiedAt,
  simultaneous,
  gapMs,
}) {
  const userId = await cachedUserId();
  if (!userId) throw new Error('Sign in to Check In.');

  // Generated once. Retrying reuses it, which is what makes a repeated upload
  // overwrite rather than duplicate.
  const groupId = uid();

  const [localFront, localRear] = await Promise.all([
    compressTo(frontUri, `${groupId}-front.jpg`),
    compressTo(rearUri, `${groupId}-rear.jpg`),
  ]);

  const job = {
    version: 1,
    groupId,
    userId,
    localDate,
    timezone: timezone || 'UTC',
    visibility: visibility === 'public' ? 'public' : 'friends',
    primaryPhoto: primaryPhoto === 'front' ? 'front' : 'rear',
    workoutSessionId: workoutSessionId || null,
    altText: altText || null,
    caption: caption || null,
    windowEndMinute: windowEndMinute == null ? null : windowEndMinute,
    notifiedAt: notifiedAt || null,
    simultaneous: !!simultaneous,
    gapMs: gapMs || 0,
    frontUri: localFront,
    rearUri: localRear,
    frontPath: checkIns.buildPhotoPath(userId, localDate, groupId, 'front'),
    rearPath: checkIns.buildPhotoPath(userId, localDate, groupId, 'rear'),
    stage: 'compressed',
    checkInId: null,
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  };
  await writePending(job);
  return job;
}

// Let the composer change its mind before the upload goes through.
export async function updatePending(patch) {
  const job = await readPending();
  if (!job) return null;
  const next = { ...job, ...patch };
  await writePending(next);
  return next;
}

async function bytesOf(uri) {
  const file = new File(uri);
  if (!file.exists) throw new Error('The photo is no longer on this device.');
  return await file.bytes();
}

/**
 * Push the pending job as far as it will go.
 *
 * Returns { status, checkIn, xp, error }:
 *   'idle'     nothing pending
 *   'done'     posted (and XP settled)
 *   'pending'  a stage failed; the job is preserved for the next attempt
 */
export async function flushPending(onStage) {
  let job = await readPending();
  if (!job) return { status: 'idle' };

  const stage = (name) => {
    job.stage = name;
    if (onStage) { try { onStage(name, job); } catch (e) {} }
    return writePending(job);
  };

  const fail = async (message) => {
    job.attempts = (job.attempts || 0) + 1;
    job.lastError = message || 'Upload failed';
    await writePending(job);
    return { status: 'pending', error: job.lastError, job };
  };

  try {
    // The signed-in account must still be the one that captured this. Switching
    // accounts with a pending Check In would otherwise post it as the new user.
    const userId = await cachedUserId();
    if (!userId) return await fail('Sign in to finish posting.');
    if (userId !== job.userId) {
      await clearPending(job);
      return { status: 'idle' };
    }

    if (job.stage === 'compressed') {
      const body = await bytesOf(job.frontUri);
      const res = await checkIns.uploadPhoto(job.frontPath, body, 'image/jpeg');
      if (res.error) return await fail(res.error.message);
      await stage('front-uploaded');
    }

    if (job.stage === 'front-uploaded') {
      const body = await bytesOf(job.rearUri);
      const res = await checkIns.uploadPhoto(job.rearPath, body, 'image/jpeg');
      if (res.error) return await fail(res.error.message);
      await stage('rear-uploaded');
    }

    if (job.stage === 'rear-uploaded') {
      const res = await checkIns.createCheckIn({
        localDate: job.localDate,
        timezone: job.timezone,
        postedAt: job.createdAt,
        windowEndMinute: job.windowEndMinute,
        notifiedAt: job.notifiedAt,
        visibility: job.visibility,
        frontPath: job.frontPath,
        rearPath: job.rearPath,
        primaryPhoto: job.primaryPhoto,
        altText: job.altText,
        caption: job.caption,
        workoutSessionId: job.workoutSessionId,
      });
      if (res.error) {
        // A workout that failed the server's ownership or date check should not
        // block the Check In itself — drop the attachment and post it plain.
        const msg = String(res.error.message || '');
        if (job.workoutSessionId && /workout/i.test(msg)) {
          job.workoutSessionId = null;
          await writePending(job);
          return await fail('That workout could not be attached — posting without it.');
        }
        return await fail(msg);
      }
      job.checkInId = res.data && res.data.id;
      job.verified = !!(res.data && res.data.check_in_type === 'verified');
      await stage('posted');
    }

    if (job.stage === 'posted') {
      // The server decides whether anything is owed and how much. A repeat call
      // returns 0, which is exactly what makes delete-and-repost worthless.
      const res = await checkIns.awardCheckInXP(job.localDate, !!job.verified);
      job.xpGranted = (res.data && res.data.granted) || 0;
      job.xpDetail = (res.data && res.data.detail) || [];
      await stage('awarded');
    }

    const finished = { ...job };
    await clearPending(job);
    return {
      status: 'done',
      checkInId: finished.checkInId,
      verified: !!finished.verified,
      xp: finished.xpGranted || 0,
      xpDetail: finished.xpDetail || [],
      job: finished,
    };
  } catch (e) {
    return await fail(String((e && e.message) || e));
  }
}

/**
 * Settle XP for a Check In that already exists — used when a workout is
 * attached AFTER posting and turns it into a Verified Session.
 * Returns only what was newly granted, which for the daily award is always 0
 * the second time.
 */
export async function settleXP(localDate, verified) {
  const res = await checkIns.awardCheckInXP(localDate, !!verified);
  if (res.error) return { granted: 0, error: res.error };
  return { granted: (res.data && res.data.granted) || 0, detail: (res.data && res.data.detail) || [] };
}

export default {
  createPending,
  updatePending,
  readPending,
  discardPending,
  flushPending,
  settleXP,
};
