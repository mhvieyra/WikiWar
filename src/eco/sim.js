// Motor de "Ecos": puzzles cooperativos contra tus propias grabaciones.
//
// Cada intento (ciclo) dura hasta `def.limit` segundos. Al terminarlo, sus
// entradas quedan grabadas y en el ciclo siguiente esa version tuya (un eco)
// las repite a la vez que jugas el ciclo nuevo. Los ecos son cuerpos de verdad:
// aprietan botones, tiran palancas, disparan a dianas, empujan cajas y se
// pueden usar de escalon.
//
// La simulacion es determinista (paso fijo, entradas enteras, sin Math.random
// ni trigonometria del navegador en la logica) para que una repeticion se pueda
// verificar en cualquier maquina. No toca el DOM: se puede correr en Node.
import { T, DT, G, RUN, JUMP, FLY_ACC, FLY_MAX, FUEL_DRAIN, FUEL_REGEN, MAXV, P_W, P_H, P_CROUCH_H, SHOOT_CD, BULLET_SPEED, SPRING_VY, SHOULDER } from './consts.js';
import { AIM } from '../shared/dmath.js';

export const SUB = 2;                     // subpasos de fisica por tick de entrada (60 Hz)
export const TICK_HZ = 60;
export const L = 1, R = 2, J = 4, D = 8, S = 16, E = 32;       // bits de la entrada
export const aimOf = m => (m >> 6) & 63;
export const mk = (bits, aim = 0) => bits | (aim << 6);

const SOLID = new Set(['#', 'L']);
const key = (w, x, y) => y * w.w + x;
const rect = b => ({ l: b.x - b.w / 2, r: b.x + b.w / 2, t: b.y - b.h, b: b.y });
const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const emit = (w, name, data) => w.ev.push(data ? { name, ...data } : { name });

/* ----------------------------------------------------------------- creacion */
// echoes: lista de grabaciones (arrays de enteros, uno por tick).
export function createWorld(def, echoes = [], mut = {}) {
  const rows = def.rows, H = rows.length, W = rows[0].length;
  const w = {
    def, w: W, h: H, tiles: [], doors: [], plates: [], levers: [], pads: [], targets: [], crates: [], movers: [], springs: [],
    actors: [], bullets: [], parts: [], ev: [], start: null, exit: null, tick: 0, sub: 0, won: false, winTick: -1, liveDead: false,
    pulse: [0, 0, 0, 0], act: [false, false, false, false], limit: Math.round((def.limit || 40) * TICK_HZ), mut: { g: 1, run: 1, jump: 1, fuel: 1, ...mut }
  };
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      let tile = '.';
      if ('#=^~L'.includes(ch)) tile = ch;
      else if ('abc'.includes(ch)) w.doors.push({ x, y, ch: 'abc'.indexOf(ch) + 1, inv: false, open: false });
      else if ('ABC'.includes(ch)) w.doors.push({ x, y, ch: 'ABC'.indexOf(ch) + 1, inv: true, open: true });
      else if ('123'.includes(ch)) w.plates.push({ x, y, ch: +ch, down: false });
      else if ('456'.includes(ch)) w.levers.push({ x, y, ch: +ch - 3, on: false });
      else if ('uvw'.includes(ch)) w.pads.push({ x, y, ch: 'uvw'.indexOf(ch) + 1, hot: 0, on: false });
      else if ('xyz'.includes(ch)) w.targets.push({ x, y, ch: 'xyz'.indexOf(ch) + 1, hot: 0 });
      else if (ch === 'P') w.start = { x: x * T + T / 2, y: (y + 1) * T };
      else if (ch === 'X') w.exit = { x, y };
      else if (ch === 'M') w.crates.push({ x: x * T + T / 2, y: (y + 1) * T, w: 30, h: 30, vx: 0, vy: 0, onGround: false, ride: null });
      else if (ch === 's') w.springs.push({ x, y, t: 0 });
      row.push(tile);
    }
    w.tiles.push(row);
  }
  for (const m of def.movers || []) {
    const len = Math.sqrt((m.dx || 0) * T * (m.dx || 0) * T + (m.dy || 0) * T * (m.dy || 0) * T) || 1;
    w.movers.push({ x: m.x * T, y: m.y * T, x0: m.x * T, y0: m.y * T, x1: (m.x + (m.dx || 0)) * T, y1: (m.y + (m.dy || 0)) * T, w: m.len * T, h: 10, period: 2 * len / (m.speed || 60), phase: m.phase || 0, dx: 0, dy: 0 });
  }
  for (const m of w.movers) { const p = moverPos(m, 0); m.x = p.x; m.y = p.y; }
  if (!w.start) throw new Error('Nivel sin inicio (P): ' + def.name);
  const fuel = Math.round((def.fuel || 0) * w.mut.fuel);
  echoes.forEach((log, i) => w.actors.push(newActor(i, w.start, 'echo', log, fuel)));
  w.live = newActor(echoes.length, w.start, 'live', null, fuel);
  w.actors.push(w.live);
  w.liveLog = [];
  rebuildDoors(w);
  updateChannels(w);
  for (const d of w.doors) d.open = d.inv ? !w.act[d.ch] : w.act[d.ch];
  return w;
}
function newActor(id, pos, kind, log, fuel) {
  return { id, kind, log, x: pos.x, y: pos.y, w: P_W, h: P_H, vx: 0, vy: 0, face: 1, aim: 0, onGround: false, ride: null, coyote: 0, buf: 0, holdT: 0,
    maxFuel: fuel, fuel, crouch: false, flying: false, t: 0, usedFlip: false, flipping: false, spin: 0, drop: 0, cool: 0, jumping: false, prev: 0, jp: false, dp: false, ep: false, dead: false, ddx: 0, ddy: 0, pushing: false };
}
function rebuildDoors(w) { w.doorAt = new Map(w.doors.map(d => [key(w, d.x, d.y), d])); }

/* --------------------------------------------------------------- utilidades */
export function solidTile(w, tx, ty) {
  if (tx < 0 || tx >= w.w || ty < 0) return true;
  if (ty >= w.h) return false;
  if (SOLID.has(w.tiles[ty][tx])) return true;
  const d = w.doorAt.get(key(w, tx, ty));
  return !!(d && !d.open);
}
const oneWayTile = (w, tx, ty) => ty >= 0 && ty < w.h && tx >= 0 && tx < w.w && w.tiles[ty][tx] === '=';
export const tileAt = (w, tx, ty) => (ty >= 0 && ty < w.h && tx >= 0 && tx < w.w ? w.tiles[ty][tx] : '.');
export function burst(w, x, y, n, col, spd = 160) {   // solo visual: no afecta la logica
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = (.3 + Math.random()) * spd; w.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: .4 + Math.random() * .5, c: col, s: 2 + Math.floor(Math.random() * 3) * 2 }); }
}

/* --------------------------------------------------------------- colisiones */
function moveX(w, b, dx, push, depth = 0) {
  if (!dx) return false;
  b.x += dx;
  let hit = false;
  const hw = b.w / 2, y0 = Math.floor((b.y - b.h + .001) / T), y1 = Math.floor((b.y - .001) / T);
  const x0 = Math.floor((b.x - hw) / T), x1 = Math.floor((b.x + hw - .001) / T);
  let lim = null;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!solidTile(w, tx, ty)) continue;
    const l = dx > 0 ? tx * T - hw : (tx + 1) * T + hw;
    if (lim === null || (dx > 0 ? l < lim : l > lim)) lim = l;
  }
  if (lim !== null) { b.x = lim; hit = true; }
  for (const c of w.crates) {
    if (c === b) continue;
    const a = rect(b), r = rect(c);
    if (!(a.l < r.r - .001 && a.r > r.l + .001 && a.t < r.b - .001 && a.b > r.t + .001)) continue;
    const need = dx > 0 ? a.r - r.l : r.r - a.l;
    let moved = 0;
    if (push && depth < 2 && c.vy === 0) {
      const before = c.x; moveX(w, c, dx > 0 ? need : -need, true, depth + 1); moved = Math.abs(c.x - before);
    }
    const rest = need - moved;
    if (rest > .001) { b.x += dx > 0 ? -rest : rest; hit = true; }
    if (b.pushing !== undefined && moved > .001) b.pushing = true;
  }
  return hit;
}

function moveY(w, b, dy) {
  if (!dy) return null;
  const prevBottom = b.y, prevTop = b.y - b.h;
  b.y += dy;
  const hw = b.w / 2;
  const x0 = Math.floor((b.x - hw + .001) / T), x1 = Math.floor((b.x + hw - .001) / T);
  const y0 = Math.floor((b.y - b.h + .001) / T), y1 = Math.floor((b.y - .001) / T);
  if (dy > 0) {
    let best = null, ride = null;
    for (let ty = y0; ty <= y1 + 1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const top = ty * T;
      if (b.y < top) continue;
      if ((solidTile(w, tx, ty) || (oneWayTile(w, tx, ty) && !(b.drop > 0))) && prevBottom <= top + .01) { if (best === null || top < best) best = top; }
    }
    for (const m of w.movers) {
      if (b.drop > 0 || b.x + hw <= m.x + 1 || b.x - hw >= m.x + m.w - 1) continue;
      if (prevBottom <= m.y + 3 && b.y >= m.y && (best === null || m.y < best)) { best = m.y; ride = m; }
    }
    for (const c of w.crates) {
      if (c === b) continue;
      const r = rect(c);
      if (b.x + hw <= r.l + .5 || b.x - hw >= r.r - .5) continue;
      if (prevBottom <= r.t + .5 && b.y >= r.t && (best === null || r.t < best)) { best = r.t; ride = null; }
    }
    for (const o of w.actors) {   // los cuerpos de los actores sirven de escalon
      if (o === b || o.dead) continue;
      const r = rect(o);
      if (b.x + hw <= r.l + 1 || b.x - hw >= r.r - 1) continue;
      if (prevBottom <= r.t + 1.5 && b.y >= r.t && (best === null || r.t < best)) { best = r.t; ride = o; }
    }
    if (best !== null) { b.y = best; b.vy = 0; b.onGround = true; b.ride = ride; return 'land'; }
    b.onGround = false; return null;
  }
  let lim = null;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidTile(w, tx, ty)) { const l = (ty + 1) * T + b.h; if (lim === null || l > lim) lim = l; }
  for (const c of w.crates) {
    if (c === b) continue;
    const r = rect(c);
    if (b.x + hw <= r.l + .5 || b.x - hw >= r.r - .5) continue;
    if (prevTop >= r.b - .5 && b.y - b.h < r.b) { const l = r.b + b.h; if (lim === null || l > lim) lim = l; }
  }
  if (lim !== null) { b.y = lim; if (b.vy < 0) b.vy = 0; return 'bump'; }
  return null;
}

function canStand(w, a) {
  const top = a.y - P_H, hw = a.w / 2;
  const x0 = Math.floor((a.x - hw + .001) / T), x1 = Math.floor((a.x + hw - .001) / T);
  const y0 = Math.floor((top + .001) / T), y1 = Math.floor((a.y - a.h - .001) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidTile(w, tx, ty)) return false;
  for (const c of w.crates) { const r = rect(c); if (a.x + hw > r.l && a.x - hw < r.r && r.b > top && r.t < a.y - a.h) return false; }
  return true;
}

/* ------------------------------------------------------------------- actor */
function killActor(w, a) {
  if (a.dead) return;
  a.dead = true; burst(w, a.x, a.y - 20, 22, a.kind === 'live' ? '#ff7a3d' : '#7fd8ff', 260);
  emit(w, a.kind === 'live' ? 'die' : 'echodie', { id: a.id });
  if (a === w.live) w.liveDead = true;
}

function stepActor(w, a, mask, first, dt) {
  if (a.dead) return;
  const k = w.mut;
  a.t += dt; a.coyote -= dt; a.buf -= dt; a.cool -= dt;
  if (a.drop > 0) a.drop -= dt;
  if (first) {
    a.jp = !!(mask & J) && !(a.prev & J); a.dp = !!(mask & D) && !(a.prev & D); a.ep = !!(mask & E) && !(a.prev & E);
    a.prev = mask; a.aim = aimOf(mask); a.face = AIM[a.aim].x >= 0 ? 1 : -1;
  }
  const jp = first && a.jp, left = mask & L, right = mask & R, jump = mask & J, down = mask & D;
  const wasGround = a.onGround, vyBefore = a.vy;
  const px = a.x, py = a.y;

  // llevado por lo que pisa (plataformas moviles o el cuerpo de otro actor)
  if (a.ride) {
    const o = a.ride;
    if (o.dead) a.ride = null;
    else if (o.dx !== undefined && o.period !== undefined) { moveX(w, a, o.dx, false); moveY(w, a, o.dy); }
    else { moveX(w, a, o.ddx, false); moveY(w, a, o.ddy); }
  }

  // agacharse y bajar de plataformas
  if (down && a.onGround) a.crouch = true; else if (a.crouch) { a.h = P_H; if (canStand(w, a)) a.crouch = false; }
  a.h = a.crouch ? P_CROUCH_H : P_H;
  if (down && a.onGround && a.ride && a.ride.period !== undefined) a.drop = .22;
  if (first && a.dp && a.onGround) { const tx = Math.floor(a.x / T), ty = Math.floor((a.y + 1) / T); if (oneWayTile(w, tx, ty)) a.drop = .22; }

  // horizontal
  const ax = (right ? 1 : 0) - (left ? 1 : 0);
  const spd = RUN * k.run * (a.crouch ? .5 : 1) * (a.pushing ? .7 : 1);
  a.vx += (ax * spd - a.vx) * Math.min(1, (a.onGround ? 18 : 6) * dt);
  if (!ax && a.onGround && Math.abs(a.vx) < 5) a.vx = 0;

  // salto con margen de coyote y de buffer, y voltereta
  if (jp) a.buf = .12;
  if (a.onGround) { a.coyote = .09; a.fuel = Math.min(a.maxFuel, a.fuel + FUEL_REGEN * dt); a.usedFlip = false; }
  if (a.buf > 0 && a.coyote > 0 && !a.crouch) {
    a.vy = -JUMP * k.jump; a.onGround = false; a.coyote = 0; a.buf = 0; a.holdT = 0; a.ride = null; a.jumping = true; emit(w, 'jump');
  } else if (jp && !a.onGround && !a.usedFlip && !a.flying && a.coyote <= 0) { a.usedFlip = true; a.flipping = true; a.spin = .01; }
  if (a.flipping) { a.spin += 13 * dt; if (a.spin >= 6.283) { a.spin = 0; a.flipping = false; } }
  if (!jump && a.jumping && a.vy < -260 * k.jump && !a.flying) a.vy = -260 * k.jump;
  if (a.vy >= 0) a.jumping = false;

  // jetpack (solo en niveles que lo dan)
  const hold = jump && !a.crouch;
  a.holdT = hold ? a.holdT + dt : 0;
  a.flying = false;
  if (!a.onGround && hold && a.holdT > .2 && a.fuel > 0) {
    a.vy = Math.max(a.vy - FLY_ACC * dt, -FLY_MAX); a.fuel -= FUEL_DRAIN * dt; a.flying = true; a.jumping = false;
  }

  a.vy = Math.min(a.vy + G * k.g * dt, MAXV);
  a.pushing = false;
  if (moveX(w, a, a.vx * dt, true)) { if (!a.pushing) a.vx = 0; }
  const r = moveY(w, a, a.vy * dt);
  if (r === 'land') { if (!wasGround && vyBefore > 300) emit(w, 'land', { v: vyBefore, id: a.id }); } else a.onGround = false;
  if (!a.onGround) a.ride = null;
  a.pushing = a.pushing && a.onGround && (right ? 1 : 0) !== (left ? 1 : 0);

  // disparo (sirve para las dianas)
  if ((mask & S) && a.cool <= 0) {
    a.cool = SHOOT_CD;
    const d = AIM[a.aim], sy = a.y + (a.crouch ? -28 : SHOULDER);
    w.bullets.push({ x: a.x + d.x * 22, y: sy + d.y * 22, vx: d.x * BULLET_SPEED, vy: d.y * BULLET_SPEED, life: 1.1 });
    emit(w, 'shoot', { id: a.id });
  }

  // palancas
  if (first && a.ep) {
    for (const lv of w.levers) {
      if (Math.abs(a.x - (lv.x * T + T / 2)) < 30 && Math.abs((a.y - 16) - (lv.y * T + T / 2)) < 34) { lv.on = !lv.on; emit(w, 'lever'); }
    }
  }
  a.ddx = a.x - px; a.ddy = a.y - py;
}

/* -------------------------------------------------------------- mecanismos */
function updateChannels(w) {
  const act = [false, false, false, false];
  for (let ch = 1; ch <= 3; ch++) {
    const ps = w.plates.filter(pl => pl.ch === ch);
    if (ps.length && ps.every(pl => pl.down)) act[ch] = true;
  }
  for (const lv of w.levers) if (lv.on) act[lv.ch] = true;
  for (let ch = 1; ch <= 3; ch++) if (w.pulse[ch] > 0) act[ch] = true;
  w.act = act;
}

function stepMechanisms(w, dt) {
  const bodies = w.crates.concat(w.actors.filter(a => !a.dead));
  for (const pl of w.plates) {
    const was = pl.down, cx = pl.x * T + T / 2, floor = (pl.y + 1) * T;
    pl.down = bodies.some(b => Math.abs(b.x - cx) < T / 2 + b.w / 2 - 6 && Math.abs(b.y - floor) < 3 && b.onGround !== false && (b.vy === 0 || b.vy === undefined));
    if (pl.down !== was) emit(w, 'plate', { down: pl.down });
  }
  const pulseSubs = Math.round((w.def.pulse || 3) / DT);
  for (const pd of w.pads) {
    const rc = { l: pd.x * T + 2, r: (pd.x + 1) * T - 2, t: (pd.y + 1) * T - 8, b: (pd.y + 1) * T + 2 };
    const on = w.actors.some(a => !a.dead && hits(rect(a), rc)) || w.crates.some(c => hits(rect(c), rc));
    if (on && !pd.on) { w.pulse[pd.ch] = pulseSubs; emit(w, 'pad'); pd.hot = 12; }   // solo al pisar: quedarse encima no lo mantiene
    pd.on = on; if (pd.hot > 0) pd.hot--;
  }
  for (let ch = 1; ch <= 3; ch++) if (w.pulse[ch] > 0) w.pulse[ch]--;
  updateChannels(w);
  for (const d of w.doors) {
    const want = d.inv ? !w.act[d.ch] : w.act[d.ch];
    if (want) { if (!d.open) emit(w, 'door', { open: true }); d.open = true; }
    else if (d.open) {
      const dr = { l: d.x * T, r: (d.x + 1) * T, t: d.y * T, b: (d.y + 1) * T };
      if (!bodies.some(b => hits(rect(b), dr))) { d.open = false; emit(w, 'door', { open: false }); }
    }
  }
  for (const s of w.springs) {
    s.t = Math.max(0, s.t - dt);
    const sr = { l: s.x * T + 2, r: (s.x + 1) * T - 2, t: (s.y + 1) * T - 16, b: (s.y + 1) * T + 4 };
    for (const a of w.actors) if (!a.dead && a.vy >= 0 && s.t <= 0 && hits(rect(a), sr)) { a.vy = -SPRING_VY; a.onGround = false; a.ride = null; a.jumping = false; s.t = .3; emit(w, 'spring'); }
  }
  for (const c of w.crates) {
    if (c.ride && (c.ride.dx || c.ride.dy)) { moveX(w, c, c.ride.dx, false); moveY(w, c, c.ride.dy); }
    c.vy = Math.min(c.vy + G * dt, MAXV);
    const r = moveY(w, c, c.vy * dt);
    if (r !== 'land') { c.onGround = false; c.ride = null; }
    if (c.y > w.h * T + 200) c.dead = true;
  }
  if (w.crates.some(c => c.dead)) w.crates = w.crates.filter(c => !c.dead);
}

function stepBullets(w, dt) {
  const pulseSubs = Math.round((w.def.pulse || 3) / DT);
  for (const b of w.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    const tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
    if (b.x < 0 || b.x > w.w * T || b.y < 0 || b.y > w.h * T + 100) { b.life = 0; continue; }
    const tg = w.targets.find(t => t.x === tx && t.y === ty);
    if (tg) { w.pulse[tg.ch] = pulseSubs; tg.hot = 12; b.life = 0; emit(w, 'target'); burst(w, b.x, b.y, 8, '#ffd166', 160); continue; }
    if (solidTile(w, tx, ty)) { b.life = 0; burst(w, b.x, b.y, 3, '#ffd166', 100); continue; }
    if (w.crates.some(c => b.x > c.x - c.w / 2 && b.x < c.x + c.w / 2 && b.y > c.y - c.h && b.y < c.y)) b.life = 0;
  }
  w.bullets = w.bullets.filter(b => b.life > 0);
  for (const t of w.targets) if (t.hot > 0) t.hot--;
}

function stepHazards(w) {
  for (const a of w.actors) {
    if (a.dead) continue;
    const pr = rect(a);
    const x0 = Math.floor((pr.l + 3) / T), x1 = Math.floor((pr.r - 3) / T), y0 = Math.floor(pr.t / T), y1 = Math.floor((pr.b - 1) / T);
    for (let ty = y0; ty <= y1 && !a.dead; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = tileAt(w, tx, ty);
      if (c === '^' && pr.b > ty * T + 14 && pr.t < (ty + 1) * T) { killActor(w, a); break; }
      if (c === '~' && pr.b > ty * T + 8) { killActor(w, a); break; }
    }
    if (a.dead) continue;
    if (a.y > w.h * T + 96) { killActor(w, a); continue; }
    const cx = Math.floor(a.x / T), cy = Math.floor((a.y - a.h / 2) / T);
    if (solidTile(w, cx, cy) && tileAt(w, cx, cy) !== '.') killActor(w, a);
  }
  if (w.exit && !w.won && !w.live.dead) {
    const er = { l: w.exit.x * T + 6, r: (w.exit.x + 1) * T - 6, t: (w.exit.y - 1) * T, b: (w.exit.y + 1) * T };
    if (hits(rect(w.live), er)) { w.won = true; w.winTick = w.tick; emit(w, 'win'); }
  }
}

/* ------------------------------------------------------------------- paso */
function moverPos(m, t) {
  const ph = ((t / m.period + m.phase) % 1 + 1) % 1, s = ph < .5 ? ph * 2 : 2 - ph * 2;
  const e = s * s * (3 - 2 * s);
  return { x: m.x0 + (m.x1 - m.x0) * e, y: m.y0 + (m.y1 - m.y0) * e };
}
function stepMovers(w) {
  const t = w.sub * DT;
  for (const m of w.movers) { const n = moverPos(m, t); m.dx = n.x - m.x; m.dy = n.y - m.y; m.x = n.x; m.y = n.y; }
}

// Avanza un tick (1/60 s) con la entrada `liveMask` del jugador vivo. Los ecos
// leen su propia grabacion. Devuelve la entrada aplicada.
export function stepTick(w, liveMask) {
  if (w.won) return;
  w.liveLog.push(liveMask);
  for (let s = 0; s < SUB; s++) {
    for (const q of w.parts) { q.vy += 900 * DT; q.x += q.vx * DT; q.y += q.vy * DT; q.life -= DT; }
    stepMovers(w);
    for (const a of w.actors) stepActor(w, a, a.kind === 'live' ? liveMask : (a.log[w.tick] || 0), s === 0, DT);
    stepMechanisms(w, DT);
    stepBullets(w, DT);
    stepHazards(w);
    w.sub++;
    if (w.won) break;
  }
  w.tick++;
  if (w.parts.length > 300) w.parts.splice(0, w.parts.length - 300);
  w.parts = w.parts.filter(q => q.life > 0);
}

export const timeUp = w => w.tick >= w.limit;

export function cloneWorld(w) {
  const { def, doorAt, parts, ev, ...rest } = w;
  const c = structuredClone(rest);
  c.def = def; c.parts = []; c.ev = [];
  rebuildDoors(c);
  return c;
}

/* --------------------------------------------- grabaciones y verificacion */
// Corre una solucion completa (lista de ciclos: cada uno un array de entradas)
// y devuelve si el ultimo ciclo llega a la salida. Es lo que usa el ranking
// para verificar repeticiones ajenas.
export function verify(def, runs, mut = {}) {
  if (!runs.length) return { ok: false, reason: 'sin ciclos' };
  const echoes = runs.slice(0, -1), last = runs[runs.length - 1];
  const w = createWorld(def, echoes, mut);
  for (let i = 0; i < last.length && !w.won && !w.live.dead; i++) stepTick(w, last[i] || 0);
  if (!w.won) return { ok: false, reason: w.live.dead ? 'el jugador murio' : 'no llego a la salida' };
  return { ok: true, echoes: echoes.length, ticks: w.winTick + 1, time: (w.winTick + 1) / TICK_HZ };
}
