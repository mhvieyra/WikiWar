// Verifica que cada nivel de Ecos tenga su solucion de referencia valida y que el par declarado se cumpla.
//   node tools/test-eco.mjs
import { LEVELS } from '../src/eco/levels.js';
import { SOLUTIONS } from '../src/eco/solutions.js';
import { unpackRuns, packRuns, encodeShare, decodeShare } from '../src/eco/codec.js';
import { verify } from '../src/eco/sim.js';
let bad = 0;
for (const def of LEVELS) {
  const runs = unpackRuns(SOLUTIONS[def.id]);
  const v = verify(def, runs);
  const share = decodeShare(encodeShare(def.id, runs)), v2 = verify(def, share.runs);
  const ok = v.ok && v.echoes <= def.par && v2.ok && v2.ticks === v.ticks && JSON.stringify(packRuns(share.runs)) === JSON.stringify(packRuns(runs));
  console.log(ok ? 'OK ' : 'MAL', 'nivel', def.id, def.name.padEnd(16), JSON.stringify(v), 'par', def.par, 'codigo', encodeShare(def.id, runs).length, 'car.');
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
