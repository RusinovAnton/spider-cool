// Game history + aggregate stats, persisted in localStorage.
const Stats = (() => {
  'use strict';
  const KEY = 'spiderAero.games.v1';
  const MAX = 2000;

  function all() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function record(game) {
    const a = all();
    a.push(game);
    while (a.length > MAX) a.shift();
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  // suits: 1 | 2 | 4 | 0 (all)
  function summary(suits = 0) {
    const games = all().filter(g => !suits || g.suits === suits);
    const wins = games.filter(g => g.won);
    // noob-mode wins (best move always highlighted) count as wins, not as records
    const ranked = wins.filter(g => !g.noob);
    let cur = 0, best = 0, run = 0;
    for (const g of games) {
      run = g.won ? run + 1 : 0;
      if (run > best) best = run;
    }
    for (let i = games.length - 1; i >= 0 && games[i].won; i--) cur++;
    const sum = (arr, f) => arr.reduce((s, g) => s + (f(g) || 0), 0);
    return {
      games,
      played: games.length,
      won: wins.length,
      winRate: games.length ? wins.length / games.length : 0,
      bestTime: ranked.length ? Math.min(...ranked.map(g => g.time)) : null,
      bestScore: ranked.length ? Math.max(...ranked.map(g => g.score)) : null,
      leastMoves: ranked.length ? Math.min(...ranked.map(g => g.moves)) : null,
      avgWinTime: wins.length ? sum(wins, g => g.time) / wins.length : null,
      avgMoves: wins.length ? sum(wins, g => g.moves) / wins.length : null,
      totalTime: sum(games, g => g.time),
      hints: sum(games, g => g.hints),
      undos: sum(games, g => g.undos),
      suitsDone: sum(games, g => g.suitsDone),
      curStreak: cur,
      bestStreak: best,
    };
  }

  return { all, record, clear, summary };
})();
