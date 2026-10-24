// Synthesized "glass & bubbles" sound effects via Web Audio — no audio files needed.
const Sound = (() => {
  'use strict';
  const PREF = 'spiderAero.sound.v1';
  let ctx = null, master, reverb, wet;
  let enabled = true;
  try { enabled = localStorage.getItem(PREF) !== '0'; } catch (e) {}

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(2.4, 3);
    wet = ctx.createGain();
    wet.gain.value = 0.4;
    reverb.connect(wet);
    wet.connect(master);
    return true;
  }

  function impulse(sec, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * sec);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function tone({ type = 'sine', f = 880, f2 = 0, t = 0, dur = 0.2, vol = 0.2, attack = 0.004, rev = 0.4, pan = 0 }) {
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let out = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    o.connect(g);
    out.connect(master);
    if (rev) {
      const s = ctx.createGain();
      s.gain.value = rev;
      out.connect(s);
      s.connect(reverb);
    }
    o.start(now);
    o.stop(now + dur + 0.05);
  }

  function noise({ t = 0, dur = 0.12, vol = 0.15, f = 2000, f2 = 0, q = 1.2, type = 'bandpass', rev = 0.2, pan = 0 }) {
    const now = ctx.currentTime + t;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f, now);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(flt);
    flt.connect(g);
    let out = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    out.connect(master);
    if (rev) {
      const s = ctx.createGain();
      s.gain.value = rev;
      out.connect(s);
      s.connect(reverb);
    }
    src.start(now);
  }

  // A glassy bell: fundamental + inharmonic partial gives the "crystal" ring.
  function bell(f, t = 0, vol = 0.12, dur = 0.9, pan = 0) {
    tone({ f, t, vol, dur, rev: 0.8, pan });
    tone({ f: f * 2.76, t, vol: vol * 0.35, dur: dur * 0.5, rev: 0.8, pan });
    tone({ f: f * 5.4, t, vol: vol * 0.12, dur: dur * 0.25, rev: 0.9, pan });
  }

  function bubble(t = 0, base = 320, vol = 0.14, pan = 0) {
    tone({ f: base, f2: base * 3.2, t, dur: 0.12, vol, attack: 0.002, rev: 0.45, pan });
  }

  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

  const fx = {
    pick() {
      tone({ f: 1900, f2: 2700, dur: 0.07, vol: 0.06, rev: 0.25 });
      noise({ dur: 0.05, vol: 0.05, f: 5000, q: 0.8, rev: 0 });
    },
    place(rank = 7, pan = 0) {
      const base = 740 * Math.pow(2, (rank - 7) / 18);
      bell(base, 0, 0.09, 0.55, pan);
      noise({ dur: 0.04, vol: 0.06, f: 3500, q: 0.7, rev: 0.1, pan });
    },
    flip(pan = 0) {
      noise({ dur: 0.07, vol: 0.07, f: 1800, f2: 6000, q: 0.9, rev: 0.15, pan });
      tone({ f: 1500, f2: 2300, dur: 0.08, vol: 0.035, rev: 0.4, pan });
    },
    deal(i = 0) {
      const pan = (i / 9) * 1.4 - 0.7;
      noise({ t: i * 0.055, dur: 0.09, vol: 0.09, f: 900, f2: 4500, q: 0.8, rev: 0.15, pan });
      tone({ t: i * 0.055 + 0.05, f: 1600 + i * 60, dur: 0.06, vol: 0.03, rev: 0.4, pan });
    },
    shuffle() {
      for (let i = 0; i < 14; i++) noise({ t: i * 0.035, dur: 0.06, vol: 0.06, f: 1200 + Math.random() * 2500, q: 0.9, rev: 0.1, pan: Math.random() - 0.5 });
      bubble(0.5, 400, 0.08);
    },
    hint() {
      bubble(0, 360, 0.13);
      bubble(0.09, 520, 0.1);
      bell(1568, 0.05, 0.04, 0.6);
    },
    click() {
      bubble(0, 420, 0.09);
    },
    invalid() {
      tone({ type: 'triangle', f: 240, f2: 150, dur: 0.18, vol: 0.12, rev: 0.1 });
      tone({ type: 'sine', f: 180, f2: 110, t: 0.07, dur: 0.18, vol: 0.1, rev: 0.1 });
    },
    undo() {
      tone({ f: 1400, f2: 520, dur: 0.2, vol: 0.08, rev: 0.4 });
      noise({ dur: 0.14, vol: 0.05, f: 5000, f2: 900, q: 0.7, rev: 0.2 });
    },
    complete() {
      const notes = [0, 2, 4, 5, 7, 9, 10];
      notes.forEach((n, i) => bell(PENTA[n], i * 0.07, 0.09, 1.1, (i / 6) - 0.5));
      for (let i = 0; i < 8; i++) bubble(0.2 + Math.random() * 0.6, 250 + Math.random() * 400, 0.07, Math.random() * 1.6 - 0.8);
    },
    win() {
      const seq = [0, 2, 4, 7, 5, 7, 9, 10];
      seq.forEach((n, i) => bell(PENTA[n], i * 0.12, 0.11, 1.4, Math.sin(i) * 0.6));
      [523.25, 659.25, 783.99, 1046.5].forEach(f => tone({ f, t: 1.0, dur: 2.4, vol: 0.05, attack: 0.3, rev: 1 }));
      for (let i = 0; i < 26; i++) bubble(0.3 + Math.random() * 2.4, 220 + Math.random() * 500, 0.06, Math.random() * 1.8 - 0.9);
    },
    pop(r = 15) {
      const f = 1400 - Math.min(r, 40) * 22;
      tone({ f, f2: f * 2.6, dur: 0.07, vol: 0.16, attack: 0.001, rev: 0.35 });
      noise({ dur: 0.035, vol: 0.09, f: 6000, q: 0.6, rev: 0.1 });
    },
    reveal() {
      bell(2093, 0, 0.035, 0.5);
    },
  };

  function play(name, ...args) {
    if (!enabled) return;
    if (!init()) return;
    try { fx[name](...args); } catch (e) { /* audio is best-effort */ }
  }

  return {
    play,
    unlock() { if (enabled) init(); },
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(PREF, enabled ? '1' : '0'); } catch (e) {}
      if (enabled) { init(); fx.click(); }
      return enabled;
    },
  };
})();
