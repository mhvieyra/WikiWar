// Dibujo de Ecos. A diferencia de un platformer, cada nivel es un cuarto que se
// ve entero en pantalla (camara fija con zoom entero, pixel art nitido). Los
// ecos se dibujan tintados y semitransparentes para distinguirlos de vos.
import { T, SHOULDER } from './consts.js';
import { SP, DOOR, DOORINV, PLATE, LEVER, PAD, TARGET, LAVA, THEMES, drawGround, drawOneWay, drawSpikes, drawPortal, backgroundFor } from './art.js';
import { okSpr, drawSpr, drawArm, drawGun } from '../sprites.js';
import { AIM_N } from '../shared/dmath.js';
import { tileAt, TICK_HZ } from './sim.js';

const PF = '"Press Start 2P",monospace', VT = '"VT323",monospace';
export const ECO_HUES = [180, 120, 260, 60, 320, 210, 90, 290];   // tintes de los ecos (sobre el naranja base)
const TOP = 78, BOTTOM = 48;

export function layoutFor(w, W, H) {
  const lw = w.w * T, lh = w.h * T, aw = W - 24, ah = H - TOP - BOTTOM;
  const zs = Math.max(1, Math.floor(Math.min(aw / (lw + 2 * T), ah / lh) * 2)), k = zs / 2;
  return { k, ox: Math.floor((W - lw * k) / 2), oy: TOP + Math.floor((ah - lh * k) / 2) };
}

function buildLayer(w) {
  // una columna de margen a cada lado para dibujar las paredes del cuarto
  const th = THEMES[w.def.theme], c = document.createElement('canvas');
  c.width = (w.w + 2) * 16; c.height = w.h * 16;
  const g = c.getContext('2d'), rows = w.def.rows;
  const solid = (x, y) => x < 0 || x >= w.w ? true : y < 0 ? true : y >= w.h ? false : rows[y][x] === '#';
  for (let y = 0; y < w.h; y++) for (let x = -1; x <= w.w; x++) {
    const ch = x < 0 || x >= w.w ? '#' : rows[y][x];
    if (ch === '#') drawGround(g, x + 1, y, { up: solid(x, y - 1), left: x < 0 ? false : solid(x - 1, y), right: x >= w.w ? false : solid(x + 1, y), down: solid(x, y + 1) }, th);
    else if (ch === '=') drawOneWay(g, x + 1, y, th);
    else if (ch === '^') drawSpikes(g, x + 1, y);
  }
  return c;
}
function blit(g, cv, x, y, flip) {
  if (flip) { g.save(); g.translate(x + cv.width * 2, y); g.scale(-1, 1); g.drawImage(cv, 0, 0, cv.width * 2, cv.height * 2); g.restore(); }
  else g.drawImage(cv, x, y, cv.width * 2, cv.height * 2);
}
export function pxBox(g, x, y, w, h, fill = '#1b1b1f') {
  g.fillStyle = '#000'; g.fillRect(x, y - 4, w, h + 8); g.fillRect(x - 4, y, w + 8, h);
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x, y, w, 3);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, y + h - 3, w, 3);
}

function drawBackground(g, w, W, H, t) {
  const th = THEMES[w.def.theme], bg = backgroundFor(th), zs = 3;
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, th.sky[0]); grad.addColorStop(1, th.sky[1]);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (const L of bg.layers) {
    const lw = 256 * zs, lh = 112 * zs, off = -((L.drift ? t * L.drift * zs : 0) % lw + lw) % lw;
    const y = L.top ? (L.ceil ? 0 : 20 * zs) : H - lh;
    for (let x = off; x < W; x += lw) g.drawImage(L.c, x, y, lw, lh);
    if (!L.top && y + lh < H) { g.fillStyle = L === bg.layers[bg.layers.length - 1] ? th.near : th.far; g.fillRect(0, y + lh - 1, W, H - y - lh + 1); }
  }
}

function drawActor(g, a, t, tint) {
  if (a.dead) return;
  const air = !a.onGround, moving = Math.abs(a.vx) > 20;
  let name;
  if (air) name = a.flying ? 'playerFly' : 'playerJump';
  else if (a.crouch) name = moving ? 'playerCrouchWalk' : 'playerCrouch';
  else name = moving ? 'playerRun' : 'playerIdle';
  if (!okSpr(name)) name = ['playerIdle', 'playerRun', 'playerJump'].find(okSpr);
  const ang = (a.aim / AIM_N) * 6.283185307179586;
  if (tint) g.globalAlpha = .78;
  if (a.flying && okSpr('jetpack')) {
    const cx = a.x - a.face * 8, cy = a.y - 23;
    if (okSpr('jetFlame')) drawSpr('jetFlame', a.t, cx, cy + 14, false, 0, .5, 0, true, tint);
    drawSpr('jetpack', 0, cx, cy, a.face < 0, 0, .5, .5, true, tint);
  }
  if (name) {
    g.save();
    if (a.spin) { g.translate(a.x, a.y - 20); g.rotate(a.spin * a.face); g.translate(-a.x, -(a.y - 20)); }
    drawSpr(name, a.t, a.x, a.y, a.face < 0, 0, .5, 1, true, tint);
    g.restore();
  } else { g.fillStyle = '#ff7a3d'; g.fillRect(a.x - 8, a.y - a.h, 16, a.h); }
  const sy = a.y + (a.crouch ? -28 : SHOULDER);
  drawArm(a.x, sy, ang, '#ff7a3d');
  drawGun(0, a.x + Math.cos(ang) * 16, sy + Math.sin(ang) * 16, ang, '#ff7a3d');
  g.globalAlpha = 1;
}

export function drawWorld(g, w, W, H, DPR, t, ui) {
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.imageSmoothingEnabled = false;
  drawBackground(g, w, W, H, t);
  const { k, ox, oy } = layoutFor(w, W, H);
  g.setTransform(DPR * k, 0, 0, DPR * k, ox * DPR, oy * DPR);
  const lw = w.w * T, lh = w.h * T;
  g.save(); g.beginPath(); g.rect(-T, 0, lw + 2 * T, lh + 200); g.clip();

  const def = w.def; if (!def._layer) def._layer = buildLayer(w);
  g.drawImage(def._layer, -T, 0, lw + 2 * T, lh);

  // lava y decorados
  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
    if (w.tiles[y][x] === '~') { const top = tileAt(w, x, y - 1) !== '~', f = Math.floor(t * 4 + x) % 4; blit(g, (top ? LAVA.top : LAVA.deep)[f], x * T, y * T); }
  }
  for (const s of def.signs || []) blit(g, SP.sign[0], s.x * T, s.y * T);
  for (const d of w.doors) blit(g, d.inv ? (d.open ? DOOR[d.ch][1] : DOORINV[d.ch]) : DOOR[d.ch][d.open ? 1 : 0], d.x * T, d.y * T);
  for (const pl of w.plates) blit(g, PLATE[pl.ch][pl.down ? 1 : 0], pl.x * T, pl.y * T);
  for (const lv of w.levers) blit(g, LEVER[lv.ch][lv.on ? 1 : 0], lv.x * T, lv.y * T);
  for (const pd of w.pads) blit(g, PAD[pd.ch][pd.hot > 0 || w.pulse[pd.ch] > 0 ? 1 : 0], pd.x * T, pd.y * T);
  for (const tg of w.targets) blit(g, TARGET[tg.ch][tg.hot > 0 || w.pulse[tg.ch] > 0 ? 1 : 0], tg.x * T, tg.y * T);
  for (const s of w.springs) blit(g, SP.spring[s.t > 0 ? 1 : 0], s.x * T, s.y * T);
  if (w.exit) drawPortal(g, w.exit.x * T + T / 2, (w.exit.y + 1) * T, t, true);
  for (const c of w.crates) blit(g, SP.crate[0], c.x - 16, c.y - 31);
  for (const m of w.movers) {
    const n = Math.round(m.w / T);
    for (let i = 0; i < n; i++) blit(g, SP.mover[n === 1 ? 1 : i === 0 ? 0 : i === n - 1 ? 2 : 1], m.x + i * T, m.y - 6);
  }
  // pulso restante sobre cada puerta o pulsador: barrita que se vacia
  for (const pd of w.pads) { const r = w.pulse[pd.ch] * (1 / 120) / (def.pulse || 3); if (r > 0) { g.fillStyle = '#000'; g.fillRect(pd.x * T + 2, pd.y * T + 2, 28, 6); g.fillStyle = '#ffd166'; g.fillRect(pd.x * T + 4, pd.y * T + 4, Math.round(24 * r), 2); } }

  // ecos primero (detras) y despues el jugador
  w.actors.forEach(a => { if (a.kind === 'echo') drawActor(g, a, t, ECO_HUES[a.id % ECO_HUES.length]); });
  drawActor(g, w.live, t, 0);
  w.actors.forEach(a => {
    if (a.kind === 'echo' && !a.dead) {
      g.font = '8px ' + PF; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#000'; g.fillRect(a.x - 7, a.y - a.h - 17, 14, 12);
      g.fillStyle = '#bff3ff'; g.fillText(String(a.id + 1), a.x, a.y - a.h - 10);
    }
  });
  for (const b of w.bullets) {
    g.save(); g.translate(b.x, b.y); g.rotate(Math.atan2(b.vy, b.vx));
    g.fillStyle = '#ff7a3d'; g.fillRect(-10, -2, 10, 4); g.fillStyle = '#ffd166'; g.fillRect(-6, -2, 8, 4); g.fillStyle = '#fff'; g.fillRect(-2, -1, 4, 2); g.restore();
  }
  for (const q of w.parts) { g.globalAlpha = Math.min(1, q.life * 2); g.fillStyle = q.c; g.fillRect(Math.round(q.x / 2) * 2, Math.round(q.y / 2) * 2, q.s, q.s); }
  g.globalAlpha = 1;
  g.restore();

  // carteles (texto en pantalla, nitido)
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (ui.showSigns) {
    const near = (def.signs || []).find(s => Math.abs(w.live.x - (s.x * T + T / 2)) < 90 && Math.abs((w.live.y - 16) - (s.y * T + 16)) < 70);
    if (near) drawSign(g, near, W, k, ox, oy);
  }
  drawHud(g, w, W, H, t, ui);
}

function drawSign(g, s, W, k, ox, oy) {
  g.font = '20px ' + VT; g.textBaseline = 'middle'; g.textAlign = 'left';
  const words = s.text.split(' '), lines = []; let cur = '';
  for (const wd of words) { const tt = cur ? cur + ' ' + wd : wd; if (g.measureText(tt).width > 360 && cur) { lines.push(cur); cur = wd; } else cur = tt; }
  lines.push(cur);
  const bw = Math.round(Math.max(...lines.map(l => g.measureText(l).width)) + 24), bh = lines.length * 22 + 16;
  const sx = ox + (s.x * T + T / 2) * k, sy = oy + s.y * T * k;
  const bx = Math.round(Math.max(12, Math.min(W - bw - 12, sx - bw / 2))), by = Math.round(Math.max(TOP + 4, sy - 56 * k - bh));
  pxBox(g, bx, by, bw, bh);
  g.fillStyle = '#f4f1e8'; lines.forEach((l, i) => g.fillText(l, bx + 12, by + 19 + i * 22));
}

const fmt = ticks => { const s = ticks / TICK_HZ; return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + '.' + String(Math.floor((s * 10) % 10)); };

function drawHud(g, w, W, H, t, ui) {
  g.textBaseline = 'middle'; g.textAlign = 'left';
  // panel superior: nivel, ciclo, ecos
  const title = (ui.title || w.def.name).toUpperCase();
  g.font = '10px ' + PF;
  const tw = Math.max(320, g.measureText(title).width + 60);
  pxBox(g, Math.round(W / 2 - tw / 2), 16, tw, 46);
  g.fillStyle = '#f4f1e8'; g.textAlign = 'center'; g.fillText(title, W / 2, 30);
  g.font = '8px ' + PF; g.fillStyle = '#a09fa8';
  g.fillText((ui.replay ? '' : 'CICLO ' + ui.cycle + '  ·  ') + 'ECOS ' + ui.echoes + (w.def.par ? '  ·  PAR ' + w.def.par : ''), W / 2, 50);
  // barra de tiempo del ciclo
  const bw = tw - 24, fr = Math.min(1, w.tick / w.limit), left = (w.limit - w.tick) / TICK_HZ;
  g.fillStyle = '#0c0c0e'; g.fillRect(W / 2 - bw / 2, 58, bw, 4);
  g.fillStyle = left < 5 && Math.floor(t * 4) % 2 ? '#fff' : left < 5 ? '#e63946' : '#ffd166'; g.fillRect(W / 2 - bw / 2, 58, bw * fr, 4);
  g.textAlign = 'left'; g.font = '18px ' + VT; g.fillStyle = '#ffd166'; g.fillText(fmt(w.tick) + ' / ' + fmt(w.limit), W / 2 + tw / 2 + 18, 32);
  // cinta de ecos a la izquierda
  const n = w.actors.filter(a => a.kind === 'echo').length;
  if (n) {
    pxBox(g, 18, 16, 20 + n * 26, 34);
    w.actors.filter(a => a.kind === 'echo').forEach((a, i) => {
      g.fillStyle = a.dead ? '#3a3a44' : `hsl(${(ECO_HUES[a.id % ECO_HUES.length] + 25) % 360},70%,60%)`; g.fillRect(28 + i * 26, 24, 18, 18);
      g.fillStyle = '#000'; g.font = '8px ' + PF; g.textAlign = 'center'; g.fillText(String(a.id + 1), 37 + i * 26, 34); g.textAlign = 'left';
    });
  }
  // combustible
  if (w.live.maxFuel > 0) {
    pxBox(g, 18, 62, 160, 22);
    g.fillStyle = '#a09fa8'; g.font = '8px ' + PF; g.fillText('FUEL', 28, 73);
    const nseg = 10, on = Math.ceil(w.live.fuel / w.live.maxFuel * nseg - 1e-6);
    for (let i = 0; i < nseg; i++) { g.fillStyle = i < on ? '#ff7a3d' : '#0c0c0e'; g.fillRect(72 + i * 10, 68, 8, 10); }
  }
  // pista de controles
  if (ui.hint) {
    const txt = ui.replay ? 'ESC salir · ESPACIO cambiar velocidad (x' + ui.speed + ')' : 'R cerrar ciclo · Q reiniciar ciclo · RETROCESO quitar último eco · E palanca · ESC pausa';
    g.font = '18px ' + VT; const hw = g.measureText(txt).width + 32;
    pxBox(g, Math.round(W / 2 - hw / 2), H - 38, hw, 26); g.fillStyle = '#a09fa8'; g.textAlign = 'center'; g.fillText(txt, W / 2, H - 25); g.textAlign = 'left';
  }
  if (ui.flash > 0) { g.fillStyle = 'rgba(0,0,0,' + Math.min(1, ui.flash) + ')'; g.fillRect(0, 0, W, H); }
  if (ui.deadT > 0) { g.fillStyle = 'rgba(230,57,70,' + Math.min(.35, ui.deadT) + ')'; g.fillRect(0, 0, W, H); g.font = '16px ' + PF; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('MORISTE · el ciclo se descarta', W / 2, H * .45); g.textAlign = 'left'; }
  if (ui.msg && ui.msgT > 0) { g.globalAlpha = Math.min(1, ui.msgT * 2); g.font = '10px ' + PF; const mw = g.measureText(ui.msg).width + 40; pxBox(g, Math.round(W / 2 - mw / 2), H - 96, mw, 30, '#ff7a3d'); g.fillStyle = '#000'; g.textAlign = 'center'; g.fillText(ui.msg, W / 2, H - 81); g.textAlign = 'left'; g.globalAlpha = 1; }
}
