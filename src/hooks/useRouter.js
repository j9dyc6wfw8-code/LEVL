// ============================================================================
// LEVL — useRouter
//
// The app's navigation, in one hook.
//
// WHY NOT REACT NAVIGATION
// The five destinations are persistent and never unmount — that is the single
// most important property of this app's navigation, because a half-entered set
// on Train must survive a trip to Social and back. A stack navigator would
// remount screens on every transition and quietly lose that state, and adopting
// one would mean rewriting every existing screen's lifecycle assumptions for no
// user-visible gain. So the tabs stay resident and a small modal stack sits on
// top. That is genuinely all this app's navigation needs.
//
// Everything that can navigate — taps, notifications, the Dynamic Island, Quick
// Actions, Siri, the widget — funnels through `open(route)`, so there is one
// code path to reason about and one place that scroll position resets.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, AppState } from 'react-native';
import { DEFAULT_TAB, TAB_KEYS, parseRoute } from '../navigation/routes';
import LiveActivity from '../../modules/levl-live-activity';
import haptics from '../services/haptics';

export function useRouter({ onExternalUrl, ready } = {}) {
  const [tab, setTab] = useState(DEFAULT_TAB);
  const [competeView, setCompeteView] = useState('duels');
  const [modals, setModals] = useState([]);          // stack of { key, params }
  const [tabParams, setTabParams] = useState({});    // one-shot params per tab

  const scrollRefs = useRef({});
  const readyRef = useRef(!!ready);
  const queuedRef = useRef(null);                    // route arriving before boot

  useEffect(() => { readyRef.current = !!ready; }, [ready]);

  const registerScroll = useCallback((key, ref) => {
    scrollRefs.current[key] = ref;
  }, []);

  const resetScroll = useCallback((key) => {
    const ref = scrollRefs.current[key];
    if (!ref || !ref.current) return;
    try { ref.current.scrollTo({ y: 0, animated: false }); } catch (e) {}
  }, []);

  /* ----------------------------- navigation ----------------------------- */

  const open = useCallback((route) => {
    if (!route) return;

    // Arrived before the app finished booting (cold launch from a
    // notification). Hold it and replay once we're in.
    if (!readyRef.current) { queuedRef.current = route; return; }

    if (route.tab && TAB_KEYS.includes(route.tab)) {
      setTab((current) => {
        if (current !== route.tab) resetScroll(route.tab);
        return route.tab;
      });
    }
    if (route.view) setCompeteView(route.view);
    if (route.params) {
      const key = route.tab || tab;
      setTabParams((p) => ({ ...p, [key]: { ...route.params, at: Date.now() } }));
    }
    if (route.modal) {
      setModals((stack) => {
        // Re-opening the modal that is already on top is a no-op rather than a
        // second copy of the same screen.
        const top = stack[stack.length - 1];
        if (top && top.key === route.modal) {
          return [...stack.slice(0, -1), { key: route.modal, params: route.params || {} }];
        }
        return [...stack, { key: route.modal, params: route.params || {} }];
      });
    } else if (route.tab) {
      // A plain tab destination dismisses whatever was covering it, so you can
      // never land on a tab with a sheet from somewhere else still on top.
      setModals([]);
    }
  }, [resetScroll, tab]);

  const goTab = useCallback((key) => {
    if (!TAB_KEYS.includes(key)) return;
    haptics.selection();
    setModals([]);
    setTab((current) => {
      if (current !== key) resetScroll(key);
      return key;
    });
  }, [resetScroll]);

  const pushModal = useCallback((key, params) => {
    setModals((stack) => [...stack, { key, params: params || {} }]);
  }, []);

  const popModal = useCallback(() => {
    setModals((stack) => stack.slice(0, -1));
  }, []);

  const closeModals = useCallback(() => setModals([]), []);

  // Read a tab's one-shot params and clear them, so a deep link acts once
  // rather than re-firing on every render of that tab.
  const consumeTabParams = useCallback((key) => {
    const value = tabParams[key];
    if (!value) return null;
    setTabParams((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });
    return value;
  }, [tabParams]);

  const activeModal = modals.length ? modals[modals.length - 1] : null;

  /* --------------------------- external entry --------------------------- */

  const handleUrl = useCallback((url) => {
    if (!url) return;
    const route = parseRoute(url);
    if (route) { open(route); return; }
    // Not one of ours — password reset, duel invite. Hand it back.
    if (onExternalUrl) onExternalUrl(url);
  }, [open, onExternalUrl]);

  useEffect(() => {
    let alive = true;
    Linking.getInitialURL()
      .then((url) => { if (alive && url) handleUrl(url); })
      .catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handleUrl(e && e.url));
    return () => { alive = false; try { sub.remove(); } catch (e) {} };
  }, [handleUrl]);

  // Quick Actions and Siri don't arrive as URLs — iOS hands them to the app
  // delegate, and the native module parks them until JS is ready.
  useEffect(() => {
    const drain = () => {
      const route = LiveActivity.takePendingRoute();
      if (route) handleUrl(route);
    };
    drain();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') drain();
    });
    return () => { try { sub.remove(); } catch (e) {} };
  }, [handleUrl]);

  // Replay whatever arrived during boot.
  useEffect(() => {
    if (!ready || !queuedRef.current) return;
    const route = queuedRef.current;
    queuedRef.current = null;
    open(route);
  }, [ready, open]);

  return {
    tab,
    competeView,
    setCompeteView,
    activeModal,
    modalDepth: modals.length,
    open,
    goTab,
    pushModal,
    popModal,
    closeModals,
    registerScroll,
    consumeTabParams,
    handleUrl,
  };
}

export default useRouter;
