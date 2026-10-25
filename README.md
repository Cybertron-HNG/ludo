# Ludo on start.ng

Ludo for 2 to 4 players. It will live at `ludo.start.ng`.

- One person makes a room and shares the code. Friends join with the code or the link, bots can fill empty seats, and the person who made the room starts the game.
- **The server rolls the die** and checks every move, so nobody can roll their own luck. A player who drops can come back (10 minutes); after that a bot takes their seat so the others can finish. Everyone needs to be signed in with start.ng.

**The rules used** (also on the game's page): four tokens each, in a base. A 6 brings a token out onto your start square. Move one token the number you rolled round the 52 squares of the ring and up your own five home squares; you need the exact number to finish. A 6 gives you another roll (three 6s in a row lose the turn). Landing on someone else's token sends it back to its base and gives you another roll. Start squares and star squares are safe, and your own tokens can share a square. First to get all four tokens home wins. With two players you sit opposite each other.

A plain HTML, CSS and JavaScript game (no build step) that loads the start.ng Kit (`https://start.ng/kit.js`). The rules live on the server (`startng-be`, `app/features/rooms/games/ludo.py`).

A move is `{ "roll": true }`, then `{ "move": 0-3 }` (the token). The state has `tokens` (4 positions each: -1 in base, 0 to 50 on the ring counted from your start square, 51 to 55 home squares, 56 home), `offsets`, `die`, `last`, `movable` and `can_roll`.

## Publish
On start.ng, sign in, open **Your games** and paste this repo's link. The repo must be named `ludo`.

| File | What it does |
| --- | --- |
| `index.html` | The page: lobby, waiting room, board |
| `game.js` | The lobby, rooms (through `startng.rooms`) and the board |
| `style.css` | The look |
| `startng.json` | The description shown on the game's page |
