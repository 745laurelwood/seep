import React from 'react';
import { CardComponent } from '../components/CardComponent';
import { ActionBar, LastMoveBanner, SeepOverlay } from '../components/panels';
import { FeltContent } from '../components/FeltContent';
import { SharedOverlays } from '../components/SharedOverlays';
import { useGame } from '../GameContext';
import { getPointsForCard } from '../rules';

export const MobileView: React.FC = () => {
  const {
    state, myIndex,
    topPlayer, rightPlayer, leftPlayer, bottomPlayer,
    selectedCardId, setSelectedCardId,
    setShowMyCaptures,
    mobileLogOpen, setMobileLogOpen,
    visualThrow, sweepingToPlayer, mobileOpponentSource,
    canThrow, canCapture, canBuild, buildTarget, actionReasons,
    executeAction, executeBid, canBid, bidReason, showSeepAnim,
  } = useGame();

  const isBidderMobile = state.gamePhase === 'BIDDING' && state.bidderIndex === myIndex;

  const sweepTarget = sweepingToPlayer !== null && visualThrow
    ? state.players[sweepingToPlayer]?.capturedCards.find(c => c.id === visualThrow.cardId)
    : null;

  const oppIndices = [leftPlayer, topPlayer, rightPlayer].filter(i => i !== -1);
  const me = bottomPlayer !== -1 ? state.players[bottomPlayer] : null;

  const getLivePoints = (teamIndex: 0 | 1) => {
    if (state.gamePhase !== 'PLAYING') return 0;
    const teamSeeps = teamIndex === 0 ? state.seeps.team0 : state.seeps.team1;
    const cards = state.players.filter(p => p.team === teamIndex).flatMap(p => p.capturedCards);
    return teamSeeps + cards.reduce((sum, c) => sum + getPointsForCard(c), 0);
  };
  const total0 = state.totalScores.team0 + getLivePoints(0);
  const total1 = state.totalScores.team1 + getLivePoints(1);
  const isMyTurn = state.currentTurn === myIndex;

  return (
    <>
      <div className="m-phone">
        <header className="m-hud">
          <div className="m-hud-bar">
            <button
              className="m-hud-btn m-home-btn"
              onClick={() => {
                if (confirm('Leave game and return to home?')) window.location.reload();
              }}
              title="Home"
              aria-label="Home"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12l9-9 9 9" />
                <path d="M5 10v10h14V10" />
              </svg>
            </button>
            <div className="m-hs-divider" />
            <div className={`m-hs-cell ${total0 > total1 ? 'active lead' : ''}`}>
              <span className="label">Team A</span>
              <span className="v">{total0}</span>
            </div>
            <div className="m-hs-divider" />
            <div className={`m-hs-cell b ${total1 > total0 ? 'active lead' : ''}`}>
              <span className="label">Team B</span>
              <span className="v">{total1}</span>
            </div>
            <div className="m-hs-divider" />
            <div className={`m-hs-cell ${total1 > total0 ? 'b' : ''} ${total0 !== total1 ? 'lead' : ''}`}>
              <span className="label">Lead</span>
              <span className="v">
                {total0 === total1 ? '—' : `${total0 > total1 ? 'A' : 'B'} +${Math.abs(total0 - total1)}`}
              </span>
            </div>
          </div>
        </header>

        <section className="m-opps">
          {oppIndices.map(i => {
            const opp = state.players[i];
            if (!opp) return <div key={i} />;
            const isTurn = state.currentTurn === i;
            const isReceivingSweep = sweepingToPlayer === i && !!sweepTarget;
            const sourceGhostCard = mobileOpponentSource && mobileOpponentSource.playerIndex === i
              ? opp.hand.find(c => c.id === mobileOpponentSource.cardId)
              : null;
            return (
              <div key={i} className={`m-opp ${isTurn ? 'turn' : ''} ${opp.team === 1 ? 'b' : ''}`}>
                {isReceivingSweep && sweepTarget && (
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                    data-card-id="capture-stack"
                  >
                    <CardComponent card={sweepTarget} flipId="sweep-pile-card" />
                  </div>
                )}
                {sourceGhostCard && (
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0"
                    data-card-id={sourceGhostCard.id}
                  >
                    <CardComponent card={sourceGhostCard} faceDown={false} />
                  </div>
                )}
                <div className="av">{opp.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="name">{opp.name}</div>
              </div>
            );
          })}
        </section>

        <div className="m-felt-wrap">
          <div className="m-felt">
            <div className="m-felt-grid">
              <FeltContent />
            </div>
            {showSeepAnim && <SeepOverlay />}
          </div>
          {state.gameLog.length > 0 && state.gamePhase === 'PLAYING' && (
            <LastMoveBanner message={state.gameLog[state.gameLog.length - 1]} />
          )}
        </div>

        {me && (
          <div className="m-me-chip" style={{ position: 'relative' }}>
            {sweepingToPlayer === bottomPlayer && sweepTarget && (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                data-card-id="capture-stack"
              >
                <CardComponent card={sweepTarget} flipId="sweep-pile-card" />
              </div>
            )}
            <div className="left">
              <div className={`av ${me.team === 1 ? 'b' : ''}`}>{me.name?.[0]?.toUpperCase() || 'Y'}</div>
              <div className="who">{me.name}</div>
              {isMyTurn && state.gamePhase === 'PLAYING' && (
                <span
                  className="animate-accent-pulse"
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--accent)',
                    color: '#06121f',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Your Turn
                </span>
              )}
              {me.capturedCards.length > 0 && (
                <button
                  onClick={() => setShowMyCaptures(true)}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-1)', border: '1px solid var(--line)', color: 'var(--fg-soft)' }}
                >
                  {me.capturedCards.length} cards
                </button>
              )}
            </div>
            <button className="log-btn" onClick={() => setMobileLogOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
              Log
            </button>
          </div>
        )}

        {me && (
          <section className="m-hand-area">
            <div className="m-hand no-scrollbar">
              {[...me.hand]
                .filter(c => !(visualThrow && visualThrow.cardId === c.id && visualThrow.playerIndex === bottomPlayer))
                .sort((a, b) => a.rank === b.rank ? a.suit.localeCompare(b.suit) : a.rank - b.rank)
                .map(card => (
                  <CardComponent
                    key={card.id}
                    card={card}
                    faceDown={false}
                    isPlayable={(isMyTurn && state.gamePhase === 'PLAYING') || isBidderMobile}
                    isSelected={selectedCardId === card.id}
                    onClick={() => {
                      if (isMyTurn || isBidderMobile) {
                        setSelectedCardId(prev => prev === card.id ? null : card.id);
                      }
                    }}
                  />
                ))}
            </div>
          </section>
        )}

        <footer className="m-actions">
          {isBidderMobile ? (
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
          ) : (
            <ActionBar
              canThrow={canThrow}
              canCapture={canCapture}
              canBuild={canBuild}
              buildTarget={buildTarget}
              onAction={executeAction}
              reasons={actionReasons}
            />
          )}
        </footer>

        {mobileLogOpen && (
          <>
            <div className="m-sheet-backdrop" onClick={() => setMobileLogOpen(false)} />
            <div className="m-sheet">
              <div className="m-sheet-handle" />
              <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontFamily: 'Fredoka', fontSize: 15, fontWeight: 500, color: 'var(--fg)' }}>
                Game Log
                <button
                  onClick={() => setMobileLogOpen(false)}
                  style={{ fontSize: 12, color: 'var(--dim)', padding: '4px 10px', borderRadius: 999, background: 'var(--bg-2)' }}
                >
                  Close
                </button>
              </h3>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[...state.gameLog].reverse().map((entry, i) => (
                  <div
                    key={i}
                    style={{ padding: '10px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13, color: 'var(--fg-soft)', lineHeight: 1.4 }}
                  >
                    {entry}
                  </div>
                ))}
                {state.gameLog.length === 0 && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No events yet.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <SharedOverlays />
    </>
  );
};
