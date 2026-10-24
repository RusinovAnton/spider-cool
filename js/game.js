// Spider Solitaire — rules, rendering, input, hints, UI.
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const SUIT_CH = ['♠︎', '♥︎', '♦︎', '♣︎'];
  const RED = [false, true, true, false];
  const RANK_CH = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const MODE_NAME = { 1: '1 Suit', 2: '2 Suits', 4: '4 Suits' };
  const MODE_SUB = { 1: 'Beginner', 2: 'Intermediate', 4: 'Expert' };
  const MODE_GLYPHS = { 1: [0], 2: [0, 1], 4: [0, 1, 2, 3] };
  const GAME_MODES = {
    noob: { name: '🐣 Noob', sub: 'Best move always lit' },
    normal: { name: 'Normal', sub: 'Hints on click · 1 undo' },
    pro: { name: '⚡ Pro', sub: 'No hints · no undo' },
  };
  // Classic pip layouts: [x %, row fraction 0 (top) → 1 (bottom)]
  const L = 31, Mid = 50, R = 69;
  const SIDES = rows => rows.flatMap(f => [[L, f], [R, f]]);
  const PIPS = {
    2: [[Mid, 0], [Mid, 1]],
    3: [[Mid, 0], [Mid, 0.5], [Mid, 1]],
    4: SIDES([0, 1]),
    5: [...SIDES([0, 1]), [Mid, 0.5]],
    6: SIDES([0, 0.5, 1]),
    7: [...SIDES([0, 0.5, 1]), [Mid, 0.25]],
    8: [...SIDES([0, 0.5, 1]), [Mid, 0.25], [Mid, 0.75]],
    9: [...SIDES([0, 1 / 3, 2 / 3, 1]), [Mid, 0.5]],
    10: [...SIDES([0, 1 / 3, 2 / 3, 1]), [Mid, 1 / 6], [Mid, 5 / 6]],
  };
  const DUR = 300;
  const DEAL_GAP = 55;
  const STAGGER = 38;
  const SAVE_KEY = 'spiderAero.current.v1';
  const PREF_KEY = 'spiderAero.prefs.v1';

  const boardEl = $('#board');
  const slotEls = { tab: [], found: null, stock: null };

  let G = null;         // persistent game state
  let deck = [];        // runtime card objects (DOM + position)
  let M = {};           // layout metrics
  let runAt = 0;        // performance.now() when clock (re)started, 0 = paused
  let hint = { version: -1, list: [], idx: 0, timer: 0 };
  let shownMove = null;   // the hint currently highlighted on the table, if any
  let seenPositions = new Set(); // this game's positions, so hints never lead back into one
  let proNagged = false;    // Pro games remind about "no hints" only once
  let press = null;
  let modal = null;
  let bestCache = null;
  let idleTimer = 0;

  const prefs = loadJSON(PREF_KEY, { suits: 1 });
  delete prefs.noob; // modes are picked per game now
  delete prefs.pro;

  // ---------- utils ----------
  function loadJSON(k, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pad2 = n => String(n).padStart(2, '0');
  function fmtTime(ms) {
    if (ms == null) return '—';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`;
  }
  const C = id => deck[id];
  const topOf = p => { const pile = G.tableau[p]; return pile.length ? C(pile[pile.length - 1]) : null; };
  const panOf = p => (p / 9) * 1.2 - 0.6;
  const cardName = c => `<b class="${RED[c.suit] ? 'tx-red' : 'tx-blk'}">${RANK_CH[c.rank]}${SUIT_CH[c.suit]}</b>`;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- game setup ----------
  function newGame(suits, seed, mode = 'normal') {
    const pro = mode === 'pro';
    if (G && G.started && !G.won && G.moves > 0) recordGame(false);
    closeModal();
    suits = MODE_NAME[suits] ? suits : 1;
    seed = seed || (Math.floor(Math.random() * 999999) + 1);
    const rnd = mulberry32(seed);
    const pattern = MODE_GLYPHS[suits];
    const defs = [];
    for (let i = 0; i < 104; i++) defs.push([pattern[Math.floor(i / 13) % pattern.length], (i % 13) + 1]);
    for (let i = defs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [defs[i], defs[j]] = [defs[j], defs[i]];
    }
    G = {
      seed, suits, deck: defs,
      tableau: Array.from({ length: 10 }, () => []),
      stock: [], found: [],
      up: new Array(104).fill(0),
      score: 500, moves: 0, undos: 0, hints: 0,
      elapsed: 0, started: false, won: false, recorded: false,
      history: [], version: 0, pro, noob: mode === 'noob',
    };
    let id = 0;
    for (let r = 0; r < 6; r++) {
      for (let p = 0; p < 10; p++) {
        if (r === 5 && p >= 4) continue;
        G.tableau[p].push(id++);
      }
    }
    G.tableau.forEach(p => { G.up[p[p.length - 1]] = 1; });
    for (; id < 104; id++) G.stock.push(id);
    runAt = 0;
    prefs.suits = suits;
    saveJSON(PREF_KEY, prefs);
    bestCache = null;

    seenPositions = new Set();
    clearTimeout(hint.timer);
    hint = { version: -1, list: [], idx: 0, timer: 0 };
    buildCards();
    measure();
    // everything starts in the stock pile, then gets dealt out
    for (const c of deck) setCard(c, { x: M.stockX, y: M.bottomY, z: 20 + c.id }, 0, true, false);
    const delays = {};
    for (let i = 0; i < 54; i++) delays[i] = 120 + i * 20;
    requestAnimationFrame(() => layout({ delays }));
    Sound.play('shuffle');
    changed();
    proNagged = false;
    Mascot.say(pro ? `⚡ Pro ${MODE_NAME[suits]} game — no hints, no undo. Good luck!`
      : G.noob ? `🐣 Noob ${MODE_NAME[suits]} game — I'll keep the best move lit for you.` : pick([
      `New ${MODE_NAME[suits]} game! Let’s spin some webs.`,
      `Fresh deal, ${MODE_NAME[suits].toLowerCase()}. You got this!`,
      `Game #${seed} — shuffled with eight legs.`,
    ]), 'happy', 3600);
  }

  function buildCards() {
    boardEl.querySelectorAll('.card').forEach(e => e.remove());
    const frag = document.createDocumentFragment();
    deck = G.deck.map(([suit, rank], id) => {
      const el = makeCardEl(suit, rank, id);
      frag.appendChild(el);
      return { id, suit, rank, el, pos: null, zt: 0, zFinal: 0, dragged: false };
    });
    boardEl.appendChild(frag);
  }

  function makeCardEl(suit, rank, id) {
    const el = document.createElement('div');
    el.className = 'card ' + (RED[suit] ? 'red' : 'black');
    el.dataset.id = id;
    const s = SUIT_CH[suit], r = RANK_CH[rank];
    let center;
    if (rank > 10) {
      center = `<div class="court"><span class="court-r">${r}</span><span class="court-s">${s}</span></div>`;
    } else if (rank === 1) {
      center = `<div class="ace-glow"></div><div class="pip ace">${s}</div>`;
    } else {
      center = PIPS[rank].map(([x, f]) =>
        `<div class="pip${rank >= 9 ? ' dense' : ''}${f > 0.5 ? ' flip' : ''}" style="left:${x}%;top:${36 + f * 52}%">${s}</div>`).join('');
    }
    el.innerHTML =
      `<div class="card-inner"><div class="face">` +
      `<div class="corner"><span class="cr">${r}</span><span class="cs">${s}</span></div>${center}` +
      `</div><div class="back"></div></div>`;
    return el;
  }

  function buildSlots() {
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      s.dataset.pile = i;
      boardEl.appendChild(s);
      slotEls.tab.push(s);
    }
    slotEls.found = document.createElement('div');
    slotEls.found.className = 'tray found-tray';
    slotEls.found.innerHTML = '<span class="tray-lbl">Completed</span>';
    slotEls.stock = document.createElement('div');
    slotEls.stock.className = 'tray stock-tray';
    slotEls.stock.innerHTML = '<span class="tray-lbl stock-lbl"></span>';
    boardEl.append(slotEls.found, slotEls.stock);
  }

  // Card-back spider web, generated once as a data-URI background.
  function setWebPattern() {
    const cx = 50, cy = 70;
    const angs = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4 + Math.PI / 8);
    let d = '';
    angs.forEach(a => { d += `M${cx} ${cy}L${(cx + Math.cos(a) * 95).toFixed(1)} ${(cy + Math.sin(a) * 95).toFixed(1)}`; });
    for (const r of [9, 18, 29, 42, 57, 74]) {
      angs.forEach((a, i) => {
        const b = angs[(i + 1) % 8];
        const m = (a + b) / 2 + (i === 7 ? Math.PI : 0);
        const p = (ang, rr) => `${(cx + Math.cos(ang) * rr).toFixed(1)} ${(cy + Math.sin(ang) * rr).toFixed(1)}`;
        d += `${i === 0 ? 'M' + p(a, r) : ''}Q${p(m, r * 0.8)} ${p(b, r)}`;
      });
    }
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 140'><path d='${d}' fill='none' stroke='white' stroke-opacity='.42' stroke-width='.9'/></svg>`;
    document.documentElement.style.setProperty('--web', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  }

  // Frosted-glass grain for card faces, rendered once to a PNG so painting it is a plain bitmap blit.
  function setFrostTexture() {
    const n = 70;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(n, n);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = v > 0.55 ? Math.round((v - 0.55) * 230) : 0;
    }
    ctx.putImageData(img, 0, 0);
    document.documentElement.style.setProperty('--frost', `url(${c.toDataURL('image/png')})`);
  }

  // ---------- layout ----------
  function measure() {
    const r = boardEl.getBoundingClientRect();
    const W = r.width, H = r.height;
    const pad = Math.max(8, Math.min(W, H) * 0.022);
    const gap = Math.max(4, W * 0.011);
    let cw = (W - pad * 2 - gap * 9) / 10;
    cw = Math.max(26, Math.min(cw, 124, (H - pad * 2) / (1.4 * 3.3)));
    const ch = cw * 1.4;
    const totalW = cw * 10 + gap * 9;
    const x0 = (W - totalW) / 2;
    M = {
      W, H, pad, gap, cw, ch, x0, totalW,
      top: pad,
      bottomY: H - pad - ch,
      cols: Array.from({ length: 10 }, (_, i) => x0 + i * (cw + gap)),
      stockOff: cw * 0.17,
      foundOff: cw * 0.34,
    };
    M.stockX = x0 + totalW - cw;
    boardEl.style.setProperty('--cw', cw + 'px');
    boardEl.style.setProperty('--ch', ch + 'px');
    slotEls.tab.forEach((s, i) => { s.style.transform = `translate(${M.cols[i]}px, ${M.top}px)`; });
    const fw = cw + M.foundOff * 7, sw = cw + M.stockOff * 4;
    Object.assign(slotEls.found.style, { width: fw + 'px', transform: `translate(${x0}px, ${M.bottomY}px)` });
    Object.assign(slotEls.stock.style, { width: sw + 'px', transform: `translate(${M.stockX - M.stockOff * 4}px, ${M.bottomY}px)` });
  }

  function pileYs(p) {
    const pile = G.tableau[p];
    const out = [];
    if (!pile.length) return out;
    let fd = M.ch * 0.1, fu = M.ch * 0.27;
    let nd = 0, nu = 0;
    for (let i = 0; i < pile.length - 1; i++) (G.up[pile[i]] ? nu++ : nd++);
    const need = nd * fd + nu * fu;
    // Prefer staying above the stock/foundation row; overlap it only when squeezing would get unreadable.
    const short = M.bottomY - M.gap - M.top - M.ch;
    const tall = M.H - M.pad - M.top - M.ch;
    if (need > short) {
      let s = Math.max(0, short) / need;
      if (fu * s < M.ch * 0.17) s = Math.max(0, tall) / need;
      s = Math.min(1, s);
      fd *= s;
      fu *= s;
    }
    let y = M.top;
    for (let i = 0; i < pile.length; i++) {
      out.push(y);
      y += G.up[pile[i]] ? fu : fd;
    }
    return out;
  }

  function computeTargets() {
    const t = new Array(104);
    G.tableau.forEach((pile, p) => {
      const ys = pileYs(p);
      pile.forEach((id, i) => { t[id] = { x: M.cols[p], y: ys[i], z: 300 + i }; });
    });
    const ng = Math.ceil(G.stock.length / 10);
    G.stock.forEach((id, i) => {
      const g = Math.floor(i / 10);
      t[id] = { x: M.stockX - (ng - 1 - g) * M.stockOff, y: M.bottomY, z: 150 + i };
    });
    G.found.forEach((run, j) => {
      run.forEach((id, i) => { t[id] = { x: M.x0 + j * M.foundOff, y: M.bottomY, z: 10 + j * 14 + (13 - i) }; });
    });
    return t;
  }

  function setCard(c, tg, delay, instant, up = !!G.up[c.id]) {
    const el = c.el;
    c.zFinal = tg.z;
    const moved = c.dragged || !c.pos || Math.abs(c.pos.x - tg.x) > 0.5 || Math.abs(c.pos.y - tg.y) > 0.5;
    c.pos = { x: tg.x, y: tg.y };
    if (instant) {
      clearTimeout(c.zt);
      c.zt = 0;
      el.classList.add('noanim');
      el.style.transform = `translate(${tg.x}px, ${tg.y}px)`;
      el.style.zIndex = tg.z;
      el.style.setProperty('--d', '0ms');
      el.classList.toggle('up', up);
      void el.offsetWidth;
      el.classList.remove('noanim');
      return;
    }
    el.style.setProperty('--d', delay + 'ms');
    if (moved) {
      el.style.zIndex = 5000 + tg.z;
      clearTimeout(c.zt);
      c.zt = setTimeout(() => {
        el.style.zIndex = c.zFinal;
        el.style.setProperty('--d', '0ms');
        c.zt = 0;
      }, delay + DUR + 60);
      el.style.transform = `translate(${tg.x}px, ${tg.y}px)`;
    } else if (!c.zt) {
      el.style.zIndex = tg.z;
    }
    if (el.classList.contains('up') !== up) {
      el.classList.remove('flip');
      void el.offsetWidth;
      el.classList.add('flip');
      clearTimeout(c.ft);
      c.ft = setTimeout(() => el.classList.remove('flip'), delay + 320);
    }
    el.classList.toggle('up', up);
  }

  function layout({ delays = {}, instant = false } = {}) {
    if (!G) return;
    const t = computeTargets();
    for (const c of deck) setCard(c, t[c.id], delays[c.id] || 0, instant);
    const deals = G.stock.length / 10;
    slotEls.stock.classList.toggle('empty', !deals);
    slotEls.stock.querySelector('.stock-lbl').textContent = deals ? `${deals} deal${deals > 1 ? 's' : ''}` : 'Empty';
    slotEls.tab.forEach((s, i) => s.classList.toggle('vacant', !G.tableau[i].length));
  }

  function boardPt(x, y) {
    const r = boardEl.getBoundingClientRect();
    return [r.left + x, r.top + y];
  }

  function floatText(x, y, txt, cls = '') {
    const el = document.createElement('div');
    el.className = 'float-txt ' + cls;
    el.textContent = txt;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    boardEl.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ---------- rules ----------
  // Index where the movable same-suit run at the top of pile p begins.
  function runStart(p) {
    const pile = G.tableau[p];
    let k = pile.length - 1;
    if (k < 0) return 0;
    while (k > 0) {
      const a = C(pile[k - 1]), b = C(pile[k]);
      if (G.up[a.id] && a.suit === b.suit && a.rank === b.rank + 1) k--;
      else break;
    }
    return k;
  }

  // Length of the face-up descending sequence (any suit) at the top of pile p.
  function orderedLen(p) {
    const pile = G.tableau[p];
    if (!pile.length) return 0;
    let n = 1;
    for (let k = pile.length - 1; k > 0; k--) {
      const a = C(pile[k - 1]), b = C(pile[k]);
      if (G.up[a.id] && a.rank === b.rank + 1) n++;
      else break;
    }
    return n;
  }

  function locate(id) {
    for (let p = 0; p < 10; p++) {
      const i = G.tableau[p].indexOf(id);
      if (i >= 0) return { where: 'tab', pile: p, idx: i };
    }
    if (G.stock.includes(id)) return { where: 'stock' };
    return { where: 'found' };
  }

  function canPlace(id, p) {
    const t = topOf(p);
    return !t || t.rank === C(id).rank + 1;
  }

  function snap() {
    return { t: G.tableau.map(p => p.slice()), s: G.stock.slice(), f: G.found.map(r => r.slice()), u: G.up.slice() };
  }
  // Only the last move can be undone: keep a single snapshot, cleared once used.
  function pushHistory() {
    if (G.pro) return; // no undo in Pro games
    G.history = [snap()];
  }

  function reveal(p) {
    const pile = G.tableau[p];
    if (!pile.length) return false;
    const id = pile[pile.length - 1];
    if (G.up[id]) return false;
    G.up[id] = 1;
    return true;
  }

  function doMove(from, idx, to) {
    if (G.won) return;
    pushHistory();
    const run = G.tableau[from].splice(idx);
    G.tableau[to].push(...run);
    G.moves++;
    G.score--;
    startClock();
    const revealed = reveal(from);
    layout();
    const lead = C(run[0]);
    Sound.play('place', lead.rank, panOf(to));
    const ys = pileYs(to);
    const [px, py] = boardPt(M.cols[to] + M.cw / 2, ys[ys.length - 1] + M.ch * 0.2);
    setTimeout(() => FX.burst(px, py, { count: 7, speed: 2.6, bubbles: 1 }), DUR * 0.8);
    if (revealed) {
      setTimeout(() => {
        Sound.play('flip', panOf(from));
        if (Math.random() < 0.18) Mascot.say(pick(['Ooh, a new card!', 'Peekaboo!', 'Nice reveal.', 'Fresh card unlocked.']), 'happy', 1800);
      }, 140);
    }
    completeCheck([to], DUR + 40);
    changed();
  }

  function completeCheck(piles, wait) {
    const done = [];
    for (const p of piles) {
      const pile = G.tableau[p];
      if (pile.length < 13 || pile.length - runStart(p) < 13) continue;
      const run = pile.splice(pile.length - 13);
      G.found.push(run);
      G.score += 100;
      reveal(p);
      done.push({ p, run, slot: G.found.length - 1 });
    }
    if (!done.length) return false;
    const won = G.found.length === 8;
    if (won) finishWin();
    setTimeout(() => {
      const delays = {};
      done.forEach((d, n) => d.run.forEach((id, i) => { delays[id] = n * 200 + (12 - i) * STAGGER; }));
      layout({ delays });
      Sound.play('complete');
      done.forEach((d, n) => {
        const [sx, sy] = boardPt(M.cols[d.p] + M.cw / 2, M.top + M.ch);
        FX.burst(sx, sy, { count: 26, speed: 6, bubbles: 8 });
        FX.ring(sx, sy);
        setTimeout(() => {
          const fx = M.x0 + d.slot * M.foundOff + M.cw / 2;
          const [x, y] = boardPt(fx, M.bottomY + M.ch / 2);
          FX.burst(x, y, { count: 30, speed: 7, bubbles: 10 });
          FX.ring(x, y, 'rgba(160,255,170,1)', 14, 80);
          floatText(fx, M.bottomY, '+100', 'gold');
        }, n * 200 + 12 * STAGGER + DUR);
      });
      if (!won) {
        Mascot.say(pick(['Suit complete! +100 ✨', 'K→A, chef’s kiss. +100', 'Spun to perfection! +100', 'Another one for the web! +100']), 'happy', 3200);
      } else {
        setTimeout(celebrate, 12 * STAGGER + DUR + 250);
      }
    }, wait);
    return true;
  }

  function deal() {
    if (!G || G.won) return;
    if (!G.stock.length) {
      Sound.play('invalid');
      Mascot.say('The stock is empty — everything’s on the table now.', 'oh', 3000);
      return;
    }
    const onTable = G.tableau.reduce((s, p) => s + p.length, 0);
    if (onTable >= 10 && G.tableau.some(p => !p.length)) {
      Sound.play('invalid');
      Mascot.say('Fill every empty column before dealing.', 'oh', 3200);
      slotEls.tab.forEach((s, i) => { if (!G.tableau[i].length) flash(s); });
      return;
    }
    pushHistory();
    const delays = {};
    for (let p = 0; p < 10; p++) {
      const id = G.stock.pop();
      G.up[id] = 1;
      G.tableau[p].push(id);
      delays[id] = p * DEAL_GAP;
      Sound.play('deal', p);
    }
    G.moves++;
    G.score--;
    startClock();
    layout({ delays });
    completeCheck([...Array(10).keys()], 10 * DEAL_GAP + DUR);
    changed();
  }

  function undo() {
    if (G && G.pro && !G.won) return proBlocked('No undo in Pro games. Every move counts!');
    if (!G || G.won || !G.history.length) {
      Sound.play('invalid');
      if (G && !G.won) Mascot.say(G.moves ? 'Only one undo per move — make a move first.' : 'Nothing to undo yet.', 'oh', 2200);
      return;
    }
    const s = G.history.pop();
    const foundBefore = G.found.length;
    G.tableau = s.t;
    G.stock = s.s;
    G.found = s.f;
    G.up = s.u;
    G.score -= 1 + 100 * (foundBefore - G.found.length);
    G.moves++;
    G.undos++;
    layout();
    Sound.play('undo');
    changed();
  }

  function changed() {
    seenPositions.add(posSig(G.tableau, G.up));
    setHover([]);
    G.version++;
    clearHint();
    updateHUD();
    scheduleSave();
    bumpIdle();
    checkStuck();
  }

  // When no useful tableau move is left, pulse the stock so the player knows to deal.
  let stuckTimer = 0;
  // Noob mode also lives here: once cards settle, the best move stays highlighted.
  function checkStuck() {
    clearTimeout(stuckTimer);
    slotEls.stock.classList.remove('nudge');
    boardEl.querySelectorAll('.card.stock-glow').forEach(e => e.classList.remove('stock-glow'));
    clearAuto();
    const v = G.version;
    stuckTimer = setTimeout(() => {
      if (!G || G.won || G.version !== v) return;
      if (G.pro) return; // no nudges or highlights in Pro games
      const list = analyze();
      if (list.length === 1 && list[0].deal) {
        slotEls.stock.classList.add('nudge');
        G.stock.slice(-10).forEach(id => C(id).el.classList.add('stock-glow'));
        Mascot.say('No more moves on the table — deal from the stock!', 'think', 3600);
        return;
      }
      if (G.noob && list.length) {
        // seed the hint cycle so a background click moves on to the 2nd-best move
        if (hint.version !== G.version) hint = { version: G.version, list, idx: 0, timer: 0 };
        applyAuto();
      }
    }, DUR + 12 * STAGGER + 200);
  }

  function clearAuto() {
    if (shownMove && !document.querySelector('.hint-src')) shownMove = null;
    boardEl.querySelectorAll('.auto-src, .auto-dst').forEach(e => e.classList.remove('auto-src', 'auto-dst'));
  }

  function applyAuto() {
    clearAuto();
    if (!G || !G.noob || G.won || hint.version !== G.version || !hint.list.length) return;
    const h = hint.list[0];
    if (h.deal) return;
    shownMove = { h, version: G.version };
    G.tableau[h.from].slice(h.idx).forEach(id => C(id).el.classList.add('auto-src'));
    const t = topOf(h.to);
    (t ? t.el : slotEls.tab[h.to]).classList.add('auto-dst');
  }

  function proBlocked(msg) {
    Sound.play('invalid');
    Mascot.say(msg, 'oh', 2600);
  }

  function flash(el) {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function reject(ids, msg) {
    for (const id of ids) {
      const el = C(id).el;
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }
    Sound.play('invalid');
    if (msg) Mascot.say(msg, 'oh', 2400);
  }

  // ---------- hints ----------
  // ---- move engine over a plain tableau so hints can look one move ahead ----
  function runStartIn(T, U, p) {
    const pile = T[p];
    let k = pile.length - 1;
    if (k < 0) return 0;
    while (k > 0) {
      const a = C(pile[k - 1]), b = C(pile[k]);
      if (U[a.id] && a.suit === b.suit && a.rank === b.rank + 1) k--;
      else break;
    }
    return k;
  }

  // Every legal move except true no-ops (a whole pile into an empty column).
  function legalMoves(T, U) {
    const out = [];
    for (let s = 0; s < 10; s++) {
      const pile = T[s];
      if (!pile.length) continue;
      for (let i = runStartIn(T, U, s); i < pile.length; i++) {
        const rank = C(pile[i]).rank;
        let triedEmpty = false;
        for (let d = 0; d < 10; d++) {
          if (d === s) continue;
          const dp = T[d];
          if (dp.length) {
            if (C(dp[dp.length - 1]).rank !== rank + 1) continue;
          } else {
            if (i === 0 || triedEmpty) continue;
            triedEmpty = true;
          }
          out.push({ from: s, idx: i, to: d });
        }
      }
    }
    return out;
  }

  // Position fingerprint by card face (the two decks' twins are interchangeable), column order ignored.
  const posSig = (T, U) => T.map(p => p.map(id => (U[id] ? C(id).suit * 13 + C(id).rank : '#')).join(',')).sort().join('|');

  // How good a tableau is. Hints are moves (or move pairs) that raise this, so shuffles
  // that change nothing score zero and can never loop.
  function boardValue(T, U, needFill) {
    let v = 0;
    for (const pile of T) {
      if (!pile.length) { v += needFill ? -15 : 30; continue; }
      const top = pile[pile.length - 1];
      if (!U[top]) {
        let hidden = 0;
        for (const id of pile) if (!U[id]) hidden++;
        v += 60 + (6 - Math.min(hidden, 6)) * 5; // a card ready to flip; short piles are nearly empty
      }
      for (let i = 1; i < pile.length; i++) {
        if (!U[pile[i - 1]] || !U[pile[i]]) continue;
        const a = C(pile[i - 1]), b = C(pile[i]);
        if (a.rank !== b.rank + 1) continue;
        v += a.suit === b.suit ? 12 : 4;
      }
    }
    return v;
  }

  // Tableau after a move. Cards it would reveal stay face-down: the lookahead mustn't peek.
  function applyIn(T, U, m) {
    const T2 = T.slice();
    T2[m.from] = T[m.from].slice(0, m.idx);
    T2[m.to] = T[m.to].concat(T[m.from].slice(m.idx));
    const d = T2[m.to];
    let done = 0;
    if (d.length >= 13 && d.length - runStartIn(T2, U, m.to) >= 13) { T2[m.to] = d.slice(0, d.length - 13); done = 1; }
    return { T: T2, done };
  }

  // By card face, not id: the two decks' twin cards are interchangeable for "was this possible already?"
  const face = id => C(id).suit * 13 + C(id).rank;
  const moveKey = (T, m) => `${face(T[m.from][m.idx])}x${T[m.from].length - m.idx}>${T[m.to].length ? face(T[m.to][T[m.to].length - 1]) : 'e'}`;
  function moveText(T, m) {
    const pile = T[m.from], card = C(pile[m.idx]), n = pile.length - m.idx;
    const dp = T[m.to], t = dp.length ? C(dp[dp.length - 1]) : null;
    return `${cardName(card)}${n > 1 ? `<span class="muted"> +${n - 1}</span>` : ''} onto ${t ? cardName(t) : 'an empty column'}`;
  }
  function moveWhy(T, U, m, done, needFill) {
    const why = [];
    const pile = T[m.from], dp = T[m.to];
    const t = dp.length ? C(dp[dp.length - 1]) : null;
    if (done) why.push('completes a suit!');
    else if (t && t.suit === C(pile[m.idx]).suit) why.push('same suit');
    if (m.idx > 0 && !U[pile[m.idx - 1]]) why.push('reveals a card');
    if (m.idx === 0 && !needFill) why.push('frees a column');
    if (!dp.length && needFill) why.push('fills a column so you can deal');
    return why;
  }

  // Hints, best → worst: one-move gains, plus setups whose follow-up gains even more.
  function analyze() {
    const T = G.tableau, U = G.up;
    const onTable = T.reduce((n, p) => n + p.length, 0);
    // With cards left to deal, every empty column must be refilled first, so it counts against
    // you (consistently, or hints flip-flop between emptying and filling).
    const needFill = G.stock.length > 0 && onTable >= 10;
    const dealBlocked = needFill && T.some(p => !p.length);
    const v0 = boardValue(T, U, needFill);
    const moves = legalMoves(T, U).map(m => {
      const r = applyIn(T, U, m);
      return { m, T1: r.T, done: r.done, gain: boardValue(r.T, U, needFill) + r.done * 1000 - v0 };
    });
    const available = new Set(moves.map(x => moveKey(T, x.m))); // a setup must unlock something new
    const list = [];
    for (const { m, T1, done, gain } of moves) {
      if (!done && seenPositions.has(posSig(T1, U))) continue; // been there: would loop
      const movedId = T[m.from][m.idx];
      let best = null;
      for (const m2 of legalMoves(T1, U)) {
        if (T1[m2.from][m2.idx] === movedId) continue;  // same cards again
        if (available.has(moveKey(T1, m2))) continue;  // was possible anyway
        const r2 = applyIn(T1, U, m2);
        const g2 = boardValue(r2.T, U, needFill) + (done + r2.done) * 1000 - v0;
        if (!best || g2 > best.g2) best = { m2, g2, done2: r2.done };
      }
      const setup = best && 0.9 * best.g2 > gain;
      const score = setup ? 0.9 * best.g2 : gain;
      if (score <= 0) continue;
      const why = gain > 0 ? moveWhy(T, U, m, done, needFill) : [];
      if (setup) why.push(`${why.length ? 'then' : 'sets up'} ${moveText(T1, best.m2)}${best.done2 ? ' (completes a suit!)' : ''}`);
      const label = `Move ${moveText(T, m)}${why.length ? ' — ' + why.join(', ') : ''}`;
      list.push({ from: m.from, idx: m.idx, to: m.to, score, label });
    }
    list.sort((a, b) => b.score - a.score);
    if (G.stock.length && !dealBlocked) list.push({ deal: true, score: -1000 });
    return list;
  }

  function clearHint() {
    clearTimeout(hint.timer);
    shownMove = null;
    boardEl.querySelectorAll('.hint-src, .hint-dst').forEach(e => e.classList.remove('hint-src', 'hint-dst'));
  }

  function showHint(quiet = false) {
    if (!G || G.won) return;
    if (G.pro) {
      // background clicks stay silent (thinking clicks); the H key gets one reminder per game
      if (!quiet && !proNagged) { proNagged = true; proBlocked('No hints in Pro mode — you got this! 😎'); }
      return;
    }
    if (hint.version !== G.version) hint = { version: G.version, list: analyze(), idx: 0, timer: 0 };
    else if (hint.list.length) hint.idx = (hint.idx + 1) % hint.list.length;
    clearHint();
    G.hints++;
    scheduleSave();
    bumpIdle();
    if (!hint.list.length) {
      Sound.play('invalid');
      Mascot.say('No moves left… try <b>Undo</b> or start a new game.', 'sad', 4200);
      return;
    }
    const h = hint.list[hint.idx];
    shownMove = h.deal ? null : { h, version: G.version };
    const n = hint.list.length;
    const tag = n > 1 ? ` <span class="hint-count">${hint.idx + 1}/${n}</span>` : '';
    if (h.deal) {
      G.stock.slice(-10).forEach(id => C(id).el.classList.add('hint-src'));
      slotEls.stock.classList.add('hint-dst');
      Mascot.say(`${n > 1 ? 'Out of better ideas — d' : 'D'}eal a new row from the stock.${tag}`, 'think', 3600);
    } else {
      G.tableau[h.from].slice(h.idx).forEach(id => C(id).el.classList.add('hint-src'));
      const t = topOf(h.to);
      (t ? t.el : slotEls.tab[h.to]).classList.add('hint-dst');
      Mascot.say(h.label + tag, 'think', 3800);
    }
    Sound.play('hint');
    clearAuto();
    hint.timer = setTimeout(() => { clearHint(); applyAuto(); }, 3400);
  }

  // Click: send the run to the destination where it makes the tallest ordered stack.
  function autoMove(id) {
    const loc = locate(id);
    if (loc.where !== 'tab' || !G.up[id] || G.won) return;
    const s = loc.pile, i = loc.idx, pile = G.tableau[s];
    if (i < runStart(s)) {
      reject(pile.slice(i), 'Only a same-suit run can move together.');
      return;
    }
    const card = C(id);
    const runLen = pile.length - i;
    let best = null;
    for (let d = 0; d < 10; d++) {
      if (d === s) continue;
      const t = topOf(d);
      if (t ? t.rank !== card.rank + 1 : i === 0) continue;
      const stack = t ? orderedLen(d) + runLen : runLen;
      const sameLen = t && t.suit === card.suit ? G.tableau[d].length - runStart(d) + runLen : 0;
      const key = [sameLen >= 13 ? 1 : 0, t ? 1 : 0, stack, sameLen, G.tableau[d].length];
      if (!best || cmpKey(key, best.key) > 0) best = { d, key };
    }
    if (!best) {
      reject(pile.slice(i), pick(['That card has nowhere to go.', 'No home for that one yet.', 'Nope — no legal spot.']));
      return;
    }
    doMove(s, i, best.d);
  }
  function cmpKey(a, b) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  }

  // ---------- input ----------
  function dropTarget(p, dx) {
    const first = C(p.ids[0]);
    const cx = first.pos.x + dx + M.cw / 2;
    const cands = [];
    for (let d = 0; d < 10; d++) {
      if (d === p.loc.pile) continue;
      const dist = Math.abs(M.cols[d] + M.cw / 2 - cx);
      if (dist < M.cw * 0.95) cands.push({ d, dist });
    }
    cands.sort((a, b) => a.dist - b.dist);
    for (const o of cands) if (canPlace(p.ids[0], o.d)) return o.d;
    return -1;
  }

  function markDrop(d) {
    boardEl.querySelectorAll('.drop-ok').forEach(e => e.classList.remove('drop-ok'));
    if (d < 0) return;
    const t = topOf(d);
    (t ? t.el : slotEls.tab[d]).classList.add('drop-ok');
  }

  boardEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!G || press) return;
    Sound.unlock();
    const cardEl = e.target.closest('.card');
    const id = cardEl ? +cardEl.dataset.id : -1;
    press = { x: e.clientX, y: e.clientY, pid: e.pointerId, id, t: performance.now(), drag: false, canDrag: false, stock: !!e.target.closest('.stock-tray') };
    if (id >= 0) {
      press.loc = locate(id);
      const { loc } = press;
      if (!G.won && loc.where === 'tab' && G.up[id] && loc.idx >= runStart(loc.pile)) {
        press.canDrag = true;
        press.ids = G.tableau[loc.pile].slice(loc.idx);
      }
    }
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
  });

  // Hover lift: raise the card under the mouse plus everything stacked on it (what a click would move).
  let hoverKey = '';
  function setHover(ids) {
    const key = ids.join(',');
    if (key === hoverKey) return;
    hoverKey = key;
    boardEl.querySelectorAll('.card.hover').forEach(e => e.classList.remove('hover'));
    for (const id of ids) C(id).el.classList.add('hover');
  }
  function hoverAt(e) {
    if (e.pointerType !== 'mouse' || press || !G || G.won) return setHover([]);
    const cardEl = e.target.closest('.card');
    if (!cardEl) return setHover([]);
    const id = +cardEl.dataset.id;
    const loc = locate(id);
    if (loc.where !== 'tab' || !G.up[id] || loc.idx < runStart(loc.pile)) return setHover([]);
    setHover(G.tableau[loc.pile].slice(loc.idx));
  }
  boardEl.addEventListener('pointerover', hoverAt);
  boardEl.addEventListener('pointerleave', () => setHover([]));

  boardEl.addEventListener('pointermove', e => {
    const p = press;
    if (!p || p.pid !== e.pointerId || !p.canDrag) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.drag) {
      if (Math.hypot(dx, dy) < 6) return;
      p.drag = true;
      setHover([]);
      clearHint();
      p.ids.forEach((id, i) => {
        const c = C(id);
        c.dragged = true;
        clearTimeout(c.zt);
        c.zt = 0;
        c.el.classList.add('dragging');
        c.el.style.zIndex = 9000 + i;
      });
      Sound.play('pick');
    }
    p.ids.forEach(id => {
      const c = C(id);
      c.el.style.transform = `translate(${c.pos.x + dx}px, ${c.pos.y + dy}px)`;
    });
    const d = dropTarget(p, dx);
    if (d !== p.mark) { p.mark = d; markDrop(d); }
  });

  boardEl.addEventListener('pointerup', e => {
    const p = press;
    if (!p || p.pid !== e.pointerId) return;
    press = null;
    if (p.drag) {
      const dx = e.clientX - p.x;
      const target = dropTarget(p, dx);
      markDrop(-1);
      p.ids.forEach(id => C(id).el.classList.remove('dragging'));
      if (target >= 0) doMove(p.loc.pile, p.loc.idx, target);
      else {
        layout();
        if (Math.hypot(dx, e.clientY - p.y) > M.cw * 0.7) Sound.play('invalid');
      }
      p.ids.forEach(id => { C(id).dragged = false; });
      return;
    }
    // holding or dragging across open space = a bubble sweep (a quick click still hints, pop or not)
    p.sweep = p.id < 0 && (performance.now() - p.t > 450 ||
      Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10);
    onTap(p);
  });

  boardEl.addEventListener('pointercancel', () => {
    const p = press;
    press = null;
    if (p && p.drag) {
      markDrop(-1);
      p.ids.forEach(id => C(id).el.classList.remove('dragging'));
      layout();
      p.ids.forEach(id => { C(id).dragged = false; });
    }
  });

  function onTap(p) {
    if (p.id >= 0) {
      if (p.loc.where === 'stock') return deal();
      if (p.loc.where === 'tab' && G.up[p.id]) {
        // clicking a highlighted hint card plays exactly that move
        const s = shownMove;
        if (s && s.version === G.version && p.loc.pile === s.h.from && p.loc.idx >= s.h.idx) return doMove(s.h.from, s.h.idx, s.h.to);
        return autoMove(p.id);
      }
      return;
    }
    if (p.stock) return deal();
    if (p.sweep) return; // that press was a bubble-popping sweep, not a click
    if (isOpenSpace(p.x, p.y)) showHint(true);
  }

  // True only for clear table area — not gaps between/next to stacks, not the trays.
  function isOpenSpace(clientX, clientY) {
    const r = boardEl.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    if (y >= M.bottomY - M.gap * 2) {
      const fx1 = M.x0 + M.cw + M.foundOff * 7;
      const sx0 = M.stockX - M.stockOff * 4;
      return x > fx1 + M.gap && x < sx0 - M.gap;
    }
    const margin = M.gap * 0.5 + M.cw * 0.15;
    for (let p = 0; p < 10; p++) {
      if (x < M.cols[p] - margin || x > M.cols[p] + M.cw + margin) continue;
      const ys = pileYs(p);
      const bottom = (ys.length ? ys[ys.length - 1] : M.top) + M.ch;
      if (y < bottom + M.ch * 0.25) return false;
    }
    return true;
  }

  // ---------- clock / HUD / persistence ----------
  function elapsedMs() {
    return G.elapsed + (runAt ? performance.now() - runAt : 0);
  }
  function startClock() {
    if (G.won) return;
    G.started = true;
    if (!runAt && !document.hidden) runAt = performance.now();
  }
  function pauseClock() {
    if (runAt) {
      G.elapsed += performance.now() - runAt;
      runAt = 0;
    }
  }

  function best() {
    if (!bestCache || bestCache.suits !== G.suits) bestCache = { suits: G.suits, s: Stats.summary(G.suits) };
    return bestCache.s;
  }

  function updateHUD() {
    $('#hud-score').textContent = G.score;
    $('#hud-moves').textContent = G.moves;
    $('#hud-time').textContent = fmtTime(elapsedMs());
    $('#hud-mode').textContent = `${MODE_NAME[G.suits]}${G.pro ? ' · PRO' : G.noob ? ' · Noob' : ''} · Best`;
    const b = best();
    $('#hud-best').textContent = b.bestTime == null ? '—' : `${fmtTime(b.bestTime)} · ${b.bestScore}`;
    $('#btn-undo').disabled = G.pro || !G.history.length || G.won;
    $('#btn-hint').disabled = !!G.pro && !G.won;
  }

  // Saving serializes the whole undo history; keep it off the move path so animations stay smooth.
  let saveTimer = 0;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (window.requestIdleCallback) requestIdleCallback(save, { timeout: 2000 });
      else save();
    }, 600);
  }

  function save() {
    clearTimeout(saveTimer);
    if (!G) return;
    const o = Object.assign({}, G, { elapsed: elapsedMs(), history: G.history.slice(-1) });
    saveJSON(SAVE_KEY, o);
  }

  function loadSaved() {
    const o = loadJSON(SAVE_KEY, null);
    if (!o || !Array.isArray(o.deck) || o.deck.length !== 104 || o.won) return null;
    return o;
  }

  function recordGame(won) {
    if (G.recorded) return;
    G.recorded = true;
    Stats.record({
      at: new Date().toISOString(),
      suits: G.suits,
      seed: G.seed,
      won,
      score: G.score,
      time: Math.round(elapsedMs()),
      moves: G.moves,
      undos: G.undos,
      hints: G.hints,
      suitsDone: G.found.length,
      noob: !!G.noob,
      pro: !!G.pro,
    });
    bestCache = null;
  }

  // ---------- win ----------
  function finishWin() {
    pauseClock();
    const prev = Stats.summary(G.suits);
    const time = elapsedMs();
    G.won = true;
    G.winInfo = {
      time,
      bestTime: !G.noob && (prev.bestTime == null || time < prev.bestTime),
      bestScore: !G.noob && (prev.bestScore == null || G.score > prev.bestScore),
    };
    recordGame(true);
    clearHint();
    updateHUD();
    save();
  }

  function celebrate() {
    Sound.play('win');
    FX.fountain(3400);
    Mascot.say('<b>YOU WIN!</b> Way too cool. 😎', 'cool', 0);
    G.found.forEach((run, j) => {
      run.forEach((id, i) => {
        const el = C(id).el;
        el.style.setProperty('--cheer-d', `${j * 110 + (12 - i) * 12}ms`);
        el.classList.add('cheer');
        setTimeout(() => el.classList.remove('cheer'), 2600);
      });
    });
    setTimeout(showWinModal, 1700);
  }

  function showWinModal() {
    const s = Stats.summary(G.suits);
    const w = G.winInfo || {};
    const badge = (on, txt) => (on ? `<span class="badge">${txt}</span>` : '');
    openModal({
      title: 'Victory!',
      cls: 'win-modal',
      body: `
        <div class="win-hero">
          <div class="win-trophy">🏆</div>
          <div>
            <div class="win-head">You cleared ${MODE_NAME[G.suits]}!</div>
            <div class="win-badges">${badge(G.pro, '⚡ Pro win — no hints, no undo!')}${badge(w.bestTime, 'New best time!')}${badge(w.bestScore, 'New best score!')}</div>
          </div>
        </div>
        <div class="tiles">
          ${tile('Time', fmtTime(w.time))}
          ${tile('Score', G.score)}
          ${tile('Moves', G.moves)}
          ${tile('Win streak', s.curStreak)}
          ${tile('Won', `${s.won}/${s.played}`)}
          ${tile('Best time', fmtTime(s.bestTime))}
        </div>`,
      actions: [
        { label: 'Change difficulty', onClick: openNewGame, defer: true },
        { label: 'Play again', cls: 'green', onClick: () => newGame(G.suits, undefined, G.pro ? 'pro' : G.noob ? 'noob' : 'normal') },
      ],
    });
  }

  // ---------- modals ----------
  function openModal({ title, body, actions = [], cls = '' }) {
    closeModal(true);
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.innerHTML = `
      <div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="win-title"><span>${title}</span><button class="win-x" aria-label="Close">✕</button></div>
        <div class="win-body">${body}</div>
        <div class="win-actions"></div>
      </div>`;
    const act = ov.querySelector('.win-actions');
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'aero-btn ' + (a.cls || '');
      b.textContent = a.label;
      b.addEventListener('click', () => {
        Sound.play('click');
        if (a.defer) { closeModal(true); setTimeout(() => a.onClick(), 0); return; }
        closeModal();
        if (a.onClick) a.onClick();
      });
      act.appendChild(b);
    }
    if (!actions.length) act.remove();
    ov.addEventListener('pointerdown', e => { if (e.target === ov) closeModal(); });
    ov.querySelector('.win-x').addEventListener('click', () => closeModal());
    $('#modal-root').appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    modal = ov;
    return ov;
  }

  function closeModal(instant) {
    if (!modal) return;
    const m = modal;
    modal = null;
    if (instant) return m.remove();
    m.classList.remove('open');
    setTimeout(() => m.remove(), 240);
  }

  const tile = (lbl, val, sub = '') => `<div class="tile"><div class="tile-val">${val}</div><div class="tile-lbl">${lbl}</div>${sub ? `<div class="tile-sub">${sub}</div>` : ''}</div>`;
  const glyphs = s => MODE_GLYPHS[s].map(i => `<span class="${RED[i] ? 'tx-red' : 'tx-blk'}">${SUIT_CH[i]}</span>`).join('');

  function openNewGame() {
    const inProgress = G && G.started && !G.won && G.moves > 0;
    const cards = [1, 2, 4].map(s => {
      const st = Stats.summary(s);
      return `
        <button class="diff${G && s === G.suits ? ' sel' : ''}" data-suits="${s}">
          <span class="diff-glyphs">${glyphs(s)}</span>
          <span class="diff-name">${MODE_NAME[s]}</span>
          <span class="diff-sub">${MODE_SUB[s]}</span>
          <span class="diff-stat">${st.won}/${st.played} won · best ${fmtTime(st.bestTime)}</span>
        </button>`;
    }).join('');
    let mode = 'normal';
    const modes = Object.entries(GAME_MODES).map(([id, m]) => `
      <button class="mode-opt${id === mode ? ' sel' : ''}" data-mode="${id}" role="radio" aria-checked="${id === mode}">
        <span class="mode-name">${m.name}</span><span class="mode-sub">${m.sub}</span>
      </button>`).join('');
    const ov = openModal({
      title: 'New Game',
      body: `${inProgress ? '<p class="note">⚠️ Your current game will be recorded as a loss.</p>' : ''}
        <div class="mode-pick" role="radiogroup" aria-label="Game mode">${modes}</div>
        <p class="note">Pick a difficulty to start.</p><div class="diff-grid">${cards}</div>`,
      actions: G ? [{ label: 'Restart this deal', onClick: () => newGame(G.suits, G.seed, mode) }, { label: 'Cancel' }] : [],
    });
    ov.querySelectorAll('.mode-opt').forEach(b => b.addEventListener('click', () => {
      Sound.play('click');
      mode = b.dataset.mode;
      ov.querySelectorAll('.mode-opt').forEach(o => {
        o.classList.toggle('sel', o === b);
        o.setAttribute('aria-checked', String(o === b));
      });
    }));
    ov.querySelectorAll('.diff').forEach(b => b.addEventListener('click', () => {
      Sound.play('click');
      newGame(+b.dataset.suits, undefined, mode);
    }));
  }

  function statsBody(suits) {
    const s = Stats.summary(suits);
    const recent = s.games.slice(-40);
    const maxScore = Math.max(600, ...recent.map(g => g.score));
    const bw = 400 / 40;
    const bars = recent.map((g, i) => {
      const h = Math.max(3, (Math.max(0, g.score) / maxScore) * 104);
      const x = i * bw + 1.5;
      return `<rect x="${x}" y="${112 - h}" width="${bw - 3}" height="${h}" rx="2.5" class="${g.won ? 'bar-win' : 'bar-loss'}"><title>${new Date(g.at).toLocaleString()} — ${MODE_NAME[g.suits]} — ${g.won ? 'Won' : 'Lost'} · score ${g.score} · ${fmtTime(g.time)}</title></rect>`;
    }).join('');
    const rows = s.games.slice(-12).reverse().map(g => `
      <tr>
        <td>${new Date(g.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${new Date(g.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${glyphs(g.suits)}${g.noob ? `<span class="noob-tag" title="Noob mode">🐣</span>` : ""}${g.pro ? `<span class="pro-tag" title="Pro: no hints, no undo">PRO</span>` : ""}</td>
        <td><span class="pill ${g.won ? 'pill-win' : 'pill-loss'}">${g.won ? 'Won' : 'Lost'}</span></td>
        <td>${g.score}</td><td>${fmtTime(g.time)}</td><td>${g.moves}</td><td>${g.suitsDone}/8</td>
      </tr>`).join('');
    return `
      <div class="tiles">
        ${tile('Played', s.played)}
        ${tile('Won', s.won, `${Math.round(s.winRate * 100)}% win rate`)}
        ${tile('Best time', fmtTime(s.bestTime))}
        ${tile('Best score', s.bestScore ?? '—')}
        ${tile('Avg win time', fmtTime(s.avgWinTime))}
        ${tile('Streak', s.curStreak, `best ${s.bestStreak}`)}
        ${tile('Time played', fmtTime(s.totalTime))}
        ${tile('Suits cleared', s.suitsDone)}
        ${tile('Hints · Undos', `${s.hints} · ${s.undos}`)}
      </div>
      <div class="chart-card">
        <div class="chart-head"><span>Score, last ${recent.length === 1 ? 'game' : `${recent.length} games`}</span><span class="legend"><i class="lg-win"></i>won <i class="lg-loss"></i>lost</span></div>
        ${recent.length ? `<svg viewBox="0 0 400 114" class="chart" preserveAspectRatio="none">${bars}</svg>` : '<div class="empty-chart">Finish a game to start your history.</div>'}
      </div>
      ${rows ? `<div class="table-wrap"><table class="hist"><thead><tr><th>When</th><th>Mode</th><th>Result</th><th>Score</th><th>Time</th><th>Moves</th><th>Suits</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}`;
  }

  function openStats(suits = G ? G.suits : 0) {
    const tabs = [0, 1, 2, 4].map(s => `<button class="tab${s === suits ? ' sel' : ''}" data-s="${s}">${s ? MODE_NAME[s] : 'All'}</button>`).join('');
    const ov = openModal({
      title: 'Statistics',
      cls: 'stats-modal',
      body: `<div class="tabs">${tabs}</div><div class="stats-content">${statsBody(suits)}</div>`,
      actions: [
        { label: 'Reset stats', cls: 'red', onClick: confirmReset, defer: true },
        { label: 'Close' },
      ],
    });
    ov.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
      Sound.play('click');
      ov.querySelectorAll('.tab').forEach(t => t.classList.toggle('sel', t === b));
      ov.querySelector('.stats-content').innerHTML = statsBody(+b.dataset.s);
    }));
  }

  function confirmReset() {
    openModal({
      title: 'Reset statistics?',
      body: '<p class="note">This permanently erases your game history and best scores from this browser.</p>',
      actions: [
        { label: 'Cancel', onClick: openStats, defer: true },
        { label: 'Erase everything', cls: 'red', onClick: () => { Stats.clear(); bestCache = null; updateHUD(); openStats(); }, defer: true },
      ],
    });
  }

  // ---------- idle tips ----------
  const TIPS = [
    'Tip: click a card — I’ll throw it on the biggest stack.',
    'Tip: click empty table space for a hint. Click again for the next one.',
    'Tip: same-suit runs move together. Mixed ones don’t.',
    'Tip: an empty column takes any card. Don’t waste it!',
    'Tip: <b>H</b> hint · <b>D</b> deal · <b>Ctrl+Z</b> undo · <b>N</b> new game.',
    'Tip: reveal face-down cards early — they’re the real enemy.',
  ];
  let tipIdx = Math.floor(Math.random() * TIPS.length);
  function bumpIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!modal && G && !G.won) Mascot.say(TIPS[tipIdx++ % TIPS.length], 'idle', 5000);
      bumpIdle();
    }, 45000);
  }

  // ---------- wiring ----------
  function toggleSound() {
    const on = Sound.toggle();
    const b = $('#btn-sound');
    b.classList.toggle('muted', !on);
    b.setAttribute('aria-pressed', String(on));
  }

  $('#btn-new').addEventListener('click', () => { Sound.play('click'); openNewGame(); });
  $('#btn-undo').addEventListener('click', () => undo());
  $('#btn-hint').addEventListener('click', () => showHint());
  $('#btn-stats').addEventListener('click', () => { Sound.play('click'); openStats(); });
  $('#btn-sound').addEventListener('click', toggleSound);
  $('#btn-sound').classList.toggle('muted', !Sound.enabled);
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') return closeModal();
    if (modal || !G) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'h') showHint();
    else if (k === 'd' || k === ' ') { e.preventDefault(); deal(); }
    else if (k === 'n') openNewGame();
    else if (k === 'u') undo();
    else if (k === 'm') toggleSound();
  });

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { measure(); layout({ instant: true }); });
  });

  document.addEventListener('visibilitychange', () => {
    if (!G) return;
    if (document.hidden) { pauseClock(); save(); }
    else if (G.started && !G.won) startClock();
  });
  window.addEventListener('pagehide', save);

  setInterval(() => { if (G) $('#hud-time').textContent = fmtTime(elapsedMs()); }, 500);

  // ---------- boot ----------
  buildSlots();
  setWebPattern();
  setFrostTexture();
  const saved = loadSaved();
  if (saved) {
    G = saved;
    G.history = (G.history || []).slice(-1);
    G.recorded = false;
    buildCards();
    seenPositions.add(posSig(G.tableau, G.up));
    measure();
    layout({ instant: true });
    if (G.started) startClock();
    updateHUD();
    bumpIdle();
    checkStuck();
    Mascot.say('Welcome back! Your game is right where you left it.', 'happy', 4000);
  } else {
    newGame(prefs.suits || 1);
  }
})();
