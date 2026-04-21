// rules.ts — Single source of truth for all Seep game rules.
//
// Every rule constant, validation function, and scoring formula lives here.
// Other files import from this module instead of hardcoding magic numbers.

import { Card, Suit, House } from './types';

// ============================================================
// GAME CONFIGURATION
// ============================================================

/** Number of players in a game */
export const NUM_PLAYERS = 4;

/** Number of teams */
export const NUM_TEAMS = 2;

// ============================================================
// DEALING RULES
// ============================================================

/** Cards dealt to the bidder at the start of a round (phase 1) */
export const INITIAL_DEAL_COUNT = 4;

/** Cards dealt face-up to the floor after the bid is placed */
export const FLOOR_DEAL_COUNT = 4;

/**
 * Full hand size for every player after the phase-2 deal.
 *
 * After the bidder's first move the remaining cards are dealt:
 *   - Other players receive FULL_HAND_SIZE (12) cards each
 *   - The bidder receives FULL_HAND_SIZE − INITIAL_DEAL_COUNT (8) cards
 *     (since they already held 4)
 */
export const FULL_HAND_SIZE = 12;

// ============================================================
// HOUSE & BID RANKS
// ============================================================
//
// In Seep, biddable ranks and house ranks are identical (9–K).
// We define them once here.

/** Minimum rank for a house / bid */
export const MIN_HOUSE_RANK = 9;

/** Maximum rank for a house / bid */
export const MAX_HOUSE_RANK = 13;

/** All valid house (and bid) ranks, derived from MIN/MAX */
export const VALID_HOUSE_RANKS: readonly number[] = Array.from(
  { length: MAX_HOUSE_RANK - MIN_HOUSE_RANK + 1 },
  (_, i) => MIN_HOUSE_RANK + i,
);

/** Check if a hand contains at least one card eligible for bidding */
export const canBid = (hand: Card[]): boolean =>
  hand.some(c => c.rank >= MIN_HOUSE_RANK);

/** Return the valid ranks that the hand actually holds */
export const getAvailableBidRanks = (hand: Card[]): number[] =>
  VALID_HOUSE_RANKS.filter(rank => hand.some(c => c.rank === rank));

// ============================================================
// SCORING RULES
// ============================================================
//
// Standard Seep scoring distributes exactly 100 points per round:
//   Spades: face value (A=1, 2=2,  K=13) → subtotal = 91
//   10 of Diamonds: 6 points
//   Ace of Clubs:   1 point
//   Ace of Hearts:  1 point
//   Ace of Diamonds: 1 point
//   ──────────────────────────
//   Total per round = 100

/** Bonus points awarded for a Seep (clearing the floor) */
export const SEEP_POINTS = 50;

/** Point value of the 10 of Diamonds */
export const POINTS_10_DIAMONDS = 6;

/** Point value of each non-Spade Ace */
export const POINTS_NON_SPADE_ACE = 1;

/** Total base points distributed each round (before Seep bonuses) */
export const TOTAL_ROUND_POINTS = 100;

/** Point lead over the opponent required to end the game. */
export const WINNING_LEAD = 100;

/** Calculate the point value of a single card */
export const getPointsForCard = (card: Card): number => {
  // All Spades count as face value (A=1  K=13)
  if (card.suit === Suit.Spades) {
    return card.rank;
  }
  // 10 of Diamonds = 6 points
  if (card.suit === Suit.Diamonds && card.rank === 10) {
    return POINTS_10_DIAMONDS;
  }
  // Non-Spade Aces = 1 point each
  if (card.rank === 1) {
    return POINTS_NON_SPADE_ACE;
  }
  // Everything else = 0
  return 0;
};

// ============================================================
// FIRST-TURN CONSTRAINT
// ============================================================

/**
 * BIDDER'S FIRST-TURN RULES:
 *
 * After the bid, 4 cards are dealt to the floor. The bidder has 3 options:
 *
 * 1. COLLECT (capture): Use the bid card to capture a combination of floor
 *    cards whose ranks sum to the bid rank.
 *
 * 2. BUILD: Use any hand card + floor cards to form a house whose rank
 *    equals the bid rank. (The bid card itself may be used if the bidder
 *    holds two copies.)
 *
 * 3. THROW: Throw the bid card onto the floor. However, if the bid card
 *    CAN capture (a floor combination sums to the bid rank), then the
 *    throw is forced to become a capture — the bidder must collect.
 *
 * In all cases:
 *  - Only the bid card may be thrown; other cards cannot be thrown on
 *    the first turn.
 *  - Build must target the bid rank specifically.
 */

/** Returns true when a move satisfies the first-turn constraint. */
export const isValidFirstTurnMove = (
  move: {
    type: 'CAPTURE' | 'THROW' | 'BUILD';
    card: Card;
    buildRank?: number;
    capturedHouses?: House[];
  },
  bidRank: number,
): boolean => {
  if (move.type === 'BUILD' && move.buildRank === bidRank) return true;
  if (move.type === 'CAPTURE' && move.card.rank === bidRank) return true;
  if (move.type === 'THROW' && move.card.rank === bidRank) return true;
  return false;
};

// ============================================================
// SEEP DETECTION
// ============================================================

/**
 * A Seep occurs when a capture clears every card and house
 * from the floor — UNLESS it is the very last move of the round.
 */
export const isSeep = (
  floorEmpty: boolean,
  housesEmpty: boolean,
  isLastMove: boolean,
): boolean => {
  return floorEmpty && housesEmpty && !isLastMove;
};

// ============================================================
// HUMAN-READABLE RULES (used by AI prompts and potential help UI)
// ============================================================

export const RULES_SUMMARY = `
Seep (also known as Sweep) is a 4-player team card game from India.

TEAMS: 4 players in 2 teams. Players 0 & 2 form Team A; Players 1 & 3 form Team B.

DEALING (two phases):
- Phase 1: The bidder receives ${INITIAL_DEAL_COUNT} cards. After bidding, ${FLOOR_DEAL_COUNT} cards are dealt to the floor. The bidder then plays their first move.
- Phase 2: After the bidder's first move, the remaining cards are dealt — ${FULL_HAND_SIZE} to each other player, ${FULL_HAND_SIZE - INITIAL_DEAL_COUNT} to the bidder (who already had ${INITIAL_DEAL_COUNT}). Everyone ends up with ${FULL_HAND_SIZE} cards.

BIDDING:
- The bidder must hold a card of rank ${MIN_HOUSE_RANK} or higher (9, 10, J, Q, K).
- If not, the deck is reshuffled and re-dealt.
- The chosen bid rank determines what the bidder must do on their first turn.

BIDDER'S FIRST TURN — exactly 3 options:
1. COLLECT: Use the bid card to capture floor cards whose ranks sum to the bid rank.
2. BUILD: Use any hand card + floor cards to form a house equal to the bid rank.
3. THROW: Throw the bid card onto the floor. But if the bid card CAN capture
   (a floor combination sums to the bid rank), the throw becomes a forced capture.
Only the bid card may be thrown; build must target the bid rank.

GAMEPLAY (subsequent turns) — on each turn a player must do exactly ONE of:
1. THROW: Place a hand card onto the floor.
2. CAPTURE: Play a card whose rank equals the sum of selected floor cards, or matches a house's rank.
3. BUILD: Combine a hand card with floor cards to form a house (rank ${MIN_HOUSE_RANK}–${MAX_HOUSE_RANK}). You must already hold a card of the target house rank.

SEEP: Clearing the entire floor (all loose cards + all houses) with a single capture earns +${SEEP_POINTS} bonus points — unless it is the very last move of the round.

SCORING (${TOTAL_ROUND_POINTS} base points per round):
- All Spades: face value (Ace = 1  King = 13, total 91).
- 10 of Diamonds: ${POINTS_10_DIAMONDS} points.
- Ace of Clubs: ${POINTS_NON_SPADE_ACE} point.
- Ace of Hearts: ${POINTS_NON_SPADE_ACE} point.
- Ace of Diamonds: ${POINTS_NON_SPADE_ACE} point.

END OF ROUND: Any cards still on the floor go to the last player who captured.
WINNING: The game ends once one team leads the other by ${WINNING_LEAD} or more points; that team wins.
`.trim();
