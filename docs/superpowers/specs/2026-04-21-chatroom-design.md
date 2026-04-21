# Chatroom Feature — Design Spec

**Date:** 2026-04-21
**Scope:** Multiplayer text chat between human players during a game.

## Goals

- Let human players send short text messages to each other during a multiplayer game.
- Match the existing `GameLog` interaction model: collapsible pill → expanded panel (desktop) and bottom-sheet drawer (mobile).
- Desktop placement: bottom-right (mirror of `GameLog`, which lives top-right).
- Mobile placement: button next to the existing "Log" button in the player chip; opens as a drawer like the log sheet.
- Hidden entirely in single-player (no bots-vs-human chat).
- Session-only: messages live in game state, broadcast via the existing MQTT SYNC_STATE flow, lost on refresh. Mid-game rejoin receives history via the normal state sync.
- Unread indicator on the collapsed pill/button when new messages arrive while closed.

## Non-Goals

- Persistence to localStorage or any external store.
- Rich content (images, emoji picker, reactions, mentions, typing indicators).
- Moderation / muting / filtering.
- Cross-room history or DMs.
- Chat in the Lobby (that's a possible follow-up, but out of scope here).

## Architecture

Chat piggybacks on the game's existing host-authoritative MQTT transport. No new topics, no new connections.

### Data model

Add a new type in [types.ts](types.ts):

```ts
export interface ChatMessage {
  id: string;         // unique id (timestamp + random suffix, client-generated)
  playerIndex: number;// index into state.players at send time
  name: string;       // snapshot of player's name (stable if they reconnect)
  team: 0 | 1;        // snapshot of team, for tint
  text: string;       // trimmed, capped at CHAT_MAX_LEN chars
  ts: number;         // Date.now() at send
}
```

Extend `GameState`:

```ts
chatLog: ChatMessage[]; // newest at end; capped at CHAT_MAX_HISTORY
```

### Reducer action

Add a new reducer action in [gameReducer.ts](gameReducer.ts):

```ts
| { type: 'SEND_CHAT'; payload: ChatMessage }
```

Behavior:
- Append to `state.chatLog`.
- Trim to last `CHAT_MAX_HISTORY` (e.g., 100).
- Do NOT touch `gameLog`, scores, turn state, etc. Chat is orthogonal.

`INITIAL_STATE` gets `chatLog: []`.

### Constants

Add to [constants.ts](constants.ts):

```ts
export const CHAT_MAX_LEN = 200;
export const CHAT_MAX_HISTORY = 100;
```

### Dispatch flow

Chat sends use the same `handleDispatch` path as any other game action:
- **Host** dispatches locally → state change → broadcasts via the existing `SYNC_STATE` effect.
- **Client** dispatches locally (optimistic) and publishes a `CLIENT_ACTION` with the `SEND_CHAT` payload. Host receives, dispatches, broadcasts `SYNC_STATE`, and the client's optimistic append is replaced by the authoritative list.

The host already handles `CLIENT_ACTION` generically via `dispatch(data.payload)` in the existing MQTT message handler — no new networking code is needed.

### Rejoin / resync

On rejoin, the client receives `SYNC_STATE` which includes the full `chatLog`. No special handling required.

### Message ordering

Messages ordered by host's dispatch order (same as every other action). Client optimistic appends may briefly show out-of-order, but the next `SYNC_STATE` reconciles within tens of milliseconds.

## Components

### 1. ChatRoom (desktop) — `components/panels.tsx`

New component, mirrors `GameLog`:

- **Collapsed:** pill chip, aligned bottom-right, shows "Chat" accent label + latest message preview (truncated) + chevron-up. Unread badge (small dot with count) if `unread > 0`.
- **Expanded:** glass panel, `w-[min(90vw,380px)]`, showing:
  - Header: "Chat" title + collapse chevron.
  - Message list: scrollable, max-height similar to `GameLog`. Each row renders `name` (team-tinted) + text. Latest at bottom. Auto-scroll to bottom on new message when expanded.
  - Input row: single-line `<input type="text">` + Send button. Enter sends. Empty/whitespace ignored. Enforce `CHAT_MAX_LEN` via `maxLength`.

Props:
```ts
{ messages: ChatMessage[]; myIndex: number; unread: number;
  onSend: (text: string) => void;
  onOpen: () => void; onClose: () => void; }
```

### 2. Mobile chat — `views/MobileView.tsx`

- New chat button in the `m-me-chip`'s right cluster, placed immediately before the existing Log button.
- Reuses the `m-sheet` + `m-sheet-backdrop` markup pattern used by the log sheet. A new state `mobileChatOpen` mirrors `mobileLogOpen`.
- Sheet contents: header, scrollable message list (newest at bottom), sticky input pinned at the bottom of the sheet. Safe-area-bottom padding so the input clears the keyboard/home indicator.
- Unread badge: small filled circle with count on the chat button when closed and unread > 0.

### 3. Rendering integration

**Desktop** ([views/DesktopView.tsx](views/DesktopView.tsx)): add a new fixed container anchored bottom-right (mirror of the top HUD row). It holds `<ChatRoom ... />` and only renders when `isMultiplayer`.

**Mobile** ([views/MobileView.tsx](views/MobileView.tsx)): chat button in the me-chip, and the chat sheet conditionally rendered at the end of the view. Both guarded by `isMultiplayer`.

## State additions

In [App.tsx](App.tsx):

- `mobileChatOpen: boolean` (mirror of `mobileLogOpen`).
- `chatUnread: number`, resets to 0 when the user opens the panel/sheet. Increments when `state.chatLog.length` grows while the chat is closed AND the new message isn't ours (the sender trivially has zero unread for their own message).
- Keep the unread tracking tidy: remember `lastSeenChatLength` via a ref, increment unread by the delta, reset `lastSeenChatLength` to current length on open.

`GameContextValue` in [GameContext.tsx](GameContext.tsx) grows by:
```ts
mobileChatOpen: boolean;
setMobileChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
chatUnread: number;
markChatRead: () => void;
sendChat: (text: string) => void;
```

`sendChat(text)` builds a `ChatMessage` with `myIndex`, snapshotted name/team, and calls `handleDispatch({ type: 'SEND_CHAT', payload })`. For single-player or when `myIndex` is invalid, it no-ops.

## Styling

Reuse existing tokens: `glass-panel`, `pill-chip`, `var(--bg-1)`, `var(--bg-2)`, `var(--line)`, `var(--accent)`, `var(--fg)`, `var(--fg-soft)`, `var(--dim)`. No new CSS variables required.

Team tint for sender name: `var(--accent)` for team 0, `var(--red)` for team 1 — matches the HUD score pills.

Own messages: right-aligned bubble or a subtle "You" marker. Keep it simple — right-align own messages, left-align others, no heavy bubble chrome, so the list still looks like the log. (Final visual nuance is minor; will refine during implementation.)

Unread badge: small filled circle using `var(--accent)`, absolute-positioned on the collapsed pill / mobile button.

z-index: use `Z_HUD` (same as `GameLog`) for the desktop panel. Mobile sheet already uses its own layer via `m-sheet` class.

## Edge cases

- **Empty / whitespace-only input:** ignored. Send button disabled when input is empty.
- **Disconnected sender:** `handleDispatch` still applies locally; the publish will fail silently — acceptable (no queueing). The host's SYNC_STATE on reconnect will authoritatively replace local chatLog; messages typed while disconnected will be lost. This matches how other client actions behave today.
- **Offline player:** an offline human's past messages remain in history; they simply can't send new ones until reconnected.
- **Observer / spectator:** not a concept in this game — every player in `players` can send.
- **Single-player session:** `ChatRoom`/chat button not rendered. No new unread logic runs.
- **Round reset / new game:** `chatLog` persists across rounds within a game. On `INIT_LOBBY` / `START_GAME`, it resets to `[]` (those already reset from `INITIAL_STATE`).
- **History cap:** `CHAT_MAX_HISTORY = 100` — oldest messages drop. Matches `MAX_LOG_ENTRIES` pattern.

## Testing

- Manual multi-tab test: open two browser windows, host + join, exchange messages, verify ordering and rejoin history.
- Desktop: verify collapsed pill → expanded panel → collapse, unread badge appears/clears, auto-scroll, Enter sends.
- Mobile (narrow viewport): verify chat button beside Log button, sheet opens/closes, input reachable above keyboard, unread badge.
- Single-player: verify no chat UI anywhere.
- Rejoin: midgame rejoin sees prior messages.

No automated tests are added — the project has none today, and chat is UI-surface feature work.

## Files Touched

1. [types.ts](types.ts) — add `ChatMessage`, extend `GameState`.
2. [constants.ts](constants.ts) — add `CHAT_MAX_LEN`, `CHAT_MAX_HISTORY`.
3. [gameReducer.ts](gameReducer.ts) — add `SEND_CHAT` action + handler; include `chatLog: []` in `INITIAL_STATE`.
4. [GameContext.tsx](GameContext.tsx) — expose `mobileChatOpen`, `setMobileChatOpen`, `chatUnread`, `markChatRead`, `sendChat`.
5. [App.tsx](App.tsx) — add unread tracking, `mobileChatOpen` state, `sendChat` helper; wire into provider value.
6. [components/panels.tsx](components/panels.tsx) — add `ChatRoom` component (desktop).
7. [views/DesktopView.tsx](views/DesktopView.tsx) — render `ChatRoom` at bottom-right when multiplayer.
8. [views/MobileView.tsx](views/MobileView.tsx) — add chat button in me-chip, chat sheet, unread badge.

## Open Questions

None — decisions from brainstorming are locked in (multiplayer-only, session-only, unread badge on).
