// Dibujo del modo Aventura: fondo con parallax, tiles, objetos, personajes y
// HUD. Todo en pixel art nitido: el mundo se dibuja con un zoom entero
// (`zs` pixeles de pantalla por pixel de arte) y la camara se ajusta a pixeles
// de arte para que nada tiemble.
import { T, SHOULDER } from './consts.js';
import { SP, DOOR, PLATE, LEVER, LAVA, THEMES, drawGround, drawOneWay, drawSpikes, drawPortal, backgroundFor, flashOf } from './art.js';
import { SPRITES, okSpr, drawSpr, drawArm, drawGun } from '../sprites.js';
import { exitOpen, coinsTaken, tileAt } from './sim.js';

const PF = '"Press Start 2P",monospace', VT = '"VT323",monospace';
const SOLIDCH = new Set(['#', '%', 'L']);

/* ------------------------------------------------------------------- camara */
export function zoomFor(H) { return Math.max(2, Math.min(5, Math.round(H / 260))); }

export function makeCamera() { return { x: 0, y: 0, shake: 0, init: false }; }

export function updateCamera(cam, w, W, H, dt) {
  const k = zoomFor(H) / 2, vw = W / k, vh = H / k, p = w.p;
  const lw = w.w * T, lh = w.h * T;
  let tx = p.x - vw / 2 + p.face * 40, ty = p.y - p.h / 2 - vh * .1;
  tx = lw <= vw ? (lw - vw) / 2 : Math.max(0, Math.min(lw - vw, tx));
  ty = lh <= vh ? (lh - vh) / 2 : Math.max(0, Math.min(lh - vh, ty));
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
  else { cam.x += (tx - cam.x) * Math.min(1, 7 * dt); cam.y += (ty - cam.y) * Math.min(1, 6 * dt); }
  cam.shake = Math.max(0, cam.shake - 40 * dt);
}

/* ---------------------------------------------------------- capa estatica */
function buildLayer(w) {
  const th = THEMES[w.def.theme], c = document.createElement('canvas');
  c.width = w.w * 16; c.height = w.h * 16;
  const g = c.getContext('2d'), rows = w.def.rows;
  const solid = (x, y) => x < 0 || x >= w.w ? true : y < 0 ? true : y >= w.h ? false : rows[y][x] === '#' || rows[y][x] === '%' || rows[y][x] === 'L';
  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
    const ch = rows[y][x];
    if (ch === '#') drawGround(g, x, y, { up: solid(x, y - 1), left: solid(x - 1, y), right: solid(x + 1, y), down: solid(x, y + 1) }, th);
    else if (ch === '=') drawOneWay(g, x, y, th);
    else if (ch === '^') drawSpikes(g, x, y);
  }
  return c;
}

/* ------------------------------------------------------------------ helpers */
function blit(g, cv, x, y, flip) {
  if (flip) { g.save(); g.translate(x + cv.width * 2, y); g.scale(-1, 1); g.drawImage(cv, 0, 0, cv.width * 2, cv.height * 2); g.restore(); }
  else g.drawImage(cv, x, y, cv.width * 2, cv.height * 2);
}
function pxBox(g, x, y, w, h, fill = '#1b1b1f') {
  g.fillStyle = '#000'; g.fillRect(x, y - 4, w, h + 8); g.fillRect(x - 4, y, w + 8, h);
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x, y, w, 3);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, y + h - 3, w, 3);
}
function bar(g, x, y, w, h, frac, col) {
  const n = Math.floor((w + 2) / 8), on = Math.ceil(Math.max(0, Math.min(1, frac)) * n - 1e-6);
  for (let i = 0; i < n; i++) { g.fillStyle = i < on ? col : '#0c0c0e'; g.fillRect(x + i * 8, y, 6, h); }
}

/* --------------------------------------------------------------------- fondo */
function drawBackground(g, w, cam, W, H, k, t) {
  const th = THEMES[w.def.theme], bg = backgroundFor(th), zs = k * 2;
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, th.sky[0]); grad.addColorStop(1, th.sky[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const camMaxY = Math.max(0, w.h * T - H / k);
  for (const L of bg.layers) {
    const lw = 256 * zs, lh = 112 * zs;
    const off = -((cam.x * L.f * k + (L.drift ? t * L.drift * zs : 0)) % lw + lw) % lw;
    let y;
    if (L.top) y = -(cam.y * L.f * .5 * k) + (L.ceil ? 0 : 20 * zs);
    else y = H - lh + (camMaxY - cam.y) * L.f * k * .7;
    if (L.anim) g.globalAlpha = .8 + .2 * Math.sin(t * 2);
    for (let x = off; x < W; x += lw) g.drawImage(L.c, x, y, lw, lh);
    g.globalAlpha = 1;
    // relleno bajo las colinas para que no quede un hueco si el nivel es alto
    if (!L.top && y + lh < H) { g.fillStyle = L.c === bg.layers[bg.layers.length - 1].c ? th.near : th.far; g.fillRect(0, y + lh - 1, W, H - y - lh + 1); }
  }
}

/* ------------------------------------------------------------------ principal */
export function drawWorld(g, w, cam, W, H, DPR, t, ui) {
  const zs = ui.zs || zoomFor(H), k = zs / 2;   // ui.zs solo lo usan las vistas de conjunto de desarrollo
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.imageSmoothingEnabled = false;
  drawBackground(g, w, cam, W, H, k, t);

  const sx = (Math.random() - .5) * cam.shake, sy = (Math.random() - .5) * cam.shake;
  const cx = Math.round((cam.x + sx) / 2) * 2, cy = Math.round((cam.y + sy) / 2) * 2;
  g.setTransform(DPR * k, 0, 0, DPR * k, -cx * DPR * k, -cy * DPR * k);
  const vw = W / k, vh = H / k;
  const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(w.w - 1, Math.floor((cx + vw) / T)), y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(w.h - 1, Math.floor((cy + vh) / T));

  // capa estatica
  const def = w.def; if (!def._layer) def._layer = buildLayer(w);
  g.drawImage(def._layer, x0 * 16, y0 * 16, (x1 - x0 + 1) * 16, (y1 - y0 + 1) * 16, x0 * T, y0 * T, (x1 - x0 + 1) * T, (y1 - y0 + 1) * T);

  const p = w.p;
  const nearSign = (def.signs || []).find(s => Math.abs(p.x - (s.x * T + T / 2)) < 60 && Math.abs((p.y - 16) - (s.y * T + 16)) < 60);

  // tiles dinamicos, puertas, mecanismos
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ch = w.tiles[y][x];
    if (ch === '%') blit(g, SP.cracked[Math.min(2, Math.max(0, 2 - ((w.crack[y * w.w + x] ?? 2) - 1)))], x * T, y * T);
    else if (ch === 'L') blit(g, SP.lock[0], x * T, y * T);
    else if (ch === '~') { const top = tileAt(w, x, y - 1) !== '~', f = Math.floor(t * 4 + x) % 4; blit(g, (top ? LAVA.top : LAVA.deep)[f], x * T, y * T); }
  }
  for (const s of def.signs || []) if (s.x >= x0 - 1 && s.x <= x1 + 1) blit(g, SP.sign[0], s.x * T, s.y * T);
  for (const d of w.doors) if (d.x >= x0 && d.x <= x1) blit(g, DOOR[d.ch][d.open ? 1 : 0], d.x * T, d.y * T);
  for (const pl of w.plates) blit(g, PLATE[pl.ch][pl.down ? 1 : 0], pl.x * T, pl.y * T);
  for (const lv of w.levers) blit(g, LEVER[lv.ch][lv.on ? 1 : 0], lv.x * T, lv.y * T);
  for (const s of w.springs) blit(g, SP.spring[s.t > 0 ? 1 : 0], s.x * T, s.y * T);
  for (const c of w.checkpoints) blit(g, c.on ? SP.flagOn[Math.floor(t * 4) % 2] : SP.flag[0], c.x * T + 4, c.y * T);
  if (w.exit) drawPortal(g, w.exit.x * T + T / 2, (w.exit.y + 1) * T, t, exitOpen(w));

  // items
  for (const it of w.items) {
    if (it.taken) continue;
    const bob = Math.sin(t * 3 + it.x) * 3;
    if (it.type === 'coin') blit(g, SP.coin[Math.floor(t * 8 + it.x / 9) % 4], it.x - 16, it.y - 16 + bob);
    else if (it.type === 'heart') blit(g, SP.heart[0], it.x - 10, it.y - 18 + bob);
    else if (it.type === 'fuel') blit(g, SP.fuel[0], it.x - 16, it.y - 22 + bob);
    else if (it.type === 'key') blit(g, SP.key[0], it.x - 16, it.y - 16 + bob);
  }
  for (const it of w.items) if (it.type === 'fuel' && it.taken) { g.globalAlpha = .18; blit(g, SP.fuel[0], it.x - 16, it.y - 22); g.globalAlpha = 1; }

  for (const c of w.crates) blit(g, SP.crate[0], c.x - 16, c.y - 31);
  for (const m of w.movers) {
    const n = Math.round(m.w / T);
    for (let i = 0; i < n; i++) blit(g, SP.mover[n === 1 ? 1 : i === 0 ? 0 : i === n - 1 ? 2 : 1], m.x + i * T, m.y - 6);
  }

  // enemigos
  for (const e of w.enemies) {
    const fl = e.flash > 0;
    if (e.kind === 'slime') { const s = SP.slime[Math.floor(e.t * 3) % 2]; blit(g, fl ? flashOf(s) : s, e.x - 16, e.y - 32 + 3, e.dir > 0); }
    else if (e.kind === 'bat') { const s = SP.bat[Math.floor(e.t * 10) % 3]; blit(g, fl ? flashOf(s) : s, e.x - 16, e.y - 32 + 13, e.dir > 0); }
    else if (e.kind === 'turret') { const s = SP.turret[0]; blit(g, fl ? flashOf(s) : s, e.x - 16 + (e.recoil > 0 ? -e.dir * 3 : 0), e.y - 32 + 3, e.dir > 0); }
    else if (e.kind === 'boss') {
      const s = SP.boss[e.phase && Math.floor(t * 8) % 2 ? 1 : 0], bx = e.x, by = e.y - 26;
      blit(g, fl ? flashOf(s) : s, bx - 32, by - 32);
      const a = Math.atan2(p.y - p.h / 2 - by, p.x - bx), d = 9;
      g.fillStyle = e.phase ? '#e63946' : '#1a1a24'; g.fillRect(Math.round((bx + Math.cos(a) * d) / 2) * 2 - 6, Math.round((by + Math.sin(a) * d * .6) / 2) * 2 - 6, 12, 12);
      g.fillStyle = '#fff'; g.fillRect(Math.round((bx + Math.cos(a) * d) / 2) * 2 - 4, Math.round((by + Math.sin(a) * d * .6) / 2) * 2 - 4, 4, 4);
    }
  }

  // jugador
  if (!p.dead) drawPlayer(g, p, t);

  // balas
  for (const b of w.bullets) {
    const a = Math.atan2(b.vy, b.vx); g.save(); g.translate(b.x, b.y); g.rotate(a);
    g.fillStyle = '#ff7a3d'; g.fillRect(-10, -2, 10, 4); g.fillStyle = '#ffd166'; g.fillRect(-6, -2, 8, 4); g.fillStyle = '#fff'; g.fillRect(-2, -1, 4, 2); g.restore();
  }
  for (const b of w.ebullets) {
    g.save(); g.translate(b.x, b.y); g.rotate(.785 + t * 6);
    g.fillStyle = '#1a1a24'; g.fillRect(-6, -6, 12, 12); g.fillStyle = '#e04fd0'; g.fillRect(-4, -4, 8, 8); g.fillStyle = '#ffd1f8'; g.fillRect(-2, -2, 4, 4); g.restore();
  }
  for (const q of w.parts) { g.globalAlpha = Math.min(1, q.life * 2); g.fillStyle = q.c; g.fillRect(Math.round(q.x / 2) * 2, Math.round(q.y / 2) * 2, q.s, q.s); }
  g.globalAlpha = 1;

  // carteles y palancas cercanas
  for (const lv of w.levers) if (!p.dead && Math.abs(p.x - (lv.x * T + T / 2)) < 30 && Math.abs((p.y - 16) - (lv.y * T + T / 2)) < 34) drawKeyHint(g, lv.x * T + T / 2, lv.y * T - 8, 'E');

  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (nearSign && !p.dead) drawSignText(g, nearSign, W, k, cx, cy);
  drawHud(g, w, W, H, t, ui);
}

function drawKeyHint(g, x, y, label) {
  g.fillStyle = '#000'; g.fillRect(x - 14, y - 22, 28, 24); g.fillStyle = '#ff7a3d'; g.fillRect(x - 12, y - 20, 24, 20);
  g.fillStyle = '#000'; g.font = '10px ' + PF; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x, y - 9);
}

// Los carteles se dibujan en espacio de pantalla (texto nitido, sin escalar).
function drawSignText(g, s, W, k, cx, cy) {
  g.font = '20px ' + VT; g.textBaseline = 'middle'; g.textAlign = 'left';
  const words = s.text.split(' '), lines = []; let cur = '';
  for (const wd of words) { const tt = cur ? cur + ' ' + wd : wd; if (g.measureText(tt).width > 320 && cur) { lines.push(cur); cur = wd; } else cur = tt; }
  lines.push(cur);
  const bw = Math.round(Math.max(...lines.map(l => g.measureText(l).width)) + 24), bh = lines.length * 22 + 16;
  const sxp = ((s.x * T + T / 2) - cx) * k, syp = (s.y * T - cy) * k;
  const bx = Math.round(Math.max(12, Math.min(W - bw - 12, sxp - bw / 2))), by = Math.round(syp - 40 * k - bh);
  pxBox(g, bx, by, bw, bh, '#1b1b1f');
  g.fillStyle = '#f4f1e8'; lines.forEach((l, i) => g.fillText(l, bx + 12, by + 19 + i * 22));
}

/* ----------------------------------------------------------------- jugador */
function drawPlayer(g, p, t) {
  if (p.inv > 0 && Math.floor(p.inv * 14) % 2) return;
  const air = !p.onGround, moving = Math.abs(p.vx) > 20;
  let name;
  if (air) name = p.flying ? 'playerFly' : 'playerJump';
  else if (p.crouch) name = moving ? 'playerCrouchWalk' : 'playerCrouch';
  else name = moving ? 'playerRun' : 'playerIdle';
  if (!okSpr(name)) name = ['playerIdle', 'playerRun', 'playerJump'].find(okSpr);
  // mochila y llama
  if (p.flying && okSpr('jetpack')) {
    const cx = p.x - p.face * 8, cy = p.y - 23;
    g.save();
    if (p.spin) { g.translate(p.x, p.y - 20); g.rotate(p.spin * p.face); g.translate(-p.x, -(p.y - 20)); }
    if (okSpr('jetFlame')) drawSpr('jetFlame', p.t, cx, cy + 14, false, 0, .5, 0);
    drawSpr('jetpack', 0, cx, cy, p.face < 0, 0, .5, .5);
    g.restore();
  }
  if (name) {
    g.save();
    if (p.spin) { g.translate(p.x, p.y - 20); g.rotate(p.spin * p.face); g.translate(-p.x, -(p.y - 20)); }
    drawSpr(name, p.t, p.x, p.y, p.face < 0, 0, .5, 1);
    g.restore();
  } else { g.fillStyle = '#ff7a3d'; g.fillRect(p.x - 8, p.y - p.h, 16, p.h); }
  const sy = p.y + (p.crouch ? -28 : SHOULDER);
  drawArm(p.x, sy, p.aim, '#ff7a3d');
  drawGun(0, p.x + Math.cos(p.aim) * 16, sy + Math.sin(p.aim) * 16, p.aim, '#ff7a3d');
}

/* --------------------------------------------------------------------- HUD */
export function drawHud(g, w, W, H, t, ui) {
  const p = w.p, X = 18, Y = 18;
  g.textBaseline = 'middle'; g.textAlign = 'left';
  pxBox(g, X, Y, 220, 108);
  for (let i = 0; i < 3; i++) {
    g.globalAlpha = i < p.hp ? 1 : .22;
    g.drawImage(SP.heart[0], 0, 7, 10, 9, X + 14 + i * 34, Y + 12, 30, 27);
  }
  g.globalAlpha = 1;
  g.font = '8px ' + PF; g.fillStyle = '#a09fa8'; g.fillText('FUEL', X + 14, Y + 58);
  bar(g, X + 62, Y + 52, 144, 12, p.fuel / 100, p.fuel > 25 ? '#ff7a3d' : '#e63946');
  g.drawImage(SP.coin[0], 0, 0, 16, 16, X + 10, Y + 72, 28, 28);
  g.font = '18px ' + VT; g.fillStyle = '#ffd166'; g.fillText(coinsTaken(w) + '/' + w.coinsTotal, X + 44, Y + 87);
  if (p.keys > 0) { g.drawImage(SP.key[0], 0, 0, 16, 16, X + 120, Y + 72, 28, 28); g.fillStyle = '#ffd166'; g.fillText('x' + p.keys, X + 152, Y + 87); }

  const title = 'NIVEL ' + w.def.id + ' · ' + w.def.name.toUpperCase();
  g.font = '10px ' + PF; const tw = g.measureText(title).width + 40;
  pxBox(g, Math.round(W / 2 - tw / 2), 18, tw, 34);
  g.fillStyle = '#f4f1e8'; g.textAlign = 'center'; g.fillText(title, W / 2, 36);

  g.textAlign = 'right';
  pxBox(g, W - 18 - 170, 18, 170, 60);
  g.font = '8px ' + PF; g.fillStyle = '#a09fa8'; g.fillText('TIEMPO', W - 34, 34); g.fillText('MUERTES', W - 34, 60);
  g.font = '18px ' + VT; g.fillStyle = '#ffd166';
  const s = Math.floor(w.time); g.fillText(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), W - 110, 34); g.fillText(String(w.deaths), W - 110, 60);
  g.textAlign = 'left';

  // barra del jefe
  const boss = w.enemies.find(e => e.kind === 'boss');
  if (boss) {
    const bw = Math.min(420, W - 80);
    pxBox(g, Math.round(W / 2 - bw / 2), 72, bw, 26, '#2a0f14');
    g.fillStyle = '#0c0c0e'; g.fillRect(W / 2 - bw / 2 + 6, 78, bw - 12, 14);
    g.fillStyle = boss.phase ? '#ff7a3d' : '#e63946'; g.fillRect(W / 2 - bw / 2 + 6, 78, (bw - 12) * boss.hp / boss.maxhp, 14);
    g.font = '8px ' + PF; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('EL OJO', W / 2, 85); g.textAlign = 'left';
  }

  // ayuda de controles
  if (ui.help > 0) {
    g.globalAlpha = Math.min(1, ui.help);
    const txt = 'A/D mover · ESPACIO saltar (mantené en el aire para volar) · S agacharse · CLICK disparar · E palanca · R reiniciar · ESC pausa';
    g.font = '18px ' + VT; const hw = g.measureText(txt).width + 32;
    pxBox(g, Math.round(W / 2 - hw / 2), H - 44, hw, 28); g.fillStyle = '#a09fa8'; g.textAlign = 'center'; g.fillText(txt, W / 2, H - 30); g.textAlign = 'left';
    g.globalAlpha = 1;
  }

  // titulo del nivel al entrar
  if (ui.banner > 0) {
    g.globalAlpha = Math.min(1, ui.banner);
    g.font = '22px ' + PF; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(w.def.name.toUpperCase(), W / 2 + 4, H * .3 + 4);
    g.fillStyle = '#ffd166'; g.fillText(w.def.name.toUpperCase(), W / 2, H * .3);
    g.font = '24px ' + VT; g.fillStyle = '#f4f1e8'; g.fillText(w.def.desc, W / 2, H * .3 + 40); g.textAlign = 'left';
    g.globalAlpha = 1;
  }
  // muerte: se oscurece la pantalla
  if (w.deathT > 0) { g.fillStyle = 'rgba(0,0,0,' + Math.min(.75, (.8 - w.deathT) * 1.3) + ')'; g.fillRect(0, 0, W, H); }
  else if (ui.flash > 0) { g.fillStyle = 'rgba(0,0,0,' + ui.flash + ')'; g.fillRect(0, 0, W, H); }
}
