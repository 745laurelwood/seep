import React from 'react';
import { CardComponent } from './CardComponent';
import { ActionBar } from './panels';
import { useGame } from '../GameContext';
import { TEAM_BADGE_CLASSES, TEAM_LABELS } from '../constants';

type Position = 'bottom' | 'left' | 'top' | 'right';

interface PlayerHandProps {
  playerIndex: number;
  position: Position;
}

/** Render a single player's hand frame (name, turn badge, cards, and for "bottom": action bar). */
export const PlayerHand: React.FC<PlayerHandProps> = ({ playerIndex, position }) => {
  const {
    state, myIndex,
    selectedCardId, setSelectedCardId,
    setShowMyCaptures,
    visualThrow, sweepingToPlayer,
    canThrow, canCapture, canBuild, buildTarget, actionReasons,
    executeAction, executeBid, canBid, bidReason,
  } = useGame();

  if (!state.players[playerIndex]) return null;
  const player = state.players[playerIndex];
  const isMe = playerIndex === myIndex;
  const isCurrentTurn = state.currentTurn === playerIndex;
  const isBidderSeat = isMe && state.gamePhase === 'BIDDING' && state.bidderIndex === myIndex;

  const wrapperRotation = position === 'left' ? 'rotate-90' : position === 'right' ? '-rotate-90' : '';
  const wrapperScale = position !== 'bottom' ? 'scale-75' : '';
  const compactClass = !isMe ? 'opp-compact' : '';

  const isReceivingSweep = sweepingToPlayer === playerIndex && !!visualThrow;
  const sweepCard = isReceivingSweep && visualThrow
    ? player.capturedCards.find(c => c.id === visualThrow.cardId)
    : null;

  return (
    <div className="relative">
      {sweepCard && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
          data-card-id="capture-stack"
        >
          <CardComponent card={sweepCard} flipId="sweep-pile-card" />
        </div>
      )}
      <div className={`flex flex-col items-center py-2 px-1 ${wrapperRotation} ${wrapperScale} ${compactClass}`}>
      <div
        className="mb-1 font-display flex flex-col items-center"
        style={{ color: 'var(--fg)' }}
      >
        <div className="flex items-center gap-2 leading-tight">
          {isMe && player.capturedCards.length > 0 ? (
            <button
              onClick={() => setShowMyCaptures(true)}
              className="text-xs sm:text-sm px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer opp-count"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', color: 'var(--fg-soft)' }}
              title="View your captured cards"
            >
              {player.capturedCards.length}
            </button>
          ) : (
            <span
              className="text-xs sm:text-sm px-2 py-0.5 rounded-full whitespace-nowrap opp-count"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', color: 'var(--dim)' }}
            >
              {player.capturedCards.length}
            </span>
          )}
          <span className="text-lg sm:text-2xl md:text-3xl opp-name">
            {player.name}
          </span>
          <span
            className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md uppercase tracking-wider ${TEAM_BADGE_CLASSES[player.team as 0 | 1]}`}
            title={`Team ${TEAM_LABELS[player.team as 0 | 1]}`}
          >
            {TEAM_LABELS[player.team as 0 | 1]}
          </span>
          {isCurrentTurn && (
            <span
              className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full animate-accent-pulse whitespace-nowrap"
              style={{
                background: 'var(--accent)',
                color: '#06121f',
                boxShadow: '0 0 14px rgba(111,176,255,0.55)',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              {isMe ? 'Your Turn' : 'Thinking'}
            </span>
          )}
        </div>
      </div>

      {position === 'bottom' && isMe && (
        <div className="h-14 sm:h-16 flex flex-col items-center justify-end mb-1 sm:mb-2 w-full min-w-[28rem] perspective-wrapper">
          {isBidderSeat ? (
            <div className="flex flex-col items-center gap-1 w-full">
              <ActionBar
                canThrow={false}
                canCapture={false}
                canBuild={false}
                onAction={executeAction}
                isBidding
                canBid={canBid}
                bidReason={bidReason}
                onBid={executeBid}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 w-full">
              <ActionBar
                canThrow={canThrow}
                canCapture={canCapture}
                canBuild={canBuild}
                buildTarget={buildTarget}
                onAction={executeAction}
                reasons={actionReasons}
              />
            </div>
          )}
        </div>
      )}

      {(() => {
        const visibleHand = [...player.hand]
          .filter(c => !(visualThrow && visualThrow.cardId === c.id && visualThrow.playerIndex === playerIndex))
          .sort((a, b) => a.rank === b.rank ? a.suit.localeCompare(b.suit) : a.rank - b.rank);
        const showEmpty = visibleHand.length === 0 && state.gamePhase !== 'GAME_OVER';
        const emptyPlaceholder = (
          <div
            className="w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 lg:w-24 lg:h-36 rounded-lg flex items-center justify-center text-xs"
            style={{ border: '2px dashed var(--line)', color: 'var(--dimmer)' }}
          >
            Empty
          </div>
        );
        return isMe ? (
          <div className="hand-scroll no-scrollbar">
            <div className="flex items-end -space-x-6 sm:-space-x-8 transition-all duration-300 shrink-0">
              {visibleHand.map(card => (
                <CardComponent
                  key={card.id}
                  card={card}
                  faceDown={false}
                  isPlayable={(isCurrentTurn && state.gamePhase === 'PLAYING') || isBidderSeat}
                  isSelected={selectedCardId === card.id}
                  onClick={() => {
                    if (isCurrentTurn || isBidderSeat) {
                      setSelectedCardId(prev => prev === card.id ? null : card.id);
                    }
                  }}
                />
              ))}
              {showEmpty && emptyPlaceholder}
            </div>
          </div>
        ) : (
          <div className="flex opp-cards -space-x-6 sm:-space-x-8 transition-all duration-300">
            {visibleHand.map(card => (
              <CardComponent
                key={card.id}
                card={card}
                faceDown={state.gamePhase !== 'GAME_OVER'}
                isPlayable={false}
                isSelected={false}
              />
            ))}
            {showEmpty && emptyPlaceholder}
          </div>
        );
      })()}
      </div>
    </div>
  );
};
