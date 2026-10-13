# Chef Showdown

Browser recreation of Mojiworks' *Chef Showdown* (the Discord Activity co-op cooking rush game, shut down in 2025), built with Three.js + Vite. All models are procedural, so there are no asset files.

```sh
npm install
npm run dev      # http://localhost:5199
npm run build    # static build in dist/
```

## Modes
- **Score Attack**: endless customers and three hearts; a heart is lost each time a customer walks out. Menu grows as you earn. Weekly local leaderboard (resets Sunday). Add a local Player 2 in the lobby for co-op.
- **Versus**: two-minute match with shared customers. Play against the CPU (Easy/Normal/Hard) or a local Player 2.

Pressing Play opens a **Pick a stage** screen. Every map works in both modes:

| Map | Twist |
|---|---|
| Sushi Bar | The original Score Attack counter: kettle, salmon/tamago boards, nori, rice cauldrons |
| Sushi Street | Night street stall. Fish rides past on a conveyor belt at the front; grab it as it goes by |
| Burger Diner | 50s diner. Bun, then patty/cheese/lettuce stack on the latest bun; grill and fryer cook in batches |
| Happy Hour | Neon drinks bar: pour lemonade, root beer and cola; brew coffee; blend shakes |

Maps live in `src/maps.js`, station models in `src/stations.js`, recipes and layouts in `src/levels.js`.

## Online play
The host's browser runs the kitchen; everyone else sends inputs and draws snapshots from the host (20 per second, own movement predicted locally). `server/index.js` serves the built game and relays room messages over WebSockets.

```sh
npm run online   # builds, then serves game + relay on http://localhost:5200 (PORT env to change)
```

1. Host opens the server address → **Play online** → **Host**, gets a 4-character room code (or copies the invite link).
2. Mate opens the same server address → **Play online** → enters the code → **Join** (an invite link pre-fills it).
3. Host picks mode (co-op Score Attack for up to 4, Versus for exactly 2) and stage, then **Start**.

Your mate must be able to reach port 5200 on your machine:
- Same network: `http://<your-LAN-IP>:5200`
- Both on Tailscale: `http://<your-tailscale-IP>:5200`
- Over the internet without opening ports: a tunnel such as `tailscale funnel 5200` or `cloudflared tunnel --url http://localhost:5200` (gives an https link; WebSockets work through both)
- Or forward TCP 5200 on your router

For development run `npm run dev` and `npm run server` side by side; Vite proxies `/ws` to the relay.

## Controls
| | Move | Interact (hold to slice/pour) |
|---|---|---|
| Solo | WASD / Arrows | Space / E / Enter |
| P1 (2-player) | WASD | Space / E |
| P2 (2-player) | Arrows | Enter / Right Shift |
| Touch | Left stick | Hand button |

`Esc` pauses and opens the help screen.

## Loop
Grab a tray (single-use: it goes to the customer with the food), start cookers (rice/kettle/coffee/shakes), add items at stations (sushi starts with rice, then toppings and nori go on the latest rice), and serve at the counter. Serving faster earns bigger tips. Park a tray on one of the two spare plates to prep ahead, and toss mistakes (tray included) in the recycle bin. Money is XP, and leveling up unlocks more chefs.
