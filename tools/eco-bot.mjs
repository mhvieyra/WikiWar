import { LEVELS } from '../src/eco/levels.js';
import { createWorld, stepTick, cloneWorld, verify, L, R, J, D, S, E, mk } from '../src/eco/sim.js';
import { T } from '../src/eco/consts.js';

const A = [];
const add = (n, masks) => A.push({ n, masks });
const rep = (m, k) => Array(k).fill(m);
for (const k of [10, 30, 60]) add('wait' + k, rep(0, k));
for (const [nm, d] of [['L', L], ['R', R]]) {
  add('run' + nm + '8', rep(d, 8)); add('run' + nm + '24', rep(d, 24));
  add('crouch' + nm, rep(d | D, 16));
  for (const h of [6, 14, 26]) add(`jump${nm}${h}`, [...rep(d | J, h), ...rep(d, 14)]);
  add('jumpAir' + nm, [...rep(d | J, 4), ...rep(d, 20)]);
}
add('jump0', [...rep(J, 14), ...rep(0, 20)]);
add('use', [E, 0, 0, 0, 0, 0]);
add('down', [D, 0, 0]);

function run(w, act, maxTick) {
  for (const m of act.masks) { stepTick(w, m); if (w.won || w.liveDead || w.tick >= maxTick) break; }
}
const key = w => { const a = w.live; return [Math.round(a.x / 8), Math.round(a.y / 8), a.onGround ? 1 : 0, Math.floor(a.fuel / 25), w.tick >> 4, w.levers.map(l => +l.on).join(''), w.crates.map(c => Math.round(c.x / 12) + ':' + Math.round(c.y / 12)).join(',')].join('|'); };

// el eco sigue quieto despues de terminar su grabacion: comprobar que la condicion se mantiene
function stable(c, goal) { const d = cloneWorld(c); for (let i = 0; i < 60; i++) stepTick(d, 0); return !d.live.dead && goal(d); }

// Busca una grabacion (array de entradas) para el ciclo con `echoes`; termina cuando goal(w) es cierto.
export function solveRun(def, echoes, { target, goal, minTick = 0, budgetMs = 60000, verbose = false, hold = 0, hfn = null }) {
  const root = createWorld(def, echoes), maxTick = root.limit;
  const gx = target[0] * T + T / 2, gy = (target[1] + 1) * T;
  const h = hfn || (w => Math.abs(w.live.x - gx) + Math.abs(w.live.y - gy) * 1.4);
  const seen = new Set([key(root)]);
  const heap = []; const push = n => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { let m = i; const a = 2 * i + 1, b = a + 1; if (a < heap.length && heap[a].f < heap[m].f) m = a; if (b < heap.length && heap[b].f < heap[m].f) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  push({ w: root, f: h(root), log: [] });
  const t0 = Date.now(); let nodes = 0, best = 1e9;
  while (heap.length && Date.now() - t0 < budgetMs) {
    const n = pop(); nodes++;
    for (const act of A) {
      const c = cloneWorld(n.w); const before = c.tick;
      run(c, act, maxTick);
      const log = n.log.concat(c.liveLog.slice(n.log.length));
      if (c.liveDead) continue;
      if (goal(c) && c.tick >= minTick && (!hold || stable(c, goal))) return { ok: true, log: log.slice(0, c.tick), nodes, secs: (Date.now() - t0) / 1000 };
      if (c.tick >= maxTick) continue;
      const k = key(c); if (seen.has(k)) continue; seen.add(k);
      const hv = h(c); if (hv < best) best = hv;
      push({ w: c, f: c.tick * 0.05 + hv, log });
    }
    if (verbose && nodes % 300 === 0) console.log('  nodos', nodes, 'mejor', best.toFixed(0), 'abiertos', heap.length);
  }
  return { ok: false, nodes, best, secs: (Date.now() - t0) / 1000 };
}

// recetas: cada ciclo tiene un objetivo (posicion y condicion); el ultimo es ganar
const at = (w, tx, ty, r = 20) => Math.abs(w.live.x - (tx * T + T / 2)) < r && Math.abs(w.live.y - (ty + 1) * T) < 4 && w.live.onGround;
const RECIPES = {
  1: [{ name: 'eco: sostener boton', target: [5, 9], goal: w => at(w, 5, 9, 12) && w.plates[0].down, hold: 3 }, { name: 'cruzar', final: true }],
  2: [{ name: 'eco: boton A', target: [6, 9], goal: w => at(w, 6, 9, 12) && w.plates[0].down, hold: 3 }, { name: 'eco: boton B', target: [9, 9], goal: w => at(w, 9, 9, 12) && w.plates[1].down, hold: 3 }, { name: 'cruzar', final: true }],
  3: [{ name: 'eco: escalon contra la pared', target: [13, 11], goal: w => w.live.onGround && w.live.x > 14 * 32 - 14 && w.live.y > 11 * 32, hold: 3 },
      { name: 'eco: subir al boton', target: [15, 8], goal: w => at(w, 15, 8, 12) && w.plates[0].down, hold: 3 }, { name: 'cruzar', final: true }],
  4: [{ name: 'eco: pulsar tarde', target: [5, 9], goal: w => w.pads[0].hot > 0 && w.tick >= 110, minTick: 110, hold: 0 }, { name: 'cruzar', final: true }],
  5: [{ name: 'eco: boton 1', target: [8, 11], goal: w => at(w, 8, 11, 12) && w.plates[0].down, hold: 3 }, { name: 'eco: boton 2', target: [17, 11], goal: w => at(w, 17, 11, 12) && w.plates[1].down, hold: 3 }, { name: 'cruzar', final: true }],
  6: [{ name: 'eco: caja y arriba (guion)', script: [[R, 120], [R | J, 20], [R, 40], [0, 30]], target: [14, 13], hfn: w => Math.abs(w.crates[0].x - 465) * 2 + Math.abs(w.live.x - 465) + (w.live.y > 430 ? 40 : 0), goal: w => w.crates[0].x > 15 * 32 - 20 && w.live.y < 14 * 32 - 25 && w.live.onGround, hold: 3 }, { name: 'subir', final: true }],
  7: [{ name: 'eco: pulsar', target: [5, 9], goal: w => w.pads[0].hot > 0 && w.tick >= 60, minTick: 60, hold: 0 }, { name: 'eco: peso 2', target: [17, 9], goal: w => at(w, 17, 9, 12) && w.plates[0].down, hold: 3 }, { name: 'cruzar', final: true }],
  8: [{ name: 'eco A: escalon y luego contrapeso', make: def => relevoA(def) }, { name: 'eco: palanca', target: [4, 8], goal: w => w.levers[0].on && at(w, 4, 8, 40), hold: 0 }, { name: 'cruzar', final: true }]
};
// Nivel 8: el eco A espera contra la pared (escalon de B), y mas tarde cruza la puerta ya abierta y se queda en el boton 2.
function relevoA(def) {
  const wait = 420;
  for (let n = 40; n < 160; n++) {
    const log = [...Array(70).fill(L), ...Array(wait - 70).fill(0), ...Array(n).fill(R)];
    const w = createWorld(def, [log]);
    w.levers[0].on = true; for (const d of w.doors) d.open = true;     // como si B ya hubiera tirado la palanca
    for (let t = 0; t < 900; t++) { stepTick(w, 0); }
    if (w.plates[0].down && !w.actors[0].dead) return log;
  }
  throw new Error('no encontre la receta de A');
}
export { RECIPES, at };

if (process.argv[1].endsWith('eco-bot.mjs')) {
  const id = +process.argv[2], def = LEVELS.find(l => l.id === id);
  let echoes = [];
  const t0 = Date.now();
  for (const [i, rc] of RECIPES[id].entries()) {
    if (rc.make) { const log = rc.make(def); echoes.push(log); console.log(' eco', i + 1, rc.name, 'construido', log.length, 'ticks'); continue; }
    if (rc.script) { const log = rc.script.flatMap(([m, n]) => Array(n).fill(m)); echoes.push(log); console.log(' eco', i + 1, rc.name, 'guion', log.length, 'ticks'); continue; }
    if (rc.final) {
      const r = solveRun(def, echoes, { target: [def.rows[0].length - 1 && findX(def)[0], findX(def)[1]], goal: w => w.won, budgetMs: 120000 });
      console.log(' ciclo final', r.ok ? `OK ${r.nodes} nodos ${r.secs.toFixed(1)}s (${r.log.length} ticks)` : 'FALLO mejor ' + r.best);
      if (!r.ok) process.exit(1);
      const v = verify(def, [...echoes, r.log]);
      console.log(' verificado:', JSON.stringify(v));
      console.log('SOL', JSON.stringify([...echoes, r.log]));
      break;
    }
    const r = solveRun(def, echoes, { target: rc.target, goal: rc.goal, minTick: rc.minTick || 0, budgetMs: 120000, hold: rc.hold || 0, hfn: rc.hfn });
    console.log(' eco', i + 1, rc.name, r.ok ? `OK ${r.nodes} nodos ${r.secs.toFixed(1)}s (${r.log.length} ticks)` : 'FALLO mejor ' + r.best);
    if (!r.ok) process.exit(1);
    echoes.push(r.log);
  }
  console.log('total', ((Date.now() - t0) / 1000).toFixed(1), 's');
}
function findX(def) { for (let y = 0; y < def.rows.length; y++) { const x = def.rows[y].indexOf('X'); if (x >= 0) return [x, y]; } }
