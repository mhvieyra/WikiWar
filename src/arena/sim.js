// Simulacion de la Arena: duelo 1 contra 1 con terreno destructible.
//
// Es determinista y no toca el DOM: las mismas entradas por tick dan siempre
// el mismo estado, lo que permite probarla con bots. Por eso no usa
// Math.random ni trigonometria del navegador: solo + - * / sqrt floor, el PRNG
// de shared/dmath.js y la tabla AIM de 64 direcciones.
//
// Entrada de un jugador en un tick (un entero):
//   bits 0-7: L R J D FIRE DIG BUILD (ver constantes)   bits 8-13: apuntado (0..63)
//   bits 14-16: cambiar de arma (1..4, 0 = no cambia)   bits 17-18: comprar (1 curar, 2 combustible, 3 municion)
import { dhypot, AIM, rng } from '../shared/dmath.js';
import { generate, CS, COLS, ROWS, AIR, DIRT, ROCK, ORE, BUILT } from './gen.js';

export const TICK_HZ = 60, DT = 1 / 120;
export const L = 1, R = 2, J = 4, D = 8, FIRE = 16, DIG = 32, BUILD = 64;
export const mkInput = (bits, aim = 0, sel = 0, buy = 0) => bits | (aim << 8) | (sel << 14) | (buy << 17);
export const inAim = m => (m >> 8) & 63;
export const inSel = m => (m >> 14) & 7;
export const inBuy = m => (m >> 17) & 3;

export const G = 1700, RUN = 250, JUMP = 560, FLY_ACC = 2900, FLY_MAX = 340, FUEL_MAX = 100, FUEL_DRAIN = 34, FUEL_REGEN = 60, MAXV = 1100;
export const PW = 16, PH = 40, PH_CROUCH = 24, HP_MAX = 100, GOLD_MAX = 99;
export const STEP_MAX = 10;
export const COUNTDOWN = 3 * TICK_HZ, OVER_TICKS = 3 * TICK_HZ, LAVA_START = 40 * TICK_HZ, LAVA_RATE = 12;   // unidades por segundo
export const WIN_ROUNDS = 3;
export const DROP_FIRST = 4 * TICK_HZ, DROP_EVERY = 12 * TICK_HZ;

export const WEAPONS = [
  { name: 'Pistola', cd: 17, dmg: 10, speed: 900, life: 80, pellets: 1, ammo: -1, max: -1 },
  { name: 'Escopeta', cd: 42, dmg: 7, speed: 850, life: 26, pellets: 5, spread: 3, ammo: 6, max: 18, per: 6 },
  { name: 'Bazuca', cd: 66, dmg: 45, speed: 520, life: 220, pellets: 1, ammo: 3, max: 9, per: 3, boom: 40 },
  { name: 'Láser', cd: 96, dmg: 38, speed: 0, life: 0, pellets: 1, ammo: 2, max: 6, per: 2, beam: 640 }
];
export const PRICE = { heal: 6, fuel: 3, ammo: [0, 5, 8, 8] };   // precio base; sube 25% con cada compra (mercado compartido)
export const BUILD_COST = 2;

const mulPrice = (base, n) => { let p = base; for (let i = 0; i < n; i++) p *= 1.25; return Math.ceil(p - 1e-9); };
export const priceOf = (w, item, sel) => item === 'ammo' ? mulPrice(PRICE.ammo[sel], w.market['ammo' + sel]) : mulPrice(PRICE[item], w.market[item]);

const emit = (w, name, data) => w.ev.push(data ? { name, ...data } : { name });

/* ----------------------------------------------------------------- creacion */
export function createMatch(seed, opts = {}) {
  const w = {
    seed, cols: COLS, rows: ROWS, cells: null, cellSum: 0, players: [], proj: [], drops: [], beams: [], ev: [], dirty: [],
    tick: 0, roundTick: 0, round: 0, phase: 'countdown', phaseT: COUNTDOWN, scores: [0, 0], winner: -1, matchWinner: -1,
    market: { heal: 0, fuel: 0, ammo1: 0, ammo2: 0, ammo3: 0 }, lavaY: ROWS * CS + 200, nextDrop: DROP_FIRST, rng: rng(seed || 1), winRounds: opts.winRounds || WIN_ROUNDS, lastRoundWinner: -2
  };
  startRound(w);
  return w;
}
function newPlayer(id, pos) {
  return { id, x: pos.x, y: pos.y, w: PW, h: PH, vx: 0, vy: 0, face: id ? -1 : 1, aim: id ? 32 : 0, onGround: false, crouch: false, flying: false, coyote: 0, buf: 0, holdT: 0, jumping: false,
    fuel: FUEL_MAX, hp: HP_MAX, alive: true, sel: 0, ammo: [-1, 3, 2, 1], gold: 0, cdFire: 0, cdDig: 0, cdBuild: 0, prev: 0, flash: 0, t: 0, lastHit: -1, digAnim: 0 };
}
export function startRound(w) {
  w.round++;
  const g = generate((w.seed * 1000 + w.round) >>> 0);
  w.cells = g.cells; w.surf = surfaceRows(w.cells); w.cellSum = 0; for (let i = 0; i < w.cells.length; i++) w.cellSum = (w.cellSum + w.cells[i] * (i % 251 + 1)) | 0;
  w.players = [newPlayer(0, g.spawns[0]), newPlayer(1, g.spawns[1])];
  w.proj = []; w.drops = []; w.beams = []; w.roundTick = 0; w.lavaY = ROWS * CS + 200; w.nextDrop = DROP_FIRST;
  w.market = { heal: 0, fuel: 0, ammo1: 0, ammo2: 0, ammo3: 0 };
  w.phase = 'countdown'; w.phaseT = COUNTDOWN; w.winner = -1; w.dirtyAll = true;
  emit(w, 'round', { n: w.round });
}

// Fila donde empieza el suelo de cada columna (ignora islas finas). Solo la usa el render para oscurecer las cuevas.
function surfaceRows(cells) {
  const out = new Int16Array(COLS);
  for (let x = 0; x < COLS; x++) {
    let y = 3; out[x] = ROWS;
    for (; y < ROWS - 3; y++) {
      if (cells[y * COLS + x] === AIR) continue;
      let run = 0; while (y + run < ROWS && cells[(y + run) * COLS + x] !== AIR && run < 10) run++;
      if (run >= 10) { out[x] = y; break; }
      y += run;
    }
  }
  return out;
}

/* ------------------------------------------------------------------- celdas */
export const cellAt = (w, cx, cy) => (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS ? ROCK : w.cells[cy * COLS + cx]);
function setCell(w, cx, cy, v) {
  const i = cy * COLS + cx, old = w.cells[i];
  w.cellSum = (w.cellSum + (v - old) * (i % 251 + 1)) | 0;
  w.cells[i] = v;
  if (w.dirty.length < 20000) w.dirty.push(i); else w.dirtyAll = true;
}
function overlaps(w, l, t, r, b) {
  const x0 = Math.floor(l / CS), x1 = Math.floor((r - 1e-4) / CS), y0 = Math.floor(t / CS), y1 = Math.floor((b - 1e-4) / CS);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cellAt(w, x, y) !== AIR) return true;
  return false;
}
// Rompe todas las celdas destructibles dentro del circulo. El oro que salga se le da a `owner`.
function carve(w, x, y, rad, owner) {
  const x0 = Math.max(0, Math.floor((x - rad) / CS)), x1 = Math.min(COLS - 1, Math.floor((x + rad) / CS)), y0 = Math.max(0, Math.floor((y - rad) / CS)), y1 = Math.min(ROWS - 1, Math.floor((y + rad) / CS));
  let gold = 0;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const c = w.cells[cy * COLS + cx];
    if (c === AIR || c === ROCK) continue;
    const dx = cx * CS + CS / 2 - x, dy = cy * CS + CS / 2 - y;
    if (dx * dx + dy * dy > rad * rad) continue;
    if (c === ORE) gold++;
    setCell(w, cx, cy, AIR);
  }
  if (gold && owner >= 0) { const p = w.players[owner]; p.gold = Math.min(GOLD_MAX, p.gold + gold); emit(w, 'gold', { id: owner, n: gold, x, y }); }
  return gold;
}
export function rayFree(w, x0, y0, x1, y1) {           // linea de vista sin celdas solidas (para la IA)
  const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(dhypot(dx, dy) / 6);
  for (let i = 1; i < n; i++) if (cellAt(w, Math.floor((x0 + dx * i / n) / CS), Math.floor((y0 + dy * i / n) / CS)) !== AIR) return false;
  return true;
}

/* --------------------------------------------------------------- movimiento */
function moveX(w, b, dx) {
  if (!dx) return false;
  b.x += dx;
  const hw = b.w / 2;
  if (!overlaps(w, b.x - hw, b.y - b.h, b.x + hw, b.y)) return false;
  if (b.onGround) {                                     // escalon: sube hasta STEP_MAX si hay lugar
    for (let up = 2; up <= STEP_MAX; up += 2) if (!overlaps(w, b.x - hw, b.y - b.h - up, b.x + hw, b.y - up)) { b.y -= up; return false; }
  }
  const y0 = Math.floor((b.y - b.h + .001) / CS), y1 = Math.floor((b.y - .001) / CS), x0 = Math.floor((b.x - hw) / CS), x1 = Math.floor((b.x + hw - .001) / CS);
  let lim = null;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    if (cellAt(w, cx, cy) === AIR) continue;
    const l = dx > 0 ? cx * CS - hw : (cx + 1) * CS + hw;
    if (lim === null || (dx > 0 ? l < lim : l > lim)) lim = l;
  }
  if (lim !== null) { b.x = lim; return true; }
  return false;
}
function moveY(w, b, dy) {
  if (!dy) return null;
  const prevBottom = b.y;
  b.y += dy;
  const hw = b.w / 2, x0 = Math.floor((b.x - hw + .001) / CS), x1 = Math.floor((b.x + hw - .001) / CS);
  const y0 = Math.floor((b.y - b.h + .001) / CS), y1 = Math.floor((b.y - .001) / CS);
  if (dy > 0) {
    let best = null;
    for (let cy = y0; cy <= y1 + 1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const top = cy * CS;
      if (b.y >= top && top >= prevBottom - .01 && cellAt(w, cx, cy) !== AIR && (best === null || top < best)) best = top;
    }
    if (best !== null) { b.y = best; b.vy = 0; b.onGround = true; return 'land'; }
    b.onGround = false; return null;
  }
  let lim = null;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (cellAt(w, cx, cy) !== AIR) { const l = (cy + 1) * CS + b.h; if (lim === null || l > lim) lim = l; }
  if (lim !== null) { b.y = lim; if (b.vy < 0) b.vy = 0; return 'bump'; }
  return null;
}
const canStand = (w, p) => !overlaps(w, p.x - p.w / 2, p.y - PH, p.x + p.w / 2, p.y - p.h);

function movePlayer(w, p, mask, dt) {
  const left = mask & L, right = mask & R, jump = mask & J, down = mask & D;
  if (down && p.onGround) p.crouch = true; else if (p.crouch && canStand(w, p)) p.crouch = false;
  p.h = p.crouch ? PH_CROUCH : PH;
  const ax = (right ? 1 : 0) - (left ? 1 : 0);
  p.vx += (ax * RUN * (p.crouch ? .5 : 1) - p.vx) * Math.min(1, (p.onGround ? 18 : 6) * dt);
  if (!ax && p.onGround && Math.abs(p.vx) < 5) p.vx = 0;
  const jp = !!(mask & J) && !(p.prev & J);
  if (jp) p.buf = .12;
  if (p.onGround) { p.coyote = .09; p.fuel = Math.min(FUEL_MAX, p.fuel + FUEL_REGEN * dt); }
  p.coyote -= dt; p.buf -= dt;
  if (p.buf > 0 && p.coyote > 0 && !p.crouch) { p.vy = -JUMP; p.onGround = false; p.coyote = 0; p.buf = 0; p.holdT = 0; p.jumping = true; emit(w, 'jump', { id: p.id }); }
  if (!jump && p.jumping && p.vy < -260 && !p.flying) p.vy = -260;
  if (p.vy >= 0) p.jumping = false;
  const hold = jump && !p.crouch;
  p.holdT = hold ? p.holdT + dt : 0;
  p.flying = false;
  if (!p.onGround && hold && p.holdT > .2 && p.fuel > 0) { p.vy = Math.max(p.vy - FLY_ACC * dt, -FLY_MAX); p.fuel -= FUEL_DRAIN * dt; p.flying = true; p.jumping = false; }
  p.vy = Math.min(p.vy + G * dt, MAXV);
  if (moveX(w, p, p.vx * dt)) p.vx = 0;
  const r = moveY(w, p, p.vy * dt);
  if (r === 'land') { if (p.vy > 300) emit(w, 'land', { id: p.id }); } else p.onGround = false;
  // techo: si quedo encajado dentro de celdas (por una construccion) lo sacamos hacia arriba
  if (overlaps(w, p.x - p.w / 2, p.y - p.h, p.x + p.w / 2, p.y)) { for (let up = 2; up <= 24; up += 2) if (!overlaps(w, p.x - p.w / 2, p.y - p.h - up, p.x + p.w / 2, p.y - up)) { p.y -= up; break; } }
}

/* ------------------------------------------------------------------- combate */
export function damage(w, p, amt, from, kx = 0, ky = 0) {
  if (!p.alive || amt <= 0) return;
  p.hp -= amt; p.flash = 6; p.vx += kx; p.vy += ky; p.lastHit = from;
  emit(w, 'hurt', { id: p.id, amt });
  if (p.hp <= 0) { p.hp = 0; p.alive = false; emit(w, 'kill', { id: p.id, by: from, x: p.x, y: p.y - 20 }); }
}
function explode(w, x, y, R, dmg, owner) {
  carve(w, x, y, R, owner);
  emit(w, 'boom', { x, y, r: R });
  const R2 = R * 1.5;
  for (const p of w.players) {
    if (!p.alive) continue;
    const cx = p.x, cy = p.y - p.h / 2, d = dhypot(cx - x, cy - y);
    if (d >= R2) continue;
    const k = 1 - d / R2, ux = d > 0 ? (cx - x) / d : 0, uy = d > 0 ? (cy - y) / d : -1;
    damage(w, p, Math.round(dmg * k * (p.id === owner ? .5 : 1)), owner, ux * 480 * k, uy * 480 * k - 80 * k);
  }
}
function fire(w, p) {
  const wp = WEAPONS[p.sel];
  if (p.cdFire > 0) return;
  if (wp.ammo >= 0) { if (p.ammo[p.sel] <= 0) { p.cdFire = 12; emit(w, 'empty', { id: p.id }); return; } p.ammo[p.sel]--; }
  p.cdFire = wp.cd;
  const sy = p.y + (p.crouch ? -14 : -22), a = AIM[p.aim], mx = p.x + a.x * 20, my = sy + a.y * 20;
  emit(w, 'shoot', { id: p.id, w: p.sel });
  if (wp.beam) {                                       // laser: atraviesa el terreno y da dano a quien cruza
    let hitP = null, ex = mx, ey = my;
    for (let d = 0; d <= wp.beam; d += 6) {
      ex = mx + a.x * d; ey = my + a.y * d;
      if (ex < 8 || ex > COLS * CS - 8 || ey < 8 || ey > ROWS * CS - 8) break;
      carve(w, ex, ey, 9, p.id);
      for (const q of w.players) if (q !== p && q.alive && !hitP && ex > q.x - q.w / 2 - 4 && ex < q.x + q.w / 2 + 4 && ey > q.y - q.h - 4 && ey < q.y + 4) hitP = q;
    }
    w.beams.push({ x0: mx, y0: my, x1: ex, y1: ey, ttl: 10, owner: p.id });
    if (hitP) damage(w, hitP, wp.dmg, p.id, a.x * 260, a.y * 260 - 60);
    p.vx -= a.x * 90; return;
  }
  for (let i = 0; i < wp.pellets; i++) {
    let idx = p.aim;
    if (wp.spread) idx = (p.aim + Math.floor(w.rng() * (wp.spread * 2 + 1)) - wp.spread + 64) & 63;
    const d = AIM[idx];
    w.proj.push({ kind: p.sel === 2 ? 'rocket' : 'bullet', x: mx, y: my, vx: d.x * wp.speed, vy: d.y * wp.speed, life: wp.life, owner: p.id, dmg: wp.dmg });
  }
  p.vx -= a.x * (p.sel === 1 ? 120 : p.sel === 2 ? 60 : 12);
}
function dig(w, p) {
  if (p.cdDig > 0) return;
  p.cdDig = 10; p.digAnim = 8;
  const a = AIM[p.aim], x = p.x + a.x * 26, y = p.y - 22 + a.y * 26;
  carve(w, x, y, 17, p.id);
  emit(w, 'dig', { id: p.id, x, y });
  const q = w.players[1 - p.id];
  if (q.alive && dhypot(q.x - x, q.y - q.h / 2 - y) < 30) damage(w, q, 9, p.id, a.x * 120, a.y * 60);
}
function build(w, p) {
  if (p.cdBuild > 0 || p.gold < BUILD_COST) return;
  const a = AIM[p.aim], cx = Math.floor((p.x + a.x * 72) / CS), cy = Math.floor((p.y - 22 + a.y * 72) / CS);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (cx + dx < 3 || cx + dx >= COLS - 3 || cy + dy < 3 || cy + dy >= ROWS - 3) return;
    for (const q of w.players) if (q.alive && overlapsRectCell(q, cx + dx, cy + dy)) return;
  }
  let placed = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (cellAt(w, cx + dx, cy + dy) === AIR) { setCell(w, cx + dx, cy + dy, BUILT); placed++; }
  if (!placed) return;
  p.gold -= BUILD_COST; p.cdBuild = 14; emit(w, 'build', { id: p.id });
}
const overlapsRectCell = (q, cx, cy) => q.x + q.w / 2 > cx * CS && q.x - q.w / 2 < (cx + 1) * CS && q.y > cy * CS && q.y - q.h < (cy + 1) * CS;

function buy(w, p, code) {
  let item = code === 1 ? 'heal' : code === 2 ? 'fuel' : 'ammo';
  if (item === 'ammo' && (WEAPONS[p.sel].ammo < 0 || p.ammo[p.sel] >= WEAPONS[p.sel].max)) return;
  if (item === 'heal' && p.hp >= HP_MAX) return;
  if (item === 'fuel' && p.fuel >= FUEL_MAX - 5) return;
  const price = priceOf(w, item, p.sel);
  if (p.gold < price) { emit(w, 'poor', { id: p.id }); return; }
  p.gold -= price;
  if (item === 'heal') { p.hp = Math.min(HP_MAX, p.hp + 40); w.market.heal++; }
  else if (item === 'fuel') { p.fuel = FUEL_MAX; w.market.fuel++; }
  else { p.ammo[p.sel] = Math.min(WEAPONS[p.sel].max, p.ammo[p.sel] + WEAPONS[p.sel].per); w.market['ammo' + p.sel]++; }
  emit(w, 'buy', { id: p.id, item, price });
}

function applyInput(w, p, mask) {
  p.aim = inAim(mask); p.face = AIM[p.aim].x >= 0 ? 1 : -1;
  const sel = inSel(mask); if (sel >= 1 && sel <= 4) p.sel = sel - 1;
  if (p.cdFire > 0) p.cdFire--; if (p.cdDig > 0) p.cdDig--; if (p.cdBuild > 0) p.cdBuild--; if (p.digAnim > 0) p.digAnim--; if (p.flash > 0) p.flash--;
  const b = inBuy(mask); if (b) buy(w, p, b);
  if ((mask & FIRE)) fire(w, p);
  if ((mask & DIG)) dig(w, p);
  if ((mask & BUILD) && !(p.prev & BUILD)) build(w, p);
}

function stepProjectiles(w, dt) {
  for (const b of w.proj) {
    if (b.kind === 'rocket') b.vy += G * .12 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.life--;
    if (b.life <= 0) { b.dead = true; if (b.kind === 'rocket') explode(w, b.x, b.y, 40, 45, b.owner); continue; }
    const cx = Math.floor(b.x / CS), cy = Math.floor(b.y / CS);
    if (cellAt(w, cx, cy) !== AIR) {
      b.dead = true;
      if (b.kind === 'rocket') explode(w, b.x, b.y, 40, 45, b.owner);
      else { emit(w, 'impact', { x: b.x, y: b.y }); if (cellAt(w, cx, cy) !== ROCK && b.dmg >= 10) { /* la pistola no rompe tierra */ } }
      continue;
    }
    for (const p of w.players) {
      if (!p.alive || (p.id === b.owner && b.kind === 'bullet')) continue;
      if (b.x > p.x - p.w / 2 - 2 && b.x < p.x + p.w / 2 + 2 && b.y > p.y - p.h - 2 && b.y < p.y + 2) {
        b.dead = true;
        if (b.kind === 'rocket') explode(w, b.x, b.y, 40, 45, b.owner);
        else damage(w, p, b.dmg, b.owner, Math.sign(b.vx) * 90, -30);
        break;
      }
    }
  }
  if (w.proj.some(b => b.dead)) w.proj = w.proj.filter(b => !b.dead);
}

/* ------------------------------------------------------------------- drops */
const LOOT = ['shotgun', 'bazooka', 'laser', 'medkit', 'gold'];
function spawnDrop(w) {
  const kind = LOOT[Math.floor(w.rng() * LOOT.length)], x = Math.floor(30 + w.rng() * (COLS - 60)) * CS;
  w.drops.push({ kind, x, y: 8 * CS, vy: 0, landed: false, w: 24, h: 24 });
  emit(w, 'drop', { kind });
}
function stepDrops(w, dt) {
  for (const d of w.drops) {
    if (!d.landed) {
      d.vy = Math.min(d.vy + G * .2 * dt, 90); d.y += d.vy * dt;
      if (overlaps(w, d.x - 10, d.y - 24, d.x + 10, d.y)) { for (let up = 0; up < 400 && overlaps(w, d.x - 10, d.y - 24 - up, d.x + 10, d.y - up); up += 2) d.y -= 2; d.landed = true; }
    }
    for (const p of w.players) {
      if (!p.alive || d.taken) continue;
      if (Math.abs(p.x - d.x) < 20 && p.y > d.y - 24 && p.y - p.h < d.y) {
        d.taken = true;
        if (d.kind === 'medkit') p.hp = Math.min(HP_MAX, p.hp + 50);
        else if (d.kind === 'gold') p.gold = Math.min(GOLD_MAX, p.gold + 5);
        else { const i = d.kind === 'shotgun' ? 1 : d.kind === 'bazooka' ? 2 : 3; p.ammo[i] = Math.min(WEAPONS[i].max, p.ammo[i] + WEAPONS[i].per); }
        emit(w, 'pickup', { id: p.id, kind: d.kind });
      }
    }
  }
  if (w.drops.some(d => d.taken)) w.drops = w.drops.filter(d => !d.taken);
}

/* ------------------------------------------------------------------- paso */
// masks: [entrada del jugador 0, entrada del jugador 1]
export function stepTick(w, masks) {
  w.tick++;
  if (w.phase === 'countdown') { if (--w.phaseT <= 0) { w.phase = 'play'; emit(w, 'go'); } return; }
  if (w.phase === 'over') {
    for (const b of w.beams) b.ttl--; w.beams = w.beams.filter(b => b.ttl > 0);
    if (--w.phaseT <= 0) {
      if (w.matchWinner >= 0) { w.phase = 'matchover'; emit(w, 'matchover', { winner: w.matchWinner }); }
      else startRound(w);
    }
    return;
  }
  if (w.phase !== 'play') return;
  w.roundTick++;
  for (const b of w.beams) b.ttl--; if (w.beams.length) w.beams = w.beams.filter(b => b.ttl > 0);
  for (const p of w.players) if (p.alive) { p.t += 1 / TICK_HZ; applyInput(w, p, masks[p.id] | 0); }
  if (w.roundTick >= w.nextDrop) { spawnDrop(w); w.nextDrop += DROP_EVERY; }
  if (w.roundTick > LAVA_START) w.lavaY = ROWS * CS - (w.roundTick - LAVA_START) * LAVA_RATE / TICK_HZ;
  for (let s = 0; s < 2; s++) {
    for (const p of w.players) if (p.alive) movePlayer(w, p, masks[p.id] | 0, DT);
    stepProjectiles(w, DT);
    stepDrops(w, DT);
  }
  for (const p of w.players) if (p.alive) {
    p.prev = masks[p.id] | 0;
    if (p.y > w.lavaY + 2) { p.hp = 0; p.alive = false; p.lastHit = -1; emit(w, 'kill', { id: p.id, by: -1, x: p.x, y: p.y - 20, lava: true }); }
  }
  // fin de ronda
  const a0 = w.players[0].alive, a1 = w.players[1].alive;
  if (!a0 || !a1) {
    w.winner = !a0 && !a1 ? -1 : a0 ? 0 : 1;
    if (w.winner >= 0) { w.scores[w.winner]++; if (w.scores[w.winner] >= w.winRounds) w.matchWinner = w.winner; }
    w.phase = 'over'; w.phaseT = OVER_TICKS; emit(w, 'roundover', { winner: w.winner });
  }
}

// Resumen del estado para detectar desincronizacion entre dos maquinas.
export function stateHash(w) {
  let h = 2166136261 >>> 0;
  const mix = v => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
  mix(w.tick); mix(w.round); mix(w.phase.length); mix(w.cellSum); mix(w.rng.state());
  for (const p of w.players) { mix(Math.round(p.x * 64)); mix(Math.round(p.y * 64)); mix(Math.round(p.vx * 16)); mix(Math.round(p.vy * 16)); mix(p.hp); mix(p.gold); mix(Math.round(p.fuel * 16)); for (const a of p.ammo) mix(a); }
  mix(w.proj.length); mix(w.drops.length); mix(w.scores[0] * 10 + w.scores[1]);
  return h;
}
