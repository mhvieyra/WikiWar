// Cajas de suministros y sus items: cada CRATE_EVERY segundos cae una caja
// con paracaidas cerca del jugador; los disparos y explosiones la rompen y
// suelta un item (municion, pocion de fuerza o botiquin) que se recoge al
// tocarlo. La caja y los items caen y aterrizan con la misma fisica que el
// resto de las entidades (physics.js).
import { RS, CRATE_EVERY, CRATE_FALL, CRATE_HP, CRATE_LIFE, CRATE_W, CRATE_H, CRATE_ROOF, CRATE_NEAR, ITEM_LIFE, ITEM_BLINK, MEDKIT_HEAL, STRENGTH_TIME, DROP_AMMO, DROP_STRENGTH } from './config.js';
import { S, state, ctx } from './state.js';
import { clamp } from './utils.js';
import { physics } from './physics.js';
import { refillAmmo } from './weapons.js';
import { playSfx } from './audio.js';
import { SPRITES, okSpr, drawSpr } from './sprites.js';
import { burst } from './main.js';
import { toast } from './ui.js';

const CHUTE_H = 32 * 2;                          // alto del paracaidas ya escalado
const ITEM_W = 28, ITEM_H = 28;                  // hitbox de los items
const ITEM_SPR = { ammo: 'itemAmmo', strength: 'itemStrength', medkit: 'itemMedkit' };
const ITEM_COL = { ammo: '#ffd166', strength: '#c77dff', medkit: '#e63946' };
const ITEM_LETTER = { ammo: 'M', strength: 'F', medkit: '+' };

/* ------------------------------------------------------------------ cajas */
// Hay una plataforma viva debajo de x, dentro de las proximas filas visibles?
// Sirve para elegir una columna donde la caja realmente aterrice a la vista.
function landsInView(x) {
  const r0 = Math.floor((state.cam + 60) / RS);
  for (let r = r0; r < r0 + Math.ceil(state.H / RS); r++) {
    const arr = state.L.top.get(r); if (!arr) continue;
    for (const pl of arr) if (pl.alive && x + CRATE_W / 2 > pl.x && x - CRATE_W / 2 < pl.x + pl.w) return true;
  }
  return false;
}

export function spawnCrate() {
  const p = state.p;
  let x = 0;
  for (let k = 0; k < 12; k++) {
    x = clamp(p.x + (Math.random() * 2 - 1) * CRATE_NEAR, CRATE_W, state.W - CRATE_W);
    if (landsInView(x)) break;
  }
  state.crates.push({
    x, y: state.cam - 20, vx: 0, vy: CRATE_FALL, g: 0, w: CRATE_W, h: CRATE_H, onGround: false, drop: 0,
    hp: CRATE_HP, age: 0, t: 0, ph: Math.random() * 6.283, chute: true, flash: 0, breakT: -1, dead: false
  });
}

export function hitCrate(c, d) {
  if (c.breakT >= 0 || c.dead) return;
  c.hp -= d; c.flash = .1;
  if (c.hp > 0) { burst(c.x, c.y - CRATE_H / 2, 4, '#b07a3c', 140, 40); return; }
  c.breakT = 0; c.chute = false;
  burst(c.x, c.y - CRATE_H / 2, 12, '#b07a3c', 220, 80);
  playSfx('crate_break', 180, .15, 'sawtooth', .05, -90);
  spawnItem(c.x, c.y - CRATE_H / 2);
}

function spawnItem(x, y) {
  const r = Math.random();
  const type = r < DROP_AMMO ? 'ammo' : r < DROP_AMMO + DROP_STRENGTH ? 'strength' : 'medkit';
  state.items.push({ type, x, y, vx: (Math.random() - .5) * 120, vy: -300, w: ITEM_W, h: ITEM_H, onGround: false, drop: 0, age: 0, t: 0, dead: false });
}

export function updateCrates(dt) {
  S.crateT -= dt;
  if (S.crateT <= 0) { S.crateT += CRATE_EVERY; spawnCrate(); }
  const breakLen = SPRITES.crateBreak.img.naturalWidth / SPRITES.crateBreak.fw / SPRITES.crateBreak.fps;
  for (const c of state.crates) {
    c.age += dt; c.t += dt; c.flash -= dt;
    if (c.breakT >= 0) { c.breakT += dt; if (c.breakT >= (breakLen || .4)) c.dead = true; continue; }
    if (c.age > CRATE_LIFE) { c.dead = true; continue; }
    // mientras esta arriba de la vista ignora las plataformas (asi la caida
    // se ve completa) y recien empieza a colisionar al entrar a pantalla.
    if (c.chute && c.y < state.cam + 60) c.drop = .1;
    physics(c, dt);
    if (c.chute && c.onGround) { c.chute = false; delete c.g; }
  }
  state.crates = state.crates.filter(c => !c.dead);
}

/* ------------------------------------------------------------------ items */
function collect(it) {
  const p = state.p;
  if (it.type === 'medkit') { p.hp = Math.min(100, p.hp + MEDKIT_HEAL); toast('+' + MEDKIT_HEAL + ' de vida'); playSfx('pickup_medkit', 520, .18, 'triangle', .05, 400); }
  else if (it.type === 'strength') { S.strengthT = STRENGTH_TIME; toast('¡Fuerza! Daño x1.5 por ' + STRENGTH_TIME + ' s'); playSfx('pickup_strength', 260, .2, 'square', .04, 300); }
  else { refillAmmo(); S.ammoFlash = .8; toast('Munición recargada'); playSfx('pickup_ammo', 700, .1, 'square', .04, 200); }
  burst(it.x, it.y - ITEM_H / 2, 10, ITEM_COL[it.type], 180, 60);
  it.dead = true;
}

export function updateItems(dt) {
  const p = state.p;
  for (const it of state.items) {
    it.age += dt; it.t += dt;
    if (it.age > ITEM_LIFE) { it.dead = true; continue; }
    physics(it, dt);
    if (Math.abs(it.x - p.x) < (it.w + p.w) / 2 && it.y > p.y - p.h && it.y - it.h < p.y) collect(it);
  }
  state.items = state.items.filter(it => !it.dead);
}

/* ------------------------------------------------------------------ dibujo */
function drawCrateBody(x, y) {
  if (okSpr('crate')) { drawSpr('crate', 0, x, y, false, 0, .5, 1); return; }
  ctx.fillStyle = '#b07a3c'; ctx.fillRect(x - CRATE_W / 2, y - CRATE_H, CRATE_W, CRATE_H);
  ctx.strokeStyle = '#5a3a14'; ctx.lineWidth = 3; ctx.strokeRect(x - CRATE_W / 2, y - CRATE_H, CRATE_W, CRATE_H);
  ctx.beginPath(); ctx.moveTo(x - CRATE_W / 2, y - CRATE_H); ctx.lineTo(x + CRATE_W / 2, y); ctx.moveTo(x + CRATE_W / 2, y - CRATE_H); ctx.lineTo(x - CRATE_W / 2, y); ctx.stroke();
}

// Paracaidas: la base del sprite queda en el centro del techo de la caja.
function drawChute(x, by) {
  if (okSpr('parachute')) { drawSpr('parachute', state.p.t, x, by, false, 0, .5, 1); return; }
  ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.ellipse(x, by, 30, CHUTE_H - 10, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 30, by); ctx.lineTo(x, by + 10); ctx.moveTo(x + 30, by); ctx.lineTo(x, by + 10); ctx.stroke();
}

export function drawCrates() {
  for (const c of state.crates) {
    if (c.breakT >= 0) { if (okSpr('crateBreak')) drawSpr('crateBreak', c.breakT, c.x, c.y, false, 0, .5, 1, false); continue; }
    if (c.flash > 0) ctx.globalAlpha = .55;
    if (c.chute) {
      // la caja cuelga del paracaidas y se balancea con el: todo gira
      // alrededor del punto mas alto del paracaidas.
      ctx.save();
      ctx.translate(Math.round(c.x), Math.round(c.y - CRATE_ROOF - CHUTE_H));
      ctx.rotate(Math.sin(c.t * 2.2 + c.ph) * .12);
      drawChute(0, CHUTE_H);
      drawCrateBody(0, CHUTE_H + CRATE_ROOF);
      ctx.restore();
    } else drawCrateBody(c.x, c.y);
    ctx.globalAlpha = 1;
  }
}

export function drawItems() {
  for (const it of state.items) {
    if (it.age > ITEM_LIFE - ITEM_BLINK && Math.floor(it.age * 8) % 2) continue;
    const lift = 8 + Math.sin(it.t * 3) * 3;
    const name = ITEM_SPR[it.type];
    if (okSpr(name)) drawSpr(name, it.t, it.x, it.y - lift, false, 0, .5, 1);
    else {
      const x = Math.round(it.x) - ITEM_W / 2, y = Math.round(it.y - lift) - ITEM_H;
      ctx.fillStyle = ITEM_COL[it.type]; ctx.fillRect(x, y, ITEM_W, ITEM_H);
      ctx.strokeStyle = '#15151f'; ctx.lineWidth = 3; ctx.strokeRect(x, y, ITEM_W, ITEM_H);
      ctx.fillStyle = '#15151f'; ctx.font = 'bold 16px "Courier New",monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ITEM_LETTER[it.type], x + ITEM_W / 2, y + ITEM_H / 2 + 1); ctx.textAlign = 'left';
    }
  }
}
