
// Card display, bot names, team colours, chat limits and the z-index scale all
// come from the shared skin. They are re-exported here so the rest of this
// codebase carries on importing them from './constants'.
export {
  getRankLabel,
  SUIT_SYMBOLS, SUIT_COLORS,
  BOT_NAMES, pickBotNames,
  TEAM_BADGE_CLASSES, TEAM_LABELS, TEAM_TEXT_COLORS,
  MAX_LOG_ENTRIES, CHAT_MAX_LEN, CHAT_MAX_HISTORY,
  PEER_ID_DISPLAY_LENGTH, EMPTY_SLOT_NAME,
  Z_CARD_SELECTED, Z_HUD, Z_ACTION_BAR, Z_TURN_BADGE, Z_OVERLAY, Z_MODAL,
} from '@laurelwood/card-class';

// ============================================================
// Card values
// ============================================================
// Not display data: `value` is what a card is worth when building and
// capturing, which is the heart of Seep's rules. The package only knows how to
// label a rank, not what it is worth here.

export const CARD_RANKS = [
  { rank: 1, label: 'A', value: 1 },
  { rank: 2, label: '2', value: 2 },
  { rank: 3, label: '3', value: 3 },
  { rank: 4, label: '4', value: 4 },
  { rank: 5, label: '5', value: 5 },
  { rank: 6, label: '6', value: 6 },
  { rank: 7, label: '7', value: 7 },
  { rank: 8, label: '8', value: 8 },
  { rank: 9, label: '9', value: 9 },
  { rank: 10, label: '10', value: 10 },
  { rank: 11, label: 'J', value: 11 },
  { rank: 12, label: 'Q', value: 12 },
  { rank: 13, label: 'K', value: 13 },
];

// ============================================================
// UI timing (ms)
// ============================================================

/** Duration the "SEEP!" overlay stays visible */
export const SEEP_ANIM_DURATION_MS = 1200;

/** Delay before an AI bot places a bid */
export const AI_BID_DELAY_MS = 2000;

/** Delay before an AI bot plays its turn */
export const AI_PLAY_DELAY_MS = 1500;

/** Delay before a reshuffle is triggered */
export const RESHUFFLE_DELAY_MS = 2000;

/**
 * Trailing debounce before the host writes its session snapshot to
 * localStorage. Serialising the full game state is a synchronous main-thread
 * write; delaying it keeps it out of the animation frames.
 */
export const SESSION_SAVE_DEBOUNCE_MS = 500;

// ============================================================
// z-index layers
// ============================================================
// Seep stacks a house badge above a selected card but below the HUD; the rest
// of the scale is the package's.

export const Z_HOUSE_BADGE = 30;

// Scoring and game-rule constants live in rules.ts
