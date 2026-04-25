import { Card, ChatMessage, GameState, Player } from './types';
import { createDeck, shuffleDeck } from './utils/deck';
import { getRankLabel, SUIT_SYMBOLS, MAX_LOG_ENTRIES, CHAT_MAX_HISTORY, EMPTY_SLOT_NAME, pickBotNames } from './constants';
import {
  SEEP_POINTS, WINNING_LEAD, NUM_PLAYERS,
  MIN_HOUSE_RANK,
  INITIAL_DEAL_COUNT, FLOOR_DEAL_COUNT, FULL_HAND_SIZE,
  getPointsForCard, isSeep,
} from './rules';

export type Action =
  | { type: 'SET_GAME_STATE'; payload: GameState }
  | { type: 'INIT_LOBBY'; payload: { isHost: boolean; roomId?: string; hostName?: string; allowFragileHouses?: boolean } }
  | { type: 'UPDATE_PLAYERS'; payload: Player[] }
  | { type: 'SET_PLAYER_OFFLINE'; payload: { peerId: string } }
  | { type: 'SET_PLAYER_TEAM'; payload: { playerIndex: number; team: 0 | 1 } }
  | { type: 'START_ROUND' }
  | { type: 'START_GAME'; payload: { playerName: string; allowFragileHouses?: boolean } }
  | { type: 'BID'; payload: { rank: number } }
  | { type: 'RETURN_TO_LOBBY'; payload: { playerIndex: number } }
  | { type: 'END_ROUND' }
  | { type: 'PLAY_MOVE'; payload: {
      playerIndex: number;
      cardId: string;
      action: 'CAPTURE' | 'THROW' | 'BUILD';
      capturedIds?: string[];
      capturedHouseIds?: string[];
      buildRank?: number;
    }}
  | { type: 'ADD_LOG'; payload: string }
  | { type: 'SEND_CHAT'; payload: ChatMessage };

export const INITIAL_STATE: GameState = {
  gamePhase: 'LOBBY',
  allowFragileHouses: false,
  players: [],
  floor: [],
  houses: [],
  deck: [],
  currentTurn: 0,
  dealerIndex: NUM_PLAYERS - 1,
  bidderIndex: 0,
  bidRank: null,
  lastBidder: -1,
  roundScores: { team0: 0, team1: 0 },
  totalScores: { team0: 0, team1: 0 },
  gameLog: [],
  seeps: { team0: 0, team1: 0 },
  chatLog: [],
};

export function makeEmptyPlayer(id: number, name: string, isHuman: boolean, peerId?: string): Player {
  return { id, name, isHuman, peerId, hand: [], capturedCards: [], score: 0, team: (id % 2) as 0 | 1, isOnline: true };
}

export const isValidGameState = (s: any): s is GameState =>
  !!s && typeof s === 'object' && !!s.seeps && Array.isArray(s.players) && !!s.gamePhase;

export const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'SET_GAME_STATE':
      if (!isValidGameState(action.payload)) return state;
      return { ...action.payload, chatLog: action.payload.chatLog ?? [] };

    case 'INIT_LOBBY':
      return {
        ...INITIAL_STATE,
        gamePhase: 'LOBBY',
        allowFragileHouses: action.payload.allowFragileHouses || false,
        roomId: action.payload.roomId,
        players: Array.from({ length: NUM_PLAYERS }, (_, i) =>
          makeEmptyPlayer(i, i === 0 ? (action.payload.hostName || 'You (Host)') : EMPTY_SLOT_NAME, false)
        ),
      };

    case 'START_GAME': {
      const botNames = pickBotNames(3);
      return {
        ...INITIAL_STATE,
        gamePhase: 'LOBBY',
        allowFragileHouses: action.payload.allowFragileHouses || false,
        players: [
          makeEmptyPlayer(0, action.payload.playerName, true),
          makeEmptyPlayer(1, botNames[0], false),
          makeEmptyPlayer(2, botNames[1], false),
          makeEmptyPlayer(3, botNames[2], false),
        ],
      };
    }

    case 'UPDATE_PLAYERS':
      return { ...state, players: action.payload };

    case 'SET_PLAYER_OFFLINE': {
      const idx = state.players.findIndex(p => p.peerId === action.payload.peerId);
      if (idx === -1) return state;
      const np = [...state.players];
      np[idx] = { ...np[idx], isOnline: false };
      return { ...state, players: np };
    }

    case 'SET_PLAYER_TEAM': {
      if (state.gamePhase !== 'LOBBY') return state;
      const { playerIndex, team } = action.payload;
      const target = state.players[playerIndex];
      if (!target || target.team === team) return state;
      const np = [...state.players];
      np[playerIndex] = { ...target, team };
      return { ...state, players: np };
    }

    case 'START_ROUND': {
      const deck = shuffleDeck(createDeck());
      // Dealer stays put across reshuffles within a round. Between rounds, the
      // dealer is drawn at random from the losing team so the next bidder (dealer+1)
      // comes from the winning team. Ties and the first round fall back to rotation.
      const isReshuffle = state.gamePhase === 'BIDDING';
      const isFromRoundOver = state.gamePhase === 'ROUND_OVER';
      const isFirstRound = state.gamePhase === 'LOBBY';
      let dealerIndex: number;
      if (isReshuffle) {
        dealerIndex = state.dealerIndex;
      } else if (isFirstRound) {
        // First round: bidder should be player 0 (the human in single-player,
        // the host in multiplayer). Keep initial dealerIndex as-is.
        dealerIndex = state.dealerIndex;
      } else if (isFromRoundOver && state.roundScores.team0 !== state.roundScores.team1) {
        const losingTeam: 0 | 1 = state.roundScores.team0 < state.roundScores.team1 ? 0 : 1;
        const candidates = state.players.filter(p => p.team === losingTeam).map(p => p.id);
        dealerIndex = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        dealerIndex = (state.dealerIndex + 1) % NUM_PLAYERS;
      }
      const bidderIndex = (dealerIndex + 1) % NUM_PLAYERS;
      const bidderHand = deck.splice(0, INITIAL_DEAL_COUNT);

      // First transition out of LOBBY — reseat humans so partners sit across
      // (same team in even slots vs odd slots), then fill remaining seats with
      // bots. The host (slot 0) anchors their team to the even slots so their
      // own seat doesn't shift. Existing pre-named bots (single-player path)
      // are reused; multiplayer empty slots draw fresh bot names.
      let seated: Player[];
      if (state.gamePhase === 'LOBBY') {
        const hostTeam = state.players[0].team;
        const oddTeam: 0 | 1 = (1 - hostTeam) as 0 | 1;
        const evenHumans = state.players.filter(p => p.isHuman && p.team === hostTeam);
        const oddHumans = state.players.filter(p => p.isHuman && p.team === oddTeam);
        const slotted: (Player | null)[] = [
          evenHumans[0] ?? null,
          oddHumans[0] ?? null,
          evenHumans[1] ?? null,
          oddHumans[1] ?? null,
        ];
        const botsNeeded = slotted.filter(s => s === null).length;
        const existingBots = state.players.filter(p => !p.isHuman && p.name !== EMPTY_SLOT_NAME);
        const freshNeeded = Math.max(0, botsNeeded - existingBots.length);
        const freshBotNames = freshNeeded > 0 ? pickBotNames(freshNeeded) : [];
        const botPool: { name: string; existing?: Player }[] = [
          ...existingBots.map(b => ({ name: b.name, existing: b })),
          ...freshBotNames.map(n => ({ name: n })),
        ];
        let botCursor = 0;
        seated = slotted.map((p, idx) => {
          const slotTeam: 0 | 1 = (idx % 2 === 0 ? hostTeam : oddTeam) as 0 | 1;
          if (p) return { ...p, id: idx, team: slotTeam };
          const next = botPool[botCursor++];
          const base = next.existing ?? makeEmptyPlayer(idx, next.name, false);
          return { ...base, id: idx, team: slotTeam };
        });
      } else {
        seated = state.players;
      }

      const players = seated.map((p, idx) => ({
        ...p,
        hand: idx === bidderIndex ? bidderHand : [],
        capturedCards: [],
        score: 0,
      }));

      if (!bidderHand.some(c => c.rank >= MIN_HOUSE_RANK)) {
        const emptied = players.map(p => ({ ...p, hand: [] }));
        return {
          ...state,
          gamePhase: 'BIDDING',
          dealerIndex,
          bidderIndex,
          currentTurn: bidderIndex,
          players: emptied,
          deck: [],
          floor: [],
          houses: [],
          gameLog: [`${players[bidderIndex].name} has no cards ≥ ${MIN_HOUSE_RANK}, reshuffling`],
        };
      }

      return {
        ...state,
        gamePhase: 'BIDDING',
        deck,
        floor: [],
        players,
        dealerIndex,
        bidderIndex,
        currentTurn: bidderIndex,
        lastBidder: -1,
        houses: [],
        seeps: { team0: 0, team1: 0 },
        bidRank: null,
        roundScores: { team0: 0, team1: 0 },
        gameLog: [`Round started, ${players[bidderIndex].name} is bidding`],
      };
    }

    case 'BID': {
      const { rank } = action.payload;
      const bidder = state.players[state.bidderIndex];
      const newDeck = [...state.deck];

      // Phase 1: only deal floor cards — other players get nothing yet
      const floor = newDeck.splice(0, FLOOR_DEAL_COUNT);

      return {
        ...state,
        gamePhase: 'PLAYING',
        bidRank: rank,
        floor,
        deck: newDeck,
        gameLog: [...state.gameLog, `${bidder.name} bids ${getRankLabel(rank)}`],
      };
    }

    case 'PLAY_MOVE': {
      const { playerIndex, cardId, action: moveType, capturedIds, capturedHouseIds, buildRank } = action.payload;
      const player = state.players[playerIndex];
      const cardIndex = player.hand.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return state;

      const playedCard = player.hand[cardIndex];
      const newHand = player.hand.filter((_, i) => i !== cardIndex);

      let newFloor = [...state.floor];
      let newHouses = [...state.houses];
      let newCaptured = [...player.capturedCards];
      const newLog = [...state.gameLog];
      const newSeeps = { ...state.seeps };

      const playedStr = `${getRankLabel(playedCard.rank)}${SUIT_SYMBOLS[playedCard.suit]}`;

      if (moveType === 'THROW') {
        newFloor.push(playedCard);
        newLog.push(`${player.name} played ${playedStr}`);

      } else if (moveType === 'CAPTURE') {
        newCaptured.push(playedCard);

        const capturedFloorCards = capturedIds ? newFloor.filter(c => capturedIds.includes(c.id)) : [];
        const capturedHouses = capturedHouseIds ? newHouses.filter(h => capturedHouseIds.includes(h.id)) : [];

        if (capturedIds) {
          newCaptured.push(...capturedFloorCards);
          newFloor = newFloor.filter(c => !capturedIds.includes(c.id));
        }
        if (capturedHouseIds) {
          capturedHouses.forEach(h => newCaptured.push(...h.cards));
          newHouses = newHouses.filter(h => !capturedHouseIds.includes(h.id));
        }

        const capParts = [];
        if (capturedFloorCards.length > 0) capParts.push(capturedFloorCards.map(c => `${getRankLabel(c.rank)}${SUIT_SYMBOLS[c.suit]}`).join(', '));
        if (capturedHouses.length > 0) capParts.push(capturedHouses.map(h => `${getRankLabel(h.rank)}🏠`).join(', '));
        newLog.push(`${player.name} played ${playedStr} and captured ${capParts.length > 0 ? capParts.join(' and ') : 'nothing'}`);

        // Seep check
        const isLastMove = newHand.length === 0 &&
          state.players.every((p, idx) => idx === playerIndex || p.hand.length === 0);

        if (isSeep(newFloor.length === 0, newHouses.length === 0, isLastMove)) {
          // newLog.push(`SEEP! (+${SEEP_POINTS} pts)`);
          if (player.team === 0) newSeeps.team0 += SEEP_POINTS;
          else newSeeps.team1 += SEEP_POINTS;
        }

      } else if (moveType === 'BUILD') {
        const usedFloorCards = capturedIds ? newFloor.filter(c => capturedIds.includes(c.id)) : [];
        newFloor = newFloor.filter(c => !capturedIds?.includes(c.id));

        const usedHouseCards: Card[] = [];
        const usedHouses = capturedHouseIds ? newHouses.filter(h => capturedHouseIds.includes(h.id)) : [];

        if (capturedHouseIds) {
          usedHouses.forEach(h => usedHouseCards.push(...h.cards));
          newHouses = newHouses.filter(h => !capturedHouseIds.includes(h.id));
        }

        const targetRank = buildRank || MIN_HOUSE_RANK;
        // Ownership is a team-level commitment: one teammate holding a same-rank card
        // satisfies it. A player becomes an owner only if their team is not yet
        // committed AND they retain a same-rank card after this play.
        // Per-house rule: when joining a same-rank house, all its owners are
        // preserved (their same-rank commitment still holds). When absorbing a
        // different-rank house (rank change), all prior owners lose it — their
        // commitment was to the old rank and doesn't carry to the new one.
        const retainedPriorOwners = usedHouses.flatMap(h =>
          h.rank === targetRank ? h.ownerIndices : []
        );
        const myTeam = state.players[playerIndex].team;
        const myTeamCommitted = retainedPriorOwners.some(idx => state.players[idx].team === myTeam);
        const retainsTargetRank = newHand.some(c => c.rank === targetRank);
        const becomesOwner = !myTeamCommitted && retainsTargetRank;
        const candidateOwners = Array.from(new Set(
          becomesOwner ? [...retainedPriorOwners, playerIndex] : retainedPriorOwners
        ));
        // Invariant: at most one owner per team. Keep the first entry encountered;
        // prior owners take precedence over the current player.
        const seenTeams = new Set<number>();
        const mergedOwners: number[] = [];
        for (const idx of candidateOwners) {
          const t = state.players[idx].team;
          if (!seenTeams.has(t)) {
            seenTeams.add(t);
            mergedOwners.push(idx);
          }
        }

        const newHouseCards = [...usedFloorCards, ...usedHouseCards, playedCard];
        // A house cements once its cards sum to a multiple ≥ 2× of its rank
        // (e.g., cards summing to 18 in a House of 9).
        const newHouseSum = newHouseCards.reduce((s, c) => s + c.rank, 0);
        newHouses.push({
          id: `house-${Date.now()}-${Math.random()}`,
          rank: targetRank,
          cards: newHouseCards,
          ownerIndices: mergedOwners,
          isCemented: newHouseSum >= 2 * targetRank,
        });

        const targetParts = [];
        if (usedFloorCards.length > 0) targetParts.push(usedFloorCards.map(c => `${getRankLabel(c.rank)}${SUIT_SYMBOLS[c.suit]}`).join(', '));
        if (usedHouses.length > 0) targetParts.push(usedHouses.map(h => `${getRankLabel(h.rank)}🏠`).join(', '));
        newLog.push(`${player.name} played ${playedStr} and built ${getRankLabel(buildRank || MIN_HOUSE_RANK)}🏠`);
      }

      const newPlayers = [...state.players];
      newPlayers[playerIndex] = { ...player, hand: newHand, capturedCards: newCaptured };

      // Phase 2 deal: after the bidder's first move, deal remaining cards
      const currentDeck = [...state.deck];
      const isBidderFirstMove = playerIndex === state.bidderIndex
        && currentDeck.length > 0;

      if (isBidderFirstMove) {
        for (let i = 0; i < NUM_PLAYERS; i++) {
          const idx = (state.bidderIndex + i) % NUM_PLAYERS;
          const p = newPlayers[idx];
          const dealCount = idx === state.bidderIndex
            ? FULL_HAND_SIZE - INITIAL_DEAL_COUNT   // 8 (already had 4)
            : FULL_HAND_SIZE;                        // 12
          newPlayers[idx] = { ...p, hand: [...p.hand, ...currentDeck.splice(0, dealCount)] };
        }
      }

      const stateAfterMove = {
        ...state,
        players: newPlayers,
        floor: newFloor,
        houses: newHouses,
        deck: currentDeck,
        gameLog: newLog.slice(-MAX_LOG_ENTRIES),
        seeps: newSeeps,
        lastBidder: moveType === 'CAPTURE' ? playerIndex : state.lastBidder,
      };

      const nextTurn = (stateAfterMove.currentTurn + 1) % NUM_PLAYERS;
      const allHandsEmpty = stateAfterMove.players.every(p => p.hand.length === 0);

      if (!allHandsEmpty) {
        return { ...stateAfterMove, currentTurn: nextTurn };
      }

      // Round is done but floor/houses still hold leftovers — the orchestrator
      // will animate them to the last capturer then dispatch END_ROUND.
      return stateAfterMove;
    }

    case 'END_ROUND': {
      const lastCapturerIdx = state.lastBidder === -1 ? state.dealerIndex : state.lastBidder;
      const lastCapturerTeam = state.players[lastCapturerIdx].team;
      const leftoverCards = [...state.floor, ...state.houses.flatMap(h => h.cards)];

      const teamPoints = [0, 1].map(team => {
        let pts = team === 0 ? state.seeps.team0 : state.seeps.team1;
        const memberIndices = state.players.filter(p => p.team === team).map(p => p.id);
        const cards = memberIndices.flatMap(i => state.players[i].capturedCards);
        if (lastCapturerTeam === team) cards.push(...leftoverCards);
        cards.forEach(c => { pts += getPointsForCard(c); });
        return pts;
      });

      const roundScores = { team0: teamPoints[0], team1: teamPoints[1] };
      const newTotalScores = {
        team0: state.totalScores.team0 + roundScores.team0,
        team1: state.totalScores.team1 + roundScores.team1,
      };
      const isGameOver = Math.abs(newTotalScores.team0 - newTotalScores.team1) >= WINNING_LEAD;

      // Move leftovers into the last capturer's pile so they're reflected in
      // that player's capture count during the round-over screen.
      const newPlayers = state.players.map(p =>
        p.id === lastCapturerIdx
          ? { ...p, capturedCards: [...p.capturedCards, ...leftoverCards] }
          : p
      );

      return {
        ...state,
        gamePhase: isGameOver ? 'GAME_OVER' : 'ROUND_OVER',
        roundScores,
        totalScores: newTotalScores,
        floor: [],
        houses: [],
        players: newPlayers,
        gameLog: [...state.gameLog, `Round over! ${teamPoints[0]} – ${teamPoints[1]}`],
      };
    }

    case 'RETURN_TO_LOBBY': {
      // Only meaningful after a game ends. Each player's click marks them ready;
      // once all humans are ready we transition to LOBBY preserving player identities.
      if (state.gamePhase !== 'GAME_OVER') return state;
      const { playerIndex } = action.payload;
      const ready = new Set(state.readyForLobbyIndices || []);
      ready.add(playerIndex);
      const humans = state.players.filter(p => p.isHuman);
      const allReady = humans.every(p => ready.has(p.id));
      if (!allReady) {
        return { ...state, readyForLobbyIndices: Array.from(ready) };
      }
      return {
        ...state,
        gamePhase: 'LOBBY',
        floor: [],
        houses: [],
        deck: [],
        currentTurn: 0,
        dealerIndex: NUM_PLAYERS - 1,
        bidderIndex: 0,
        bidRank: null,
        lastBidder: -1,
        roundScores: { team0: 0, team1: 0 },
        totalScores: { team0: 0, team1: 0 },
        seeps: { team0: 0, team1: 0 },
        gameLog: [],
        readyForLobbyIndices: [],
        players: state.players.map(p => ({
          ...p,
          hand: [],
          capturedCards: [],
          score: 0,
        })),
      };
    }

    case 'ADD_LOG':
      return { ...state, gameLog: [...state.gameLog, action.payload].slice(-MAX_LOG_ENTRIES) };

    case 'SEND_CHAT':
      return { ...state, chatLog: [...state.chatLog, action.payload].slice(-CHAT_MAX_HISTORY) };

    default:
      return state;
  }
};
