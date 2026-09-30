// Simulacion del modo Aventura. No toca el DOM ni el canvas, asi que se puede
// correr en Node para probar niveles con bots. Todo el mundo vive en un objeto
// `w`; `stepWorld(w, inp, dt)` avanza un paso fijo y deja los sonidos y avisos
// en `w.ev` (el renderer y el bucle principal los consumen).
import { T, G, RUN, JUMP, FLY_ACC, FLY_MAX, FUEL_DRAIN, FUEL_REGEN, MAXV, P_W, P_H, P_CROUCH_H, MAXHP, INV_TIME, SHOOT_CD, BULLET_SPEED, SPRING_VY, FUEL_RESPAWN, SHOULDER } from './consts.js';

const SOLID = new Set(['#', '%', 'L']);
export const CRACK_HP = 2;
const key = (w, x, y) => y * w.w + x;
const rect = b => ({ l: b.x - b.w / 2, r: b.x + b.w / 2, t: b.y - b.h, b: b.y });
const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ----------------------------------------------------------------- creacion */
export function createWorld(def) {
  const rows = def.rows, H = rows.length, W = rows[0].length;
  const w = {
    def, w: W, h: H, tiles: [], crack: {}, doors: [], plates: [], levers: [], crates: [], enemies: [], items: [], movers: [], springs: [], checkpoints: [],
    bullets: [], ebullets: [], parts: [], ev: [], p: null, start: null, exit: null, hasBoss: false, bossDead: false,
    time: 0, deaths: 0, kills: 0, coinsTotal: 0, deathT: 0, won: false, snap: null, cpPos: null, active: [false, false, false, false]
  };
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x];
      const cx = x * T + T / 2, by = (y + 1) * T;
      let tile = '.';
      if ('#=^~%L'.includes(ch)) tile = ch;
      else if ('abc'.includes(ch)) w.doors.push({ x, y, ch: 'abc'.indexOf(ch) + 1, open: false });
      else if ('123'.includes(ch)) w.plates.push({ x, y, ch: +ch, down: false });
      else if ('456'.includes(ch)) w.levers.push({ x, y, ch: +ch - 3, on: false });
      else if (ch === 'P') w.start = { x: cx, y: by };
      else if (ch === 'X') w.exit = { x, y };
      else if (ch === 'C') w.checkpoints.push({ x, y, on: false });
      else if (ch === 'o') { w.items.push({ type: 'coin', x: cx, y: by - T / 2, taken: false, t: 0 }); w.coinsTotal++; }
      else if (ch === 'h') w.items.push({ type: 'heart', x: cx, y: by - T / 2, taken: false, t: 0 });
      else if (ch === 'f') w.items.push({ type: 'fuel', x: cx, y: by - T / 2, taken: false, t: 0 });
      else if (ch === 'k') w.items.push({ type: 'key', x: cx, y: by - T / 2, taken: false, t: 0 });
      else if (ch === 'M') w.crates.push({ x: cx, y: by, w: 30, h: 30, vx: 0, vy: 0, onGround: false, ride: null });
      else if (ch === 's') w.springs.push({ x, y, t: 0 });
      else if (ch === 'S') w.enemies.push({ kind: 'slime', x: cx, y: by, w: 24, h: 22, vx: 0, vy: 0, hp: 2, maxhp: 2, dir: -1, speed: 52, onGround: false, t: hashT(x, y), flash: 0, dead: false, ride: null });
      else if (ch === 'B') w.enemies.push({ kind: 'bat', x: cx, y: by - 8, w: 22, h: 16, vx: 0, vy: 0, hp: 1, maxhp: 1, dir: -1, hx: cx, hy: by - 8, mode: 'idle', t: hashT(x, y), flash: 0, dead: false });
      else if (ch === 'T') w.enemies.push({ kind: 'turret', x: cx, y: by, w: 26, h: 26, vx: 0, vy: 0, hp: 3, maxhp: 3, dir: -1, cd: 1 + hashT(x, y) % 1, t: 0, flash: 0, dead: false });
      else if (ch === 'G') { w.hasBoss = true; w.enemies.push(makeBoss(cx, by - T)); }
      row.push(tile);
    }
    w.tiles.push(row);
  }
  for (const m of def.movers || []) {
    w.movers.push({ x: m.x * T, y: m.y * T, x0: m.x * T, y0: m.y * T, x1: (m.x + (m.dx || 0)) * T, y1: (m.y + (m.dy || 0)) * T, w: m.len * T, h: 10, speed: m.speed || 70, s: 0, dir: 1, wait: 0, dx: 0, dy: 0 });
  }
  if (!w.start) throw new Error('Nivel sin punto de inicio (P): ' + def.name);
  rebuildDoors(w);
  w.p = newPlayer(w.start);
  w.cpPos = { x: w.start.x, y: w.start.y };
  w.snap = snapshot(w);
  return w;
}
function hashT(x, y) { return Math.abs(((x * 73856093) ^ (y * 19349663)) % 1000) / 1000 * 3; }
function makeBoss(cx, feetY) {
  return { kind: 'boss', x: cx, y: feetY + 26, w: 52, h: 52, vx: 0, vy: 0, hp: 30, maxhp: 30, hx: cx, hy: feetY + 26, t: 0, cd: 2, dive: 0, diveCd: 5, batCd: 4, flash: 0, dead: false, dir: 1, phase: 0 };
}
function newPlayer(pos) {
  return { x: pos.x, y: pos.y, w: P_W, h: P_H, vx: 0, vy: 0, face: 1, onGround: false, ride: null, coyote: 0, buf: 0, holdT: 0, fuel: 100, hp: MAXHP, inv: 1.2, crouch: false, flying: false, keys: 0, t: 0, usedFlip: false, flipping: false, spin: 0, drop: 0, cool: 0, aim: 0, pushing: false, jumpHeld: false, dead: false };
}
function rebuildDoors(w) { w.doorAt = new Map(w.doors.map(d => [key(w, d.x, d.y), d])); }

/* ------------------------------------------------------ snapshot y respawn */
const SNAP_KEYS = ['tiles', 'crack', 'doors', 'levers', 'crates', 'enemies', 'items', 'movers', 'springs', 'checkpoints', 'bossDead'];
function snapshot(w) {
  const s = {}; for (const k of SNAP_KEYS) s[k] = JSON.parse(JSON.stringify(w[k]));
  s.keys = w.p.keys; return s;
}
function restore(w) {
  const s = JSON.parse(JSON.stringify(w.snap));
  for (const k of SNAP_KEYS) w[k] = s[k];
  for (const c of w.crates) c.ride = null;
  rebuildDoors(w);
  w.p = newPlayer(w.cpPos); w.p.keys = s.keys; w.p.inv = 1.5;
  w.bullets = []; w.ebullets = [];
}

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
// hay algo donde pararse debajo de (x, y)? (para que los slimes no se caigan del borde)
function groundAt(w, x, y) {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  if (solidTile(w, tx, ty) || oneWayTile(w, tx, ty)) return true;
  for (const c of w.crates) if (x > c.x - c.w / 2 && x < c.x + c.w / 2 && y >= c.y - c.h - 1 && y <= c.y + 2) return true;
  return false;
}
function los(w, x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (solidTile(w, Math.floor(x / T), Math.floor(y / T))) return false;
    for (const c of w.crates) if (x > c.x - c.w / 2 && x < c.x + c.w / 2 && y > c.y - c.h && y < c.y) return false;
  }
  return true;
}
const emit = (w, name, data) => w.ev.push(data ? { name, ...data } : { name });

/* --------------------------------------------------------------- colisiones */
// Mueve b en X. Devuelve true si choco. `push`: puede empujar cajas.
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
  // cajas
  for (const c of w.crates) {
    if (c === b) continue;
    const a = rect(b), r = rect(c);
    if (!(a.l < r.r - .001 && a.r > r.l + .001 && a.t < r.b - .001 && a.b > r.t + .001)) continue;
    const need = dx > 0 ? a.r - r.l : r.r - a.l;
    let moved = 0;
    if (push && depth < 2 && c.vy === 0) {
      const before = c.x; moveX(w, c, dx > 0 ? need : -need, true, depth + 1); moved = Math.abs(c.x - before);
      if (moved > 0.001) c.pushed = true;
    }
    const rest = need - moved;
    if (rest > .001) { b.x += dx > 0 ? -rest : rest; hit = true; }
    if (b.pushing !== undefined && moved > 0.001) b.pushing = true;
  }
  // otros cuerpos (una caja empujada no atraviesa enemigos)
  if (b.w === 30 && b.h === 30) {
    for (const e of w.enemies) {
      if (e.dead || e.kind === 'bat' || e.kind === 'boss') continue;
      const a = rect(b), r = rect(e);
      if (hits(a, r)) { b.x = dx > 0 ? r.l - hw : r.r + hw; hit = true; }
    }
  }
  return hit;
}

// Mueve b en Y y resuelve piso/techo. Devuelve 'land' | 'bump' | null.
function moveY(w, b, dy, opt = {}) {
  if (!dy) return null;
  const prevBottom = b.y, prevTop = b.y - b.h;
  b.y += dy;
  const hw = b.w / 2;
  const x0 = Math.floor((b.x - hw + .001) / T), x1 = Math.floor((b.x + hw - .001) / T);
  const y0 = Math.floor((b.y - b.h + .001) / T), y1 = Math.floor((b.y - .001) / T);
  if (dy > 0) {
    let best = null; b.ride = null;
    for (let ty = y0; ty <= y1 + 1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const top = ty * T;
      if (b.y < top) continue;
      if (solidTile(w, tx, ty) && prevBottom <= top + .01 || (oneWayTile(w, tx, ty) && !(b.drop > 0) && prevBottom <= top + .01)) { if (best === null || top < best) best = top; }
    }
    let ride = null;
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
    if (b.w === 30 && b.h === 30 && w.p && !w.p.dead) { // una caja que cae se apoya en la cabeza del jugador
      const r = rect(w.p);
      if (b.x + hw > r.l + 1 && b.x - hw < r.r - 1 && prevBottom <= r.t + .5 && b.y >= r.t && (best === null || r.t < best)) best = r.t;
    }
    if (best !== null) { b.y = best; b.vy = 0; b.onGround = true; b.ride = ride; return 'land'; }
    b.onGround = false; return null;
  }
  // subiendo: techo
  let lim = null;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (solidTile(w, tx, ty)) { const l = (ty + 1) * T + b.h; if (lim === null || l > lim) lim = l; }
  }
  for (const c of w.crates) {
    if (c === b) continue;
    const r = rect(c);
    if (b.x + hw <= r.l + .5 || b.x - hw >= r.r - .5) continue;
    if (prevTop >= r.b - .5 && b.y - b.h < r.b) { const l = r.b + b.h; if (lim === null || l > lim) lim = l; }
  }
  if (lim !== null) { b.y = lim; if (b.vy < 0) b.vy = 0; return 'bump'; }
  return null;
}

/* ------------------------------------------------------------------ jugador */
function canStand(w, p) {
  const top = p.y - P_H, hw = p.w / 2;
  const x0 = Math.floor((p.x - hw + .001) / T), x1 = Math.floor((p.x + hw - .001) / T);
  const y0 = Math.floor((top + .001) / T), y1 = Math.floor((p.y - p.h - .001) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidTile(w, tx, ty)) return false;
  for (const c of w.crates) { const r = rect(c); if (p.x + hw > r.l && p.x - hw < r.r && r.b > top && r.t < p.y - p.h) return false; }
  return true;
}

function hurtPlayer(w, d, dirX) {
  const p = w.p;
  if (p.inv > 0 || p.dead) return;
  p.hp -= d; p.inv = INV_TIME; p.vx = dirX * 260; p.vy = -320; p.onGround = false;
  emit(w, 'hurt');
  burst(w, p.x, p.y - 20, 10, '#c0392b', 200);
  if (p.hp <= 0) killPlayer(w);
}
export function killPlayer(w) {
  const p = w.p;
  if (p.dead) return;
  p.dead = true; w.deathT = .8; w.deaths++;
  burst(w, p.x, p.y - 20, 34, '#ff7a3d', 320); emit(w, 'die');
}

export function burst(w, x, y, n, col, spd = 180, up = 60) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = (.3 + Math.random()) * spd;
    w.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: .4 + Math.random() * .5, c: col, s: 2 + Math.floor(Math.random() * 3) * 2 });
  }
}

function stepPlayer(w, inp, dt) {
  const p = w.p;
  p.t += dt; p.inv -= dt; p.coyote -= dt; p.buf -= dt; p.cool -= dt;
  if (p.drop > 0) p.drop -= dt;
  const wasGround = p.onGround, vyBefore = p.vy;

  // llevado por plataformas moviles
  if (p.ride && (p.ride.dx || p.ride.dy)) { moveX(w, p, p.ride.dx, false); moveY(w, p, p.ride.dy); }

  // agacharse (solo en el piso)
  const wantCrouch = inp.down && p.onGround;
  if (wantCrouch) p.crouch = true; else if (p.crouch) { p.h = P_H; if (canStand(w, p)) p.crouch = false; }
  p.h = p.crouch ? P_CROUCH_H : P_H;
  if (inp.down && p.onGround && p.ride) p.drop = .22;
  if (inp.downPressed && p.onGround) { const tx = Math.floor(p.x / T), ty = Math.floor((p.y + 1) / T); if (oneWayTile(w, tx, ty)) p.drop = .22; }

  // horizontal
  const ax = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const spd = RUN * (p.crouch ? .5 : 1) * (p.pushing ? .7 : 1);
  p.vx += (ax * spd - p.vx) * Math.min(1, (p.onGround ? 18 : 6) * dt);
  if (!ax && p.onGround && Math.abs(p.vx) < 5) p.vx = 0;

  // salto (con margen de coyote y de buffer) y voltereta en el aire
  if (inp.jumpPressed) p.buf = .12;
  if (p.onGround) { p.coyote = .09; p.fuel = Math.min(100, p.fuel + FUEL_REGEN * dt); p.usedFlip = false; }
  if (p.buf > 0 && p.coyote > 0 && !p.crouch) {
    p.vy = -JUMP; p.onGround = false; p.coyote = 0; p.buf = 0; p.holdT = 0; p.ride = null; p.jumping = true; emit(w, 'jump');
  } else if (inp.jumpPressed && !p.onGround && !p.usedFlip && !p.flying && p.coyote <= 0) { p.usedFlip = true; p.flipping = true; p.spin = .01; }
  if (p.flipping) { p.spin += 13 * dt; if (p.spin >= 6.283) { p.spin = 0; p.flipping = false; } }
  if (!inp.jump && p.jumping && p.vy < -260 && !p.flying) { p.vy = -260; }
  if (p.vy >= 0) p.jumping = false;

  // vuelo con el jetpack: mantener el salto en el aire
  const hold = inp.jump && !p.crouch;
  p.holdT = hold ? p.holdT + dt : 0;
  p.flying = false;
  if (!p.onGround && hold && p.holdT > .2 && p.fuel > 0) {
    p.vy = Math.max(p.vy - FLY_ACC * dt, -FLY_MAX); p.fuel -= FUEL_DRAIN * dt; p.flying = true; p.jumping = false;
  }

  // gravedad y movimiento
  p.vy = Math.min(p.vy + G * dt, MAXV);
  p.pushing = false;
  if (moveX(w, p, p.vx * dt, true)) { if (!p.pushing) p.vx = 0; }
  const r = moveY(w, p, p.vy * dt);
  if (r === 'land') { if (!wasGround && vyBefore > 300) emit(w, 'land', { v: vyBefore }); } else p.onGround = false;
  if (!p.onGround) p.ride = null;
  p.pushing = p.pushing && p.onGround && Math.abs(inp.right - inp.left) > 0;

  // disparo
  if (inp.shoot && p.cool <= 0) {
    p.cool = SHOOT_CD;
    const a = p.aim, sy = p.y + SHOULDER;
    w.bullets.push({ x: p.x + Math.cos(a) * 26, y: sy + Math.sin(a) * 26, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: 1.1, dmg: 1 });
    p.vx -= Math.cos(a) * 12; emit(w, 'shoot');
  }

  // palancas
  if (inp.interactPressed) {
    for (const lv of w.levers) {
      if (Math.abs(p.x - (lv.x * T + T / 2)) < 30 && Math.abs((p.y - 16) - (lv.y * T + T / 2)) < 34) { lv.on = !lv.on; emit(w, 'lever'); }
    }
  }
}

/* -------------------------------------------------------------- mecanismos */
function updateMechanisms(w, dt) {
  const p = w.p, bodies = [w.crates, w.enemies.filter(e => e.kind === 'slime' && !e.dead), [p]].flat();
  // botones pesados: solo los activa una caja apoyada encima (el jugador solo no alcanza)
  for (const pl of w.plates) {
    const was = pl.down, cx = pl.x * T + T / 2, floor = (pl.y + 1) * T;
    pl.down = w.crates.some(b => Math.abs(b.x - cx) < T / 2 + b.w / 2 - 6 && Math.abs(b.y - floor) < 3 && b.vy === 0);
    if (pl.down !== was) emit(w, 'plate', { down: pl.down });
  }
  // un canal se activa si TODOS sus botones estan apretados, o si su palanca esta en ON
  w.active = [false, false, false, false];
  for (let ch = 1; ch <= 3; ch++) { const ps = w.plates.filter(pl => pl.ch === ch); if (ps.length && ps.every(pl => pl.down)) w.active[ch] = true; }
  for (const lv of w.levers) if (lv.on) w.active[lv.ch] = true;
  for (const d of w.doors) {
    if (w.active[d.ch]) { if (!d.open) emit(w, 'door', { open: true }); d.open = true; }
    else if (d.open) {
      const dr = { l: d.x * T, r: (d.x + 1) * T, t: d.y * T, b: (d.y + 1) * T };
      if (!bodies.some(b => hits(rect(b), dr))) { d.open = false; emit(w, 'door', { open: false }); }
    }
  }
  // plataformas moviles
  for (const m of w.movers) {
    const len = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) || 1;
    let mv = 0;
    if (m.wait > 0) m.wait -= dt; else { m.s += m.dir * m.speed * dt / len; mv = 1; }
    if (m.s >= 1) { m.s = 1; m.dir = -1; m.wait = .5; } else if (m.s <= 0) { m.s = 0; m.dir = 1; m.wait = .5; }
    const nx = m.x0 + (m.x1 - m.x0) * m.s, ny = m.y0 + (m.y1 - m.y0) * m.s;
    m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny;
  }
  // resortes
  for (const s of w.springs) {
    s.t = Math.max(0, s.t - dt);
    const sr = { l: s.x * T + 2, r: (s.x + 1) * T - 2, t: (s.y + 1) * T - 16, b: (s.y + 1) * T + 4 };
    if (p.vy >= 0 && !p.dead && hits(rect(p), sr) && s.t <= 0) { p.vy = -SPRING_VY; p.onGround = false; p.ride = null; s.t = .3; p.jumping = false; emit(w, 'spring'); }
  }
  // cajas: gravedad y carga por plataformas
  for (const c of w.crates) {
    if (c.ride && (c.ride.dx || c.ride.dy)) { moveX(w, c, c.ride.dx, false); moveY(w, c, c.ride.dy); }
    c.vy = Math.min(c.vy + G * dt, MAXV);
    const r = moveY(w, c, c.vy * dt);
    if (r !== 'land') { c.onGround = false; c.ride = null; }
    if (c.y > w.h * T + 200) c.dead = true;
  }
  w.crates = w.crates.filter(c => !c.dead);
}

/* ----------------------------------------------------------------- enemigos */
function hitEnemy(w, e, d, dirX) {
  if (e.dead) return;
  e.hp -= d; e.flash = .12;
  if (e.kind !== 'turret') e.vx += dirX * 90;
  emit(w, 'enemyhit');
  if (e.hp <= 0) {
    e.dead = true; w.kills++;
    burst(w, e.x, e.y - e.h / 2, e.kind === 'boss' ? 60 : 16, e.kind === 'slime' ? '#3fa34d' : e.kind === 'bat' ? '#6a2c9a' : e.kind === 'boss' ? '#ff7a3d' : '#a8acb8', e.kind === 'boss' ? 400 : 240);
    emit(w, e.kind === 'boss' ? 'bossdie' : 'enemydie');
    if (e.kind === 'boss') { w.bossDead = true; w.ebullets = []; w.enemies.forEach(o => { if (o.kind === 'bat') o.dead = true; }); }
  }
}

function enemyBullet(w, x, y, a, sp = 260) { w.ebullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 4 }); }

function stepEnemies(w, dt) {
  const p = w.p;
  for (const e of w.enemies) {
    if (e.dead) continue;
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    const pc = { x: p.x, y: p.y - p.h / 2 };
    if (e.kind === 'slime') {
      if (e.ride && (e.ride.dx || e.ride.dy)) { moveX(w, e, e.ride.dx); moveY(w, e, e.ride.dy); }
      e.vx += (e.dir * e.speed - e.vx) * Math.min(1, 8 * dt);
      e.vy = Math.min(e.vy + G * dt, MAXV);
      const hit = moveX(w, e, e.vx * dt, false);
      const lookX = e.x + e.dir * (e.w / 2 + 3);
      if (hit || (e.onGround && !groundAt(w, lookX, e.y + 3))) { e.dir *= -1; e.vx = 0; }
      const r = moveY(w, e, e.vy * dt);
      if (r !== 'land') e.onGround = false;
      if (e.y > w.h * T + 100) e.dead = true;
      if (solidTile(w, Math.floor(e.x / T), Math.floor((e.y - 4) / T)) === false && tileAt(w, Math.floor(e.x / T), Math.floor((e.y - 2) / T)) === '~') { e.dead = true; burst(w, e.x, e.y - 8, 8, '#ff9a3d', 160); }
    } else if (e.kind === 'bat') {
      const d = Math.hypot(pc.x - e.x, pc.y - (e.y - e.h / 2));
      const seen = d < 260 && los(w, e.x, e.y - 8, pc.x, pc.y);
      if (seen) e.mode = 'chase'; else if (d > 420 || e.mode === 'chase' && !seen && d > 300) e.mode = 'home';
      let tx, ty, sp;
      if (e.mode === 'chase') { tx = pc.x; ty = pc.y - 4 + Math.sin(e.t * 5) * 14; sp = 125; }
      else { tx = e.hx + Math.sin(e.t * 1.3) * 26; ty = e.hy + Math.sin(e.t * 2.1) * 10; sp = 70; }
      const dx = tx - e.x, dy = ty - (e.y - 8), dl = Math.hypot(dx, dy) || 1;
      const vx = dx / dl * Math.min(sp, dl * 4), vy = dy / dl * Math.min(sp, dl * 4);
      e.vx += (vx - e.vx) * Math.min(1, 6 * dt); e.vy += (vy - e.vy) * Math.min(1, 6 * dt);
      moveX(w, e, e.vx * dt, false); moveY(w, e, e.vy * dt);
      e.dir = e.vx >= 0 ? 1 : -1;
    } else if (e.kind === 'turret') {
      e.cd -= dt;
      const dx = pc.x - e.x, dy = pc.y - (e.y - 14), d = Math.hypot(dx, dy);
      e.dir = dx >= 0 ? 1 : -1;
      e.aim = Math.atan2(dy, dx);
      if (d < 460 && e.cd <= 0 && los(w, e.x, e.y - 14, pc.x, pc.y)) {
        e.cd = 1.7; enemyBullet(w, e.x + Math.cos(e.aim) * 14, e.y - 14 + Math.sin(e.aim) * 14, e.aim, 250); emit(w, 'eshoot'); e.recoil = .12;
      }
      if (e.recoil > 0) e.recoil -= dt;
    } else if (e.kind === 'boss') stepBoss(w, e, dt, pc);

    // contacto con el jugador
    if (!p.dead && !e.dead) {
      const a = rect(p), r = rect(e);
      if (hits(a, { l: r.l + 2, r: r.r - 2, t: r.t + 2, b: r.b })) {
        const stompable = e.kind !== 'turret';
        if (stompable && p.vy > 60 && p.y - 10 <= r.t + (e.kind === 'boss' ? 22 : 16)) {
          hitEnemy(w, e, e.kind === 'boss' ? 3 : 2, Math.sign(e.x - p.x) || 1);
          p.vy = (inpHold(w) ? -520 : -380); p.onGround = false; p.ride = null; p.jumping = false; emit(w, 'stomp');
        } else hurtPlayer(w, 1, Math.sign(p.x - e.x) || 1);
      }
    }
  }
  w.enemies = w.enemies.filter(e => !e.dead);
}
const inpHold = w => !!w.lastInp && w.lastInp.jump;

function stepBoss(w, e, dt, pc) {
  const half = e.hp <= e.maxhp / 2;
  e.phase = half ? 1 : 0;
  e.diveCd -= dt; e.cd -= dt; e.batCd -= dt;
  const bx = e.x, by = e.y - 26;
  if (e.dive > 0) {              // embestida: baja hacia el jugador y vuelve
    e.dive -= dt;
    const goingDown = e.dive > .9;
    const tx = goingDown ? pc.x : e.hx, ty = goingDown ? pc.y - 10 : e.hy - 26;
    const dx = tx - bx, dy = ty - by, dl = Math.hypot(dx, dy) || 1, sp = goingDown ? 380 : 260;
    e.x += dx / dl * Math.min(sp * dt, dl); e.y += dy / dl * Math.min(sp * dt, dl);
  } else {
    e.x = e.hx + Math.sin(e.t * (half ? 1.4 : .9)) * 240; e.y = e.hy + 26 + Math.sin(e.t * 1.7) * 22;
    if (e.diveCd <= 0) { e.dive = 1.8; e.diveCd = half ? 4 : 6; }
    if (e.cd <= 0) {
      e.cd = half ? 1.1 : 1.6;
      const a0 = Math.atan2(pc.y - by, pc.x - bx), n = half ? 5 : 3;
      for (let i = 0; i < n; i++) enemyBullet(w, e.x, by, a0 + (i - (n - 1) / 2) * .28, 230);
      emit(w, 'eshoot');
    }
    if (half && e.batCd <= 0) {
      e.batCd = 7;
      if (w.enemies.filter(o => o.kind === 'bat' && !o.dead).length < 3) w.enemies.push({ kind: 'bat', x: e.x, y: e.y, w: 22, h: 16, vx: 0, vy: 0, hp: 1, maxhp: 1, dir: 1, hx: e.x, hy: e.y, mode: 'chase', t: 0, flash: 0, dead: false });
    }
  }
}

/* -------------------------------------------------------------------- balas */
function stepBullets(w, dt) {
  const p = w.p;
  for (const b of w.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    const tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
    if (b.x < 0 || b.x > w.w * T || b.y < 0 || b.y > w.h * T + 100) { b.life = 0; continue; }
    if (tileAt(w, tx, ty) === '%') {
      const k = key(w, tx, ty); w.crack[k] = (w.crack[k] ?? CRACK_HP) - 1; b.life = 0; emit(w, 'crack');
      burst(w, b.x, b.y, 4, '#9a94ab', 120);
      if (w.crack[k] <= 0) { w.tiles[ty][tx] = '.'; burst(w, tx * T + 16, ty * T + 16, 22, '#7b7488', 260); emit(w, 'boom'); }
      continue;
    }
    if (solidTile(w, tx, ty)) { b.life = 0; burst(w, b.x, b.y, 3, '#ffd166', 110); continue; }
    if (w.crates.some(c => b.x > c.x - c.w / 2 && b.x < c.x + c.w / 2 && b.y > c.y - c.h && b.y < c.y)) { b.life = 0; burst(w, b.x, b.y, 3, '#8a5a2b', 100); continue; }
    for (const e of w.enemies) {
      if (e.dead) continue;
      const r = rect(e);
      if (b.x > r.l - 2 && b.x < r.r + 2 && b.y > r.t - 2 && b.y < r.b + 2) { hitEnemy(w, e, b.dmg, Math.sign(b.vx) || 1); b.life = 0; break; }
    }
  }
  w.bullets = w.bullets.filter(b => b.life > 0);
  for (const b of w.ebullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (solidTile(w, Math.floor(b.x / T), Math.floor(b.y / T))) { b.life = 0; burst(w, b.x, b.y, 3, '#b56cf0', 100); continue; }
    if (!p.dead && b.x > p.x - p.w / 2 - 3 && b.x < p.x + p.w / 2 + 3 && b.y > p.y - p.h - 3 && b.y < p.y + 3) { b.life = 0; hurtPlayer(w, 1, Math.sign(b.vx) || 1); }
  }
  w.ebullets = w.ebullets.filter(b => b.life > 0);
}

/* ------------------------------------------------- items, peligros, metas */
function stepWorldObjects(w, dt) {
  const p = w.p, pr = rect(p);
  for (const it of w.items) {
    if (it.taken) { if (it.type === 'fuel') { it.t -= dt; if (it.t <= 0) it.taken = false; } continue; }
    if (Math.abs(it.x - p.x) < 22 && Math.abs(it.y - (p.y - p.h / 2)) < p.h / 2 + 12) {
      if (it.type === 'heart' && p.hp >= MAXHP) continue;
      it.taken = true; emit(w, it.type, { x: it.x, y: it.y });
      if (it.type === 'heart') p.hp++; else if (it.type === 'fuel') { p.fuel = 100; it.t = FUEL_RESPAWN; } else if (it.type === 'key') p.keys++;
      burst(w, it.x, it.y, 8, it.type === 'coin' ? '#ffd166' : it.type === 'heart' ? '#e63946' : it.type === 'fuel' ? '#4aa3ff' : '#ffd166', 140);
    }
  }
  // llave + cerradura: abre todo el bloque de cerraduras conectadas
  if (p.keys > 0) {
    const x0 = Math.floor((p.x - p.w / 2 - 3) / T), x1 = Math.floor((p.x + p.w / 2 + 3) / T), y0 = Math.floor((p.y - p.h + 2) / T), y1 = Math.floor((p.y - 2) / T);
    let start = null;
    for (let ty = y0; ty <= y1 && !start; ty++) for (let tx = x0; tx <= x1; tx++) if (tileAt(w, tx, ty) === 'L') { start = [tx, ty]; break; }
    if (start) {
      const st = [start];
      while (st.length) {
        const [tx, ty] = st.pop();
        if (tileAt(w, tx, ty) !== 'L') continue;
        w.tiles[ty][tx] = '.'; burst(w, tx * T + 16, ty * T + 16, 8, '#ffd166', 200);
        st.push([tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]);
      }
      p.keys--; emit(w, 'unlock');
    }
  }
  // puntos de control
  for (const c of w.checkpoints) {
    if (c.on) continue;
    if (Math.abs(p.x - (c.x * T + T / 2)) < 22 && p.y > c.y * T - 6 && p.y - p.h < (c.y + 1) * T) {
      c.on = true; w.cpPos = { x: c.x * T + T / 2, y: (c.y + 1) * T };
      w.snap = snapshot(w); emit(w, 'checkpoint'); burst(w, c.x * T + 16, c.y * T, 16, '#7ddc5a', 180);
    }
  }
  // pinchos y lava
  const x0 = Math.floor((pr.l + 3) / T), x1 = Math.floor((pr.r - 3) / T), y0 = Math.floor(pr.t / T), y1 = Math.floor((pr.b - 1) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const c = tileAt(w, tx, ty);
    if (c === '^' && pr.b > ty * T + 14 && pr.t < (ty + 1) * T) { if (p.inv <= 0) { hurtPlayer(w, 1, -Math.sign(p.vx) || 1); p.vy = -420; } }
    else if (c === '~' && pr.b > ty * T + 8) { killPlayer(w); return; }
  }
  if (p.y > w.h * T + 96) { killPlayer(w); return; }
  const cx = Math.floor(p.x / T), cy = Math.floor((p.y - p.h / 2) / T);
  if (solidTile(w, cx, cy) && tileAt(w, cx, cy) !== '.') { killPlayer(w); return; }
  // meta
  if (w.exit) {
    const open = !w.hasBoss || w.bossDead;
    const er = { l: w.exit.x * T + 6, r: (w.exit.x + 1) * T - 6, t: (w.exit.y - 1) * T, b: (w.exit.y + 1) * T };
    if (open && hits(pr, er)) { w.won = true; emit(w, 'win'); }
  }
}

/* ------------------------------------------------------------ paso general */
export function stepWorld(w, inp, dt) {
  w.lastInp = inp;
  for (const q of w.parts) { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  w.parts = w.parts.filter(q => q.life > 0);
  if (w.won) return;
  if (w.deathT > 0) {
    w.deathT -= dt;
    if (w.deathT <= 0) { restore(w); emit(w, 'respawn'); }
    return;
  }
  w.time += dt;
  stepPlayer(w, inp, dt);
  updateMechanisms(w, dt);
  stepEnemies(w, dt);
  stepBullets(w, dt);
  stepWorldObjects(w, dt);
}

export const exitOpen = w => !w.hasBoss || w.bossDead;
export function coinsTaken(w) { return w.items.filter(i => i.type === 'coin' && i.taken).length; }

// Copia profunda del mundo (sin el nivel ni las particulas). Sirve para que un
// bot pruebe jugadas y para las pruebas automaticas.
export function cloneWorld(w) {
  const { def, snap, doorAt, parts, ev, lastInp, ...rest } = w;
  const c = structuredClone(rest);
  c.def = def; c.snap = snap; c.parts = []; c.ev = []; c.lastInp = null;
  rebuildDoors(c);
  return c;
}
