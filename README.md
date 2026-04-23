# Seep

A web-based version of **Seep**, the classic Indian 4-player team card game. Play against AI opponents or with friends in a shared room.

## Rules

### Players and teams

Four players in two fixed partnerships, partners facing each other. Seats 0 & 2 form Team A; seats 1 & 3 form Team B. A standard 52-card deck is used.

### Dealing (two phases)

Phase 1 — before the first move:
- The **bidder** (first player to act after the dealer) receives **4 cards**.
- The bidder places a bid (see below).
- **4 cards** are dealt face-up to the floor.
- The bidder plays their first move.

Phase 2 — after the bidder's first move:
- The remaining cards are dealt.
- Every non-bidder receives **12 cards**.
- The bidder receives **8 more** (to also total 12).

### Bidding

The bidder picks a **bid rank** from **9, 10, J, Q, K** using a card in their initial 4-card hand. The bid rank determines what they must do on their first turn. If the bidder's 4 cards contain no card of rank 9 or higher, the deck is reshuffled and re-dealt.

### Bidder's first turn — exactly one of:

1. **Collect**: Use the bid card to capture a combination of floor cards whose ranks **sum to the bid rank**.
2. **Build**: Combine a hand card with floor cards to form a **house** of the bid rank. (The bid card itself can be used if the bidder holds two copies.)
3. **Throw**: Place the bid card on the floor. However, if the bid card *can* capture (some floor combination sums to the bid rank), the throw becomes a **forced capture**.

Only the bid card may be thrown on the first turn. A build must target the bid rank.

### Regular turns — exactly one of:

1. **Throw**: Place a hand card on the floor.
2. **Capture**: Play a card whose rank equals the sum of selected floor cards, or matches an existing house's rank.
3. **Build**: Combine a hand card with floor cards to form a house of rank **9–K**. You must already hold another card of the target house rank in your hand.

### Seep

Clearing the **entire floor** — every loose card and every house — in a single capture earns a **+50 bonus** for the capturing team, *unless* it is the very last move of the round.

### Scoring (100 base points per round)

| Cards | Points |
| --- | --- |
| All Spades | face value (A=1 … K=13); 91 total |
| 10 of Diamonds | 6 |
| Ace of Clubs | 1 |
| Ace of Hearts | 1 |
| Ace of Diamonds | 1 |

### End of round

Any cards still on the floor at the end of the round go to the team that made the **last capture**.

### Winning

The match ends once one team **leads the other by 100 or more points**. That team wins.

## Run locally

**Prerequisites**: Node.js, pnpm.

```bash
pnpm install
pnpm run dev
```
