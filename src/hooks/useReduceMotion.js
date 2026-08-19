// ============================================================================
// LEVL — useReduceMotion
//
// One answer to "should this animate?", so screens stop each rolling their own.
//
// There were two hand-rolled copies before this (DualPhoto and FeedSkeleton) and
// both read the setting once at mount and never listened. Toggling Reduce Motion
// in Settings while LEVL was open therefore did nothing until the component
// remounted — which, for a feed skeleton, is never. This subscribes, the way
// haptics.js and ui.js's Reduce Transparency hook already do.
//
// It FAILS OPEN — every failure path leaves the value false, meaning "animate".
// A thrown API call should cost someone a nice transition, never freeze the UI
// into a state the rest of the screen is not expecting.
// ============================================================================

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;

    try {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((v) => { if (alive) setReduce(!!v); })
        .catch(() => {});
    } catch (e) { /* platform without the API */ }

    let sub = null;
    try {
      sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
        if (alive) setReduce(!!v);
      });
    } catch (e) { sub = null; }

    return () => {
      alive = false;
      try { if (sub) sub.remove(); } catch (e) {}
    };
  }, []);

  return reduce;
}

export default useReduceMotion;
