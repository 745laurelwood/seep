export enum Suit {
  Spades = 'S',
  Hearts = 'H',
  Clubs = 'C',
  Diamonds = 'D',
}

export interface Card {
  suit: Suit;
  rank: number; // 1 (Ace) to 13 (King)
  id: string; // unique identifier
}

export interface House {
  id: string;
  rank: number; // The value of the house (e.g., 9, 12)
  cards: Card[]; // Cards making up the house
  ownerIndices: number[]; // All players who have contributed to this house (supports co-ownership)
  isCemented: boolean; // True once the house's cards sum to ≥ 2× its rank.
}

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  isOnline?: boolean;
  peerId?: string; // For multiplayer identification
  hand: Card[];
  capturedCards: Card[]; // For scoring
  score: number;
  team: 0 | 1; // 0 for North/South (or P1/P3), 1 for East/West (or P2/P4)
}

export type GamePhase = 'LOBBY' | 'BIDDING' | 'PLAYING' | 'ROUND_OVER' | 'GAME_OVER';

export interface GameState {
  gamePhase: GamePhase;
  allowFragileHouses: boolean;
  roomId?: string; // The Host's Peer ID
  players: Player[];
  floor: Card[];
  houses: House[];
  deck: Card[];
  currentTurn: number;
  dealerIndex: number; // Tracks who dealt the current round
  bidderIndex: number; // Tracks who is bidding/bid in the current round
  bidRank: number | null; // The rank of the house chosen by bidder
  lastBidder: number; // For Seep checks (last capturer)
  roundScores: {
    team0: number;
    team1: number;
  };
  totalScores: {
    team0: number;
    team1: number;
  };
  gameLog: string[];
  seeps: {
    team0: number;
    team1: number;
  };
  resolvingMove?: {
    playerIndex: number;
    cardId: string;
    action: 'CAPTURE' | 'BUILD';
    capturedIds?: string[];
    capturedHouseIds?: string[];
    buildRank?: number;
  } | null;
  readyForLobbyIndices?: number[];
}

export interface Move {
  card: Card;
  type: 'CAPTURE' | 'THROW' | 'BUILD';
  capturedCards?: Card[]; // Cards from floor being captured (loose)
  capturedHouses?: House[]; // Houses being captured
  buildRank?: number; // If building, what rank?
}

export interface AIMoveResponse {
  cardIndex: number;
  action: 'CAPTURE' | 'THROW' | 'BUILD';
  buildRank?: number; // If action is BUILD
  reasoning: string;
  taunt?: string;
}

// Network Types
export type NetworkAction = 
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'PLAYER_JOINED'; payload: { index: number; name: string; peerId: string } }
  | { type: 'CLIENT_ACTION'; payload: any }; // Payload matches the local reducer actions
