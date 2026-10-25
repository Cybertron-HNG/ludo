// Ludo on start.ng. The server rolls the die and checks every move; a room is made by one person, who adds bots to empty seats and starts
// the game. Needs https://start.ng/kit.js (loaded in index.html).
(() => {
  const $ = (id) => document.getElementById(id);
  const REASONS = {
    not_found: 'That room has closed, or the code is wrong.',
    nobody_came: 'Nobody joined in time, so the room closed.',
    inactive: 'The room closed because nobody played for a while.',
    empty: 'The room closed because everyone left.',
    finished: 'That game is over and the room closed.',
    too_old: 'That room was open too long, so it closed.',
    offline: "Couldn't reconnect. Check your connection and try again.",
    code_4403: 'That room is full, or the game has started.',
    code_4404: 'That room has closed, or the code is wrong.',
    code_4409: 'You joined from another tab, so this one stopped.',
    code_4429: 'Too many wrong codes. Wait a minute and try again.',
    code_4401: 'Sign in with start.ng to play.',
  };
  const COLOURS = ['red', 'green', 'yellow', 'blue'];

  // The 52 squares of the ring on a 15 x 15 grid, as [column, row], clockwise from the red start square.
  const RING = [
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0],
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [14, 7], [14, 8],
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [7, 14], [6, 14],
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8], [0, 7], [0, 6],
  ];
  const SAFE = new Set([0, 13, 26, 39, 8, 21, 34, 47]);
  // The home squares (positions 51 to 55) for each corner of the board, counted from the ring towards the middle.
  const HOME_COLUMN = {
    0: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], 13: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    26: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]], 39: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  };
  // The four resting places in a base, by the corner (offset) the player starts from.
  const BASE = { 0: [1, 1], 13: [10, 1], 26: [10, 10], 39: [1, 10] };

  let room = null;
  let botsNext = 0;

  const show = (name) => { for (const id of ['lobby', 'waiting', 'game']) $(id).hidden = id !== name; };
  const problem = (text) => { $('lobby-problem').textContent = text || ''; $('lobby-problem').hidden = !text; };
  const reasonText = (reason) => REASONS[reason] || 'The room closed.';
  const note = (text) => { $('game-note').textContent = text || ''; };
  const nameOf = (seat) => room?.players.find((p) => p.seat === seat)?.name ?? 'Player';
  const isHost = () => room?.host === 0 && room.you === 0;
  const colourOf = (seat) => COLOURS[room.state.offsets[seat] / 13];

  // ---------- the lobby ----------

  function needSignIn(why) { problem(why); $('signin').hidden = false; }

  async function guarded(open) {
    problem('');
    $('signin').hidden = true;
    try {
      return await open();
    } catch (err) {
      if (err.message === 'signin') needSignIn('Sign in with start.ng to play Ludo.');
      else if (/^closed:/.test(err.message)) problem(reasonText(`code_${err.message.slice(7)}`));
      else problem(err.message || "Couldn't start. Try again.");
      return null;
    }
  }

  function wire(r) {
    room = r;
    r.on('welcome', () => {
      if (botsNext && r.status === 'waiting') {
        const n = botsNext;
        botsNext = 0;
        for (let i = 0; i < n; i++) r.playBot();
        setTimeout(() => r.start(), 400);
      }
      render();
    });
    r.on('state', render);
    r.on('join', render);
    r.on('away', render);
    r.on('back', render);
    r.on('reconnecting', () => note('Reconnecting…'));
    r.on('open', () => note(''));
    r.on('error', (m) => note(m.message));
    r.on('closed', (m) => leaveRoom(reasonText(m.reason)));
    render();
  }

  async function open(make) {
    const r = await guarded(make);
    if (r) wire(r);
    return r;
  }

  async function joinRoom(code) {
    const r = await open(() => startng.rooms.join(code));
    if (!r && new URLSearchParams(location.search).has('room')) history.replaceState(null, '', location.pathname);
  }

  function leaveRoom(message) {
    room?.leave();
    room = null;
    botsNext = 0;
    history.replaceState(null, '', location.pathname);
    show('lobby');
    problem(message || '');
  }

  // ---------- drawing the room ----------

  function render() {
    if (!room) return;
    if (room.code) history.replaceState(null, '', `${location.pathname}?room=${room.code}`);
    if (room.status === 'waiting' || room.status === null) { drawWaiting(); return; }
    show('game');
    drawGame();
  }

  function drawWaiting() {
    show('waiting');
    $('room-code').textContent = room.code || '';
    $('names').replaceChildren(...room.players.map((p) => {
      const li = document.createElement('li');
      li.textContent = p.seat === room.you ? `${p.name} (you)` : p.name;
      if (!p.online) li.className = 'away';
      return li;
    }));
    const host = isHost();
    $('add-bot').hidden = !host || room.players.length >= 4;
    $('start').hidden = !host;
    $('start').disabled = room.players.length < 2;
    $('waiting-title').textContent = host ? 'Share this code' : 'You are in. Waiting for the host to start.';
    $('waiting-note').textContent = host ? 'Up to 4 can play. Add bots to fill empty seats, then start.' : '';
  }

  // Where a token is on the 15 x 15 grid.
  function cellOf(s, seat, token) {
    const pos = s.tokens[seat][token];
    const offset = s.offsets[seat];
    if (pos === -1) {
      const [bx, by] = BASE[offset];
      return [bx + (token % 2) * 2, by + Math.floor(token / 2) * 2];
    }
    if (pos <= 50) return RING[(offset + pos) % 52];
    if (pos <= 55) return HOME_COLUMN[offset][pos - 51];
    return [7 + [-0.7, 0.7, -0.7, 0.7][token] * 0.9, 7 + [-0.7, -0.7, 0.7, 0.7][token] * 0.9]; // finished: round the middle
  }

  function drawBoard() {
    const s = room.state;
    const board = $('board');
    const cells = [];
    const cell = (c, r, cls, text) => {
      const d = document.createElement('i');
      d.className = `sq ${cls}`;
      d.style.left = `${(c / 15) * 100}%`;
      d.style.top = `${(r / 15) * 100}%`;
      if (text) d.textContent = text;
      return d;
    };
    for (const [corner, [bx, by]] of Object.entries(BASE)) {
      const b = document.createElement('i');
      b.className = `base ${COLOURS[Number(corner) / 13]}`;
      b.style.left = `${((bx - 1) / 15) * 100}%`;
      b.style.top = `${((by - 1) / 15) * 100}%`;
      cells.push(b);
    }
    RING.forEach(([c, r], i) => cells.push(cell(c, r, `ring${SAFE.has(i) ? ' safe' : ''}${i % 13 === 0 ? ` start ${COLOURS[i / 13]}` : ''}`, i % 13 === 8 ? '★' : '')));
    for (const [corner, squares] of Object.entries(HOME_COLUMN)) for (const [c, r] of squares) cells.push(cell(c, r, `home ${COLOURS[Number(corner) / 13]}`));
    cells.push(cell(6, 6, 'centre'));
    board.replaceChildren(...cells);

    const mine = s.movable;
    for (let seat = 0; seat < s.players; seat++) {
      for (let t = 0; t < 4; t++) {
        const [c, r] = cellOf(s, seat, t);
        const stack = s.tokens[seat].filter((p, j) => j < t && p === s.tokens[seat][t] && p >= 0 && p < 56).length;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `token ${colourOf(seat)}`;
        b.textContent = t + 1;
        b.style.left = `${((c + stack * 0.18) / 15) * 100}%`;
        b.style.top = `${((r - stack * 0.18) / 15) * 100}%`;
        b.setAttribute('aria-label', `${seat === room.you ? 'Your' : `${nameOf(seat)}'s`} ${colourOf(seat)} token ${t + 1}`);
        const canMove = seat === room.you && mine.includes(t);
        b.disabled = !canMove;
        if (canMove) { b.classList.add('go'); b.onclick = () => room.send({ move: t }); }
        board.append(b);
      }
    }
  }

  function drawGame() {
    const s = room.state;
    const result = room.result;
    const myTurn = room.turn === room.you;
    drawBoard();
    $('players').replaceChildren(...room.players.map((p) => {
      const span = document.createElement('span');
      const home = s.tokens[p.seat].filter((x) => x === 56).length;
      span.innerHTML = `<i class="dot ${colourOf(p.seat)}"></i>`;
      span.append(`${p.seat === room.you ? 'You' : p.name} · ${home}/4`);
      if (room.turn === p.seat) span.className = 'turn';
      if (!p.online) span.className += ' away';
      return span;
    }));
    $('die').textContent = s.last?.die ?? '–';
    $('roll').hidden = !!result;
    $('roll').disabled = !s.can_roll;
    $('roll').onclick = () => room.send({ roll: true });
    if (result) $('status').textContent = result.winner === room.you ? 'All four home. You win! 🎉' : `${nameOf(result.winner)} won`;
    else if (myTurn) $('status').textContent = s.can_roll ? 'Your turn: roll the die' : 'Pick a token to move';
    else $('status').textContent = `Waiting for ${nameOf(room.turn)}`;
    $('after').hidden = !result;
    note(lastText(s.last));
  }

  function lastText(last) {
    if (!last) return '';
    const who = last.seat === room.you ? 'You' : nameOf(last.seat);
    if (last.note) return `${who} rolled three sixes in a row: turn lost.`;
    if (last.moved === null) return last.seat === room.state.turn && last.die ? '' : `${who} rolled ${last.die}: no move.`;
    return `${who} rolled ${last.die}${last.captured?.length ? ' and sent a token home!' : '.'}`;
  }

  // ---------- buttons ----------

  $('friend').onclick = () => open(() => startng.rooms.create());
  $('bot').onclick = () => { botsNext = 3; open(() => startng.rooms.create()).then((r) => { if (!r) botsNext = 0; }); };
  $('join').onsubmit = (e) => { e.preventDefault(); const code = $('code').value.trim(); if (code) joinRoom(code); };
  $('signin').onclick = () => startng.signIn();
  $('add-bot').onclick = () => room?.playBot();
  $('start').onclick = () => room?.start();
  $('wait-cancel').onclick = () => leaveRoom('');
  $('back').onclick = () => leaveRoom('');
  $('share').onclick = () => startng.share({ text: 'I just played Ludo on start.ng. Play me!' });
  $('copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(room?.inviteUrl() ?? '');
      $('copy').textContent = 'Link copied';
    } catch {
      $('copy').textContent = room?.inviteUrl() ?? 'Copy failed';
    }
    setTimeout(() => { $('copy').textContent = 'Copy invite link'; }, 2000);
  };

  // ---------- start ----------

  async function start() {
    if (!window.startng) { problem('start.ng could not load. Check your connection.'); return; }
    const player = await startng.getPlayer();
    const code = startng.rooms.codeFromUrl();
    if (code && player?.user) joinRoom(code);
    else if (code) {
      $('invite').textContent = `You were invited to a game (room ${code}).`;
      $('invite').hidden = false;
      needSignIn('Sign in with start.ng to join your friends.');
    }
  }

  if (window.startng) start();
  else addEventListener('load', start);
})();
