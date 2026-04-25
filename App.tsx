import React, { useState, useEffect, useReducer, useRef } from 'react';
import { flushSync } from 'react-dom';
import mqtt from 'mqtt';
import { Card, ChatMessage, GameState, House, Suit } from './types';
import { findSumCombinations, getPossibleMoves, canCaptureWithRank, canPerfectlyPartition } from './utils/gameLogic';
import { sounds } from './utils/sound';
import { flipTransition } from './utils/flip';
import { loadSession, saveSession, clearSession, SavedSession } from './utils/session';
import {
  getRankLabel,
  SEEP_ANIM_DURATION_MS, AI_BID_DELAY_MS, AI_PLAY_DELAY_MS, RESHUFFLE_DELAY_MS,
  EMPTY_SLOT_NAME, CHAT_MAX_LEN,
} from './constants';
import {
  NUM_PLAYERS,
  MIN_HOUSE_RANK, MAX_HOUSE_RANK, VALID_HOUSE_RANKS,
  getPointsForCard,
} from './rules';
import { Action, INITIAL_STATE, makeEmptyPlayer, gameReducer } from './gameReducer';
import { GameProvider, GameContextValue } from './GameContext';
import { MobileView } from './views/MobileView';
import { DesktopView } from './views/DesktopView';
import { Lobby } from './views/Lobby';

const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  // Local UI state
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedFloorIds, setSelectedFloorIds] = useState<Set<string>>(new Set());
  const [selectedHouseIds, setSelectedHouseIds] = useState<Set<string>>(new Set());
  const [previewHouseId, setPreviewHouseId] = useState<string | null>(null);
  const [showMyCaptures, setShowMyCaptures] = useState(false);
  const [visualThrow, setVisualThrow] = useState<{ cardId: string; playerIndex: number } | null>(null);
  const [mobileOpponentSource, setMobileOpponentSource] = useState<{ cardId: string; playerIndex: number } | null>(null);
  const [visualCapturePile, setVisualCapturePile] = useState<string[]>([]);
  const [sweepingToPlayer, setSweepingToPlayer] = useState<number | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [showSeepAnim, setShowSeepAnim] = useState(false);
  const prevSeepsTotal = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Mobile layout (phone-shaped) — detect via media query
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const [mobileLogOpen, setMobileLogOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const lastSeenChatLenRef = useRef(0);

  // Networking state
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('seep_playerName') || '');
  const [fragileHouses, setFragileHouses] = useState(() => {
    const saved = localStorage.getItem('seep_fragileHouses');
    return saved !== null ? saved === 'true' : true;
  });
  const [myIndex, setMyIndex] = useState(0);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(() => loadSession());
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);
  const handleDataRef = useRef<(data: any) => void>(() => {});
  const stateRef = useRef(state);
  const peerIdRef = useRef('');
  const isOrchestratingRef = useRef(false);
  const pendingSyncStateRef = useRef<GameState | null>(null);
  const clientRejoinRef = useRef<{ roomId: string; name: string; myPeerId: string } | null>(null);
  const wakeLockRef = useRef<any | null>(null);
  const hostInitializedRef = useRef(false);
  const hostRoomIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { localStorage.setItem('seep_playerName', playerName); }, [playerName]);
  useEffect(() => { localStorage.setItem('seep_fragileHouses', fragileHouses.toString()); }, [fragileHouses]);

  // ── Screen wake lock: keep screen on while game is active and visible ──
  useEffect(() => {
    if (state.gamePhase === 'LOBBY' || state.gamePhase === 'GAME_OVER') return;
    const lock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) { /* not supported or denied — ignore */ }
    };
    lock();
    const onVis = () => { if (document.visibilityState === 'visible') lock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [state.gamePhase]);

  // ── Host-side wake: force reconnect if stale, rebroadcast state to clients ──
  useEffect(() => {
    if (!isMultiplayer || !isHost) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const client = mqttClientRef.current;
      const roomId = hostRoomIdRef.current;
      if (!client || !roomId) return;
      try {
        if (!client.connected) { client.reconnect(); return; }
      } catch { /* fall through */ }
      try {
        const snapshot = stateRef.current;
        client.publish(`seep_game_${roomId}`, JSON.stringify({ type: 'SYNC_STATE', payload: snapshot }));
      } catch (e) { console.error('Host wake rebroadcast error:', e); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
    };
  }, [isMultiplayer, isHost]);

  // ── Re-associate on tab/PWA wake: republish PLAYER_JOINED and force MQTT reconnect ──
  useEffect(() => {
    if (!isMultiplayer || isHost) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const info = clientRejoinRef.current;
      const client = mqttClientRef.current;
      if (!info || !client) return;
      // If the socket is stale, force a reconnect. On successful reconnect,
      // our on('connect') handler will re-subscribe and re-publish PLAYER_JOINED.
      try {
        if (!client.connected) { client.reconnect(); return; }
      } catch { /* fall through to manual republish */ }
      // Socket still live — republish PLAYER_JOINED so the host rebroadcasts
      // SYNC_STATE to us in case we missed anything during the suspend.
      try {
        const payload = { type: 'PLAYER_JOINED', payload: { name: info.name, peerId: info.myPeerId } };
        client.publish(`seep_game_${info.roomId}`, JSON.stringify(payload));
      } catch (e) { console.error('Client re-associate error:', e); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
    };
  }, [isMultiplayer, isHost]);

  // ── Chat notification sound (plays for messages from others, not our own) ──
  const prevChatLenRef = useRef<number | null>(null);
  useEffect(() => {
    const len = state.chatLog?.length ?? 0;
    if (prevChatLenRef.current === null) {
      prevChatLenRef.current = len;
      return;
    }
    if (len > prevChatLenRef.current) {
      const latest = state.chatLog[len - 1];
      if (latest && latest.playerIndex !== myIndex) sounds.chat();
    }
    prevChatLenRef.current = len;
  }, [state.chatLog, myIndex]);

  // ── Chat unread tracking ──
  // Increment when chatLog grows while chat is closed; reset on open.
  useEffect(() => {
    const len = state.chatLog?.length ?? 0;
    const prev = lastSeenChatLenRef.current;
    if (len > prev) {
      if (isMobile && mobileChatOpen) {
        lastSeenChatLenRef.current = len;
      } else {
        setChatUnread(u => u + (len - prev));
      }
    } else if (len < prev) {
      lastSeenChatLenRef.current = len;
    }
  }, [state.chatLog, isMobile, mobileChatOpen]);

  // ── Auto-save host session on every state change ──
  useEffect(() => {
    if (!isMultiplayer || !isHost || !state.roomId) return;
    if (state.gamePhase === 'LOBBY') return;
    if (state.gamePhase === 'GAME_OVER') { clearSession(); return; }
    saveSession({ role: 'host', roomId: state.roomId, playerName, state });
  }, [isMultiplayer, isHost, state, playerName]);

  // ── Seep animation ──
  useEffect(() => {
    if (!state?.seeps) return;
    const currentTotal = state.seeps.team0 + state.seeps.team1;
    if (state.gamePhase === 'BIDDING' || state.gamePhase === 'LOBBY') {
      if (currentTotal === 0) prevSeepsTotal.current = 0;
    }
    if (currentTotal > prevSeepsTotal.current) {
      sounds.seep();
      setShowSeepAnim(true);
      setTimeout(() => setShowSeepAnim(false), SEEP_ANIM_DURATION_MS);
    }
    prevSeepsTotal.current = currentTotal;
  }, [state?.seeps, state?.gamePhase]);

  // ── Networking: broadcast state to clients ──
  useEffect(() => {
    if (isHost && isMultiplayer && mqttClientRef.current) {
      console.log(`🟪 HOST BROADCASTING STATE [${state.gamePhase}] to Topic seep_game_${state.roomId}`);
      const payloadString = JSON.stringify({ type: 'SYNC_STATE', payload: state });
      try { mqttClientRef.current.publish(`seep_game_${state.roomId}`, payloadString); } catch(e) { console.error('Host broadast error:', e); }
    }
  }, [state, isHost, isMultiplayer]);

  useEffect(() => {
    handleDataRef.current = (data: any) => {
      const s = stateRef.current;
      if (data.type === 'PLAYER_JOINED') {
        const newPlayers = [...s.players];
        const rebroadcast = (players: typeof newPlayers) => {
          // Explicit rebroadcast so the rejoining client gets the full state
          // even if the UPDATE_PLAYERS-triggered broadcast raced its SUBSCRIBE.
          try {
            if (mqttClientRef.current && s.roomId) {
              const snapshot = { ...s, players };
              mqttClientRef.current.publish(
                `seep_game_${s.roomId}`,
                JSON.stringify({ type: 'SYNC_STATE', payload: snapshot })
              );
            }
          } catch (e) { console.error('PLAYER_JOINED rebroadcast error:', e); }
        };

        // 1. Reconnection Logic: If a player's name strictly matches an existing active slot, allow mid-game re-entry!
        const existingPlayerIdx = newPlayers.findIndex(p => p.name === data.payload.name && p.isHuman);
        if (existingPlayerIdx !== -1) {
          newPlayers[existingPlayerIdx] = { ...newPlayers[existingPlayerIdx], peerId: data.payload.peerId, isOnline: true };
          dispatch({ type: 'UPDATE_PLAYERS', payload: newPlayers });
          rebroadcast(newPlayers);
          return;
        }

        // 2. Initial Join Logic: strictly restricted to Lobby bounds
        if (s.gamePhase !== 'LOBBY') {
          // Mid-game rejoin with a name that no longer matches — still give them
          // the current state so they at least render correctly.
          rebroadcast(newPlayers);
          return;
        }
        const slot = newPlayers.findIndex((p, i) => i !== 0 && p.name === EMPTY_SLOT_NAME);
        if (slot !== -1) {
          newPlayers[slot] = { ...newPlayers[slot], name: data.payload.name, isHuman: true, peerId: data.payload.peerId };
          dispatch({ type: 'UPDATE_PLAYERS', payload: newPlayers });
          rebroadcast(newPlayers);
        }
      } else if (data.type === 'CLIENT_ACTION') {
        dispatch(data.payload);
      } else if (data.type === 'PLAYER_OFFLINE') {
        dispatch({ type: 'SET_PLAYER_OFFLINE', payload: { peerId: data.payload.peerId } });
      }
    };
  }, []);

  const initHostWithRef = (resume?: Extract<SavedSession, { role: 'host' }>) => {
    setIsMultiplayer(true);
    setIsHost(true);
    setMyIndex(0);
    setIsDisconnected(false);

    const roomId = resume?.roomId ?? Math.random().toString(36).substring(2, 6).toUpperCase();
    setPeerId(roomId);
    if (!resume) clearSession();

    hostInitializedRef.current = false;
    hostRoomIdRef.current = roomId;

    const client = mqtt.connect(MQTT_BROKER);
    mqttClientRef.current = client;

    client.on('connect', () => {
      console.log('🟩 HOST: Node connected natively to MQTT Broker!');
      setIsDisconnected(false);
      client.subscribe(`seep_game_${roomId}`, (err) => {
        if (err) { console.error('🟩 HOST subscribe error:', err); return; }
        // First connect only: seed state. Later reconnects must not reset it.
        if (!hostInitializedRef.current) {
          hostInitializedRef.current = true;
          if (resume) {
            dispatch({ type: 'SET_GAME_STATE', payload: resume.state });
          } else {
            dispatch({ type: 'INIT_LOBBY', payload: { isHost: true, roomId, hostName: playerName || 'You (Host)', allowFragileHouses: fragileHouses } });
            dispatch({
              type: 'UPDATE_PLAYERS',
              payload: [
                makeEmptyPlayer(0, playerName || 'You (Host)', true, roomId),
                makeEmptyPlayer(1, EMPTY_SLOT_NAME, false),
                makeEmptyPlayer(2, EMPTY_SLOT_NAME, false),
                makeEmptyPlayer(3, EMPTY_SLOT_NAME, false),
              ],
            });
          }
        } else {
          // Reconnect — rebroadcast current state so any clients that lost
          // sync while we were away catch up immediately.
          try {
            const snapshot = stateRef.current;
            client.publish(`seep_game_${roomId}`, JSON.stringify({ type: 'SYNC_STATE', payload: snapshot }));
          } catch (e) { console.error('🟩 HOST rebroadcast error:', e); }
        }
      });
    });

    client.on('message', (topic, message) => {
      try {
        const raw = message.toString();
        const parsed = JSON.parse(raw);

        if (parsed.type === 'SYNC_STATE') return;
        if (parsed.type === 'MOVE_ANNOUNCE' && parsed.originatorPeerId === roomId) return;

        console.log('🟩 HOST RECEIVED DATA:', parsed?.type || 'UNKNOWN');

        if (parsed.type === 'MOVE_ANNOUNCE') {
          executeOrchestratedMove(parsed.payload, (p) => {
            dispatch({ type: 'PLAY_MOVE', payload: p });
          });
          return;
        }

        if (parsed.type === 'PLAYER_JOINED' || parsed.type === 'CLIENT_ACTION' || parsed.type === 'PLAYER_OFFLINE') {
          handleDataRef.current(parsed);
        }
      } catch(e) { console.error('Host JSON Parse Error:', e); }
    });

    client.on('close', () => {
      console.warn('🟩 HOST: MQTT Connection dropped.');
      setIsDisconnected(true);
    });
  };

  const joinGame = (resume?: Extract<SavedSession, { role: 'client' }>) => {
    const roomId = (resume?.roomId ?? joinId).toUpperCase();
    const name = resume?.playerName ?? playerName;
    if (!roomId) return;
    if (resume && !joinId) setJoinId(roomId);
    setIsMultiplayer(true);
    setIsHost(false);
    setIsDisconnected(false);

    const myPeerId = resume?.myPeerId ?? Math.random().toString(36).substring(2, 9);
    setPeerId(myPeerId);

    const displayName = name || `Player ${myPeerId.substring(0, 4)}`;
    saveSession({ role: 'client', roomId, playerName: displayName, myPeerId });
    clientRejoinRef.current = { roomId, name: displayName, myPeerId };

    const client = mqtt.connect(MQTT_BROKER, {
      will: {
        topic: `seep_game_${roomId}`,
        payload: JSON.stringify({ type: 'PLAYER_OFFLINE', payload: { peerId: myPeerId } }),
        qos: 0,
        retain: false
      }
    });
    mqttClientRef.current = client;

    client.on('connect', () => {
      console.log('🟦 CLIENT: Connection fully OPEN to Cloud Room:', roomId);
      setIsDisconnected(false);

      // Wait for SUBACK before publishing PLAYER_JOINED, otherwise the host's
      // SYNC_STATE response can be routed before our subscription is registered
      // (common on mobile reconnect after screen wake).
      client.subscribe(`seep_game_${roomId}`, (err) => {
        if (err) {
          console.error('🟦 CLIENT subscribe error:', err);
          return;
        }
        const joinPayload = { type: 'PLAYER_JOINED', payload: { name: displayName, peerId: myPeerId } };
        console.log('🟦 CLIENT SENDING:', joinPayload.type);
        client.publish(`seep_game_${roomId}`, JSON.stringify(joinPayload));
      });
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'SYNC_STATE') {
          console.log(`🟦 CLIENT RECEIVED DATA: [SYNC_STATE] | Phase: ${data?.payload?.gamePhase || 'N/A'}`);
          const newState = data.payload as GameState;
          if (isOrchestratingRef.current) {
            pendingSyncStateRef.current = newState;
            return;
          }
          const me = newState.players.find(p => p.peerId === myPeerId);
          if (me) setMyIndex(me.id);
          dispatch({ type: 'SET_GAME_STATE', payload: newState });
        } else if (data.type === 'MOVE_ANNOUNCE') {
          if (data.originatorPeerId === myPeerId) return;
          executeOrchestratedMove(data.payload, (p) => {
            dispatch({ type: 'PLAY_MOVE', payload: p });
          });
        }
      } catch(e) { console.error('Client JSON Parse Error:', e); }
    });

    client.on('close', () => {
      console.warn('🟦 CLIENT: MQTT Connection dropped.');
      setIsDisconnected(true);
    });
  };

  // ── Auto-scroll game log ──
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [state.gameLog]);

  // ── Reshuffle detection ──
  useEffect(() => {
    if (state.gamePhase !== 'BIDDING' || !isHost) return;
    const bidder = state.players[state.bidderIndex];
    if (bidder.hand.length === 0) {
      setTimeout(() => dispatch({ type: 'START_ROUND' }), RESHUFFLE_DELAY_MS);
    }
  }, [state.gamePhase, state.players, state.bidderIndex, isHost]);

  // ── Animation Sequence Helper ──
  const FLIP_FLY_MS = 1000;
  const FLIP_STACK_MS = 500;
  const FLIP_SWEEP_MS = 1000;

  const executeOrchestratedMove = async (
    actionPayload: any,
    commitDispatch: (payload: any) => void,
    onStep1?: () => void
  ) => {
    const commitFinal = (isSweepCapture = false) => {
      return flipTransition(() => {
        if (!isSweepCapture) {
          setVisualThrow(null);
          setVisualCapturePile([]);
        }
        if (isSweepCapture) setSweepingToPlayer(actionPayload.playerIndex);
        commitDispatch(actionPayload);
      }, isSweepCapture ? FLIP_SWEEP_MS : FLIP_FLY_MS);
    };

    isOrchestratingRef.current = true;
    // On mobile, opponents have no rendered hand cards — so FLIP has no "before"
    // position for their played card. Seed an invisible ghost at the opponent's
    // avatar BEFORE collectRects runs, giving FLIP a source to animate from.
    const isOpponent = actionPayload.playerIndex !== myIndex;
    if (isOpponent) {
      flushSync(() => setMobileOpponentSource({
        cardId: actionPayload.cardId,
        playerIndex: actionPayload.playerIndex,
      }));
    }
    try {
      if (actionPayload.action === 'THROW') {
        sounds.throwCard();
        await flipTransition(() => {
          if (onStep1) onStep1();
          setMobileOpponentSource(null);
          setVisualThrow(null);
          commitDispatch(actionPayload);
        }, FLIP_FLY_MS);
      } else {

      await flipTransition(() => {
        if (onStep1) onStep1();
        setMobileOpponentSource(null);
        setVisualThrow({ cardId: actionPayload.cardId, playerIndex: actionPayload.playerIndex });
      }, FLIP_FLY_MS);

      if (actionPayload.action === 'CAPTURE') {
        sounds.capture();
        const targets = [...(actionPayload.capturedIds || []), ...(actionPayload.capturedHouseIds || [])];
        for (const targetId of targets) {
          await flipTransition(() => {
            setVisualCapturePile(prev => [...prev, targetId]);
          }, FLIP_STACK_MS);
        }
        await new Promise(r => setTimeout(r, 375));
        await commitFinal(true);
        flushSync(() => {
          setSweepingToPlayer(null);
          setVisualThrow(null);
          setVisualCapturePile([]);
        });
      } else if (actionPayload.action === 'BUILD') {
        sounds.build();
        await new Promise(r => setTimeout(r, 225));
        await commitFinal();
      }
      }
    } finally {
      isOrchestratingRef.current = false;
      const pending = pendingSyncStateRef.current;
      if (pending) {
        pendingSyncStateRef.current = null;
        const me = pending.players.find(p => p.peerId === peerIdRef.current);
        if (me) setMyIndex(me.id);
        dispatch({ type: 'SET_GAME_STATE', payload: pending });
      }
    }

    // ── End-of-round sweep: animate any leftover floor/house cards to the
    // last capturer, then finalize scores. Only the host dispatches END_ROUND
    // in multiplayer; clients receive the state broadcast.
    const postState = stateRef.current;
    const allHandsEmpty = postState.players.every(p => p.hand.length === 0);
    const hasLeftovers = postState.floor.length > 0 || postState.houses.length > 0;
    const stillPlaying = postState.gamePhase === 'PLAYING';
    if (stillPlaying && allHandsEmpty && (!isMultiplayer || isHost)) {
      isOrchestratingRef.current = true;
      try {
        const lastCapturerIdx = postState.lastBidder === -1
          ? postState.dealerIndex
          : postState.lastBidder;
        if (hasLeftovers) {
          sounds.capture();
          // Pick any leftover card id — this anchors the sweep-receiving ghost
          // after END_ROUND puts the leftovers into the capturer's pile.
          const anchorCardId = postState.floor[0]?.id
            ?? postState.houses[0]?.cards[0]?.id
            ?? '';
          flushSync(() => {
            setVisualThrow({ cardId: anchorCardId, playerIndex: lastCapturerIdx });
          });

          const targetIds = [
            ...postState.floor.map(c => c.id),
            ...postState.houses.map(h => h.id),
          ];
          for (const targetId of targetIds) {
            await flipTransition(() => {
              setVisualCapturePile(prev => [...prev, targetId]);
            }, FLIP_STACK_MS);
          }
          await new Promise(r => setTimeout(r, 300));
          await flipTransition(() => {
            setSweepingToPlayer(lastCapturerIdx);
            dispatch({ type: 'END_ROUND' });
          }, FLIP_SWEEP_MS);
          flushSync(() => {
            setSweepingToPlayer(null);
            setVisualThrow(null);
            setVisualCapturePile([]);
          });
        } else {
          dispatch({ type: 'END_ROUND' });
        }
      } finally {
        isOrchestratingRef.current = false;
      }
    }
  };

  const publishMoveAnnounce = (actionPayload: any) => {
    const client = mqttClientRef.current;
    if (!client) return;
    const roomId = state.roomId || joinId;
    if (!roomId) return;
    try {
      client.publish(
        `seep_game_${roomId}`,
        JSON.stringify({ type: 'MOVE_ANNOUNCE', payload: actionPayload, originatorPeerId: peerIdRef.current })
      );
    } catch (e) { console.error('publishMoveAnnounce error:', e); }
  };

  // ── AI engine trigger ──
  useEffect(() => {
    if (!isHost && isMultiplayer) return;

    if (state.gamePhase === 'BIDDING') {
      const bidder = state.players[state.bidderIndex];
      if (!bidder.isHuman && !aiThinking) {
        setAiThinking(true);
        setTimeout(() => {
          const possible = VALID_HOUSE_RANKS.filter(r => bidder.hand.some(c => c.rank === r));
          if (possible.length > 0) {
            sounds.bid();
            dispatch({ type: 'BID', payload: { rank: possible[possible.length - 1] } });
          } else {
            dispatch({ type: 'START_ROUND' });
          }
          setAiThinking(false);
        }, AI_BID_DELAY_MS);
      }
    }

    if (state.gamePhase === 'PLAYING') {
      const currentPlayer = state.players[state.currentTurn];
      if (!currentPlayer.isHuman && !aiThinking) {
        const runAI = async () => {
          setAiThinking(true);
          await new Promise(r => setTimeout(r, AI_PLAY_DELAY_MS));

          const validMoves = getPossibleMoves(currentPlayer.hand, state.floor, state.houses, currentPlayer.id, state.players, state.allowFragileHouses);
          const isFirstTurn = currentPlayer.id === state.players[state.bidderIndex].id
            && state.deck.length > 0;

          let moves = validMoves;
          if (isFirstTurn && state.bidRank) {
            const bidMoves = validMoves.filter(m =>
              (m.type === 'BUILD' && m.buildRank === state.bidRank) ||
              (m.type === 'CAPTURE' && m.card.rank === state.bidRank)
            );

            if (bidMoves.length > 0) {
              moves = bidMoves;
            } else {
              const bidCard = currentPlayer.hand.find(c => c.rank === state.bidRank);
              if (bidCard) {
                const capturable = findSumCombinations(state.floor, state.bidRank);
                if (capturable.length > 0) {
                  moves = [{ card: bidCard, type: 'CAPTURE' as const, capturedCards: capturable[0] }];
                } else {
                  moves = [{ card: bidCard, type: 'THROW' as const }];
                }
              }
            }
          }

          const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
          const captureValue = (m: typeof moves[number]): number => {
            if (m.type !== 'CAPTURE') return 0;
            const cards = [
              ...(m.capturedCards || []),
              ...(m.capturedHouses || []).flatMap(h => h.cards),
              m.card,
            ];
            return cards.reduce((s, c) => s + getPointsForCard(c), 0);
          };

          const floorCount = state.floor.length;
          const houseCount = state.houses.length;
          const seepCaptures = moves.filter(m =>
            m.type === 'CAPTURE' &&
            (m.capturedCards?.length || 0) === floorCount &&
            (m.capturedHouses?.length || 0) === houseCount &&
            (floorCount + houseCount) > 0
          );

          // ── Bot memory: count every card visible across the table ──
          // Hand, floor, houses, and every player's capture pile are public. Any
          // rank not fully accounted for could still be with another player.
          const seenCounts = new Array(14).fill(0);
          for (const c of currentPlayer.hand) seenCounts[c.rank]++;
          for (const c of state.floor) seenCounts[c.rank]++;
          for (const h of state.houses) for (const c of h.cards) seenCounts[c.rank]++;
          for (const p of state.players) for (const c of p.capturedCards) seenCounts[c.rank]++;
          const threatRanks: number[] = [];
          for (let R = 1; R <= 13; R++) {
            if (seenCounts[R] < 4) threatRanks.push(R);
          }

          const simulateMove = (m: typeof moves[number]): { newFloor: Card[]; newHouses: House[] } => {
            let newFloor = [...state.floor];
            let newHouses = [...state.houses];
            const capFloorIds = new Set((m.capturedCards || []).map(c => c.id));
            const capHouseIds = new Set((m.capturedHouses || []).map(h => h.id));
            if (m.type === 'THROW') {
              newFloor.push(m.card);
            } else if (m.type === 'CAPTURE') {
              newFloor = newFloor.filter(c => !capFloorIds.has(c.id));
              newHouses = newHouses.filter(h => !capHouseIds.has(h.id));
            } else if (m.type === 'BUILD') {
              const usedHouses = newHouses.filter(h => capHouseIds.has(h.id));
              newFloor = newFloor.filter(c => !capFloorIds.has(c.id));
              newHouses = newHouses.filter(h => !capHouseIds.has(h.id));
              const newHouseCards = [
                ...(m.capturedCards || []),
                ...usedHouses.flatMap(h => h.cards),
                m.card,
              ];
              newHouses.push({
                id: 'sim',
                rank: m.buildRank || 0,
                cards: newHouseCards,
                ownerIndices: [],
                isCemented: false,
              });
            }
            return { newFloor, newHouses };
          };

          const allowsSeep = (floor: Card[], houses: House[]): boolean => {
            if (floor.length === 0 && houses.length === 0) return false;
            const allowFragile = state.allowFragileHouses;
            for (const R of threatRanks) {
              // Houses that must rank-match R exactly for a single-R play to sweep
              // them: in standard mode this is every house; in laurelwood it's only
              // the cemented houses (uncemented ones can combine with loose cards).
              const mustMatchR = allowFragile ? houses.filter(h => h.isCemented) : houses;
              if (!mustMatchR.every(h => h.rank === R)) continue;

              // Laurelwood: uncemented houses act as rank-units joining the partition.
              const partitionHouses = allowFragile ? houses.filter(h => !h.isCemented) : [];
              const partitionItems = [
                ...floor,
                ...partitionHouses.map(h => ({ id: h.id, rank: h.rank } as Card)),
              ];

              // Every loose card and every uncemented house must fit in a group
              // summing to R — otherwise something would remain on the floor.
              if (partitionItems.length > 0 && !canPerfectlyPartition(partitionItems, R)) continue;

              return true;
            }
            return false;
          };

          const isUnsafe = (m: typeof moves[number]): boolean => {
            const { newFloor, newHouses } = simulateMove(m);
            return allowsSeep(newFloor, newHouses);
          };

          const safeOnly = <T extends typeof moves[number]>(arr: T[]): T[] =>
            arr.filter(m => !isUnsafe(m));

          // ── Build classification ──
          const myTeam = currentPlayer.team;
          const handRankCount = (rank: number, excludeId?: string) =>
            currentPlayer.hand.filter((c: Card) => c.rank === rank && c.id !== excludeId).length;

          // Ownable build = after playing, bot still holds a card of the target rank
          // (so the reserved-for-capture rule keeps the house recoverable).
          const isOwnableBuild = (m: typeof moves[number]): boolean => {
            if (m.type !== 'BUILD') return false;
            const target = m.buildRank || 0;
            return handRankCount(target, m.card.id) >= 1;
          };

          // Merge onto a house my partner already owns — helps the team even
          // though I don't gain ownership.
          const isPartnerMerge = (m: typeof moves[number]): boolean => {
            if (m.type !== 'BUILD') return false;
            return (m.capturedHouses || []).some(h =>
              h.ownerIndices.some(idx => idx !== currentPlayer.id && state.players[idx].team === myTeam)
            );
          };

          // ── Throw scoring: higher = more painful to throw ──
          const throwCost = (c: Card): number => {
            let cost = 0;
            // Spades have rank-value points; throwing any is a direct point loss.
            if (c.suit === Suit.Spades) cost += c.rank + 8;
            // 10 of diamonds is worth 6 points.
            if (c.suit === Suit.Diamonds && c.rank === 10) cost += 15;
            // Non-spade Aces each worth 1 point.
            if (c.suit !== Suit.Spades && c.rank === 1) cost += 4;
            // House-rank cards (9+): duplicates are very valuable for building/owning.
            if (c.rank >= MIN_HOUSE_RANK) {
              const copies = handRankCount(c.rank, c.id);
              if (copies >= 2) cost += 40;
              else if (copies === 1) cost += 15;
              else cost += 5; // lone high card — least bad among valuables
            }
            return cost;
          };

          const throwsSorted = moves
            .filter(m => m.type === 'THROW')
            .slice()
            .sort((a, b) => throwCost(a.card) - throwCost(b.card));

          // ── Captures (any value), with sorting by real points captured ──
          const allCaptures = moves
            .filter(m => m.type === 'CAPTURE')
            .slice()
            .sort((a, b) => captureValue(b) - captureValue(a));
          const safeCaptures = safeOnly(allCaptures);
          const safeBigCaptures = safeCaptures.filter(m => captureValue(m) >= 5);

          const safeOwnableBuilds = safeOnly(moves.filter(isOwnableBuild));
          const safePartnerMerges = safeOnly(moves.filter(isPartnerMerge));
          const safeAnyBuild = safeOnly(moves.filter(m => m.type === 'BUILD'));

          const safeThrows = throwsSorted.filter(m => !isUnsafe(m));
          const allThrows = throwsSorted;
          const safeAll = safeOnly(moves);

          const chosen =
            // 1. Seep capture — always take it.
            seepCaptures.length > 0    ? pickRandom(seepCaptures) :
            // 2. Any capture worth ≥ 5 real points that doesn't hand a seep to the next player.
            safeBigCaptures.length > 0 ? safeBigCaptures[0] :
            // 3. Build a house I can own (I retain another matching card).
            safeOwnableBuilds.length > 0 ? pickRandom(safeOwnableBuilds) :
            // 4. Merge into partner's same-rank house.
            safePartnerMerges.length > 0 ? pickRandom(safePartnerMerges) :
            // 5. Any non-empty safe capture (take what's there, even small).
            safeCaptures.length > 0    ? safeCaptures[0] :
            // 6. Any other safe build.
            safeAnyBuild.length > 0    ? pickRandom(safeAnyBuild) :
            // 7. Throw the least valuable card that's safe.
            safeThrows.length > 0      ? safeThrows[0] :
            // Fallbacks when nothing is safe:
            allThrows.length > 0       ? allThrows[0] :
            safeAll.length > 0         ? pickRandom(safeAll) :
            pickRandom(moves);

          if (chosen) {
            const actionPayload = {
              playerIndex: state.currentTurn,
              cardId: chosen.card.id,
              action: chosen.type,
              capturedIds: chosen.capturedCards?.map(c => c.id),
              capturedHouseIds: chosen.capturedHouses?.map(h => h.id),
              buildRank: chosen.buildRank,
            };

            if (isMultiplayer) publishMoveAnnounce(actionPayload);
            await executeOrchestratedMove(actionPayload, (payload) => {
              dispatch({ type: 'PLAY_MOVE', payload });
              setAiThinking(false);
            });
          } else {
            setAiThinking(false);
          }
        };
        runAI();
      }
    }
  }, [state, isHost, isMultiplayer, aiThinking]);

  // ── Dispatch (local or network) ──
  // Clients optimistically apply deterministic actions locally so FLIP animations have correct
  // before/after DOM state. The host's SYNC_STATE echo will authoritatively replace local state.
  // START_ROUND builds a freshly-shuffled deck, so only the host may run it — clients publish only.
  const handleDispatch = (action: Action) => {
    if (isHost) {
      dispatch(action);
      return;
    }
    if (action.type !== 'START_ROUND') {
      dispatch(action);
    }
    if (mqttClientRef.current) {
      mqttClientRef.current.publish(`seep_game_${state.roomId || joinId}`, JSON.stringify({ type: 'CLIENT_ACTION', payload: action }));
    }
  };

  // ── Chat helpers ──
  const markChatRead = () => {
    lastSeenChatLenRef.current = state.chatLog?.length ?? 0;
    setChatUnread(0);
  };

  const sendChat = (text: string) => {
    if (!isMultiplayer) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const me = state.players[myIndex];
    if (!me) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerIndex: myIndex,
      name: me.name,
      team: me.team,
      text: trimmed.slice(0, CHAT_MAX_LEN),
      ts: Date.now(),
    };
    handleDispatch({ type: 'SEND_CHAT', payload: msg });
  };

  // ── Human move execution ──
  const executeAction = (type: 'CAPTURE' | 'THROW' | 'BUILD') => {
    if (!selectedCardId) return;
    const handCard = state.players[myIndex].hand.find(c => c.id === selectedCardId);
    const buildRank = type === 'BUILD' && handCard
      ? getActions().buildTarget
      : undefined;

    const actionPayload = {
      playerIndex: myIndex,
      cardId: selectedCardId,
      action: type,
      capturedIds: Array.from(selectedFloorIds) as string[],
      capturedHouseIds: Array.from(selectedHouseIds) as string[],
      buildRank,
    };

    if (isMultiplayer) publishMoveAnnounce(actionPayload);
    executeOrchestratedMove(actionPayload, (payload) => {
      dispatch({ type: 'PLAY_MOVE', payload });
    }, () => {
      setSelectedCardId(null); setSelectedFloorIds(new Set()); setSelectedHouseIds(new Set());
    });
  };

  // ── Bid availability ──
  const bidSelectedCard = selectedCardId ? state.players[myIndex]?.hand.find((c: Card) => c.id === selectedCardId) : undefined;
  const canBid =
    state.gamePhase === 'BIDDING' &&
    state.bidderIndex === myIndex &&
    !!bidSelectedCard &&
    bidSelectedCard.rank >= MIN_HOUSE_RANK;
  const bidReason: string | undefined =
    state.gamePhase !== 'BIDDING' || state.bidderIndex !== myIndex
      ? undefined
      : !bidSelectedCard
        ? 'Select a card of rank 9 or higher'
        : bidSelectedCard.rank < MIN_HOUSE_RANK
          ? `Bid card < ${MIN_HOUSE_RANK}`
          : undefined;

  // ── Human bid execution ──
  const executeBid = () => {
    if (state.gamePhase !== 'BIDDING' || state.bidderIndex !== myIndex) return;
    if (!selectedCardId) return;
    const handCard = state.players[myIndex].hand.find(c => c.id === selectedCardId);
    if (!handCard || handCard.rank < MIN_HOUSE_RANK) return;
    sounds.bid();
    handleDispatch({ type: 'BID', payload: { rank: handCard.rank } });
    setSelectedCardId(null);
  };

  // ── Compute available actions ──
  const getActions = () => {
    const noReasons: { throw?: string; capture?: string; build?: string } = {};
    const noActions = {
      canThrow: false, canCapture: false, canBuild: false,
      buildTarget: undefined as number | undefined,
      reasons: noReasons,
    };
    if (!state.players[myIndex]) return { ...noActions, reasons: { throw: 'Waiting for player', capture: 'Waiting for player', build: 'Waiting for player' } };
    if (state.gamePhase !== 'PLAYING') return { ...noActions, reasons: { throw: 'Round not in play', capture: 'Round not in play', build: 'Round not in play' } };
    if (state.currentTurn !== myIndex) return { ...noActions, reasons: { throw: "Not your turn", capture: "Not your turn", build: "Not your turn" } };

    const handCard = state.players[myIndex].hand.find(c => c.id === selectedCardId);
    if (!handCard) return { ...noActions, reasons: { throw: 'Select a card from your hand', capture: 'Select a card from your hand', build: 'Select a card from your hand' } };

    const floorSelected = state.floor.filter(c => selectedFloorIds.has(c.id));
    const housesSelected = state.houses.filter(h => selectedHouseIds.has(h.id));

    const reasons: { throw?: string; capture?: string; build?: string } = {};
    const handLabel = getRankLabel(handCard.rank);

    // Is handCard my last copy of a rank I own a house for? If so, I must
    // reserve it to eventually capture that house — only CAPTURE is allowed.
    const myHandCopiesOfRank = state.players[myIndex].hand.filter((c: Card) => c.rank === handCard.rank).length;
    const iOwnHouseOfHandRank = state.houses.some((h: House) =>
      h.rank === handCard.rank && h.ownerIndices.includes(myIndex)
    );
    const lastCardReservedForOwnedHouse = myHandCopiesOfRank === 1 && iOwnHouseOfHandRank;
    const reservedReason = `Last ${handLabel} must capture ${handLabel}🏠`;

    // ── Throw Validation ──
    let canThrow = floorSelected.length === 0 && housesSelected.length === 0;
    if (!canThrow) reasons.throw = 'Deselect floor items to throw';
    if (canThrow) {
      if (canCaptureWithRank(state.floor, handCard.rank) || state.houses.some(h => h.rank === handCard.rank)) {
        canThrow = false;
        reasons.throw = `This ${handLabel} can capture something on the floor`;
      }
    }
    if (canThrow && lastCardReservedForOwnedHouse) {
      canThrow = false;
      reasons.throw = reservedReason;
    }

    // ── Capture Validation ──
    let canCapture = false;
    if (floorSelected.length === 0 && housesSelected.length === 0) {
      reasons.capture = 'Select loose cards or a house on the floor to capture';
    } else if (state.allowFragileHouses) {
      const cementedHouses = housesSelected.filter(h => h.isCemented);
      const uncementedHouses = housesSelected.filter(h => !h.isCemented);
      if (!cementedHouses.every((h: House) => h.rank === handCard.rank)) {
        reasons.capture = `Cemented house rank must match your card (${handLabel})`;
      } else {
        // Cemented houses captured directly (rank matches). Remaining items
        // (loose cards + uncemented houses as rank-units) must partition into
        // groups each summing to handCard.rank.
        const simulatedFloor = [...floorSelected, ...uncementedHouses.map((h: House) => ({ id: h.id, rank: h.rank } as Card))];
        const looseValid = simulatedFloor.length === 0 || canPerfectlyPartition(simulatedFloor, handCard.rank);
        if (looseValid) {
          canCapture = true;
        } else {
          reasons.capture = `Selection doesn't split into groups that each sum to ${handLabel}`;
        }
      }
    } else {
      const housesAllMatch = housesSelected.every((h: House) => h.rank === handCard.rank);
      const looseValid = floorSelected.length === 0 || canPerfectlyPartition(floorSelected, handCard.rank);
      if (!housesAllMatch) {
        reasons.capture = `All selected houses must match your card (${handLabel})`;
      } else if (!looseValid) {
        reasons.capture = `Selected loose cards don't split into groups of ${handLabel}`;
      } else {
        canCapture = true;
      }
    }

    const unselectedFloor = state.floor.filter(c => !selectedFloorIds.has(c.id));
    const unselectedHouses = state.houses.filter(h => !selectedHouseIds.has(h.id));

    // Greedy Capture Constraint
    if (canCapture) {
      let blocked: boolean;
      if (state.allowFragileHouses) {
        const unselectedUncemented = unselectedHouses.filter((h: House) => !h.isCemented);
        const simulated = [...unselectedFloor, ...unselectedUncemented.map((h: House) => ({ id: h.id, rank: h.rank } as Card))];
        const unselectedCementedSameRank = unselectedHouses.some((h: House) => h.isCemented && h.rank === handCard.rank);
        blocked = unselectedCementedSameRank || canCaptureWithRank(simulated, handCard.rank);
      } else {
        blocked = unselectedHouses.some((h: House) => h.rank === handCard.rank) || canCaptureWithRank(unselectedFloor, handCard.rank);
      }
      if (blocked) {
        canCapture = false;
        reasons.capture = `You must also capture every other group that sums to ${handLabel}`;
      }
    }

    // ── Build Validation ──
    const potentialCardsForBuild = [handCard, ...floorSelected];
    housesSelected.forEach(h => potentialCardsForBuild.push(...h.cards));
    const totalPotentialSum = potentialCardsForBuild.reduce((s, c) => s + c.rank, 0);

    let canBuild = false;
    let computedBuildTarget: number | undefined = undefined;

    if (floorSelected.length === 0 && housesSelected.length === 0) {
      reasons.build = 'Select floor cards and/or houses to build with';
    } else {
      let lastFailure: string | undefined;
      for (let R = MIN_HOUSE_RANK; R <= MAX_HOUSE_RANK; R++) {
        const rLabel = getRankLabel(R);
        if (housesSelected.some(h => h.isCemented && h.rank !== R)) {
          lastFailure = "You can't break a cemented house of a different rank";
          continue;
        }
        if (!(totalPotentialSum % R === 0 && canPerfectlyPartition(potentialCardsForBuild, R))) {
          continue;
        }
        const hasTargetInHand = state.players[myIndex].hand.filter(c => c.id !== handCard.id).some(c => c.rank === R);
        const myTeam = state.players[myIndex].team;
        const partnerOwnedExistingTargetHouse = housesSelected.some(h =>
           h.rank === R &&
           h.ownerIndices.some(idx => idx !== myIndex && state.players[idx].team === myTeam)
        );
        if (!hasTargetInHand && !partnerOwnedExistingTargetHouse) {
          lastFailure = `You need a ${rLabel} in hand (or a partner-owned House of ${rLabel}) to build ${rLabel}`;
          continue;
        }
        const sameRankHouseLeft = unselectedHouses.some((h: House) => h.rank === R);
        let greedyOk: boolean;
        if (state.allowFragileHouses) {
          const unselectedUncementedDiffRank = unselectedHouses.filter((h: House) => !h.isCemented && h.rank !== R);
          const simulated = [...unselectedFloor, ...unselectedUncementedDiffRank.map((h: House) => ({ id: h.id, rank: h.rank } as Card))];
          greedyOk = !sameRankHouseLeft && !canCaptureWithRank(simulated, R);
        } else {
          greedyOk = !sameRankHouseLeft && !canCaptureWithRank(unselectedFloor, R);
        }
        if (!greedyOk) {
          lastFailure = sameRankHouseLeft
            ? `You must also absorb the other House of ${rLabel} on the floor`
            : `You must also absorb every group of ${rLabel} left on the floor`;
          continue;
        }
        canBuild = true;
        computedBuildTarget = R;
        break;
      }
      if (!canBuild) {
        reasons.build = lastFailure ?? `Selection doesn't form a valid house (9–${getRankLabel(MAX_HOUSE_RANK)})`;
      }
    }
    if (canBuild && lastCardReservedForOwnedHouse) {
      canBuild = false;
      reasons.build = reservedReason;
    }
    const buildTarget = computedBuildTarget;

    // ── First-turn constraint ──
    const isFirstTurn = state.currentTurn === state.bidderIndex
      && state.deck.length > 0;
    if (isFirstTurn && state.bidRank) {
      const bidLabel = getRankLabel(state.bidRank);
      if (canBuild && buildTarget !== state.bidRank) {
        canBuild = false;
        reasons.build = `Build must target your bid (${bidLabel}) on the first turn`;
      }
      if (canCapture && handCard.rank !== state.bidRank) {
        canCapture = false;
        reasons.capture = `Only the bid card (${bidLabel}) can capture on the first turn`;
      }
      if (canThrow && handCard.rank !== state.bidRank) {
        canThrow = false;
        reasons.throw = `Only the bid card (${bidLabel}) can be thrown on the first turn`;
      }
    }

    return { canThrow, canCapture, canBuild, buildTarget, reasons };
  };

  const { canThrow, canCapture, canBuild, buildTarget, reasons: actionReasons } = getActions();

  const toggleFloorCard = (id: string) => {
    if (state.currentTurn !== myIndex) return;
    setSelectedFloorIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleHouse = (id: string) => {
    if (state.currentTurn !== myIndex) return;
    setSelectedHouseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Map player indices to visual positions
  const positionFor = (pIndex: number): 'bottom' | 'left' | 'top' | 'right' => {
    const positions = ['bottom', 'left', 'top', 'right'] as const;
    return positions[(pIndex - myIndex + NUM_PLAYERS) % NUM_PLAYERS];
  };

  const topPlayer    = state.players.findIndex((_, i) => positionFor(i) === 'top');
  const leftPlayer   = state.players.findIndex((_, i) => positionFor(i) === 'left');
  const rightPlayer  = state.players.findIndex((_, i) => positionFor(i) === 'right');
  const bottomPlayer = state.players.findIndex((_, i) => positionFor(i) === 'bottom');

  const offlinePlayers = state.players.filter(p => p.isHuman && p.id !== 0 && !p.isOnline);
  const isPaused = (offlinePlayers.length > 0 && state.gamePhase !== 'LOBBY') || isDisconnected;

  if (state.gamePhase === 'LOBBY') {
    return (
      <Lobby
        state={state}
        isMultiplayer={isMultiplayer}
        isHost={isHost}
        peerId={peerId}
        myIndex={myIndex}
        playerName={playerName}
        setPlayerName={setPlayerName}
        fragileHouses={fragileHouses}
        setFragileHouses={setFragileHouses}
        joinId={joinId}
        setJoinId={setJoinId}
        savedSession={savedSession}
        setSavedSession={setSavedSession}
        onCreateRoom={initHostWithRef}
        onJoinRoom={joinGame}
        onStartSinglePlayer={() => {
          setIsHost(true);
          setIsMultiplayer(true);
          setMyIndex(0);
          dispatch({ type: 'START_GAME', payload: { playerName: playerName || 'You', allowFragileHouses: fragileHouses } });
        }}
        onStartRound={() => dispatch({ type: 'START_ROUND' })}
        onSetTeam={(playerIndex, team) => handleDispatch({ type: 'SET_PLAYER_TEAM', payload: { playerIndex, team } })}
      />
    );
  }

  const gameContext: GameContextValue = {
    state, dispatch, handleDispatch,
    myIndex, isHost, isMultiplayer, peerId, joinId, isDisconnected,
    selectedCardId, setSelectedCardId,
    selectedFloorIds, setSelectedFloorIds,
    selectedHouseIds, setSelectedHouseIds,
    previewHouseId, setPreviewHouseId,
    showMyCaptures, setShowMyCaptures,
    mobileLogOpen, setMobileLogOpen,
    mobileChatOpen, setMobileChatOpen,
    chatUnread, markChatRead, sendChat,
    visualThrow, visualCapturePile, sweepingToPlayer, mobileOpponentSource,
    showSeepAnim,
    canThrow, canCapture, canBuild, buildTarget, actionReasons,
    executeAction, executeBid, canBid, bidReason,
    toggleFloorCard, toggleHouse,
    topPlayer, leftPlayer, rightPlayer, bottomPlayer,
    logEndRef,
    isPaused, offlinePlayers,
  };

  return (
    <GameProvider value={gameContext}>
      {isMobile ? <MobileView /> : <DesktopView />}
    </GameProvider>
  );
}
