import React from 'react';

interface RulebookProps {
  onClose: () => void;
}

export const Rulebook: React.FC<RulebookProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: 200, background: 'var(--bg)', color: 'var(--fg)' }}
    >
      <div
        className="max-w-3xl mx-auto px-5 sm:px-8 pb-8 sm:pb-12 relative"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}
      >
        <button
          onClick={onClose}
          aria-label="Close rulebook"
          className="sticky float-right w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-[color:var(--bg-2)]"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            color: 'var(--fg-soft)',
            top: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          }}
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <header className="mb-8 pt-2">
          <h1 className="font-display text-3xl sm:text-4xl mb-1" style={{ color: 'var(--accent)' }}>
            Seep Rulebook
          </h1>
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--dim)' }}>
            Also known as Sweep
          </p>
        </header>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Overview</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            Seep is a four-player partnership card game from the Indian subcontinent. Two teams of
            two compete to accumulate points by capturing cards from a shared <em>floor</em>. A standard
            52-card deck is used.
          </p>
          <p style={{ color: 'var(--fg-soft)' }}>
            Seats around the table alternate by team: <strong className="text-[color:var(--accent)]">Team A</strong> sits
            opposite itself, and <strong className="text-[color:var(--red)]">Team B</strong> sits opposite itself. A
            round progresses clockwise. Teams combine their captured cards at the end of each round to
            score points.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Card Values</h2>
          <ul className="space-y-2" style={{ color: 'var(--fg-soft)' }}>
            <li>An <strong>Ace</strong> counts as <strong>1</strong>. Number cards are face-value (2–10). Jack = 11, Queen = 12, King = 13.</li>
            <li>These ranks are used both for sums during captures and for building houses.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Scoring</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            A round distributes exactly <strong>100 base points</strong> across the cards in play:
          </p>
          <ul className="space-y-2 mb-3" style={{ color: 'var(--fg-soft)' }}>
            <li>Every <strong className="text-[color:var(--fg)]">Spade</strong> is worth its face value
              (Ace = 1, 2 = 2,  King = 13). Spades contribute 91 points total.</li>
            <li>The <strong className="text-[color:var(--fg)]">10 of Diamonds</strong> is worth <strong>6 points</strong>.</li>
            <li>Each non-Spade Ace (Clubs, Hearts, Diamonds) is worth <strong>1 point</strong>.</li>
            <li>All other cards are worth 0 base points but still count toward captures and houses.</li>
          </ul>
          <p style={{ color: 'var(--fg-soft)' }}>
            A <strong>Seep</strong> (clearing the entire floor in a single capture) awards an extra <strong>50 points</strong> —
            unless it happens on the very last move of the round, in which case there is nothing left to
            clear and the bonus does not apply.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Dealing</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            Dealing happens in two phases so that the bidder can see their first hand before committing
            to a bid:
          </p>
          <ol className="list-decimal list-inside space-y-2" style={{ color: 'var(--fg-soft)' }}>
            <li>
              <strong>Phase 1.</strong> The dealer deals <strong>4 cards</strong> face-down to the bidder
              (the player to the dealer's left). The bidder privately inspects these cards and announces
              the <strong>bid rank</strong> — a rank from <strong>9 to King</strong> — which they must
              hold in those 4 cards. If the bidder does not hold any card ≥ 9, the hand is reshuffled
              and re-dealt.
            </li>
            <li>
              <strong>Floor.</strong> After the bid, the dealer deals <strong>4 cards face-up</strong> to
              the floor in the center of the table.
            </li>
            <li>
              <strong>First move.</strong> The bidder plays the first move of the round (see rules below),
              using a card from their 4-card hand.
            </li>
            <li>
              <strong>Phase 2.</strong> The remaining deck is dealt: every other player receives 12 cards,
              and the bidder receives 8 more (they already held 4). Every player now has a full hand of
              12 cards.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>The Bidder's First Move</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            On the bidder's very first turn, the bid rank determines what they may do. The options are
            restricted to exactly one of the following three:
          </p>
          <ol className="list-decimal list-inside space-y-3" style={{ color: 'var(--fg-soft)' }}>
            <li>
              <strong>Capture.</strong> Play the bid card to capture floor cards whose ranks sum to the
              bid rank (as one or more groups).
            </li>
            <li>
              <strong>Build.</strong> Use a hand card + floor cards to form a house equal to the bid rank.
              The bidder must still hold a second card of that rank in hand to own the house (see
              "Houses" below).
            </li>
            <li>
              <strong>Throw.</strong> Place the bid card on the floor. However, if the bid card can
              capture anything on the floor, then the throw is forced to become a capture — the bidder
              must collect.
            </li>
          </ol>
          <p className="mt-3" style={{ color: 'var(--fg-soft)' }}>
            Only the bid card may be thrown on the first turn, and any build must target the bid rank
            specifically.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Subsequent Turns</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            After the bidder's first move and the phase-2 deal, play proceeds clockwise. On each turn, a
            player does exactly one of:
          </p>
          <ul className="space-y-3" style={{ color: 'var(--fg-soft)' }}>
            <li>
              <strong>Capture.</strong> Play a hand card that captures either (a) one or more houses of
              the same rank and/or (b) one or more loose-card groups whose ranks sum to the played card's
              rank. The capture rule is <strong>greedy</strong>: if the played card can capture anything,
              the player <em>must</em> capture <em>every</em> legal group it could take.
            </li>
            <li>
              <strong>Build.</strong> Combine a hand card with one or more floor cards (and optionally
              houses) to form a new house whose rank is between 9 and King. To legally build a house of
              rank R, the builder must still hold another card of rank R after playing (so the house can
              be captured later) — unless their partner already owns a house of rank R on the floor, in
              which case the new material is absorbed into the partner's house.
            </li>
            <li>
              <strong>Throw.</strong> Place a hand card on the floor. Throw is only legal when the card
              cannot capture anything — if the card can capture even a single group, the player must
              capture instead.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Houses</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            A house is a pile of cards on the floor whose total rank is a multiple of a declared "house
            rank" (9–K). It can be captured in one play only by a card of that same rank.
          </p>
          <ul className="space-y-2 mb-3" style={{ color: 'var(--fg-soft)' }}>
            <li>
              <strong>Ownership.</strong> A house is "owned" by the team that built it. The owning
              player must continuously hold a card of the house's rank in hand, so that the house can be
              captured before the round ends. Playing your last card of the rank for anything other than
              a capture is not allowed while you own a house of that rank.
            </li>
            <li>
              <strong>Same-rank merge.</strong> If a player builds or throws cards that combine with an
              existing house of the same rank, the new material is absorbed into that house — there is
              never more than one house of a given rank on the floor.
            </li>
            <li>
              <strong>Rank-up.</strong> A player may absorb a house of a lower rank (e.g. 9) into a new
              house of a higher rank (e.g. J) by contributing the difference from the floor or their
              hand. When this happens, the previous owners lose that house entirely (unless they are on
              the same team).
            </li>
            <li>
              <strong>Cementing.</strong> Once a house accumulates cards whose ranks total at least twice
              its declared rank (e.g. a House of 10 with cards totaling 20+), it is <em>cemented</em> — it
              can no longer be modified, only captured by an exact rank match.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>End of Round</h2>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            When the last player plays their final card, the round ends. Any cards still on the floor —
            loose cards and every card inside every remaining house — go to the team of the player who
            last made a capture. If no capture happened that round, the dealer's team receives the
            leftovers.
          </p>
          <p style={{ color: 'var(--fg-soft)' }}>
            Each team's round score is computed from the point values of the cards in their combined
            capture piles, plus any Seep bonuses earned during play. Round scores accumulate across the
            game.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="font-display text-xl sm:text-2xl mb-3" style={{ color: 'var(--fg)' }}>Winning the Game</h2>
          <p style={{ color: 'var(--fg-soft)' }}>
            The game continues round after round until one team leads the other by <strong>100 points or
            more</strong>. That team wins. Between rounds, the dealer is drawn at random from the losing
            team so that the next bidder (dealer + 1 clockwise) comes from the winning team.
          </p>
        </section>

        <section
          className="p-5 sm:p-7 rounded-2xl mb-10"
          style={{ background: 'var(--bg-1)', border: '1px solid var(--line)' }}
        >
          <h2 className="font-display text-xl sm:text-2xl mb-1" style={{ color: 'var(--accent)' }}>
            Laurelwood Mode
          </h2>
          <p className="text-xs uppercase tracking-[0.18em] mb-4" style={{ color: 'var(--dim)' }}>
            Optional variant
          </p>
          <p className="mb-3" style={{ color: 'var(--fg-soft)' }}>
            Laurelwood Mode is a house variant introduced in this edition. It changes how
            <strong> uncemented</strong> houses behave during captures and builds. Cemented houses are
            unchanged — they still behave exactly as in the standard game.
          </p>
          <ul className="space-y-3" style={{ color: 'var(--fg-soft)' }}>
            <li>
              <strong>Fragile houses.</strong> In Laurelwood Mode, an uncemented house can be
              <em> broken open</em>. Its total rank (as a single unit) may be combined with loose floor
              cards as part of a capture or build sum, even by a card that does not match the house's
              own rank.
            </li>
            <li>
              <strong>Example.</strong> Suppose the floor has a loose 3 and an uncemented House of 10.
              A played King may capture the pair as a single group (3 + 10 = 13), sweeping the house
              along with the loose card. In the standard game, the King could only capture cards of
              rank K or combinations that sum to 13 using loose cards alone.
            </li>
            <li>
              <strong>Greedy rule still applies.</strong> Because uncemented houses can now participate
              in sum-combinations, the greedy-capture rule considers them too: if a played card can
              combine with an uncemented house to form a capturable group, the player must take that
              group along with any other groups that already sum to the played rank.
            </li>
            <li>
              <strong>Cemented houses are immune.</strong> A cemented house is still captured only by an
              exact rank match. It can never be broken down or combined with other cards, even in
              Laurelwood Mode.
            </li>
          </ul>
          <p className="mt-4" style={{ color: 'var(--fg-soft)' }}>
            All other rules — scoring, Seep bonus, house ownership, end-of-round leftover sweep,
            winning condition — remain identical to the standard game.
          </p>
        </section>

        <div className="text-center py-4">
          <button
            onClick={onClose}
            className="btn-accent px-6 py-2.5 rounded-xl text-sm sm:text-base font-semibold"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
