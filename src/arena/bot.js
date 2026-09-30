// Rival controlado por la computadora. Produce una entrada por tick con el mismo
// formato que un jugador, asi que juega con exactamente las mismas reglas.
// Con `level` (1 a 3) sube la punteria y la anticipacion.
import { rng, aimIndex } from '../shared/dmath.js';
import { dhypot } from '../shared/dmath.js';
import { L, R, J, D, FIRE, DIG, BUILD, mkInput, WEAPONS, priceOf, rayFree, cellAt } from './sim.js';
import { CS, AIR } from './gen.js';

export function makeBot(id, level = 2, seed = 1) {
  return { id, level, r: rng((seed * 9973 + id * 7919 + level) >>> 0 || 1), dir: 1, flipT: 30, lastX: 0, lastY: 0, stuck: 0, selT: 0, sel: 0 };
}

export function botInput(w, bot) {
  const me = w.players[bot.id], op = w.players[1 - bot.id];
  if (!me.alive || w.phase !== 'play') return 0;
  const r = bot.r, lvl = bot.level;
  const cx = me.x, cy = me.y - 22, ox = op.x, oy = op.y - op.h / 2;
  let dx = ox - cx, dy = oy - cy, dist = dhypot(dx, dy);
  const los = rayFree(w, cx, cy, ox, oy);
  let bits = 0, sel = 0, buy = 0;

  // arma segun la situacion (se reevalua cada 20 ticks)
  bot.selT--;
  if (bot.selT <= 0) {
    bot.selT = 20;
    let want = 0;
    if (los && dist < 150 && me.ammo[1] > 0) want = 1;
    else if (dist > 130 && me.ammo[2] > 0 && (los || dist < 320)) want = 2;
    else if (!los && dist < 620 && me.ammo[3] > 0) want = 3;
    else if (los && dist > 260 && me.ammo[3] > 0 && lvl >= 3) want = 3;
    if (want !== me.sel) sel = want + 1;
  }
  const cur = sel ? sel - 1 : me.sel, wp = WEAPONS[cur];

  // compras
  if (me.hp < 50 && me.gold >= priceOf(w, 'heal') && me.hp < 100) buy = 1;
  else if (me.fuel < 25 && me.gold >= priceOf(w, 'fuel')) buy = 2;
  else if (cur > 0 && me.ammo[cur] === 0 && me.gold >= priceOf(w, 'ammo', cur)) buy = 3;

  // punteria con anticipacion segun el nivel
  const speed = cur === 2 ? 520 : cur === 0 ? 900 : 850;
  const lead = lvl >= 2 && cur !== 3 ? dist / speed : 0;
  const tx = ox + op.vx * lead, ty = oy + op.vy * lead + (cur === 2 ? dist * .06 : 0);
  let aim = aimIndex(tx - cx, ty - cy);
  const err = lvl === 1 ? 5 : lvl === 2 ? 2 : 1;
  aim = (aim + Math.floor(r() * (err * 2 + 1)) - err + 64) & 63;

  // disparo / excavacion
  const clear = los || (cur === 3 && dist < 620);
  if (clear && (dist < (cur === 1 ? 260 : 700)) && !(cur === 2 && dist < 100)) bits |= FIRE;
  if (!los && dist < 240 && cur !== 3) bits |= DIG;

  // movimiento
  bot.flipT--; if (bot.flipT <= 0) { bot.dir = -bot.dir; bot.flipT = 25 + Math.floor(r() * 50); }
  let goX = dx > 0 ? 1 : -1, want = 0;
  const range = cur === 1 ? 90 : cur === 2 ? 260 : 300;
  if (dist > range + 60 || !los) want = goX; else if (dist < range - 60) want = -goX; else want = bot.dir;
  // ir a buscar un suministro si no hay pelea directa
  if (!los || dist > 420) {
    let best = null, bd = 800; for (const d of w.drops) { const dd = Math.abs(d.x - cx) + Math.abs(d.y - cy); if (dd < bd) { bd = dd; best = d; } }
    if (best) { want = best.x > cx ? 1 : -1; if (best.y < cy - 30) bits |= J; }
  }
  if (want < 0) bits |= L; else if (want > 0) bits |= R;
  // obstaculo delante: saltar o cavar
  const ahead = cellAt(w, Math.floor((cx + want * 14) / CS), Math.floor((me.y - 6) / CS)) !== AIR;
  if (ahead && want) { bits |= J; if (me.fuel > 10) bits |= J; if (!(bits & FIRE) && !(bits & DIG)) { bits |= DIG; aim = aimIndex(want, 0); } }
  if (dy < -70 && me.fuel > 15) bits |= J;                                   // rival mas arriba: subir
  if (!me.onGround && me.vy > 200 && me.fuel > 25 && dy < 40) bits |= J;      // frenar caidas
  // lava
  if (w.lavaY - me.y < 150 && me.fuel > 5) { bits |= J; bits &= ~D; }
  // atasco
  if (Math.abs(me.x - bot.lastX) + Math.abs(me.y - bot.lastY) < 1.5) bot.stuck++; else bot.stuck = 0;
  bot.lastX = me.x; bot.lastY = me.y;
  if (bot.stuck > 30) { bits |= DIG | J; if (want) aim = aimIndex(want, -.3); if (bot.stuck > 90) bot.stuck = 0; }
  // construir un refugio si esta herido y tiene oro
  if (me.hp < 30 && me.gold >= 2 && dist < 300 && los && (w.roundTick & 15) === 0) { bits |= BUILD; aim = aimIndex(dx, dy); }
  return mkInput(bits, aim, sel, buy);
}
