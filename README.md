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

- **Tap to move.** Tapping a card sends it to the first legal home, foundation
  first. Tapping a card that has others stacked on it moves the whole run.
  Foundation cards tap back down to the tableau.
- **Guaranteed-winnable deals.** Choose "Winnable only" and every shuffle is
  run through a solver before it reaches the board. "Random deal" is there too,
  and the statistics are tracked separately for each.
- **It tells you when the game is lost.** Two separate checks: a hard dead end
  (no legal move anywhere) fires instantly, and in the background the solver
  looks for any winning line from your current position. It only says a game
  cannot be won when it has *exhausted* the search — never as a guess.
- **Hint.** Asks the solver for the next move in a winning line.
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

## Layout

```
index.html              markup + iOS meta tags
css/styles.css          theme and layout
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
node --stack-size=8000 tools/test-game.js 40    # rules, undo, autocomplete, invariants
node --stack-size=8000 tools/bench.js 150       # solver win rate and speed
node --stack-size=8000 tools/tune.js            # move-ordering weight sweep
```

`test-game.js` checks card conservation (all 52 accounted for), the tableau run
invariant, that undo restores the deal exactly, and that every position the
solver claims to win can actually be played out to 52.
