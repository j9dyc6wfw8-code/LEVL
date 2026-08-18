// ============================================================================
// LEVL — useAppConfig
//
// Reads the single app_config row at launch, so a subsystem can be switched off
// without shipping a build.
//
// The DEFAULTS ARE ALL ON, and a failed fetch keeps them on. A kill switch that
// fails closed would take the app down every time the network hiccups, which is
// a worse outage than the one it was meant to prevent.
// ============================================================================

import { useEffect, useState } from 'react';
import { supabase, isConfigured } from '../services/supabase/client';

const DEFAULTS = {
  social_enabled: true,
  duels_enabled: true,
  packs_enabled: true,
  check_ins_enabled: true,
  leaderboard_enabled: true,
  notice_text: null,
  notice_level: null,
  min_build: 0,
};

export function useAppConfig() {
  const [config, setConfig] = useState(DEFAULTS);

  useEffect(() => {
    if (!isConfigured) return undefined;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_config').select('*').eq('id', 1).maybeSingle();
        if (!alive || error || !data) return;
        setConfig({ ...DEFAULTS, ...data });
      } catch (e) {
        // Stay on the defaults — everything enabled.
      }
    })();
    return () => { alive = false; };
  }, []);

  return config;
}

export default useAppConfig;
