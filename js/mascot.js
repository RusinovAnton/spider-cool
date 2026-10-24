// Webby — a glossy spider living inside an Aero-era user account tile.
const Mascot = (() => {
  'use strict';
  const tile = document.getElementById('mascot');
  const bubble = document.getElementById('speech');
  const text = bubble.querySelector('.speech-text');

  // mirrored legs: [x1,y1, cx,cy, x2,y2] for the left side
  const LEGS = [
    [39, 50, 25, 30, 13, 37],
    [37, 55, 20, 43, 8, 53],
    [37, 61, 20, 60, 9, 72],
    [39, 66, 27, 76, 18, 89],
  ];
  const leg = ([x1, y1, cx, cy, x2, y2], side, i) => {
    const m = v => (side < 0 ? v : 100 - v);
    return `<path class="leg leg${i}" style="transform-origin:${m(x1)}px ${y1}px" d="M${m(x1)} ${y1} Q${m(cx)} ${cy} ${m(x2)} ${y2}"/>`;
  };

  tile.innerHTML = `
<svg viewBox="0 0 100 100" class="mascot-svg" data-mood="idle" aria-hidden="true">
  <defs>
    <linearGradient id="mFrame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#d6f1ff"/>
      <stop offset=".5" stop-color="#a9dcf7"/><stop offset="1" stop-color="#e8f8ff"/>
    </linearGradient>
    <linearGradient id="mSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f7fd8"/><stop offset=".55" stop-color="#6fd0ff"/><stop offset="1" stop-color="#e2f8ff"/>
    </linearGradient>
    <radialGradient id="mSun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".3" stop-color="#fffbe0" stop-opacity=".8"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="mGrass" cx=".5" cy="0" r="1">
      <stop offset="0" stop-color="#c9f66a"/><stop offset=".45" stop-color="#62c42c"/><stop offset="1" stop-color="#226f12"/>
    </radialGradient>
    <radialGradient id="mBody" cx=".36" cy=".3" r=".85">
      <stop offset="0" stop-color="#7fb5ff"/><stop offset=".3" stop-color="#2d5bb0"/>
      <stop offset=".75" stop-color="#0d1f4a"/><stop offset="1" stop-color="#050d24"/>
    </radialGradient>
    <linearGradient id="mShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8ff8ff"/><stop offset=".45" stop-color="#18a8e8"/><stop offset="1" stop-color="#062f78"/>
    </linearGradient>
    <linearGradient id="mGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/>
    </linearGradient>
    <linearGradient id="mMark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b6ffef"/><stop offset="1" stop-color="#18c7d8"/>
    </linearGradient>
    <clipPath id="mClip"><rect x="7" y="7" width="86" height="86" rx="13"/></clipPath>
  </defs>

  <rect x="1.5" y="1.5" width="97" height="97" rx="18" fill="url(#mFrame)" stroke="#4d9fd0" stroke-width="1.2"/>
  <g clip-path="url(#mClip)">
    <rect x="7" y="7" width="86" height="86" fill="url(#mSky)"/>
    <circle cx="80" cy="18" r="22" fill="url(#mSun)"/>
    <path d="M0 52 Q 40 30 100 46 L100 54 Q 50 40 0 62Z" fill="#fff" opacity=".28"/>
    <ellipse cx="50" cy="106" rx="72" ry="27" fill="url(#mGrass)"/>
    <path d="M-5 84 Q 50 70 105 84" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>
    <circle cx="17" cy="24" r="4" fill="#fff" fill-opacity=".25" stroke="#fff" stroke-opacity=".7" stroke-width=".6"/>
    <circle cx="25" cy="15" r="2.2" fill="#fff" fill-opacity=".25" stroke="#fff" stroke-opacity=".7" stroke-width=".5"/>
    <circle cx="86" cy="62" r="3" fill="#fff" fill-opacity=".25" stroke="#fff" stroke-opacity=".7" stroke-width=".5"/>
    <line class="thread" x1="50" y1="0" x2="50" y2="33" stroke="#fff" stroke-opacity=".8" stroke-width=".7"/>

    <g class="spider">
      <g class="legs" stroke="#0a1838" stroke-width="3.3" stroke-linecap="round" fill="none">
        ${LEGS.map((l, i) => leg(l, -1, i)).join('')}
        ${LEGS.map((l, i) => leg(l, 1, i)).join('')}
      </g>
      <g class="legs-shine" stroke="#7fb5ff" stroke-opacity=".55" stroke-width=".9" stroke-linecap="round" fill="none">
        ${LEGS.map((l, i) => leg(l, -1, i)).join('')}
        ${LEGS.map((l, i) => leg(l, 1, i)).join('')}
      </g>
      <ellipse cx="50" cy="70" rx="19" ry="16" fill="url(#mBody)"/>
      <path d="M50 62 L55 70 L50 78 L45 70 Z" fill="url(#mMark)" opacity=".9"/>
      <ellipse cx="43" cy="63" rx="8" ry="3.6" fill="#fff" opacity=".45" transform="rotate(-24 43 63)"/>
      <circle cx="50" cy="47" r="16" fill="url(#mBody)"/>
      <ellipse cx="44" cy="37" rx="7" ry="3.4" fill="#fff" opacity=".5" transform="rotate(-20 44 37)"/>

      <g class="eyes">
        <g class="eye" style="transform-origin:43.5px 46px">
          <ellipse cx="43.5" cy="46" rx="5.6" ry="6.4" fill="#fff"/>
          <g class="pupil"><circle cx="43.5" cy="46.8" r="3.1" fill="#061433"/><circle cx="42.3" cy="45.4" r="1.15" fill="#fff"/></g>
        </g>
        <g class="eye" style="transform-origin:56.5px 46px">
          <ellipse cx="56.5" cy="46" rx="5.6" ry="6.4" fill="#fff"/>
          <g class="pupil"><circle cx="56.5" cy="46.8" r="3.1" fill="#061433"/><circle cx="55.3" cy="45.4" r="1.15" fill="#fff"/></g>
        </g>
      </g>
      <ellipse cx="38.5" cy="54" rx="2.6" ry="1.5" fill="#ff7fb0" opacity=".55"/>
      <ellipse cx="61.5" cy="54" rx="2.6" ry="1.5" fill="#ff7fb0" opacity=".55"/>

      <path class="mouth m-smile" d="M45.5 55.2 Q50 59 54.5 55.2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path class="mouth m-grin" d="M44.5 54.4 Q50 62.5 55.5 54.4 Z" fill="#fff"/>
      <ellipse class="mouth m-oh" cx="50" cy="56.6" rx="2.1" ry="2.7" fill="#fff"/>
      <path class="mouth m-sad" d="M45.8 58.4 Q50 54.8 54.2 58.4" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path class="fangs" d="M47.6 59.4 l.9 2.2 l.9 -2.2 M50.6 59.4 l.9 2.2 l.9 -2.2" fill="#fff" stroke="#fff" stroke-width=".4"/>

      <g class="shades">
        <path d="M34.8 43.5 L36.6 42.6 M65.2 43.5 L63.4 42.6" stroke="#061a3f" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M36.2 41.6 h13 q.6 0 .5 .8 l-.9 5.4 q-.7 3.6 -4.6 3.6 h-2.4 q-4.4 0 -5.3 -4 l-.9 -5 q-.1 -.8 .6 -.8z" fill="url(#mShade)" stroke="#061a3f" stroke-width="1"/>
        <path d="M63.8 41.6 h-13 q-.6 0 -.5 .8 l.9 5.4 q.7 3.6 4.6 3.6 h2.4 q4.4 0 5.3 -4 l.9 -5 q.1 -.8 -.6 -.8z" fill="url(#mShade)" stroke="#061a3f" stroke-width="1"/>
        <path d="M49.4 43 Q50 42.2 50.6 43" stroke="#061a3f" stroke-width="1.3" fill="none"/>
        <path d="M38.5 43.2 l3 0 l-2.6 4.2z M52.8 43.2 l3 0 l-2.6 4.2z" fill="#fff" opacity=".75"/>
      </g>
    </g>
  </g>
  <path d="M7 20 Q7 7 20 7 H80 Q93 7 93 20 V38 Q50 50 7 38 Z" fill="url(#mGloss)" opacity=".5" pointer-events="none"/>
  <rect x="7" y="7" width="86" height="86" rx="13" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.2"/>
</svg>`;

  const svg = tile.querySelector('svg');
  const pupils = [...svg.querySelectorAll('.pupil')];
  let moodTimer = 0, sayTimer = 0;
  let mood = 'idle';

  function setMood(m, ms = 0) {
    mood = m;
    svg.dataset.mood = m;
    clearTimeout(moodTimer);
    if (ms) moodTimer = setTimeout(() => setMood('idle'), ms);
    if (m === 'think') lookAt(-1.4, -1.6);
  }

  function say(html, m, ms = 4200) {
    text.innerHTML = html;
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('show', 'pop');
    clearTimeout(sayTimer);
    if (ms) sayTimer = setTimeout(() => bubble.classList.remove('show'), ms);
    if (m) setMood(m, ms);
    tile.classList.remove('bounce');
    void tile.offsetWidth;
    tile.classList.add('bounce');
  }

  function lookAt(dx, dy) {
    for (const p of pupils) p.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
  }

  window.addEventListener('pointermove', e => {
    if (mood === 'think' || mood === 'cool') return;
    const r = tile.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height * 0.46);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 300) * 1.7;
    lookAt((dx / d) * k, (dy / d) * k);
  });

  (function blink() {
    setTimeout(() => {
      svg.classList.add('blink');
      setTimeout(() => svg.classList.remove('blink'), 140);
      blink();
    }, 2500 + Math.random() * 4000);
  })();

  const POKES = [
    'Hey! Eight legs, zero patience for bad moves. 🕷️',
    'Psst — click empty table space for a hint.',
    'Click a card and I’ll fling it onto the biggest stack.',
    'Same-suit K→A runs fly home for +100!',
    'Empty columns are pure gold. Spend them wisely.',
    'Ctrl+Z takes back your last move. Just one, so choose wisely.',
    'I spun this web myself. Took ages.',
  ];
  let pokeIdx = 0;
  tile.addEventListener('click', () => {
    Sound.play('click');
    say(POKES[pokeIdx++ % POKES.length], 'happy', 3500);
  });

  return { say, mood: setMood, get current() { return mood; } };
})();
