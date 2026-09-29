// Enemigos: aparicion, IA de persecucion/disparo, dibujo y daño recibido.
import { RS, JUMP } from './config.js';
import { S, state, ctx } from './state.js';
import { playSfx } from './audio.js';
import { okSpr, drawSpr, drawStick, drawGun, SHOULDER_STAND_Y, CHEST_Y } from './sprites.js';
import { physics } from './physics.js';
import { hueRotate } from './utils.js';
import { burst, hurt } from './main.js';
import { lootAmmo } from './weapons.js';

// Color base por tipo (antes de aplicarle el hue random de cada instancia).
const BASE_COL = { grunt: '#c0392b', gunner: '#8e2bb0', pistolero: '#2b7cb0' };

// Parametros de disparo por tipo de enemigo armado: el gunner (SMG, dispara
// mas fuerte pero mas espaciado y de mas lejos) y el pistolero (pistola,
// tiros mas debiles y seguidos, se acerca mas antes de tirar).
const GUN_STATS = {
  gunner: { keepFar: 380, keepNear: 220, range: 640, cdMin: 1.4, cdVar: .8, bulletSpeed: 520, dmg: 12, pitch: 240, gun: 1 },
  pistolero: { keepFar: 260, keepNear: 140, range: 460, cdMin: .9, cdVar: .5, bulletSpeed: 480, dmg: 8, pitch: 340, gun: 0 }
};

const SIDES = ['left', 'right', 'above', 'below'];

export function spawnEnemy() {
  const p = state.p, L = state.L;
  const want = Math.min(3 + S.clicks * 2, 14);
  if (state.enemies.length >= want) return;
  for (const minD of [340, 200, 0]) {
    for (let k = 0; k < 20; k++) {
      const side = SIDES[Math.floor(Math.random() * SIDES.length)];
      let y0;
      if (side === 'above') y0 = p.y - (150 + Math.random() * 550);
      else if (side === 'below') y0 = p.y + (150 + Math.random() * 550);
      else y0 = p.y + (Math.random() * 560 - 280);
      const arr = L.top.get(Math.floor(y0 / RS));
      if (!arr || !arr.length) continue;
      const pl = arr[Math.floor(Math.random() * arr.length)];
      if (!pl.alive) continue;
      const cx = pl.x + pl.w / 2, dx = cx - p.x;
      if (side === 'left' && dx > -minD) continue;
      if (side === 'right' && dx < minD) continue;
      if ((side === 'above' || side === 'below') && Math.abs(dx) < minD * .5) continue;
      if (Math.abs(dx) > 900) continue;
      const roll = Math.random(), gunChance = Math.min(.1 + S.clicks * .1, .5);
      const type = roll < gunChance * .55 ? 'gunner' : roll < gunChance ? 'pistolero' : 'grunt';
      state.enemies.push({
        x: cx, y: pl.y - 1, vx: 0, vy: 0, w: 16, h: 40, hp: type === 'grunt' ? 3 : 2.5, type,
        speed: 85 + Math.min(S.clicks, 8) * 6 + Math.random() * 25, face: dx < 0 ? -1 : 1, t: Math.random() * 5, onGround: false, drop: 0,
        jumpCd: Math.random(), cd: 1 + Math.random(), far: 0, flash: 0, dead: false,
        hue: Math.random() * 360, stuckT: 0, sampleT: 0, sampleX: cx
      });
      burst(cx, pl.y + CHEST_Y, 8, '#c0392b', 140, 60);
      return;
    }
  }
}

export function updateEnemy(e, dt) {
  const p = state.p;
  const dx = p.x - e.x, dy = p.y - e.y;
  // Umbral (en vez de Math.sign crudo) para que no tiemble/gire de un lado
  // al otro cuando el jugador esta casi arriba/abajo (dx cerca de 0) y por
  // ahi no lo puede alcanzar: solo cambia de frente si se movio en serio.
  if (dx > 10) e.face = 1; else if (dx < -10) e.face = -1;
  e.t += dt; e.flash -= dt;

  const stats = GUN_STATS[e.type];
  let targetVx = 0;
  if (stats) {
    const d = Math.abs(dx);
    targetVx = (d > stats.keepFar ? e.face : d < stats.keepNear ? -e.face : 0) * e.speed;
    e.cd -= dt;
    if (e.cd <= 0 && d < stats.range && Math.abs(dy) < 280) {
      e.cd = stats.cdMin + Math.random() * stats.cdVar;
      const a = Math.atan2((p.y + SHOULDER_STAND_Y) - (e.y + SHOULDER_STAND_Y), dx) + (Math.random() - .5) * .18;
      state.bullets.push({ x: e.x + Math.cos(a) * 16, y: e.y + SHOULDER_STAND_Y + Math.sin(a) * 16, vx: Math.cos(a) * stats.bulletSpeed, vy: Math.sin(a) * stats.bulletSpeed, life: 1.6, dmg: stats.dmg, pierce: 1, own: 'e' });
      playSfx('enemy_shoot', stats.pitch, .08, 'square', .025, -100);
    }
  } else targetVx = Math.abs(dx) > 14 ? e.face * e.speed : 0;

  // aceleracion suave (no un salto brusco de velocidad): la persecucion se
  // ve mas natural y de paso amortigua cualquier micro-oscilacion de targetVx.
  e.vx += (targetVx - e.vx) * Math.min(1, (e.onGround ? 10 : 4) * dt);

  // deteccion de atascado: si viene intentando moverse en serio y hace un
  // rato que casi no avanzo (bloqueado contra algo), intenta saltar para
  // desatascarse en vez de quedar empujando para siempre contra el obstaculo.
  e.sampleT += dt;
  if (e.sampleT > .4) {
    const moved = Math.abs(e.x - e.sampleX);
    if (e.onGround && Math.abs(targetVx) > 20 && moved < 6) e.stuckT += e.sampleT; else e.stuckT = 0;
    e.sampleX = e.x; e.sampleT = 0;
  }

  if (e.onGround) {
    e.jumpCd -= dt;
    if (e.jumpCd <= 0) {
      if (dy < -40) { e.vy = -JUMP * .95; e.jumpCd = .7 + Math.random() * .5; }
      else if (dy > 60 && Math.abs(dx) < 140) { e.drop = .3; e.jumpCd = .6; }
      else if (e.stuckT > .6) { e.vy = -JUMP * .85; e.jumpCd = .8 + Math.random() * .4; e.stuckT = 0; }
    }
  }
  physics(e, dt);
  if (dy < -340 || Math.abs(dx) > 1100) e.far += dt; else e.far = 0;
  if (e.far > 3) e.dead = true, e.silent = true;
  if (p.inv <= 0 && Math.abs(e.x - p.x) < (e.w + p.w) / 2 && p.y > e.y - e.h && p.y - p.h < e.y) hurt(18, Math.sign(p.x - e.x || 1) * 320);
}

// `wi` es el arma que causo el daño (-1 si no fue un disparo del jugador).
export function hitEnemy(e, d, dir, wi) {
  e.hp -= d; e.flash = .1; e.vx += dir * 90;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true; S.kills++;
    if (wi === 0) lootAmmo();
    burst(e.x, e.y + CHEST_Y, 22, '#c0392b', 260, 120);
    state.fx.push({ type: 'die', x: e.x, y: e.y, t: 0, face: e.face, hue: e.hue });
    playSfx('enemy_die', 140, .18, 'sawtooth', .05, -80);
  }
}

function drawAimedGun(e, p, col, gunName) {
  const a = Math.atan2((p.y + SHOULDER_STAND_Y) - (e.y + SHOULDER_STAND_Y), p.x - e.x);
  ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(e.x, e.y + SHOULDER_STAND_Y); ctx.lineTo(e.x + Math.cos(a) * 16, e.y + SHOULDER_STAND_Y + Math.sin(a) * 16); ctx.stroke();
  drawGun(gunName, e.x, e.y + SHOULDER_STAND_Y, a, col);
}

export function drawEnemy(e) {
  const p = state.p;
  const air = !e.onGround, moving = Math.abs(e.vx) > 10;
  const col = hueRotate(BASE_COL[e.type] || BASE_COL.grunt, e.hue);
  const useGunnerArt = e.type === 'gunner' && okSpr('enemyGunner');
  const sn = useGunnerArt ? 'enemyGunner' : okSpr('enemyRun') ? 'enemyRun' : null;
  if (e.flash > 0) ctx.globalAlpha = .55;
  if (sn) {
    drawSpr(sn, e.t, e.x, e.y, e.face < 0, 0, .5, 1, true, e.hue);
  } else drawStick(e.x, e.y, { face: e.face, col, t: e.t, moving, air });
  // el pistolero siempre lleva el arma dibujada aparte (no tiene sprite con
  // arma propia); el gunner solo si esta usando el placeholder sin sprite.
  const stats = GUN_STATS[e.type];
  if (stats && !useGunnerArt) drawAimedGun(e, p, col, stats.gun);
  ctx.globalAlpha = 1;
}
