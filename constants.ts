import { Suit } from './types';

// ============================================================
// Card display constants
// ============================================================

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

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Spades]: '♠',
  [Suit.Hearts]: '♥',
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
};

export const SUIT_COLORS: Record<Suit, string> = {
  [Suit.Spades]: 'text-black',
  [Suit.Hearts]: 'text-red-600',
  [Suit.Clubs]: 'text-black',
  [Suit.Diamonds]: 'text-red-600',
};

/** Helper to get a card's display label from its rank */
export const getRankLabel = (rank: number): string =>
  CARD_RANKS.find(r => r.rank === rank)?.label ?? '?';

// ============================================================
// AI
// ============================================================

/** Pool of playful compound-word names for single-player bots. */
export const BOT_NAMES = [
  'CardShark', 'VelvetFox', 'MidnightOwl', 'RiverBandit', 'LuckyLoaf',
  'SilverTongue', 'CloverKnight', 'PepperPaws', 'BananaBaron', 'MapleMaverick',
  'GingerGhost', 'TangoTiger', 'WaffleWizard', 'CosmicOtter', 'MochiMonarch',
  'NeonBadger', 'PeachPhantom', 'BiscuitBandit', 'SunnyScholar', 'JollyJester',
];

/** Returns `count` unique bot names picked at random from BOT_NAMES. */
export function pickBotNames(count: number): string[] {
  const pool = [...BOT_NAMES];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

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

// ============================================================
// Team colors
// ============================================================

/** Tailwind classes for each team's badge (label + background + ring). */
export const TEAM_BADGE_CLASSES: Record<0 | 1, string> = {
  0: 'bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/40',
  1: 'bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/40',
};

/** Short label for each team. */
export const TEAM_LABELS: Record<0 | 1, string> = {
  0: 'A',
  1: 'B',
};

/** Accent text color per team (used in HUD headings). */
export const TEAM_TEXT_COLORS: Record<0 | 1, string> = {
  0: 'text-cyan-300',
  1: 'text-rose-300',
};

// ============================================================
// UI layout
// ============================================================

/** Maximum number of game log entries kept visible */
export const MAX_LOG_ENTRIES = 50;

/** How many characters of a peer ID to show in the UI */
export const PEER_ID_DISPLAY_LENGTH = 6;

/** Placeholder name for an empty player slot in the lobby */
export const EMPTY_SLOT_NAME = 'Waiting...';

// ============================================================
// z-index layers (ordered lowest → highest)
// ============================================================

export const Z_CARD_SELECTED = 20;
export const Z_HOUSE_BADGE = 30;
export const Z_HUD = 40;
export const Z_ACTION_BAR = 45;
export const Z_TURN_BADGE = 50;
export const Z_OVERLAY = 60;
export const Z_MODAL = 100;

// Scoring and game-rule constants live in rules.ts
