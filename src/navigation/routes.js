// ============================================================================
// LEVL — routes
//
// One table describing every place the app can be, and one parser turning a
// `levl://` URL into it. Notifications, the Dynamic Island, Home Screen Quick
// Actions, Siri and the widget all produce URLs, and they ALL come through
// here — so a notification can never open the home screen "close enough".
//
// The shape is deliberately flat: five persistent tabs, plus a stack of modal
// screens on top. Tabs keep their state forever; modals are the only thing that
// pushes and pops. That is the whole model, and it is why switching tabs never
// loses what you were doing.
// ============================================================================

export const TABS = [
  { key: 'train',   label: 'Train',   icon: 'train'   },
  { key: 'compete', label: 'Compete', icon: 'duel'    },
  { key: 'social',  label: 'Social',  icon: 'social'  },
  // The LABEL is what people read; the KEY is what deep links, widgets and
  // saved notification payloads already contain. Renaming the label to "Player"
  // must not rename the key, or every levl://hunter link ever emitted breaks.
  { key: 'hunter',  label: 'Player',  icon: 'profile' },
  { key: 'forge',   label: 'Forge',   icon: 'shop'    },
];
export const TAB_KEYS = TABS.map((t) => t.key);
export const DEFAULT_TAB = 'train';

// Modal screens that sit above the tabs.
export const MODALS = {
  CHECK_IN_CAMERA:  'check-in-camera',
  CHECK_IN_DETAIL:  'check-in-detail',
  CHECK_IN_ARCHIVE: 'check-in-archive',
  SETTINGS:         'settings',
  PROFILE:          'profile',
  FRIENDS:          'friends',
  ANALYTICS:        'analytics',
  PACKS:            'packs',
  SOCIAL_INTRO:     'social-intro',
};

// Sub-views inside a tab that a deep link may target.
// 'friends' joined these when it was promoted out of DuelTab's inner segment
// into a peer destination. The three original keys are untouched, so every
// existing levl://compete/... link still resolves.
export const COMPETE_VIEWS = ['duels', 'friends', 'ranks', 'leaderboard'];

/**
 * Parse a levl:// URL into { tab, view, modal, params }.
 * Returns null when the URL is not a LEVL route, so callers can ignore it
 * (password-reset links and duel invites are handled elsewhere).
 *
 * Understood:
 *   levl://train                      levl://compete/duels
 *   levl://social                     levl://compete/ranks
 *   levl://player (or hunter)         levl://compete/leaderboard
 *   levl://forge                      levl://forge/packs
 *   levl://check-in                   levl://check-in/{id}
 *   levl://comments/{checkInId}       levl://profile/{userId}
 *   levl://friends                    levl://settings
 *   levl://workout/{sessionId}        levl://duel/{duelId}
 */
export function parseRoute(url) {
  if (!url || typeof url !== 'string') return null;

  const withoutScheme = url
    .replace(/^levl:\/\//i, '')
    .replace(/^ascend:\/\//i, '')   // pre-rebrand links still work
    .replace(/^\/+/, '');
  if (!withoutScheme) return null;

  const [pathPart] = withoutScheme.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  if (!segments.length) return null;

  const [head, ...rest] = segments;

  switch (head) {
    case 'train':
      return { tab: 'train' };

    case 'compete':
    case 'duel':
    case 'duels': {
      // levl://duel/{id} targets a specific duel; levl://compete/{view} a view.
      if (head === 'duel' && rest[0]) {
        return { tab: 'compete', view: 'duels', params: { duelId: rest[0] } };
      }
      const view = COMPETE_VIEWS.includes(rest[0]) ? rest[0] : 'duels';
      return { tab: 'compete', view };
    }

    case 'social':
      return { tab: 'social' };

    // 'player' is the current name for this destination; 'hunter' is the key it
    // still travels under, and links using either word resolve to it.
    case 'player':
    case 'hunter':
      return { tab: 'hunter' };

    case 'forge':
    case 'shop':
      if (rest[0] === 'packs') return { tab: 'forge', modal: MODALS.PACKS };
      return { tab: 'forge', params: rest[0] ? { rewardId: rest[0] } : undefined };

    case 'packs':
      return { tab: 'forge', modal: MODALS.PACKS };

    case 'check-in':
      // No id: open the camera. With an id: open that Check In.
      if (!rest[0]) return { tab: 'social', modal: MODALS.CHECK_IN_CAMERA };
      return { tab: 'social', modal: MODALS.CHECK_IN_DETAIL, params: { checkInId: rest[0] } };

    case 'comments':
      if (!rest[0]) return { tab: 'social' };
      return {
        tab: 'social',
        modal: MODALS.CHECK_IN_DETAIL,
        params: { checkInId: rest[0], focusComments: true },
      };

    case 'archive':
      return { tab: 'social', modal: MODALS.CHECK_IN_ARCHIVE, params: { userId: rest[0] || null } };

    case 'friends':
    case 'requests':
      return {
        tab: 'social',
        modal: MODALS.FRIENDS,
        params: { focus: head === 'requests' ? 'requests' : 'friends' },
      };

    case 'profile':
      if (rest[0]) return { tab: 'social', modal: MODALS.PROFILE, params: { userId: rest[0] } };
      return { modal: MODALS.SETTINGS };

    case 'settings':
      return { modal: MODALS.SETTINGS, params: { section: rest[0] || null } };

    case 'analytics':
      return { tab: 'train', modal: MODALS.ANALYTICS };

    case 'workout':
      // From the Live Activity: back into the exact session in progress.
      return { tab: 'train', params: { sessionId: rest[0] || null, resumeWorkout: true } };

    default:
      return null;
  }
}

// The inverse, for share links and the widget.
export function buildRoute(route) {
  if (!route) return 'levl://train';
  if (route.modal === MODALS.CHECK_IN_DETAIL && route.params && route.params.checkInId) {
    return 'levl://check-in/' + route.params.checkInId;
  }
  if (route.modal === MODALS.CHECK_IN_CAMERA) return 'levl://check-in';
  if (route.tab === 'compete' && route.view) return 'levl://compete/' + route.view;
  return 'levl://' + (route.tab || 'train');
}
