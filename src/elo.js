// Sistema Elo local (localStorage). Es un juego de un solo jugador, asi que
// cada partida clasificatoria se juega contra "la ruta": un rival de rating
// fijo (ROUTE_RATING). El resultado no es solo ganar/perder: una victoria
// vale entre 0.5 y 1 segun rapidez, saltos y vidas que sobran; una derrota
// (o abandonar la partida) vale 0. El modo sin tiempo no toca el Elo.
import { clamp } from './utils.js';

const KEY = 'wikiwar.elo';
export const START_RATING = 1000;
export const ROUTE_RATING = 1200;
const K_NEW = 40, K_NORMAL = 24, NEW_GAMES = 10;
const PAR_TIME = 600;      // s: a partir de ahi no hay bonus de rapidez
const PAR_JUMPS = 8;       // saltos: a partir de ahi no hay bonus de eficiencia

export const RANKS = [
  [0, 'Bronce'], [900, 'Plata'], [1100, 'Oro'], [1300, 'Platino'], [1500, 'Diamante'], [1700, 'Maestro'], [1900, 'Leyenda']
];
export function rankOf(r) { let n = RANKS[0][1]; for (const [min, name] of RANKS) if (r >= min) n = name; return n; }

function fresh() { return { rating: START_RATING, games: 0, wins: 0, peak: START_RATING }; }

export function loadElo() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Number.isFinite(d.rating)) return { ...fresh(), ...d };
  } catch (e) { /* localStorage bloqueado o roto */ }
  return fresh();
}
function saveElo(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* sin persistencia */ } }

// Puntaje de la partida en [0, 1].
export function scoreOf(won, { time, clicks, lives }) {
  if (!won) return 0;
  const speed = clamp(1 - time / PAR_TIME, 0, 1);
  const jumps = clamp(1 - (clicks - 1) / PAR_JUMPS, 0, 1);
  const life = clamp((lives - 1) / 2, 0, 1);
  return .5 + .5 * (.5 * speed + .3 * jumps + .2 * life);
}

// Registra una partida clasificatoria y devuelve { before, after, delta, rank, promoted }.
export function recordGame(won, stats) {
  const d = loadElo(), before = d.rating;
  const expected = 1 / (1 + Math.pow(10, (ROUTE_RATING - before) / 400));
  const k = d.games < NEW_GAMES ? K_NEW : K_NORMAL;
  const after = Math.max(0, Math.round(before + k * (scoreOf(won, stats) - expected)));
  d.rating = after; d.games++; if (won) d.wins++; d.peak = Math.max(d.peak, after);
  saveElo(d);
  return { before, after, delta: after - before, rank: rankOf(after), promoted: rankOf(after) !== rankOf(before) && after > before };
}
