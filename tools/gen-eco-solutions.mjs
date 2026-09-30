// Regenera src/eco/solutions.js corriendo el bot sobre cada nivel.
//   node tools/gen-eco-solutions.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/eco/levels.js';
import { packRuns } from '../src/eco/codec.js';
const out = {};
for (const l of LEVELS) {
  const txt = execFileSync('node', ['tools/eco-bot.mjs', String(l.id)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const line = txt.split('\n').find(s => s.startsWith('SOL '));
  if (!line) throw new Error('sin solucion para el nivel ' + l.id);
  out[l.id] = packRuns(JSON.parse(line.slice(4)));
  console.log('nivel', l.id, 'ok,', JSON.parse(line.slice(4)).length - 1, 'ecos');
}
writeFileSync('src/eco/solutions.js', '// Soluciones de referencia (una por nivel), generadas con tools/gen-eco-solutions.mjs.\n// Cada una es la lista de ciclos empaquetada con codec.js; el ultimo ciclo es el que llega a la salida.\nexport const SOLUTIONS = ' + JSON.stringify(out) + ';\n');
