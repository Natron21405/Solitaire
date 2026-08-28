# Pastel Solitaire

Klondike solitaire built to live on an iPhone home screen. No build step, no
dependencies, no server — open `index.html` and it runs.

## House rules

| Rule | Setting |
| --- | --- |
| Stock | Draw **three** at a time |
| Passes through the stock | Unlimited |
| "Turn the last few face up" rule | **Off** |
| Foundation → tableau | **Allowed** |
| Undo | Unlimited, back to the deal |

## Features

- **Tap or drag.** Tapping a card sends it to the first legal home, foundation
  first; tapping a card with others stacked on it moves the whole run.
  Dragging works too — press and move past a few pixels and the card (or run)
  follows your finger, with the landing spot outlined. A press that does not
  travel stays a tap, so the two never fight each other. Foundation cards come
  back down to the tableau either way.
- **Stock on the right.** The stock is the most-tapped thing on the board and
  the top-left corner is the hardest place to reach one-handed on a tall
  phone, so it sits top-right with the waste fanning away from it.
- **Guaranteed-winnable deals.** Choose "Winnable only" and every shuffle is
  run through a solver before it reaches the board. "Random deal" is there too,
  and the statistics are tracked separately for each.
- **It stops only when the board is actually stuck.** If no legal move remains
  anywhere, you get a message and the offer of a new game or a replay.
  Deliberately, nothing interrupts you merely because a position has become
  unwinnable: a game you cannot win is still a game you can play, and the
  interruption would end it for you.
- **Hint.** Asks the solver for the next move in a winning line. This is the
  opt-in way to find out whether a game is still alive — if no line exists, it
  says so, but only because you asked.
- **Replay.** Restart the deal you are on from its opening position. The
  abandoned attempt is not recorded, so a replay costs nothing in the
  statistics — starting a *new* game still counts the one you walked away
  from as a loss.
- **Autocomplete.** Offered as soon as no face-down cards remain.
- **Lifetime statistics** in `localStorage`: games, wins, win rate, current and
  best streak, fastest win, fewest moves, total time, cards sent home.
- **Offline.** A service worker caches everything, so it works with no signal.

## Installing on iPhone

Open the page in Safari → Share → **Add to Home Screen**. It launches
full-screen with no browser chrome.

## The solver

`js/solver.js` is a depth-first search with a transposition table. The parts
that make it fast enough to run on a phone:

- **Compact state key.** The stock and waste never change relative order, so a
  position is fully identified by the foundations, the face-down counts, the
  face-up cards and one integer — how far into the stock you are.
- **Safe auto-play.** A card whose two opposite-colour neighbours one rank down
  are already home can never be wanted on the tableau again, so it is sent to
  the foundation automatically. This is a proof, not a heuristic, so no
  solutions are lost.
- **Compound draw moves.** "Press the stock four times, then play that card" is
  one move rather than five, which keeps the branching factor down.
- **Randomised restarts.** Search here is heavy-tailed — a dive either finds a
  line quickly or thrashes. Several short, differently-ordered dives beat one
  long dive on the same total budget (~68% vs ~64% of deals solved).

### One thing worth knowing

An earlier version treated "no face-down cards remain" as an automatic win.
That is true for draw-one but **false for draw-three**: cycling the stock only
ever exposes every third card, so a needed card can sit permanently out of
reach. The shortcut now also requires the stock and waste to be empty, which is
provable. The same distinction is why Autocomplete plays greedily when the
stock is empty and hands the job to the solver otherwise.

## Three bugs worth remembering

**Hints used to oscillate.** Each request re-solved from scratch, so after you
played the suggested move the fresh search could hand back its inverse — a
black ten shuffled between two red jacks forever. The solver was not wrong;
asking it the same question twice from different sides of one move just gets
two different answers. The fix is to ask once: a hint request now returns the
*whole* winning line, which is replayed into a `position -> next move` map.
Following a hint looks up the new position and gets the next step of the same
line. Leaving the line recomputes; undo lands on a position already in the map.

**Autocomplete could spin forever.** `autocompleteStep()` presses the stock when
nothing is playable and reports `true` for having done so, which is an infinite
loop in any position with no productive move — the stock cycles, snapshotting
every press, until the app is force-quit. It now allows at most one full pass
through the stock with nothing reaching a foundation, then stops and says so.

**"No moves left" almost never fired.** The old check answered "yes, there are
moves" whenever the stock held anything, on the assumption you can always press
it. That is wrong for draw three: cycling exposes only every third card, so a
full pass can surface nothing playable at all. It also could not reuse the
solver's move generator, which prunes legal-but-pointless moves for search
speed — correct for searching, wrong for deciding whether a player is stuck.
The check now enumerates real legality, including every card the stock can
actually reach.

## Are "winnable" deals really winnable?

Yes — and it is checked end to end, not just asserted. `tools/test-winnable.js`
reproduces the generator's exact loop, then replays the winning line through
the `Game` class's **public** move API, the same `draw()` and `doMove()` that
taps and drags call. A deal only passes if every move is accepted and the
foundations reach 52. **720 of 720** deals passed across four seed ranges.

That does not mean a game *you* played was winnable when you gave up.
`tools/test-naive-play.js` takes verified-winnable deals and plays them the way
the tap encourages — foundation first, always — for seventy moves, then asks
the solver whether a win is still possible. **43% are provably dead by then.**
Sending a card home early is the classic way to lose Klondike: it is no longer
there to hold the run that needed it. The deal was winnable; the game stopped
being so. Undo, Hint and Replay all exist for exactly this.

## The card faces

`js/cardart.js` draws every face as an inline SVG on a 100 x 148 grid, so the
same artwork is crisp at 50px on a phone and 200px on a tablet. Suits are
paths rather than the Unicode characters ♠♥♣♦, which render as colour emoji on
some iOS versions and change proportions between platforms. Numbers use the
traditional pip layouts with the lower half rotated. Courts are bold
half-length figures — clothing and crowns as solid suit-coloured masses, face,
beard, hair and ruff as cream — drawn so the three stay distinguishable when
shrunk to a thumbnail: the King has a cross-topped crown and a full beard, the
Queen a wide tiara and long hair, the Jack a plumed cap and a ruff.

Two rendering traps are worth remembering, both of which broke the cards once:

- The card flip is a 3D transform. Putting `filter` on `.face` or `.back`
  forces those elements to `transform-style: flat`, which silently disables
  `backface-visibility` — every card then shows its back. Use `box-shadow`.
- `.back` must carry `transform: rotateY(180deg)`. Without it both sides face
  the same way and the back simply paints over the face.

## Layout

```
index.html              markup + iOS meta tags
css/styles.css          theme and layout
js/cardart.js           card faces and backs, drawn as SVG
js/solver.js            search, rules, state (no DOM — also runs in node)
js/deal.js              seeded shuffle
js/game.js              playable game: moves, undo, autocomplete
js/stats.js             localStorage statistics
js/ui.js                rendering, input, overlays
js/worker.js            runs the solver off the main thread
sw.js                   offline cache
tools/                  benchmarks and tests (node)
```

## Tests

```
node --stack-size=8000 tools/test-game.js 40        # rules, undo, autocomplete, invariants
node --stack-size=8000 tools/test-winnable.js 200  # generated deals really do win, via the game API
node --stack-size=8000 tools/test-naive-play.js 60 # how often eager play kills a winnable deal
node --stack-size=8000 tools/bench.js 150          # solver win rate and speed
node --stack-size=8000 tools/tune.js               # move-ordering weight sweep
```

`test-game.js` checks card conservation (all 52 accounted for), the tableau run
invariant, that undo restores the deal exactly, and that every position the
solver claims to win can actually be played out to 52.
