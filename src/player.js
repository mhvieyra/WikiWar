// El jugador: spawn, disparo, granada y dibujo. La fisica de movimiento en
// si (gravedad, colision con plataformas) vive en physics.js y se aplica
// desde el bucle principal en main.js, que es quien conoce ax/hold/etc.
import { WEAPONS } from './weapons.js';
import { S, state, ctx } from './state.js';
import { playSfx } from './audio.js';
import { okSpr, drawSpr, drawStick, drawGun, GUN_Y } from './sprites.js';
import { burst } from './main.js';

export function spawnPlayer() {
  const L = state.L;
  state.p = {
    x: L.spawn.x, y: L.spawn.y - 2, vx: 0, vy: 0, w: 16, h: 40, onGround: false, drop: 0, hp: 100, fuel: 100, inv: 2,
    holdT: 0, spin: 0, flipping: false, flying: false, face: 1, aim: 0, t: 0, usedFlip: false, crouch: false
  };
}

export function fire() {
  const p = state.p, w = WEAPONS[S.wi]; S.cool = w.rate;
  const ox = p.x, oy = p.y + GUN_Y, a0 = p.aim;
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
  state.grenades.push({ x: p.x, y: p.y + GUN_Y, vx: Math.cos(a) * sp + p.vx * .4, vy: Math.sin(a) * sp - 120, w: 6, h: 6, t: 0, drop: 0, onGround: false });
  playSfx('grenade_throw', 300, .1, 'triangle', .04, 200);
}

export function drawPlayer() {
  const p = state.p;
  if (p.inv > 0 && Math.floor(p.inv * 12) % 2) return;
  const air = !p.onGround, moving = Math.abs(p.vx) > 20;
  const name = air ? (p.flying && okSpr('playerFly') ? 'playerFly' : 'playerJump') : moving ? 'playerRun' : 'playerIdle';
  const sn = okSpr(name) ? name : ['playerIdle', 'playerRun', 'playerJump', 'playerFly'].find(okSpr);
  if (sn) {
    ctx.save();
    if (p.spin) { ctx.translate(p.x, p.y - 20); ctx.rotate(p.spin * p.face); ctx.translate(-p.x, -(p.y - 20)); }
    drawSpr(sn, p.t, p.x, p.y, p.face < 0, 0, .5, 1);
    ctx.restore();
  } else drawStick(p.x, p.y, { face: p.face, col: '#111', t: p.t, moving, air, spin: p.spin, crouch: p.crouch });
  ctx.strokeStyle = '#111'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  if (!okSpr(sn || '')) { ctx.beginPath(); ctx.moveTo(p.x, p.y + GUN_Y); ctx.lineTo(p.x + Math.cos(p.aim) * 16, p.y + GUN_Y + Math.sin(p.aim) * 16); ctx.stroke(); }
  drawGun(S.wi, p.x, p.y + GUN_Y, p.aim, '#111');
}
