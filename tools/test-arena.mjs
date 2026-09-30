// Pruebas de la Arena sin navegador:
//   node tools/test-arena.mjs
// - el generador es determinista y simetrico
// - la simulacion es determinista (misma entrada, mismo hash) y las entradas distintas divergen
// - bot contra bot: las partidas terminan, sin ventaja de lado marcada
import { generate, COLS, ROWS } from '../src/arena/gen.js';
import { createMatch, stepTick, stateHash, mkInput, L, R, J, D, FIRE, DIG, BUILD } from '../src/arena/sim.js';
import { makeBot, botInput } from '../src/arena/bot.js';
import { rng } from '../src/shared/dmath.js';

let bad = 0; const ok = (c, msg) => { console.log(c ? 'OK ' : 'MAL', msg); if (!c) bad++; };

// generador
const a = generate(5), b = generate(5), c = generate(6);
ok(a.cells.every((v, i) => v === b.cells[i]), 'misma semilla, mismo mapa');
ok(a.cells.some((v, i) => v !== c.cells[i]), 'otra semilla, otro mapa');
let asym = 0; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (a.cells[y * COLS + x] !== a.cells[y * COLS + COLS - 1 - x]) asym++;
ok(asym === 0, 'el mapa es simetrico');

// determinismo con entradas al azar
function play(seed, inputSeed, ticks) {
  const w = createMatch(seed), r = rng(inputSeed), cur = [0, 0], hs = [];
  for (let t = 0; t < ticks; t++) {
    if (t % 20 === 0) for (let i = 0; i < 2; i++) { let bits = 0; if (r() < .4) bits |= L; if (r() < .4) bits |= R; if (r() < .5) bits |= J; if (r() < .1) bits |= D; if (r() < .5) bits |= FIRE; if (r() < .3) bits |= DIG; if (r() < .1) bits |= BUILD; cur[i] = mkInput(bits, Math.floor(r() * 64), r() < .2 ? 1 + Math.floor(r() * 4) : 0, r() < .05 ? 1 + Math.floor(r() * 3) : 0); }
    stepTick(w, cur); w.ev.length = 0; w.dirty.length = 0;
    if (t % 30 === 0) hs.push(stateHash(w));
  }
  return hs.join();
}
ok(play(3, 11, 4000) === play(3, 11, 4000), 'la simulacion es determinista (4000 ticks)');
ok(play(3, 11, 4000) !== play(3, 12, 4000), 'entradas distintas dan estados distintos');

// bot contra bot
let w0 = 0, w1 = 0, unfinished = 0, kills = 0, lava = 0;
for (let s = 1; s <= 20; s++) {
  const w = createMatch(s), b0 = makeBot(0, 2, s), b1 = makeBot(1, 2, s); let g = 0;
  while (w.phase !== 'matchover' && g++ < 60 * 60 * 15) { stepTick(w, [botInput(w, b0), botInput(w, b1)]); for (const e of w.ev) if (e.name === 'kill') (e.lava ? lava++ : kills++); w.ev.length = 0; w.dirty.length = 0; }
  if (w.phase !== 'matchover') unfinished++; else (w.matchWinner ? w1++ : w0++);
}
ok(unfinished === 0, 'todas las partidas bot contra bot terminan');
ok(Math.abs(w0 - w1) <= 8, 'sin ventaja de lado marcada (J1 ' + w0 + ' - J2 ' + w1 + ')');
console.log('   rondas decididas: combate', kills, 'lava', lava);
process.exit(bad ? 1 : 0);
