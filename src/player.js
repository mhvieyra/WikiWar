// El jugador: spawn, disparo, granada y dibujo. La fisica de movimiento en
// si (gravedad, colision con plataformas) vive en physics.js y se aplica
// desde el bucle principal en main.js, que es quien conoce ax/hold/etc.
import { STAND_H } from './config.js';
import { WEAPONS } from './weapons.js';
import { S, state, ctx } from './state.js';
import { playSfx } from './audio.js';
import { okSpr, drawSpr, drawStick, drawArm, drawGun, SHOULDER_STAND_Y, SHOULDER_CROUCH_Y } from './sprites.js';
import { burst } from './main.js';

const PLAYER_COL = '#ff7a3d';

export function spawnPlayer() {
  const L = state.L;
  state.p = {
    x: L.spawn.x, y: L.spawn.y - 2, vx: 0, vy: 0, w: 16, h: STAND_H, onGround: false, drop: 0, hp: 100, fuel: 100, inv: 2,
    holdT: 0, spin: 0, flipping: false, flying: false, face: 1, aim: 0, t: 0, usedFlip: false, crouch: false
  };
}

function shoulderY(p) { return p.crouch ? SHOULDER_CROUCH_Y : SHOULDER_STAND_Y; }

export function fire() {
  const p = state.p, w = WEAPONS[S.wi]; S.cool = w.rate;
  const ox = p.x, oy = p.y + shoulderY(p), a0 = p.aim;
  for (let i = 0; i < w.pellets; i++) {
    const a = a0 + (Math.random() - .5) * w.spread * 2;
    state.bullets.push({ x: ox + Math.cos(a0) * 20, y: oy + Math.sin(a0) * 20, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 1.1, dmg: w.dmg, pierce: w.pierce, own: 'p' });
  }
  p.vx -= Math.cos(a0) * w.kick;
  burst(ox + Math.cos(a0) * 22, oy + Math.sin(a0) * 22, 2, '#ffd166', 120, 0);
  playSfx('shoot_' + w.name.toLowerCase(), w.snd[0], w.snd[1], 'square', .04, -200);
}

export function throwGrenade() {
  S.gcool = 1.2;
  const p = state.p, a = p.aim, sp = 620;
  state.grenades.push({ x: p.x, y: p.y + shoulderY(p), vx: Math.cos(a) * sp + p.vx * .4, vy: Math.sin(a) * sp - 120, w: 6, h: 6, t: 0, drop: 0, onGround: false });
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
