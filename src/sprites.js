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

// Escala del placeholder vectorial: todas las medidas de drawStick estan
// pensadas en una unidad "chica" y esta transformacion las agranda, asi que
// GUN_Y (mas abajo) es el unico numero que hay que mantener sincronizado
// con el hombro (shY) para que el arma no quede flotando lejos de la mano.
export const STICK_SCALE = 2;
const SHOULDER_LOCAL_Y = -29;
export const GUN_Y = SHOULDER_LOCAL_Y * STICK_SCALE;
export const CHEST_Y = (-16 + SHOULDER_LOCAL_Y) / 2 * STICK_SCALE;

// Color del contorno oscuro que se dibuja detras de cada parte (imita el
// borde marcado tipo comic de la referencia).
const OUTLINE = '#15151f';

// Traza un path dos veces (contorno grueso oscuro, despues el color real
// encima mas fino) para lograr el efecto de silueta con borde marcado.
function strokeOutlined(c, path, width, col) {
  c.lineWidth = width + 5; c.strokeStyle = OUTLINE; c.stroke(path);
  c.lineWidth = width; c.strokeStyle = col; c.stroke(path);
}

// Placeholder vectorial de un stickman, usado para el jugador y los
// enemigos cuando no hay sprite disponible. Silueta rellena tipo capsula
// (torso y miembros gruesos con puntas redondeadas) con contorno oscuro,
// cabeza ovalada pegada al torso, piernas con rodilla y pose agachada
// (o.crouch), siguiendo la referencia que paso el usuario pero en vector
// liso, no pixelart.
export function drawStick(x, y, o) {
  const c = ctx;
  c.save(); c.translate(Math.round(x), Math.round(y));
  c.scale(STICK_SCALE, STICK_SCALE);
  if (o.spin) { c.translate(0, -22); c.rotate(o.spin * o.face); c.translate(0, 22); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  const crouch = !!o.crouch && !o.air;
  const hipY = crouch ? -8 : -16;
  const shY = crouch ? -17 : SHOULDER_LOCAL_Y;
  const headY = crouch ? -25 : -37;
  const headRX = 7.5, headRY = 10;
  // parado (no crouch, no aire, no moviendose): postura con piernas separadas,
  // no juntas en una sola linea. sw controla cuanto se abren/mueven.
  const sw = o.air || crouch ? 0 : o.moving ? Math.sin(o.t * 16) : .55;

  // piernas (con rodilla)
  const legs = new Path2D();
  if (o.air) {
    legs.moveTo(0, hipY); legs.lineTo(-6, hipY + 9); legs.lineTo(-8, hipY + 17);
    legs.moveTo(0, hipY); legs.lineTo(8, hipY + 7); legs.lineTo(10, hipY + 15);
  } else if (crouch) {
    legs.moveTo(0, hipY); legs.lineTo(-9, hipY * .45); legs.lineTo(-6, 0);
    legs.moveTo(0, hipY); legs.lineTo(9, hipY * .45); legs.lineTo(6, 0);
  } else {
    const kneeY = hipY * .5 - Math.abs(sw) * 3;
    legs.moveTo(0, hipY); legs.lineTo(sw * 5, kneeY); legs.lineTo(sw * 10, 0);
    legs.moveTo(0, hipY); legs.lineTo(-sw * 5, kneeY); legs.lineTo(-sw * 10, 0);
  }
  strokeOutlined(c, legs, 7, o.col);

  // torso (grueso, sin cuello: la cabeza se apoya directo encima)
  const torso = new Path2D(); torso.moveTo(0, hipY); torso.lineTo(0, shY);
  strokeOutlined(c, torso, 10, o.col);

  // brazo (con codo), pegado al cuerpo
  const arm = new Path2D();
  if (o.air) {
    arm.moveTo(0, shY + 2); arm.lineTo(-o.face * 7, shY - 2); arm.lineTo(-o.face * 9, shY - 9);
  } else if (crouch) {
    arm.moveTo(0, shY + 2); arm.lineTo(-o.face * 5, shY + 10); arm.lineTo(-o.face * 2, hipY + 3);
  } else {
    const armSw = o.moving ? Math.sin(o.t * 16) * 3 : 0;
    arm.moveTo(0, shY + 2); arm.lineTo(-o.face * 6, shY + 8 + armSw); arm.lineTo(-o.face * 3, shY + 16 + armSw);
  }
  strokeOutlined(c, arm, 6, o.col);

  // cabeza (ovalada, con contorno)
  c.beginPath(); c.ellipse(0, headY, headRX + 2, headRY + 2, 0, 0, 6.283); c.fillStyle = OUTLINE; c.fill();
  c.beginPath(); c.ellipse(0, headY, headRX, headRY, 0, 0, 6.283); c.fillStyle = o.col; c.fill();
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
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 0); ctx.stroke();
    const len = name === 0 ? 30 : name === 1 ? 42 : 50, h = name === 2 ? 22 : 18;
    const body = new Path2D(); body.roundRect(6, -h / 2, len, h, h / 3);
    ctx.lineJoin = 'round'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
    ctx.fillStyle = '#242832'; ctx.fill(body); ctx.stroke(body);
    // aleta/mira arriba, cerca de la mano
    ctx.fillStyle = '#242832';
    ctx.beginPath(); ctx.roundRect(9, -h / 2 - 6, len * .22, 8, 2); ctx.fill(); ctx.stroke();
    // ventana celeste (mira) y franja de cañon celeste claro
    ctx.fillStyle = '#2bb8e8';
    ctx.beginPath(); ctx.roundRect(6 + len * .1, -h / 2 + 2, len * .18, h * .4, 3); ctx.fill();
    ctx.fillStyle = '#8fe3ff';
    ctx.beginPath(); ctx.roundRect(6 + len * .48, h * .06, len * .42, h * .28, (h * .28) / 2); ctx.fill();
    // acento amarillo
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(6 + len * .34, -1); ctx.lineTo(6 + len * .44, -h * .22); ctx.lineTo(6 + len * .44, h * .05); ctx.closePath(); ctx.fill();
    // punta del cañon, un poco mas clara
    ctx.fillStyle = '#3a4050';
    ctx.beginPath(); ctx.roundRect(6 + len - 6, -h * .22, 8, h * .44, 3); ctx.fill();
  }
  ctx.restore();
}

export function drawHeart(x, y, s) {
  if (okSpr('heart')) { const d = SPRITES.heart; ctx.drawImage(d.img, 0, 0, d.fw, d.fh, x, y, d.fw * SPR_SCALE * 1.5, d.fh * SPR_SCALE * 1.5); return; }
  const pat = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  ctx.fillStyle = '#e63946';
  pat.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === '1') ctx.fillRect(x + i * s, y + j * s, s, s); });
}
