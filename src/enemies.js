// Enemigos: aparicion, IA de persecucion/disparo, dibujo y daño recibido.
import { RS, JUMP } from './config.js';
import { S, state, ctx } from './state.js';
import { playSfx } from './audio.js';
import { okSpr, drawSpr, drawStick, drawGun } from './sprites.js';
import { physics } from './physics.js';
import { burst, hurt } from './main.js';

export function spawnEnemy() {
  const p = state.p, L = state.L;
  const want = Math.min(3 + S.clicks * 2, 14);
  if (state.enemies.length >= want) return;
  for (const minD of [340, 200]) {
    for (let k = 0; k < 14; k++) {
      const y0 = p.y + (Math.random() * 700 - 450);
      const arr = L.top.get(Math.floor(y0 / RS));
      if (!arr) continue;
      const pl = arr[Math.floor(Math.random() * arr.length)];
      const cx = pl.x + pl.w / 2;
      if (!pl.alive || Math.abs(cx - p.x) < minD || Math.abs(cx - p.x) > 900) continue;
      const gun = Math.random() < Math.min(.1 + S.clicks * .1, .5);
      state.enemies.push({
        x: cx, y: pl.y - 1, vx: 0, vy: 0, w: 16, h: 40, hp: gun ? 2.5 : 3, type: gun ? 'gunner' : 'grunt',
        speed: 85 + Math.min(S.clicks, 8) * 6 + Math.random() * 25, face: 1, t: Math.random() * 5, onGround: false, drop: 0,
        jumpCd: Math.random(), cd: 1 + Math.random(), far: 0, flash: 0, dead: false
      });
      burst(cx, pl.y - 20, 8, '#c0392b', 140, 60);
      return;
    }
  }
}

export function updateEnemy(e, dt) {
  const p = state.p;
  const dx = p.x - e.x, dy = p.y - e.y, dir = Math.sign(dx) || 1;
  e.face = dir; e.t += dt; e.flash -= dt;
  if (e.type === 'gunner') {
    const d = Math.abs(dx);
    e.vx = (d > 380 ? dir : d < 220 ? -dir : 0) * e.speed;
    e.cd -= dt;
    if (e.cd <= 0 && d < 640 && Math.abs(dy) < 280) {
      e.cd = 1.4 + Math.random() * .8;
      const a = Math.atan2((p.y - 22) - (e.y - 26), dx) + (Math.random() - .5) * .18;
      state.bullets.push({ x: e.x + Math.cos(a) * 16, y: e.y - 26 + Math.sin(a) * 16, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 1.6, dmg: 12, pierce: 1, own: 'e' });
      playSfx('enemy_shoot', 240, .08, 'square', .025, -100);
    }
  } else e.vx = dir * e.speed;
  if (e.onGround) {
    e.jumpCd -= dt;
    if (e.jumpCd <= 0) {
      if (dy < -40) { e.vy = -JUMP * .95; e.jumpCd = .7 + Math.random() * .5; }
      else if (dy > 60 && Math.abs(dx) < 140) { e.drop = .3; e.jumpCd = .6; }
    }
  }
  physics(e, dt);
  if (dy < -340 || Math.abs(dx) > 1100) e.far += dt; else e.far = 0;
  if (e.far > 3) e.dead = true, e.silent = true;
  if (p.inv <= 0 && Math.abs(e.x - p.x) < (e.w + p.w) / 2 && p.y > e.y - e.h && p.y - p.h < e.y) hurt(18, Math.sign(p.x - e.x || 1) * 320);
}

export function hitEnemy(e, d, dir) {
  e.hp -= d; e.flash = .1; e.vx += dir * 90;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true; S.kills++;
    burst(e.x, e.y - 20, 22, '#c0392b', 260, 120);
    state.fx.push({ type: 'die', x: e.x, y: e.y, t: 0, face: e.face });
    playSfx('enemy_die', 140, .18, 'sawtooth', .05, -80);
  }
}

export function drawEnemy(e) {
  const p = state.p;
  const air = !e.onGround, moving = Math.abs(e.vx) > 10;
  const sn = e.type === 'gunner' && okSpr('enemyGunner') ? 'enemyGunner' : okSpr('enemyRun') ? 'enemyRun' : null;
  if (e.flash > 0) ctx.globalAlpha = .55;
  if (sn) drawSpr(sn, e.t, e.x, e.y, e.face < 0, 0, .5, 1);
  else {
    drawStick(e.x, e.y, { face: e.face, col: e.type === 'gunner' ? '#8e2bb0' : '#c0392b', t: e.t, moving, air });
    if (e.type === 'gunner') {
      const a = Math.atan2((p.y - 22) - (e.y - 26), p.x - e.x);
      ctx.strokeStyle = '#8e2bb0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 26); ctx.lineTo(e.x + Math.cos(a) * 9, e.y - 26 + Math.sin(a) * 9); ctx.stroke();
      drawGun(0, e.x, e.y - 26, a, '#8e2bb0');
    }
  }
  ctx.globalAlpha = 1;
}
