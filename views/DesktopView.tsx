import React from 'react';
import { ChatRoom, Felt, LastMoveBanner, TableGrid } from '@laurelwood/card-class';
import { HUD, SeepOverlay } from '../components/panels';
import { FeltContent } from '../components/FeltContent';
import { PlayerHand } from '../components/PlayerHand';
import { SharedOverlays } from '../components/SharedOverlays';
import { useGame } from '../GameContext';
import { Z_HUD } from '../constants';

export const DesktopView: React.FC = () => {
  const {
    state, isMultiplayer, myIndex,
    topPlayer, leftPlayer, rightPlayer, bottomPlayer,
    logEndRef, showSeepAnim,
    chatUnread, markChatRead, sendChat,
  } = useGame();

  const chatEnabled = !!state.roomId && state.players.some(p => p.isHuman && p.id !== myIndex);

  return (
    <>
      {/* Page-level overlay, not felt content: fixed to the top of the
          viewport above whatever the grid is doing. */}
      <div
        className="fixed left-0 right-0 flex items-start justify-between gap-2 p-2 sm:p-3 pointer-events-none"
        style={{ zIndex: Z_HUD, top: 'var(--safe-t)' }}
      >
        <div className="pointer-events-auto">
          <HUD state={state} isMultiplayer={isMultiplayer} roomId={state.roomId || ''} />
        </div>
        {/* No GameLog panel here on purpose — remembering past plays is part
            of the game. The component is in @laurelwood/card-class if this
            ever gets turned back on. */}
      </div>

      <TableGrid
        className="relative"
        top={topPlayer !== -1 && <PlayerHand playerIndex={topPlayer} position="top" />}
        left={leftPlayer !== -1 && <PlayerHand playerIndex={leftPlayer} position="left" />}
        right={rightPlayer !== -1 && <PlayerHand playerIndex={rightPlayer} position="right" />}
        bottom={bottomPlayer !== -1 && <PlayerHand playerIndex={bottomPlayer} position="bottom" />}
      >
        <Felt>
          {state.gameLog.length > 0 && state.gamePhase === 'PLAYING' && (
            <LastMoveBanner message={state.gameLog[state.gameLog.length - 1]} />
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 z-10 max-w-full">
            <FeltContent />
          </div>

          {showSeepAnim && <SeepOverlay />}
        </Felt>
      </TableGrid>

      {chatEnabled && (
        <div
          className="fixed right-0 flex justify-end p-2 sm:p-3 pointer-events-none"
          style={{ zIndex: Z_HUD, bottom: 'var(--safe-b)' }}
        >
          <div className="pointer-events-auto">
            <ChatRoom
              messages={state.chatLog ?? []}
              myIndex={myIndex}
              unread={chatUnread}
              onOpen={markChatRead}
              onClose={() => { /* unread only grows while closed */ }}
              onSend={sendChat}
            />
          </div>
        </div>
      )}
      <SharedOverlays />
    </>
  );
};
