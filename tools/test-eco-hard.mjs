// Comprueba que un nivel NO se pueda resolver con menos ecos que el par, usando las
// soluciones de referencia con un eco menos como punto de partida (busqueda acotada).
//   node tools/test-eco-hard.mjs [id]
import { LEVELS } from '../src/eco/levels.js';
import { SOLUTIONS } from '../src/eco/solutions.js';
import { unpackRuns } from '../src/eco/codec.js';
import { solveRun } from './eco-bot.mjs';
import { T } from '../src/eco/consts.js';
const only = process.argv[2] ? +process.argv[2] : null;
for (const def of LEVELS) {
  if (only && def.id !== only) continue;
  const runs = unpackRuns(SOLUTIONS[def.id]), echoes = runs.slice(0, -1);
  let ex; for (let y = 0; y < def.rows.length; y++) { const x = def.rows[y].indexOf('X'); if (x >= 0) ex = [x, y]; }
  for (let drop = 0; drop < echoes.length; drop++) {
    const sub = echoes.filter((_, i) => i !== drop);
    const r = solveRun(def, sub, { target: ex, goal: w => w.won, budgetMs: 25000 });
    console.log(`nivel ${def.id} sin el eco ${drop + 1}:`, r.ok ? 'RESUELTO (el nivel es mas facil de lo previsto)' : 'sin solucion (' + r.nodes + ' nodos)');
  }
}
