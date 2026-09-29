// Carga de sprites con fallback a placeholders dibujados por codigo, igual
// que en la version original de un unico archivo.
//
// Cada PNG es una tira horizontal de frames de igual tamaño, mirando a la
// derecha. Si el archivo no existe (ver public/sprites/, y SPRITES.md para
// el detalle de cada uno) se dibuja un placeholder vectorial.
import { SPR_SCALE } from './config.js';
import { ctx } from './state.js';

export const SPRITES = {
  playerIdle: { src: '/sprites/player_idle.png', fw: 32, fh: 32, fps: 4 },
  playerRun: { src: '/sprites/player_run.png', fw: 32, fh: 32, fps: 12 },
  playerJump: { src: '/sprites/player_jump.png', fw: 32, fh: 32, fps: 1 },
  playerFly: { src: '/sprites/player_fly.png', fw: 32, fh: 32, fps: 10 },
  enemyRun: { src: '/sprites/enemy_run.png', fw: 32, fh: 32, fps: 10 },
  enemyGunner: { src: '/sprites/enemy_gunner.png', fw: 32, fh: 32, fps: 10 },
  enemyDie: { src: '/sprites/enemy_die.png', fw: 32, fh: 32, fps: 14 },
  gunPistol: { src: '/sprites/gun_pistol.png', fw: 16, fh: 16, fps: 1 },
  gunSmg: { src: '/sprites/gun_smg.png', fw: 24, fh: 16, fps: 1 },
  gunShotgun: { src: '/sprites/gun_shotgun.png', fw: 28, fh: 16, fps: 1 },
  bullet: { src: '/sprites/bullet.png', fw: 8, fh: 8, fps: 1 },
  grenade: { src: '/sprites/grenade.png', fw: 8, fh: 8, fps: 1 },
  explosion: { src: '/sprites/explosion.png', fw: 64, fh: 64, fps: 20 },
  heart: { src: '/sprites/heart.png', fw: 8, fh: 8, fps: 1 }
};
for (const k in SPRITES) {
  const d = SPRITES[k]; d.ok = false; d.img = new Image();
  d.img.onload = () => { d.ok = d.img.naturalWidth > 0; };
  d.img.onerror = () => { d.ok = false; };
  d.img.src = d.src;
}

export function okSpr(n) { return SPRITES[n] && SPRITES[n].ok; }

export function drawSpr(name, t, cx, by, flip, ang, ax, ay, loop) {
  const d = SPRITES[name];
  const n = Math.max(1, Math.floor(d.img.naturalWidth / d.fw));
  const f = loop === false ? Math.min(n - 1, Math.floor(t * d.fps)) : Math.floor(t * d.fps) % n;
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(by));
  if (ang) ctx.rotate(ang);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(d.img, f * d.fw, 0, d.fw, d.fh, -d.fw * SPR_SCALE * ax, -d.fh * SPR_SCALE * ay, d.fw * SPR_SCALE, d.fh * SPR_SCALE);
  ctx.restore();
}

// Placeholder vectorial de un stickman, usado para el jugador y los
// enemigos cuando no hay sprite disponible.
export function drawStick(x, y, o) {
  const c = ctx;
  c.save(); c.translate(Math.round(x), Math.round(y));
  if (o.spin) { c.translate(0, -20); c.rotate(o.spin * o.face); c.translate(0, 20); }
  c.strokeStyle = o.col; c.lineWidth = 3; c.lineCap = 'square';
  const sw = o.moving && !o.air ? Math.sin(o.t * 16) * 9 : 0;
  c.beginPath();
  if (o.air) { c.moveTo(0, -16); c.lineTo(-6, -4); c.moveTo(0, -16); c.lineTo(7, -6); }
  else { c.moveTo(0, -16); c.lineTo(sw, 0); c.moveTo(0, -16); c.lineTo(-sw, 0); }
  c.moveTo(0, -16); c.lineTo(0, -28);
  c.moveTo(0, -26); c.lineTo(-o.face * 6, -17 + (o.moving ? Math.sin(o.t * 16) * 3 : 0));
  c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -34, 6, 0, 6.283); c.fill(); c.stroke();
  c.restore();
}

export function drawGun(name, x, y, a, col) {
  const spriteName = name === 0 ? 'gunPistol' : name === 1 ? 'gunSmg' : 'gunShotgun';
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a);
  if (Math.cos(a) < 0) ctx.scale(1, -1);
  if (okSpr(spriteName)) {
    const d = SPRITES[spriteName];
    ctx.drawImage(d.img, 0, 0, d.fw, d.fh, -d.fw * SPR_SCALE * .2, -d.fh * SPR_SCALE * .5, d.fw * SPR_SCALE, d.fh * SPR_SCALE);
  } else {
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.fillStyle = '#272727';
    const len = name === 0 ? 12 : name === 1 ? 18 : 22;
    ctx.fillRect(6, -3, len, 5);
  }
  ctx.restore();
}

export function drawHeart(x, y, s) {
  if (okSpr('heart')) { const d = SPRITES.heart; ctx.drawImage(d.img, 0, 0, d.fw, d.fh, x, y, d.fw * SPR_SCALE * 1.5, d.fh * SPR_SCALE * 1.5); return; }
  const pat = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  ctx.fillStyle = '#e63946';
  pat.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === '1') ctx.fillRect(x + i * s, y + j * s, s, s); });
}
