import React, { createContext, useContext } from 'react';
import { GameState } from './types';
import { Action } from './gameReducer';

export interface GameContextValue {
  // Core state
  state: GameState;
  dispatch: React.Dispatch<Action>;
  handleDispatch: (action: Action) => void;

  // Identity
  myIndex: number;
  isHost: boolean;
  isMultiplayer: boolean;
  peerId: string;
  joinId: string;
  isDisconnected: boolean;

  // Selection
  selectedCardId: string | null;
  setSelectedCardId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedFloorIds: Set<string>;
  setSelectedFloorIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedHouseIds: Set<string>;
  setSelectedHouseIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  previewHouseId: string | null;
  setPreviewHouseId: React.Dispatch<React.SetStateAction<string | null>>;
  showMyCaptures: boolean;
  setShowMyCaptures: React.Dispatch<React.SetStateAction<boolean>>;
  mobileLogOpen: boolean;
  setMobileLogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileChatOpen: boolean;
  setMobileChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatUnread: number;
  markChatRead: () => void;
  sendChat: (text: string) => void;

  // Animation state
  visualThrow: { cardId: string; playerIndex: number } | null;
  mobileOpponentSource: { cardId: string; playerIndex: number } | null;
  visualCapturePile: string[];
  sweepingToPlayer: number | null;
  showSeepAnim: boolean;

  // Derived actions
  canThrow: boolean;
  canCapture: boolean;
  canBuild: boolean;
  buildTarget: number | undefined;
  actionReasons: { throw?: string; capture?: string; build?: string };
  executeAction: (type: 'CAPTURE' | 'THROW' | 'BUILD') => void;
  executeBid: () => void;
  canBid: boolean;
  bidReason?: string;
  toggleFloorCard: (id: string) => void;
  toggleHouse: (id: string) => void;

  // Positional players
  topPlayer: number;
  leftPlayer: number;
  rightPlayer: number;
  bottomPlayer: number;

  // Refs
  logEndRef: React.RefObject<HTMLDivElement | null>;

  // Pause state
  isPaused: boolean;
  offlinePlayers: { name: string }[];
}

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider: React.FC<{ value: GameContextValue; children: React.ReactNode }> = ({ value, children }) => (
  <GameContext.Provider value={value}>{children}</GameContext.Provider>
);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside a GameProvider');
  return ctx;
}
