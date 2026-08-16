import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, GameState } from '../types';
import {
  getRankLabel,
  TEAM_LABELS, TEAM_TEXT_COLORS,
  Z_HUD, Z_ACTION_BAR, Z_OVERLAY, Z_MODAL,
  CHAT_MAX_LEN,
} from '../constants';
import { SEEP_POINTS, getPointsForCard } from '../rules';

/** HUD panel — top-left score display */
export function HUD({ state, isMultiplayer, roomId }: {
  state: GameState; isMultiplayer: boolean; roomId: string;
}) {
  const [copied, setCopied] = useState(false);
  const copyRoom = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  };
  const getLivePoints = (teamIndex: 0 | 1) => {
    if (state.gamePhase !== 'PLAYING') return 0;
    const teamSeeps = teamIndex === 0 ? state.seeps.team0 : state.seeps.team1;
    const cards = state.players.filter(p => p.team === teamIndex).flatMap(p => p.capturedCards);
    return teamSeeps + cards.reduce((sum, c) => sum + getPointsForCard(c), 0);
  };

  const pts0 = getLivePoints(0);
  const pts1 = getLivePoints(1);

  const base0 = state.totalScores.team0;
  const base1 = state.totalScores.team1;
  const total0 = base0 + pts0;
  const total1 = base1 + pts1;
  const lead = total0 - total1;
  const leadingTeam: 0 | 1 | null = lead > 0 ? 0 : lead < 0 ? 1 : null;

  const team0IsLeader = leadingTeam === 0;
  const team1IsLeader = leadingTeam === 1;

  return (
    <div className="glass-panel px-3 py-2 sm:px-4 sm:py-3 rounded-2xl isolate" style={{ zIndex: Z_HUD }}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-stretch gap-0.5 rounded-full pill-chip p-0.5 sm:p-1">
          <div className={`flex flex-col items-center justify-center px-2.5 py-0.5 sm:px-6 sm:py-1 rounded-full transition-colors ${team0IsLeader ? 'bg-[color:var(--bg-2)] ring-1 ring-[color:var(--line)]' : ''}`}>
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--accent)' }}>A</span>
            <span className="font-display text-sm sm:text-base leading-none tabular-nums" style={{ color: 'var(--accent)' }}>
              {base0}{pts0 > 0 ? ` (${pts0})` : ''}
            </span>
          </div>
          <div className="w-px my-1" style={{ background: 'var(--line)' }} />
          <div className={`flex flex-col items-center justify-center px-2.5 py-0.5 sm:px-6 sm:py-1 rounded-full transition-colors ${team1IsLeader ? 'bg-[color:var(--bg-2)] ring-1 ring-[color:var(--line)]' : ''}`}>
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--red)' }}>B</span>
            <span className="font-display text-sm sm:text-base leading-none tabular-nums" style={{ color: 'var(--red)' }}>
              {base1}{pts1 > 0 ? ` (${pts1})` : ''}
            </span>
          </div>
          <div className="w-px my-1" style={{ background: 'var(--line)' }} />
          <div className="flex flex-col items-center justify-center px-2.5 py-0.5 sm:px-6 sm:py-1 rounded-full">
            <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: 'var(--dim)' }}>Lead</span>
            <span
              className="font-display text-sm sm:text-base leading-none tabular-nums"
              style={{ color: leadingTeam === 0 ? 'var(--accent)' : leadingTeam === 1 ? 'var(--red)' : 'var(--dim)' }}
            >
              {leadingTeam === null ? '—' : `${TEAM_LABELS[leadingTeam]} +${Math.abs(lead)}`}
            </span>
          </div>
        </div>
      </div>

      {(state.bidRank != null || (isMultiplayer && roomId) || (state.gamePhase === 'PLAYING' && state.players[state.dealerIndex])) && (
        <div className="mt-2 flex flex-col gap-y-1 text-[14px]" style={{ color: 'var(--dim)' }}>
          {state.bidRank != null && (
            <div>
              {state.players[state.bidderIndex] && (
                <span className="text-[color:var(--fg)]">{state.players[state.bidderIndex].name}</span>
              )}
              <span> bid </span>
              <span className="text-[color:var(--accent)]">{getRankLabel(state.bidRank)}</span>
            </div>
          )}
          {state.gamePhase === 'PLAYING' && state.players[state.dealerIndex] && (
            <div>
              <span>Last player is </span>
              <span className="text-[color:var(--fg)]">{state.players[state.dealerIndex].name}</span>
            </div>
          )}
          {isMultiplayer && roomId && (
            <div className="flex items-center gap-x-3">
              <button
                onClick={copyRoom}
                title="Click to copy — share with a disconnected player"
                className="ml-auto font-mono hover:text-[color:var(--accent)] transition-colors"
              >
                {copied ? 'Copied!' : roomId}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Seep animation overlay — rendered inside the felt so it centers on the arena. */
export function SeepOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: Z_OVERLAY }}
    >
      <div
        className="text-5xl sm:text-6xl md:text-8xl font-display animate-fade-in transition-all duration-700 text-center scale-110 tracking-widest"
        style={{ color: 'var(--accent)', textShadow: '0 0 24px rgba(111,176,255,0.55)' }}
      >
        SEEP!
        <div className="text-xl sm:text-2xl md:text-3xl mt-2 tracking-normal" style={{ color: 'var(--fg)' }}>
          +{SEEP_POINTS} Points
        </div>
      </div>
    </div>
  );
}

/** Action buttons (Throw / Capture / Build) */
export function ActionBar({ canThrow, canCapture, canBuild, buildTarget, onAction, reasons, isBidding, canBid, bidReason, onBid }: {
  canThrow: boolean;
  canCapture: boolean;
  canBuild: boolean;
  buildTarget?: number;
  onAction: (type: 'CAPTURE' | 'THROW' | 'BUILD') => void;
  reasons?: { throw?: string; capture?: string; build?: string };
  isBidding?: boolean;
  canBid?: boolean;
  bidReason?: string;
  onBid?: () => void;
}) {
  type BtnType = 'THROW' | 'CAPTURE' | 'BUILD' | 'BID';
  const buttons: { label: string; type: BtnType; enabled: boolean; tooltip?: string; hint?: string }[] = isBidding
    ? [
        { label: 'Throw',   type: 'THROW',   enabled: false, tooltip: 'Place your bid first' },
        { label: 'Bid',     type: 'BID',     enabled: !!canBid, tooltip: bidReason },
        { label: 'Capture', type: 'CAPTURE', enabled: false, tooltip: 'Place your bid first' },
      ]
    : [
        { label: 'Throw',   type: 'THROW',   enabled: canThrow,   tooltip: reasons?.throw },
        { label: 'Build',   type: 'BUILD',   enabled: canBuild,   tooltip: reasons?.build },
        { label: 'Capture', type: 'CAPTURE', enabled: canCapture, tooltip: reasons?.capture },
      ];

  const [activeTooltip, setActiveTooltip] = useState<BtnType | null>(null);
  const tooltipTimerRef = React.useRef<number | null>(null);
  const showTooltip = (type: BtnType) => {
    if (tooltipTimerRef.current) window.clearTimeout(tooltipTimerRef.current);
    setActiveTooltip(type);
    tooltipTimerRef.current = window.setTimeout(() => setActiveTooltip(null), 2200);
  };
  const clearTooltip = () => {
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setActiveTooltip(null);
  };

  return (
    <div className="flex gap-2 justify-center w-full max-w-md mx-auto" style={{ zIndex: Z_ACTION_BAR }}>
      {buttons.map(b => (
        <span
          key={b.type}
          className="relative inline-block flex-1"
          style={{ isolation: 'isolate', zIndex: 9999 }}
          onMouseEnter={() => { if (b.tooltip) setActiveTooltip(b.type); }}
          onMouseLeave={() => { if (activeTooltip === b.type) clearTooltip(); }}
        >
          {b.tooltip && activeTooltip === b.type && (
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 rounded-md text-[color:var(--fg)] text-xs leading-snug text-center transition-opacity duration-75 pointer-events-none"
              style={{ zIndex: 999, width: 'max-content', maxWidth: '240px', whiteSpace: 'normal', background: 'var(--bg-1)', border: '1px solid var(--line)', boxShadow: '0 6px 18px rgba(0,0,0,0.5)' }}
            >
              {b.tooltip}
            </div>
          )}
          <button
            onClick={() => {
              if (!b.enabled) {
                if (b.tooltip) showTooltip(b.type);
                return;
              }
              clearTooltip();
              if (b.type === 'BID') { onBid?.(); return; }
              onAction(b.type);
            }}
            aria-disabled={!b.enabled}
            className={`
              w-full px-3 sm:px-4 py-3 rounded-2xl text-sm font-semibold
              transition-all flex items-center justify-center gap-1.5
              ${b.enabled
                ? 'btn-accent'
                : 'text-[color:var(--dimmer)] bg-[color:var(--bg-1)]/50 border border-[color:var(--line-soft)] cursor-not-allowed opacity-60'}
            `}
          >
            {b.label}
            {b.hint && <span className="text-[10px] opacity-70 tracking-wider">{b.hint}</span>}
          </button>
        </span>
      ))}
    </div>
  );
}

/** Round-over / Game-over modal */
export function GameOverModal({ state, isHost, myIndex, onNextRound, onReturnToLobby }: {
  state: GameState; isHost: boolean; myIndex: number; onNextRound: () => void; onReturnToLobby: () => void;
}) {
  const isOver = state.gamePhase === 'GAME_OVER';
  const winningTeam: 0 | 1 = state.totalScores.team0 >= state.totalScores.team1 ? 0 : 1;
  const teamMembers = (t: 0 | 1) => state.players.filter(p => p.team === t).map(p => p.name);
  const roundWinningTeam: 0 | 1 | null =
    state.roundScores.team0 > state.roundScores.team1 ? 0 :
    state.roundScores.team1 > state.roundScores.team0 ? 1 : null;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: Z_MODAL, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div className="glass-panel p-6 sm:p-9 rounded-2xl text-center max-w-lg w-full">
        <h1 className={`text-2xl sm:text-3xl font-display mb-2 ${isOver ? TEAM_TEXT_COLORS[winningTeam] : 'text-[color:var(--accent)]'}`}>
          {isOver ? `Team ${TEAM_LABELS[winningTeam]} Wins!` : 'Round Complete'}
        </h1>
        {!isOver && (
          <p className="text-sm mb-5" style={{ color: 'var(--fg-soft)' }}>
            {roundWinningTeam !== null ? (
              <>Team <span className={TEAM_TEXT_COLORS[roundWinningTeam]}>{TEAM_LABELS[roundWinningTeam]}</span> won this round</>
            ) : (
              'Round tied'
            )}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          {([0, 1] as const).map((teamIndex) => {
            const label = `Team ${TEAM_LABELS[teamIndex]}`;
            const total = teamIndex === 0 ? state.totalScores.team0 : state.totalScores.team1;
            const roundPts = teamIndex === 0 ? state.roundScores.team0 : state.roundScores.team1;
            const isWinner = isOver && teamIndex === winningTeam;
            const isRoundWinner = !isOver && teamIndex === roundWinningTeam;
            const highlight = isWinner || isRoundWinner;
            return (
              <div
                key={teamIndex}
                className="p-4 rounded-xl"
                style={{
                  background: highlight ? 'rgba(127,215,169,0.1)' : 'var(--bg-1)',
                  border: `1px solid ${highlight ? 'rgba(127,215,169,0.4)' : 'var(--line)'}`,
                }}
              >
                <div className="text-[10px] uppercase tracking-[0.14em] mb-2 flex items-center justify-center gap-2" style={{ color: 'var(--dim)' }}>
                  <span>{label}</span>
                  {isWinner && <span className="normal-case tracking-normal" style={{ color: 'var(--good)' }}>Winner</span>}
                  {isRoundWinner && <span className="normal-case tracking-normal" style={{ color: 'var(--good)' }}>Round</span>}
                </div>
                {!isOver && (
                  <div className="mb-2">
                    <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>This round</div>
                    <div className={`text-xl sm:text-2xl font-display ${TEAM_TEXT_COLORS[teamIndex]}`}>+{roundPts}</div>
                  </div>
                )}
                <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>Total</div>
                <div className={`text-3xl sm:text-4xl font-display ${TEAM_TEXT_COLORS[teamIndex]}`}>{total}</div>
                {isOver && (
                  <ul className="mt-3 text-xs sm:text-sm space-y-0.5" style={{ color: 'var(--fg-soft)' }}>
                    {teamMembers(teamIndex).map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {isOver ? (() => {
          const readySet = new Set(state.readyForLobbyIndices || []);
          const humanPlayers = state.players.filter(p => p.isHuman);
          const totalHumans = humanPlayers.length;
          const readyHumans = humanPlayers.filter(p => readySet.has(p.id)).length;
          const iAmReady = readySet.has(myIndex);
          return (
            <>
              <button
                onClick={onReturnToLobby}
                disabled={iAmReady}
                className={`w-full py-3 rounded-xl text-base font-semibold transition-all ${
                  iAmReady
                    ? 'text-[color:var(--dimmer)] bg-[color:var(--bg-1)]/50 border border-[color:var(--line-soft)] cursor-not-allowed'
                    : 'btn-accent'
                }`}
              >
                {iAmReady ? 'Waiting for others' : 'Return to Lobby'}
              </button>
              {totalHumans > 1 && (
                <p className="text-xs mt-2" style={{ color: 'var(--dim)' }}>
                  {readyHumans} / {totalHumans} ready
                </p>
              )}
            </>
          );
        })() : isHost ? (
          <button
            onClick={onNextRound}
            className="btn-accent w-full py-3 rounded-xl text-base font-semibold transition-all"
          >
            Next Round
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2" style={{ color: 'var(--fg-soft)' }}>
            <span className="animate-pulse inline-block w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
            Waiting for host
          </div>
        )}
      </div>
    </div>
  );
}
