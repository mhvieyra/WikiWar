// Carga de sprites con fallback a placeholders dibujados por codigo, igual
// que en la version original de un unico archivo.
//
// Cada PNG es una tira horizontal de frames de igual tamaño, mirando a la
// derecha. Si el archivo no existe (ver public/sprites/, y SPRITES.md para
// el detalle de cada uno) se dibuja un placeholder vectorial.
import { SPR_SCALE } from './config.js';
import { ctx } from './state.js';

export const SPRITES = {
  playerIdle: { src: '/sprites/player_idle.png', fw: 32, fh: 36, fps: 4 },
  playerRun: { src: '/sprites/player_run.png', fw: 32, fh: 36, fps: 12 },
  playerJump: { src: '/sprites/player_jump.png', fw: 32, fh: 36, fps: 1 },
  playerFly: { src: '/sprites/player_fly.png', fw: 32, fh: 36, fps: 10 },
  playerCrouch: { src: '/sprites/player_crouch.png', fw: 32, fh: 36, fps: 2 },
  playerCrouchWalk: { src: '/sprites/player_crouch_walk.png', fw: 32, fh: 36, fps: 8 },
  playerArm: { src: '/sprites/player_arm.png', fw: 16, fh: 16, fps: 1 },
  enemyRun: { src: '/sprites/enemy_run.png', fw: 32, fh: 36, fps: 10 },
  enemyGunner: { src: '/sprites/enemy_gunner.png', fw: 32, fh: 36, fps: 10 },
  enemyDie: { src: '/sprites/enemy_die.png', fw: 32, fh: 36, fps: 26 },
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

// Altura del hombro sobre los pies (mismas medidas que los sprites reales:
// 32px de pie, 28px agachado). La usan player.js/enemies.js/main.js para el
// angulo de apuntado, el origen de balas/granadas y donde se pega el brazo.
export const SHOULDER_STAND_Y = -32;
export const SHOULDER_CROUCH_Y = -28;
// Altura de pecho, solo para el origen de efectos de particulas (golpe, muerte, spawn).
export const CHEST_Y = -18;

// Color del contorno oscuro que se dibuja detras de cada parte (imita el
// borde marcado tipo comic de los sprites reales).
const OUTLINE = '#15151f';

// Traza un path dos veces (contorno grueso oscuro, despues el color real
// encima mas fino) para lograr el efecto de silueta con borde marcado.
function strokeOutlined(c, path, width, col) {
  c.lineWidth = width + 3; c.strokeStyle = OUTLINE; c.stroke(path);
  c.lineWidth = width; c.strokeStyle = col; c.stroke(path);
}

// Placeholder vectorial del CUERPO (sin brazo: el brazo/arma se dibuja
// aparte con drawArm/drawGun, igual que con los sprites reales), usado para
// el jugador y los enemigos cuando falta el PNG correspondiente. El hombro
// (shY) coincide con SHOULDER_STAND_Y/SHOULDER_CROUCH_Y para que el brazo
// se pegue bien al cuerpo tambien en este modo placeholder.
export function drawStick(x, y, o) {
  const c = ctx;
  c.save(); c.translate(Math.round(x), Math.round(y));
  if (o.spin) { c.translate(0, -21); c.rotate(o.spin * o.face); c.translate(0, 21); }
  c.lineCap = 'round'; c.lineJoin = 'round';
  const crouch = !!o.crouch && !o.air;
  const hipY = crouch ? -9 : -14;
  const shY = crouch ? SHOULDER_CROUCH_Y : SHOULDER_STAND_Y;
  const headY = crouch ? -35 : -40;
  const headR = 7;
  // parado (no crouch, no aire, no moviendose): postura con piernas separadas,
  // no juntas en una sola linea. sw controla cuanto se abren/mueven.
  const sw = o.air || crouch ? 0 : o.moving ? Math.sin(o.t * 16) : .5;

  // piernas (con rodilla)
  const legs = new Path2D();
  if (o.air) {
    legs.moveTo(0, hipY); legs.lineTo(-4, hipY + 6); legs.lineTo(-5, hipY + 11);
    legs.moveTo(0, hipY); legs.lineTo(5, hipY + 5); legs.lineTo(6, hipY + 10);
  } else if (crouch) {
    legs.moveTo(0, hipY); legs.lineTo(-6, hipY * .45); legs.lineTo(-4, 0);
    legs.moveTo(0, hipY); legs.lineTo(6, hipY * .45); legs.lineTo(4, 0);
  } else {
    const kneeY = hipY * .5 - Math.abs(sw) * 2;
    legs.moveTo(0, hipY); legs.lineTo(sw * 3, kneeY); legs.lineTo(sw * 6, 0);
    legs.moveTo(0, hipY); legs.lineTo(-sw * 3, kneeY); legs.lineTo(-sw * 6, 0);
  }
  strokeOutlined(c, legs, 4, o.col);

  // torso (grueso, sin cuello: la cabeza se apoya directo encima)
  const torso = new Path2D(); torso.moveTo(0, hipY); torso.lineTo(0, shY);
  strokeOutlined(c, torso, 5.5, o.col);

  // cabeza (ovalada, con contorno)
  c.beginPath(); c.ellipse(0, headY, headR + 1.5, headR * 1.3 + 1.5, 0, 0, 6.283); c.fillStyle = OUTLINE; c.fill();
  c.beginPath(); c.ellipse(0, headY, headR, headR * 1.3, 0, 0, 6.283); c.fillStyle = o.col; c.fill();
  c.restore();
}

// Brazo que apunta al mouse: rota desde el hombro segun el angulo `a`, y se
// espeja en vertical al apuntar a la izquierda (igual que drawGun). Se
// dibuja siempre aparte del cuerpo, tenga este sprite real o placeholder.
export function drawArm(x, y, a, col) {
  const c = ctx;
  c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(a);
  if (Math.cos(a) < 0) c.scale(1, -1);
  if (okSpr('playerArm')) {
    const d = SPRITES.playerArm, scale = d.scale ?? SPR_SCALE;
    // hombro en el pixel (1.5, 8.5) de la imagen fuente de 16x16.
    c.drawImage(d.img, 0, 0, d.fw, d.fh, -1.5 * scale, -8.5 * scale, d.fw * scale, d.fh * scale);
  } else {
    strokeOutlined(c, (() => { const p = new Path2D(); p.moveTo(0, 0); p.lineTo(14, 0); return p; })(), 5, col);
  }
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
