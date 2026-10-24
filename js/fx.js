// Ambient rising bubbles (background) + particle bursts (foreground overlay).
const FX = (() => {
  'use strict';
  const bg = document.getElementById('bubbles');
  const fg = document.getElementById('fx');
  const bctx = bg.getContext('2d');
  const fctx = fg.getContext('2d');
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1;
  const bubbles = [];
  const parts = [];
  const rand = (a, b = 0) => b + Math.random() * (a - b);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    // soft background bubbles don't need retina pixels; the sparkle overlay does
    const scales = [[bg, bctx, 1], [fg, fctx, dpr]];
    for (const [c, ctx, s] of scales) {
      c.width = W * s;
      c.height = H * s;
      c.style.width = W + 'px';
      c.style.height = H + 'px';
      ctx.setTransform(s, 0, 0, s, 0, 0);
    }
  }

  function makeBubble(initial) {
    const r = 4 + Math.pow(Math.random(), 2.2) * 34;
    return {
      x: rand(W),
      y: initial ? rand(H) : H + r + rand(80),
      r,
      vy: 0.12 + Math.random() * 0.4 + r * 0.004,
      ph: rand(Math.PI * 2),
      amp: 0.2 + rand(0.7),
      a: 0.5 + rand(0.5),
    };
  }

  // Bubbles and sparks are pre-rendered once into sprites; per-frame drawing is just drawImage.
  function sprite(size, paint) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d'), size / 2);
    return c;
  }

  const BUBBLE = sprite(128, (ctx, c) => {
    const r = c - 2;
    const g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.05, c, c, r);
    g.addColorStop(0, 'rgba(255,255,255,.42)');
    g.addColorStop(0.45, 'rgba(200,240,255,.07)');
    g.addColorStop(0.85, 'rgba(160,230,255,.16)');
    g.addColorStop(1, 'rgba(255,255,255,.62)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();
    // specular highlight
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.ellipse(c - r * 0.38, c - r * 0.42, r * 0.26, r * 0.14, -0.7, 0, Math.PI * 2);
    ctx.fill();
    // rim tint bottom-right (rainbow-ish film)
    ctx.strokeStyle = 'rgba(120,255,220,.25)';
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.arc(c, c, r * 0.9, 0.1, 1.4);
    ctx.stroke();
  });

  function drawBubble(ctx, x, y, r, a) {
    ctx.globalAlpha = a;
    ctx.drawImage(BUBBLE, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  const SPARK_S = 12;
  const sparkSprites = new Map();
  function sparkSprite(color) {
    let s = sparkSprites.get(color);
    if (!s) {
      s = sprite(SPARK_S * 6, (ctx, c) => {
        const g = ctx.createRadialGradient(c, c, 0, c, c, SPARK_S * 2.2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, color);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c, c, SPARK_S * 2.2, 0, Math.PI * 2);
        ctx.fill();
        const k = SPARK_S * 2.6;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(c, c - k);
        ctx.quadraticCurveTo(c, c, c + k, c);
        ctx.quadraticCurveTo(c, c, c, c + k);
        ctx.quadraticCurveTo(c, c, c - k, c);
        ctx.quadraticCurveTo(c, c, c, c - k);
        ctx.fill();
      });
      sparkSprites.set(color, s);
    }
    return s;
  }

  function drawSpark(ctx, x, y, s, a, color) {
    const w = (SPARK_S * 6 * s) / SPARK_S;
    ctx.globalAlpha = a;
    ctx.drawImage(sparkSprite(color), x - w / 2, y - w / 2, w, w);
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  let lastBg = 0;
  let fgDirty = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(50, now - last) / 16.67;
    last = now;

    // background bubbles: slow and soft, 20fps is plenty and keeps the GPU mostly idle
    if (now - lastBg >= 50) {
      const bdt = Math.min(100, now - (lastBg || now - 16.67)) / 16.67;
      lastBg = now;
      bctx.clearRect(0, 0, W, H);
      for (const b of bubbles) {
        b.y -= b.vy * bdt;
        b.ph += 0.012 * bdt;
        const x = b.x + Math.sin(b.ph) * b.amp * 12;
        if (b.y < -b.r - 10) Object.assign(b, makeBubble(false));
        drawBubble(bctx, x, b.y, b.r, b.a);
      }
      if (sweep.on && sweep.ok) sweepPop(); // holding still: catch bubbles floating into the pointer
    }

    // foreground particles: skip entirely when nothing is alive
    if (!parts.length) {
      if (fgDirty) { fctx.clearRect(0, 0, W, H); fgDirty = false; }
      return;
    }
    fgDirty = true;
    fctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'spark') {
        drawSpark(fctx, p.x, p.y, p.s * (1 - k * 0.6), 1 - k, p.color);
      } else if (p.type === 'bubble') {
        p.ph += 0.08 * dt;
        drawBubble(fctx, p.x + Math.sin(p.ph) * 3, p.y, p.s * (0.7 + k * 0.5), Math.min(1, (1 - k) * 1.6));
      } else if (p.type === 'ring') {
        fctx.save();
        fctx.globalAlpha = (1 - k) * 0.9;
        fctx.strokeStyle = p.color;
        fctx.lineWidth = 3 * (1 - k) + 1;
        fctx.shadowColor = p.color;
        fctx.shadowBlur = 12;
        fctx.beginPath();
        fctx.arc(p.x, p.y, p.s + k * p.grow, 0, Math.PI * 2);
        fctx.stroke();
        fctx.restore();
      }
    }
  }

  const COLORS = ['rgba(120,240,255,.9)', 'rgba(140,255,170,.9)', 'rgba(255,255,255,.9)', 'rgba(255,230,120,.9)'];

  function burst(x, y, { count = 18, speed = 5, colors = COLORS, bubbles: nb = 6, spread = Math.PI * 2, dir = -Math.PI / 2, g = 0.08 } = {}) {
    if (reduced) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.8);
      parts.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g, drag: 0.95, life: 0, max: 40 + rand(30), s: 1.5 + rand(2.5), color: colors[i % colors.length] });
    }
    for (let i = 0; i < nb; i++) {
      parts.push({ type: 'bubble', x: x + rand(20, -20), y: y + rand(10, -10), vx: rand(1, -1), vy: -0.6 - rand(1.6), g: -0.01, drag: 0.99, life: 0, max: 70 + rand(50), s: 4 + rand(10), ph: rand(6) });
    }
  }

  function ring(x, y, color = 'rgba(140,240,255,1)', size = 10, grow = 60) {
    parts.push({ type: 'ring', x, y, vx: 0, vy: 0, g: 0, drag: 1, life: 0, max: 36, s: size, grow, color });
  }

  function fountain(ms = 2500) {
    const start = performance.now();
    const tick = () => {
      const t = performance.now() - start;
      if (t > ms) return;
      for (let i = 0; i < 3; i++) {
        const x = rand(W * 0.9, W * 0.1);
        parts.push({ type: 'bubble', x, y: H + 20, vx: rand(1, -1), vy: -2 - rand(4), g: -0.01, drag: 0.995, life: 0, max: 160 + rand(80), s: 6 + rand(22), ph: rand(6) });
      }
      burst(rand(W * 0.85, W * 0.15), rand(H * 0.6, H * 0.1), { count: 10, speed: 4, bubbles: 0, g: 0.05 });
      setTimeout(tick, 90);
    };
    tick();
  }

  // Pop whichever bubble (ambient or particle) sits under the point. Returns true if one popped.
  function popAt(x, y) {
    let hit = null, hitR = 0, list = null;
    for (const b of bubbles) {
      const bx = b.x + Math.sin(b.ph) * b.amp * 12;
      const r = Math.max(b.r, 12);
      if (Math.hypot(x - bx, y - b.y) <= r && b.r > hitR) { hit = b; hitR = b.r; list = bubbles; }
    }
    for (const p of parts) {
      if (p.type !== 'bubble') continue;
      const r = Math.max(p.s, 12);
      if (Math.hypot(x - p.x, y - p.y) <= r && p.s > hitR) { hit = p; hitR = p.s; list = parts; }
    }
    if (!hit) return false;
    const hx = list === bubbles ? hit.x + Math.sin(hit.ph) * hit.amp * 12 : hit.x;
    const hy = hit.y;
    ring(hx, hy, 'rgba(255,255,255,1)', hitR * 0.8, hitR * 0.9 + 10);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const v = 1.5 + Math.random() * 2;
      parts.push({ type: 'spark', x: hx + Math.cos(a) * hitR * 0.8, y: hy + Math.sin(a) * hitR * 0.8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.05, drag: 0.92, life: 0, max: 22 + rand(12), s: 1 + rand(1.2), color: 'rgba(170,240,255,.9)' });
    }
    if (list === bubbles) Object.assign(hit, makeBubble(false));
    else parts.splice(parts.indexOf(hit), 1);
    return hitR;
  }

  resize();
  const count = reduced ? 10 : Math.round(Math.min(22, (W * H) / 60000));
  for (let i = 0; i < count; i++) bubbles.push(makeBubble(true));
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);

  // Hold the mouse/touchpad down on open space and sweep (or just hold still) to keep popping.
  // Listeners are passive on the window, so popping never blocks or swallows the click underneath.
  const sweep = { on: false, ok: false, x: 0, y: 0 };
  const clearSpot = el => !!el && !(el.closest && el.closest('.card, button, .modal, .speech'));
  function sweepPop() {
    const r = popAt(sweep.x, sweep.y);
    if (r && typeof Sound !== 'undefined') Sound.play('pop', r);
  }
  window.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    sweep.on = sweep.ok = clearSpot(e.target); // presses that start on a card are drags, not sweeps
    sweep.x = e.clientX;
    sweep.y = e.clientY;
    if (sweep.on) sweepPop();
  }, { capture: true, passive: true });
  window.addEventListener('pointermove', e => {
    if (!sweep.on) return;
    const x0 = sweep.x, y0 = sweep.y;
    sweep.ok = clearSpot(document.elementFromPoint(e.clientX, e.clientY));
    // walk the segment so a fast swipe doesn't skip bubbles between pointer samples
    const steps = sweep.ok ? Math.min(12, Math.ceil(Math.hypot(e.clientX - x0, e.clientY - y0) / 10)) : 0;
    for (let i = 1; i <= steps; i++) {
      sweep.x = x0 + ((e.clientX - x0) * i) / steps;
      sweep.y = y0 + ((e.clientY - y0) * i) / steps;
      sweepPop();
    }
    sweep.x = e.clientX;
    sweep.y = e.clientY;
  }, { capture: true, passive: true });
  const stopSweep = () => { sweep.on = false; };
  window.addEventListener('pointerup', stopSweep, { capture: true, passive: true });
  window.addEventListener('pointercancel', stopSweep, { capture: true, passive: true });
  window.addEventListener('blur', stopSweep);

  return { burst, ring, fountain, popAt };
})();
