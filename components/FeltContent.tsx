import React from 'react';
import { CardComponent } from './CardComponent';
import { useGame } from '../GameContext';
import { Z_CARD_SELECTED, Z_HOUSE_BADGE, getRankLabel, TEAM_LABELS, TEAM_TEXT_COLORS } from '../constants';
import { getPointsForCard } from '../rules';
import { clearSession } from '../utils/session';

/** Felt contents — bidding message, houses, floor cards, and the in-flight ghost stack. */
export const FeltContent: React.FC = () => {
  const {
    state, myIndex, isHost, handleDispatch,
    selectedFloorIds, selectedHouseIds,
    previewHouseId, setPreviewHouseId,
    toggleFloorCard, toggleHouse,
    visualThrow, visualCapturePile, sweepingToPlayer,
  } = useGame();

  return (
    <>
      {state.gamePhase === 'GAME_OVER' && (() => {
        const { totalScores } = state;
        const winningTeam: 0 | 1 = totalScores.team0 >= totalScores.team1 ? 0 : 1;
        const teamMembers = (t: 0 | 1) => state.players.filter(p => p.team === t).map(p => p.name);
        const readySet = new Set(state.readyForLobbyIndices || []);
        const humanPlayers = state.players.filter(p => p.isHuman);
        const totalHumans = humanPlayers.length;
        const readyHumans = humanPlayers.filter(p => readySet.has(p.id)).length;
        const iAmReady = readySet.has(myIndex);
        return (
          <div className="flex flex-col items-center gap-4 sm:gap-6 px-4 py-6 sm:py-8 max-w-xl w-full">
            <div className="text-center">
              <div className="text-xs sm:text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--dim)' }}>Game Over</div>
              <div className={`mt-1 text-xl sm:text-2xl font-display ${TEAM_TEXT_COLORS[winningTeam]}`}>
                Team {TEAM_LABELS[winningTeam]} Wins!
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
              {([0, 1] as const).map(team => {
                const label = `Team ${TEAM_LABELS[team]}`;
                const total = team === 0 ? totalScores.team0 : totalScores.team1;
                const isWinner = team === winningTeam;
                return (
                  <div
                    key={team}
                    className="p-3 sm:p-4 rounded-xl text-center"
                    style={{
                      background: isWinner ? 'rgba(127,215,169,0.1)' : 'var(--bg-1)',
                      border: `1px solid ${isWinner ? 'rgba(127,215,169,0.4)' : 'var(--line)'}`,
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-[0.14em] flex items-center justify-center gap-2" style={{ color: 'var(--dim)' }}>
                      <span>{label}</span>
                      {isWinner && <span className="normal-case tracking-normal" style={{ color: 'var(--good)' }}>Winner</span>}
                    </div>
                    <div className={`text-2xl sm:text-3xl font-display mt-1 ${TEAM_TEXT_COLORS[team]}`}>{total}</div>
                    <ul className="mt-2 text-[11px] sm:text-xs space-y-0.5" style={{ color: 'var(--fg-soft)' }}>
                      {teamMembers(team).map((name, i) => (
                        <li key={i}>{name}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => {
                  if (isHost) clearSession();
                  handleDispatch({ type: 'RETURN_TO_LOBBY', payload: { playerIndex: myIndex } });
                }}
                disabled={iAmReady}
                className={`px-6 py-2.5 rounded-xl text-sm sm:text-base font-semibold transition-all ${
                  iAmReady
                    ? 'text-[color:var(--dimmer)] bg-[color:var(--bg-1)]/50 border border-[color:var(--line-soft)] cursor-not-allowed'
                    : 'btn-accent'
                }`}
              >
                {iAmReady ? 'Waiting for others' : 'Return to Lobby'}
              </button>
              {totalHumans > 1 && (
                <p className="text-xs" style={{ color: 'var(--dim)' }}>
                  {readyHumans} / {totalHumans} ready
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {state.gamePhase === 'ROUND_OVER' && (() => {
        const { roundScores, totalScores } = state;
        const roundWinner: 0 | 1 | null =
          roundScores.team0 > roundScores.team1 ? 0 :
          roundScores.team1 > roundScores.team0 ? 1 : null;
        return (
          <div className="flex flex-col items-center gap-4 sm:gap-6 px-4 py-6 sm:py-8 max-w-xl w-full">
            <div className="text-center">
              <div className="text-xs sm:text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--dim)' }}>Round Complete</div>
              <div className="mt-1 text-lg sm:text-xl font-display" style={{ color: 'var(--fg)' }}>
                {roundWinner !== null ? (
                  <>Team <span className={TEAM_TEXT_COLORS[roundWinner]}>{TEAM_LABELS[roundWinner]}</span> wins the round</>
                ) : 'Round tied'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
              {([0, 1] as const).map(team => {
                const label = `Team ${TEAM_LABELS[team]}`;
                const round = team === 0 ? roundScores.team0 : roundScores.team1;
                const total = team === 0 ? totalScores.team0 : totalScores.team1;
                const isWinner = team === roundWinner;
                return (
                  <div
                    key={team}
                    className="p-3 sm:p-4 rounded-xl text-center"
                    style={{
                      background: isWinner ? 'rgba(127,215,169,0.08)' : 'var(--bg-1)',
                      border: `1px solid ${isWinner ? 'rgba(127,215,169,0.35)' : 'var(--line)'}`,
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>{label}</div>
                    <div className={`text-xl sm:text-2xl font-display ${TEAM_TEXT_COLORS[team]}`}>+{round}</div>
                    <div className="text-[10px] mt-1 uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>Total</div>
                    <div className={`text-base sm:text-lg font-display ${TEAM_TEXT_COLORS[team]}`}>{total}</div>
                  </div>
                );
              })}
            </div>
            {isHost ? (
              <button
                onClick={() => handleDispatch({ type: 'START_ROUND' })}
                className="btn-accent px-6 py-2.5 rounded-xl text-sm sm:text-base font-semibold"
              >
                Next Round
              </button>
            ) : (
              <div className="text-xs sm:text-sm animate-pulse" style={{ color: 'var(--fg-soft)' }}>Waiting for host</div>
            )}
          </div>
        );
      })()}

      {state.gamePhase === 'BIDDING' && (
        <div className="flex flex-col items-center animate-pulse">
          {state.players[state.bidderIndex] && (
            <span
              className="font-display text-base sm:text-lg px-4 py-2 rounded-xl"
              style={{ color: 'var(--fg)', background: 'var(--bg-1)', border: '1px solid var(--line)' }}
            >
              {state.players[state.bidderIndex].id === myIndex ? 'Your Bid' : `${state.players[state.bidderIndex].name} is bidding`}
            </span>
          )}
        </div>
      )}

      {state.gamePhase === 'PLAYING' && (
        <>
          {[...state.houses].filter(h => !visualCapturePile.includes(h.id)).sort((a, b) => a.rank - b.rank).map((house) => {
            const topCard = house.cards[house.cards.length - 1];
            const ownerNames = house.ownerIndices.map(i => state.players[i]?.name).filter(Boolean).join(', ');
            const tooltipLabel = ownerNames || 'Unowned';
            const stackDepth = Math.min(3, Math.max(1, house.cards.length));
            const ownerTeams = house.ownerIndices.map(i => state.players[i]?.team);
            const hasTeam0 = ownerTeams.includes(0);
            const hasTeam1 = ownerTeams.includes(1);
            const isCoOwned = hasTeam0 && hasTeam1;
            const ownerTeam = state.players[house.ownerIndices[0]]?.team;
            const teamColor = isCoOwned ? '#a980e8' : (ownerTeam === 1 ? 'var(--red)' : 'var(--accent)');
            const teamColorBright = isCoOwned ? '#c9a4ff' : (ownerTeam === 1 ? '#ff5a6e' : '#3d8aff');
            return (
              <div
                key={house.id}
                onClick={() => toggleHouse(house.id)}
                data-card-id={`house-${house.id}`}
                className={`group relative isolate transition-transform hover:scale-105 hover:-translate-y-1 cursor-pointer flex-shrink-0 ${selectedHouseIds.has(house.id) ? 'scale-110 -translate-y-4' : ''}`}
                style={selectedHouseIds.has(house.id) ? { zIndex: Z_CARD_SELECTED } : undefined}
              >
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-2.5 py-1 rounded-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none"
                  style={{ zIndex: Z_HOUSE_BADGE + 2, background: 'var(--bg-1)', color: 'var(--fg)', border: '1px solid var(--line)', boxShadow: '0 6px 18px rgba(0,0,0,0.5)' }}
                >
                  {tooltipLabel}
                </div>
                {Array.from({ length: stackDepth - 1 }).map((_, i) => (
                  <div
                    key={`shadow-${i}`}
                    aria-hidden="true"
                    className="absolute top-0 left-0 w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 lg:w-24 lg:h-36 rounded-lg card-shadow pointer-events-none"
                    style={{
                      transform: `translate(${(i + 1) * 3}px, ${(i + 1) * 3}px) rotate(${(i + 1) * (i % 2 === 0 ? -2 : 2)}deg)`,
                      background: 'linear-gradient(180deg, #faf9f5 0%, #ece8de 100%)',
                    }}
                  />
                ))}
                <CardComponent
                  card={topCard}
                  isHouse
                  isCementedHouse={house.isCemented}
                  className={selectedHouseIds.has(house.id) ? 'ring-[3px] ring-[color:var(--red)] shadow-[0_0_12px_3px_rgba(232,146,154,0.9)]' : ''}
                  flipId={topCard.id}
                />
                <div
                  onClick={(e) => { e.stopPropagation(); setPreviewHouseId(house.id); }}
                  className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 rounded-full min-w-[22px] h-6 sm:min-w-[26px] sm:h-7 px-1.5 flex items-center justify-center text-xs sm:text-sm font-display cursor-pointer hover:scale-110 transition-transform active:scale-95"
                  style={{
                    zIndex: Z_HOUSE_BADGE,
                    background: teamColor,
                    color: '#1a1d22',
                    boxShadow: house.isCemented
                      ? `0 2px 6px rgba(0,0,0,0.4), 0 0 0 1.5px var(--bg), 0 0 0 3px ${teamColorBright}`
                      : '0 2px 6px rgba(0,0,0,0.4), 0 0 0 2px var(--bg)',
                    fontWeight: 600,
                  }}
                  title="Inspect House Cards"
                >
                  {getRankLabel(house.rank)}
                </div>
                <div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] rounded-full px-1.5 py-0.5 whitespace-nowrap"
                  style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: '#fff', fontWeight: 600, letterSpacing: '0.04em' }}
                >
                  {house.cards.reduce((sum, c) => sum + getPointsForCard(c), 0)}
                </div>
              </div>
            );
          })}

          {state.floor.filter(c => !visualCapturePile.includes(c.id)).map(card => (
            <CardComponent
              key={card.id}
              card={card}
              isSelected={selectedFloorIds.has(card.id)}
              onClick={() => toggleFloorCard(card.id)}
            />
          ))}

          {visualThrow && sweepingToPlayer === null && (() => {
            const p = state.players[visualThrow.playerIndex];
            const playedCard = p?.hand.find(x => x.id === visualThrow.cardId)
              || p?.capturedCards.find(x => x.id === visualThrow.cardId);
            // Show the stack even without a played card (end-of-round leftover sweep).
            if (!playedCard && visualCapturePile.length === 0) return null;

            return (
              <div
                className="relative inline-block isolate flex-shrink-0 mr-4"
                data-card-id="capture-stack"
              >
                {visualCapturePile.map((targetId, i) => {
                  const targetCard = state.floor.find(f => f.id === targetId);
                  if (targetCard) {
                    return (
                      <div key={`stack-${targetId}`} className="absolute top-0 left-0" style={{ zIndex: i }}>
                        <CardComponent card={targetCard} />
                      </div>
                    );
                  }
                  const targetHouse = state.houses.find(h => h.id === targetId);
                  if (targetHouse) {
                    const topCard = targetHouse.cards[targetHouse.cards.length - 1];
                    return (
                      <div key={`stack-${targetId}`} className="absolute top-0 left-0" style={{ zIndex: i }} data-card-id={`house-${targetHouse.id}`}>
                        <CardComponent card={topCard} isHouse flipId={`house-${targetHouse.id}-stack`} />
                      </div>
                    );
                  }
                  return null;
                })}

                {playedCard && (
                  <div className="relative" style={{ zIndex: visualCapturePile.length }}>
                    <CardComponent
                      key={`ghost-${playedCard.id}`}
                      card={playedCard}
                      faceDown={false}
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </>
  );
};
