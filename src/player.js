// El jugador: spawn, disparo, granada y dibujo. La fisica de movimiento en
// si (gravedad, colision con plataformas) vive en physics.js y se aplica
// desde el bucle principal en main.js, que es quien conoce ax/hold/etc.
import { STAND_H, SPR_SCALE, JETPACK_BACK, SMOKE_EVERY, SMOKE_LIFE } from './config.js';
import { WEAPONS, hasAmmo, dmgMult } from './weapons.js';
import { S, state, ctx } from './state.js';
import { playSfx } from './audio.js';
import { okSpr, drawSpr, drawStick, drawArm, drawGun, SHOULDER_STAND_Y, SHOULDER_CROUCH_Y } from './sprites.js';
import { burst } from './main.js';
import { toast } from './ui.js';

const PLAYER_COL = '#ff7a3d';

export function spawnPlayer() {
  const L = state.L;
  state.p = {
    x: L.spawn.x, y: L.spawn.y - 2, vx: 0, vy: 0, w: 16, h: STAND_H, onGround: false, drop: 0, hp: 100, fuel: 100, inv: 2,
    holdT: 0, smokeT: 0, spin: 0, flipping: false, flying: false, face: 1, aim: 0, t: 0, usedFlip: false, crouch: false
  };
}

function shoulderY(p) { return p.crouch ? SHOULDER_CROUCH_Y : SHOULDER_STAND_Y; }

/* ------------------------------------------------------------------ jetpack */
// Cadera sobre los pies (los mismos valores que usa el placeholder del cuerpo).
const HIP_STAND_Y = -14, HIP_CROUCH_Y = -9;
// Pixel de la tobera en jetpack.png (16x16): (8, 15).
const NOZZLE_X = 8, NOZZLE_Y = 15, JP_SIZE = 16;

// Posicion (sin la rotacion del giro) del centro de la mochila, que va en la
// espalda a media altura entre cadera y hombro, y de su tobera.
function jetpackPose(p) {
  const hipY = p.crouch ? HIP_CROUCH_Y : HIP_STAND_Y;
  const cx = p.x - p.face * JETPACK_BACK, cy = p.y + (hipY + shoulderY(p)) / 2;
  return { cx, cy, nx: cx + (NOZZLE_X - JP_SIZE / 2) * SPR_SCALE * p.face, ny: cy + (NOZZLE_Y - JP_SIZE / 2) * SPR_SCALE };
}

// Mismo giro (voltereta) que se le aplica al sprite del cuerpo.
function spinPoint(p, x, y) {
  if (!p.spin) return { x, y };
  const a = p.spin * p.face, c = Math.cos(a), s = Math.sin(a), px = p.x, py = p.y - 20, dx = x - px, dy = y - py;
  return { x: px + dx * c - dy * s, y: py + dx * s + dy * c };
}

// La mochila se dibuja siempre ANTES que el cuerpo (detras del torso); la
// llama, si esta volando, sale de la tobera y tambien queda detras.
function drawJetpack(p) {
  if (!okSpr('jetpack')) return;
  const { cx, cy, nx, ny } = jetpackPose(p);
  ctx.save();
  if (p.spin) { ctx.translate(p.x, p.y - 20); ctx.rotate(p.spin * p.face); ctx.translate(-p.x, -(p.y - 20)); }
  if (p.flying && okSpr('jetFlame')) drawSpr('jetFlame', p.t, nx, ny, false, 0, .5, 0);
  drawSpr('jetpack', 0, cx, cy, p.face < 0, 0, .5, .5);
  ctx.restore();
}

// Una bocanada de humo cada SMOKE_EVERY s desde la tobera mientras vuela:
// cae con deriva horizontal al azar y se elimina al terminar sus frames.
export function updateJetSmoke(dt) {
  const p = state.p;
  if (p.flying && okSpr('jetSmoke') && okSpr('jetpack')) {
    p.smokeT -= dt;
    const { nx, ny } = jetpackPose(p), n = spinPoint(p, nx, ny);
    while (p.smokeT <= 0) {
      p.smokeT += SMOKE_EVERY;
      state.smoke.push({ x: n.x + (Math.random() - .5) * 4, y: n.y, vx: (Math.random() - .5) * 70, vy: 30 + Math.random() * 30, t: 0 });
    }
  } else p.smokeT = 0;
  for (const s of state.smoke) { s.t += dt; s.vy += 160 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
  state.smoke = state.smoke.filter(s => s.t < SMOKE_LIFE);
}

export function drawSmoke() {
  for (const s of state.smoke) drawSpr('jetSmoke', s.t, s.x, s.y, false, 0, .5, .5, false);
}

export function fire() {
  const p = state.p, w = WEAPONS[S.wi];
  if (!hasAmmo(S.wi)) {
    // sin balas: clic seco y vuelve a la pistola (que es infinita)
    S.cool = .3; S.wi = 0; toast('Sin munición: ' + w.name); playSfx('empty', 120, .04, 'square', .03, 0);
    return;
  }
  S.cool = w.rate;
  if (w.ammo) S.ammo[S.wi]--;
  const mult = dmgMult(), wi = S.wi;
  const ox = p.x, oy = p.y + shoulderY(p), a0 = p.aim;
  for (let i = 0; i < w.pellets; i++) {
    const a = a0 + (Math.random() - .5) * w.spread * 2;
    state.bullets.push({ x: ox + Math.cos(a0) * 20, y: oy + Math.sin(a0) * 20, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 1.1, dmg: w.dmg * mult, pierce: w.pierce, own: 'p', wi });
  }
  p.vx -= Math.cos(a0) * w.kick;
  burst(ox + Math.cos(a0) * 22, oy + Math.sin(a0) * 22, 2, '#ffd166', 120, 0);
  playSfx('shoot_' + w.name.toLowerCase(), w.snd[0], w.snd[1], 'square', .04, -200);
}

export function throwGrenade() {
  S.gcool = 1.2;
  const p = state.p, a = p.aim, sp = 620;
  state.grenades.push({ x: p.x, y: p.y + shoulderY(p), vx: Math.cos(a) * sp + p.vx * .4, vy: Math.sin(a) * sp - 120, w: 6, h: 6, t: 0, drop: 0, onGround: false, mult: dmgMult() });
  playSfx('grenade_throw', 300, .1, 'triangle', .04, 200);
}

export function drawPlayer() {
  const p = state.p;
  if (p.inv > 0 && Math.floor(p.inv * 12) % 2) return;
  const air = !p.onGround, moving = Math.abs(p.vx) > 20;
  let name, fallbacks;
  if (air) { name = p.flying && okSpr('playerFly') ? 'playerFly' : 'playerJump'; fallbacks = ['playerJump', 'playerFly', 'playerIdle', 'playerRun']; }
  else if (p.crouch) { name = moving ? 'playerCrouchWalk' : 'playerCrouch'; fallbacks = ['playerCrouch', 'playerCrouchWalk', 'playerIdle', 'playerRun']; }
  else { name = moving ? 'playerRun' : 'playerIdle'; fallbacks = ['playerIdle', 'playerRun', 'playerJump', 'playerFly']; }
  const sn = okSpr(name) ? name : fallbacks.find(okSpr);
  drawJetpack(p);
  if (sn) {
    ctx.save();
    if (p.spin) { ctx.translate(p.x, p.y - 20); ctx.rotate(p.spin * p.face); ctx.translate(-p.x, -(p.y - 20)); }
    drawSpr(sn, p.t, p.x, p.y, p.face < 0, 0, .5, 1);
    ctx.restore();
  } else drawStick(p.x, p.y, { face: p.face, col: PLAYER_COL, t: p.t, moving, air, spin: p.spin, crouch: p.crouch });
  // el brazo y el arma van siempre aparte del cuerpo (sprite real o
  // placeholder), pegados al hombro y rotando hacia la mira.
  const sx = p.x, sy = p.y + shoulderY(p);
  drawArm(sx, sy, p.aim, PLAYER_COL);
  drawGun(S.wi, sx + Math.cos(p.aim) * 16, sy + Math.sin(p.aim) * 16, p.aim, PLAYER_COL);
}
