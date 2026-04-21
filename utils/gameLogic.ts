import { Card, Move, House, Player } from '../types';
import { VALID_HOUSE_RANKS } from '../rules';

/**
 * Find all combinations of floor cards that sum up to the target value.
 * Returns an array of arrays, where each inner array is a set of cards summing to target.
 */
export const findSumCombinations = (floor: Card[], target: number): Card[][] => {
  const results: Card[][] = [];

  const search = (index: number, currentSum: number, currentCards: Card[]) => {
    if (currentSum === target) {
      if (currentCards.length > 0) results.push([...currentCards]);
      return;
    }
    if (currentSum > target || index >= floor.length) return;

    // Include current card
    search(index + 1, currentSum + floor[index].rank, [...currentCards, floor[index]]);
    // Exclude current card
    search(index + 1, currentSum, currentCards);
  };

  search(0, 0, []);
  return results;
};

/**
 * Checks if the given array of cards can be perfectly partitioned into groups
 * that each sum to exactly `targetRank`.
 */
export const canPerfectlyPartition = (cards: Card[], targetRank: number): boolean => {
  const totalSum = cards.reduce((sum, c) => sum + c.rank, 0);
  if (totalSum === 0 || totalSum % targetRank !== 0) return false;
  
  const targetGroups = totalSum / targetRank;
  const sortedCards = [...cards].sort((a, b) => b.rank - a.rank);
  const used = new Array(sortedCards.length).fill(false);

  const backtrack = (groupsFound: number, currentSum: number, startIndex: number): boolean => {
    if (groupsFound === targetGroups) return true;
    if (currentSum === targetRank) {
      // Start a new group from index 0
      return backtrack(groupsFound + 1, 0, 0);
    }
    
    let lastTriedRank = -1;
    for (let i = startIndex; i < sortedCards.length; i++) {
      if (used[i]) continue;

      const cardRank = sortedCards[i].rank;
      // Skip duplicates: trying another card of the same rank from the same position
      // explores an identical subtree.
      if (cardRank === lastTriedRank) continue;

      if (currentSum + cardRank <= targetRank) {
        used[i] = true;
        if (backtrack(groupsFound, currentSum + cardRank, i + 1)) return true;
        used[i] = false;
        lastTriedRank = cardRank;
      }

      // Pruning (sound under descending sort): if we couldn't place the largest
      // unused card to start a new group, or placing this card to EXACTLY close
      // the group didn't lead to a solution, no valid partition exists on this path.
      if (currentSum === 0 || currentSum + cardRank === targetRank) {
        return false;
      }
    }
    return false;
  };

  return backtrack(0, 0, 0);
};

/**
 * Check whether any combination of floor cards sums to EXACTLY `rank`.
 * Used to determine if a card CAN capture — if so, it cannot be thrown.
 */
export const canCaptureWithRank = (floor: Card[], rank: number): boolean => {
  if (floor.length === 0 || rank <= 0) return false;
  return findSumCombinations(floor, rank).length > 0;
};

/**
 * Collect ALL capturable loose cards for a given card rank.
 * Groups are found that sum to exactly `rank`.
 * Returns deduplicated cards.
 */
export const collectAllCapturableLoose = (floor: Card[], rank: number): Card[] => {
  const all = findSumCombinations(floor, rank).flat();
  return Array.from(new Map(all.map(c => [c.id, c])).values());
};

/**
 * Calculates valid moves for a player.
 *
 * Rules applied:
 *   Capture — play card C, pick up all loose cards whose sum is a multiple of C's rank,
 *             plus all houses matching C's rank.
 *   Build   — play card C + floor cards to form a house of rank X (9–13).
 *             Must retain a card of rank X in hand after playing C.
 *   Throw   — only allowed if card C cannot capture anything on the floor.
 */
export const getPossibleMoves = (hand: Card[], floor: Card[], houses: House[], myIndex: number, players: Player[], allowFragileHouses: boolean): Move[] => {
  const moves: Move[] = [];

  for (const card of hand) {
    // If this card is my last copy of a rank I own a house for, it must be
    // reserved for CAPTURE — no THROW or BUILD allowed.
    const copiesOfRank = hand.filter(c => c.rank === card.rank).length;
    const iOwnHouseOfCardRank = houses.some(h =>
      h.rank === card.rank && h.ownerIndices.includes(myIndex)
    );
    const reservedForCapture = copiesOfRank === 1 && iOwnHouseOfCardRank;

    // ── 1. Capture ──
    // Any same-rank house (cemented or uncemented) is captured via rank match.
    // Then iteratively pack disjoint combos from the remaining loose cards
    // and uncemented-other-rank houses (laurelwood). Cemented houses of other
    // ranks are never broken down.
    const matchingHouses = houses.filter(h => h.rank === card.rank);
    const uncementedHouses = allowFragileHouses ? houses.filter(h => !h.isCemented) : [];

    {
      const capturedCards: Card[] = [];
      const capturedHouses: House[] = [...matchingHouses];

      const isCaptured = (id: string) =>
        capturedCards.some(c => c.id === id) || capturedHouses.some(h => h.id === id);
      const remainderItems = () => {
        const looseLeft = floor.filter(c => !isCaptured(c.id));
        const housesLeft = allowFragileHouses ? uncementedHouses.filter(h => !isCaptured(h.id)) : [];
        return [...looseLeft, ...housesLeft.map(h => ({ id: h.id, rank: h.rank } as Card))];
      };

      let guard = 0;
      while (guard++ < 32) {
        const pool = remainderItems();
        const combos = findSumCombinations(pool, card.rank);
        if (combos.length === 0) break;
        // Prefer combos that pull in an uncemented house (fragile priority),
        // then larger combos for maximum coverage.
        combos.sort((a, b) => {
          const aUsesHouse = allowFragileHouses && a.some(x => uncementedHouses.some(h => h.id === x.id));
          const bUsesHouse = allowFragileHouses && b.some(x => uncementedHouses.some(h => h.id === x.id));
          if (aUsesHouse !== bUsesHouse) return aUsesHouse ? -1 : 1;
          return b.length - a.length;
        });
        const chosen = combos[0];
        for (const item of chosen) {
          if (uncementedHouses.some(h => h.id === item.id)) {
            if (!capturedHouses.some(h => h.id === item.id)) {
              capturedHouses.push(uncementedHouses.find(h => h.id === item.id)!);
            }
          } else {
            if (!capturedCards.some(c => c.id === item.id)) {
              capturedCards.push(floor.find(c => c.id === item.id)!);
            }
          }
        }
      }

      if (capturedCards.length > 0 || capturedHouses.length > 0) {
        moves.push({
          card,
          type: 'CAPTURE',
          capturedCards,
          capturedHouses,
        });
      }
    }

    // ── 2. Build ──
    if (!reservedForCapture) for (const targetRank of VALID_HOUSE_RANKS) {
      const hasTargetInHand = hand.some(c => c.id !== card.id && c.rank === targetRank);

      const neededSum = targetRank - card.rank;
      if (neededSum >= 0) {
        // If neededSum is 0, we're building directly on top of something (usually an existing house or a single matching card)
        const floorCombos = neededSum > 0 ? findSumCombinations(floor, neededSum) : [[]];

        if (floorCombos.length > 0) {
          const baseGroup = floorCombos[0];
          const remainingFloor = floor.filter(c => !baseGroup.includes(c));

          // Greedily grab disjoint groups summing to targetRank from the remainder.
          const extraLoose: Card[] = [];
          let remaining = [...remainingFloor];
          let g = 0;
          while (g++ < 32) {
            const cs = findSumCombinations(remaining, targetRank);
            if (cs.length === 0) break;
            cs.sort((a, b) => b.length - a.length);
            const combo = cs[0];
            extraLoose.push(...combo);
            const ids = new Set(combo.map(c => c.id));
            remaining = remaining.filter(c => !ids.has(c.id));
          }

          // Extra houses must match target rank. We allow cemented houses as long as their lock matches the targetRank!
          const extraHouses = houses.filter(h => h.rank === targetRank);

          if (baseGroup.length > 0 || extraLoose.length > 0 || extraHouses.length > 0) {
            const myTeam = players[myIndex].team;
            const hasPartnerHouse = extraHouses.some(h =>
              h.ownerIndices.some(idx => idx !== myIndex && players[idx].team === myTeam)
            );

            if (hasTargetInHand || hasPartnerHouse) {
               moves.push({
                 card,
                 type: 'BUILD',
                 capturedCards: [...baseGroup, ...extraLoose],
                 capturedHouses: extraHouses,
                 buildRank: targetRank,
               });
            }
          }
        }
      }
    }

    // ── 3. Throw — only if this card cannot capture anything ──
    const fragileFloorForThrow = allowFragileHouses
      ? [...floor, ...uncementedHouses.map(h => ({ id: h.id, rank: h.rank } as Card))]
      : floor;
    const cardCanCapture = canCaptureWithRank(fragileFloorForThrow, card.rank)
      || matchingHouses.length > 0;

    if (!cardCanCapture && !reservedForCapture) {
      moves.push({ card, type: 'THROW' });
    }
  }

  return moves;
};
