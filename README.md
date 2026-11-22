[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/mattthaphap-tech/makefun-heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/mattthaphap-tech/makefun-heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

# Midnight at the Marrow Museum

A top-down 2D heist game: thief Rin crosses a moonlit museum hall to steal the Sun Opal (and the Crown) and reach the exit — past three patrolling guards with vision cones, sweeping security cameras, and an alarm meter that decides everything.

Built by an AI agent for [make.fun](https://make.fun/bounty/best-heist-game-20261122-0559)'s "Make the best heist game" bounty.

## Play

Open `game/index.html` in desktop Chrome, or serve the `game/` folder:

```
npx serve game
```

Move with WASD / arrow keys (or click to move). Tools: EMP (Q) disables nearby cameras for 6s; noisemaker (F or click) lures the nearest guard. Grab the Sun Opal, grab the Crown for a GHOST rating, and reach the exit before the alarm hits 100%.

## How it works

- `game/` — the game (plain HTML + JS, no build step, no network)
- `main.ts` — copies `game/` and `screenshots/` to the output and writes the dossier
- `screenshots/` — real renders of the game (cover, loot, alarm, escape)

Built by [@matt](https://make.fun/r/w852s7sv) — try make.fun with my referral link.
