// Dibujo de la Arena: terreno en un canvas que se repinta solo donde cambia,
// camara que sigue al jugador local, HUD y minimapa. Todo pixel art nitido.
import { CS, COLS, ROWS, AIR, DIRT, ROCK, ORE, BUILT } from './gen.js';
import { WEAPONS, priceOf, PRICE, BUILD_COST, LAVA_START, TICK_HZ, HP_MAX, FUEL_MAX, PW } from './sim.js';
import { AIM } from '../shared/dmath.js';
import { THEMES, backgroundFor, LAVA, hash } from '../eco/art.js';
import { okSpr, drawSpr, drawArm, drawGun } from '../sprites.js';

const PF = '"Press Start 2P",monospace', VT = '"VT323",monospace';
const P_COLORS = ['#ff7a3d', '#4aa3ff'];
const HUES = [0, 190];                 // vos siempre en naranja, el rival en azul (sin importar quien sea el jugador 0)
const WORLD_W = COLS * CS, WORLD_H = ROWS * CS;

/* ------------------------------------------------------------------ terreno */
const DIRT_C = ['#8a5a2b', '#835428', '#916031'], BACK_C = ['#2b1d14', '#30211a'];
export class TerrainView {
  constructor() { this.c = document.createElement('canvas'); this.c.width = COLS * 4; this.c.height = ROWS * 4; this.g = this.c.getContext('2d'); this.round = -1; this.mini = document.createElement('canvas'); this.mini.width = COLS; this.mini.height = ROWS; this.miniT = 0; }
  cell(w, x, y) {
    const g = this.g, X = x * 4, Y = y * 4, t = w.cells[y * COLS + x];
    g.clearRect(X, Y, 4, 4);
    const at = (cx, cy) => (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS ? ROCK : w.cells[cy * COLS + cx]);
    const h = hash(x, y, 3);
    if (t === AIR) { if (y >= w.surf[x]) { g.fillStyle = BACK_C[h > .5 ? 1 : 0]; g.fillRect(X, Y, 4, 4); if (h > .8) { g.fillStyle = '#3a2a20'; g.fillRect(X + 1, Y + 1, 1, 1); } } return; }
    const up = at(x, y - 1), lf = at(x - 1, y), rt = at(x + 1, y), dn = at(x, y + 1);
    if (t === DIRT || t === ORE) {
      g.fillStyle = DIRT_C[Math.floor(h * 3)]; g.fillRect(X, Y, 4, 4);
      g.fillStyle = h > .6 ? '#5a3a1a' : '#9a6a35'; g.fillRect(X + Math.floor(h * 977) % 3, Y + Math.floor(h * 331) % 3, 1, 1);
      if (t === ORE) { g.fillStyle = '#c99a2e'; g.fillRect(X, Y + 1, 2, 2); g.fillStyle = '#ffd166'; g.fillRect(X + 2, Y, 2, 2); g.fillStyle = '#fff2c0'; g.fillRect(X + 2, Y, 1, 1); g.fillStyle = '#ffd166'; g.fillRect(X + 1, Y + 3, 2, 1); }
      if (up === AIR) { g.fillStyle = '#5cc84a'; g.fillRect(X, Y, 4, 2); g.fillStyle = '#2f8f3a'; g.fillRect(X, Y + 2, 4, 1); if (h > .5) g.fillRect(X + 1, Y + 3, 1, 1); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(X, Y, 4, 1); }
      else if (t === DIRT) { /* interior */ }
      g.fillStyle = 'rgba(20,10,5,.55)';
      if (lf === AIR) g.fillRect(X, Y, 1, 4); if (rt === AIR) g.fillRect(X + 3, Y, 1, 4); if (dn === AIR) g.fillRect(X, Y + 3, 4, 1);
    } else if (t === ROCK) {
      g.fillStyle = '#4a4f60'; g.fillRect(X, Y, 4, 4); g.fillStyle = '#3a3d4a'; g.fillRect(X, Y + 3, 4, 1); g.fillRect(X + ((y & 1) ? 1 : 3), Y, 1, 3); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(X, Y, 4, 1);
    } else if (t === BUILT) {
      g.fillStyle = '#a8acb8'; g.fillRect(X, Y, 4, 4); g.fillStyle = '#6c7080'; g.fillRect(X, Y + 3, 4, 1); g.fillRect(X + 3, Y, 1, 4); g.fillStyle = '#e0e3ea'; g.fillRect(X, Y, 3, 1); g.fillStyle = '#ffd166'; g.fillRect(X + 1, Y + 1, 1, 1);
    }
  }
  sync(w) {
    if (this.round !== w.round || w.dirtyAll) {
      this.g.clearRect(0, 0, this.c.width, this.c.height);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) this.cell(w, x, y);
      this.round = w.round; w.dirtyAll = false; w.dirty.length = 0; this.miniT = 0; return;
    }
    if (!w.dirty.length) return;
    const seen = new Set();
    for (const i of w.dirty) {
      const x = i % COLS, y = (i / COLS) | 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue; const k = ny * COLS + nx; if (!seen.has(k)) { seen.add(k); this.cell(w, nx, ny); } }
    }
    w.dirty.length = 0;
  }
  drawMini(w, dt) {
    this.miniT -= dt; if (this.miniT > 0) return; this.miniT = .25;
    const g = this.mini.getContext('2d'), img = g.createImageData(COLS, ROWS), d = img.data;
    for (let i = 0; i < w.cells.length; i++) {
      const t = w.cells[i], o = i * 4;
      const c = t === AIR ? (((i / COLS) | 0) >= w.surf[i % COLS] ? [43, 29, 20] : [90, 160, 220]) : t === DIRT ? [138, 90, 43] : t === ROCK ? [70, 75, 90] : t === ORE ? [255, 209, 102] : [168, 172, 184];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
}

/* ------------------------------------------------------------- efectos (cliente) */
export function makeFx() { return { parts: [], texts: [], shake: 0, boom: [] }; }
export function fxBurst(fx, x, y, n, col, spd = 160, up = 50) {
  for (let i = 0; i < n; i++) { const a = (i * 2.399963 + x * .37 + y * .11) % 6.2832, s = (.35 + ((i * 7919) % 100) / 100) * spd; fx.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: .35 + ((i * 31) % 50) / 100, c: col, s: 2 + (i % 3) * 2 }); }
}
export function updateFx(fx, dt) {
  for (const q of fx.parts) { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  fx.parts = fx.parts.filter(q => q.life > 0);
  for (const t of fx.texts) { t.y -= 30 * dt; t.life -= dt; } fx.texts = fx.texts.filter(t => t.life > 0);
  for (const b of fx.boom) b.t += dt; fx.boom = fx.boom.filter(b => b.t < .35);
  fx.shake = Math.max(0, fx.shake - 40 * dt);
}

/* ------------------------------------------------------------------- camara */
export function zoomFor(W, H) { return W >= 2300 && H >= 1300 ? 3 : 2; }
export function updateCamera(cam, w, me, W, H, mouseW, dt) {
  const k = zoomFor(W, H) / 2, vw = W / k, vh = H / k, p = w.players[me];
  let tx = p.x - vw / 2, ty = p.y - p.h / 2 - vh / 2;
  if (mouseW) { tx += (mouseW.x - p.x) * .18; ty += (mouseW.y - p.y) * .18; }
  tx = WORLD_W <= vw ? (WORLD_W - vw) / 2 : Math.max(0, Math.min(WORLD_W - vw, tx));
  ty = WORLD_H <= vh ? (WORLD_H - vh) / 2 : Math.max(0, Math.min(WORLD_H - vh, ty));
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; } else { cam.x += (tx - cam.x) * Math.min(1, 8 * dt); cam.y += (ty - cam.y) * Math.min(1, 8 * dt); }
}

/* ------------------------------------------------------------------ jugadores */
function customGun(g, kind, x, y, a) {
  g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(a); if (Math.cos(a) < 0) g.scale(1, -1);
  if (kind === 2) { g.fillStyle = '#1a1a24'; g.fillRect(-6, -7, 34, 12); g.fillStyle = '#6c7080'; g.fillRect(-4, -5, 30, 8); g.fillStyle = '#a8acb8'; g.fillRect(-4, -5, 30, 2); g.fillStyle = '#e63946'; g.fillRect(24, -6, 6, 10); g.fillStyle = '#3a3d4a'; g.fillRect(-8, -4, 6, 6); }
  else { g.fillStyle = '#1a1a24'; g.fillRect(-4, -6, 26, 10); g.fillStyle = '#2266bb'; g.fillRect(-2, -4, 22, 6); g.fillStyle = '#8fe3ff'; g.fillRect(4, -3, 14, 2); g.fillStyle = '#fff'; g.fillRect(20, -3, 4, 4); }
  g.restore();
}
function drawPlayer(g, w, p, t, mine) {
  if (!p.alive) return;
  const air = !p.onGround, moving = Math.abs(p.vx) > 20, ci = mine ? 0 : 1, hue = HUES[ci];
  let name;
  if (air) name = p.flying ? 'playerFly' : 'playerJump'; else if (p.crouch) name = moving ? 'playerCrouchWalk' : 'playerCrouch'; else name = moving ? 'playerRun' : 'playerIdle';
  if (!okSpr(name)) name = ['playerIdle', 'playerRun', 'playerJump'].find(okSpr);
  if (p.flash > 0 && Math.floor(p.flash / 2) % 2) g.globalAlpha = .55;
  if (p.flying && okSpr('jetpack')) {
    const cx = p.x - p.face * 8, cy = p.y - 23;
    if (okSpr('jetFlame')) drawSpr('jetFlame', p.t, cx, cy + 14, false, 0, .5, 0, true, hue);
    drawSpr('jetpack', 0, cx, cy, p.face < 0, 0, .5, .5, true, hue);
  }
  if (name) drawSpr(name, p.t, p.x, p.y, p.face < 0, 0, .5, 1, true, hue); else { g.fillStyle = P_COLORS[ci]; g.fillRect(p.x - 8, p.y - p.h, 16, p.h); }
  const a = Math.atan2(AIM[p.aim].y, AIM[p.aim].x), sy = p.y + (p.crouch ? -28 : -32);
  drawArm(p.x, sy, a, P_COLORS[ci]);
  const gx = p.x + Math.cos(a) * 16, gy = sy + Math.sin(a) * 16;
  if (p.digAnim > 0) {
    const sw = a + (p.digAnim / 8 - .5) * 1.6;
    g.save(); g.translate(gx, gy); g.rotate(sw); if (Math.cos(a) < 0) g.scale(1, -1);
    g.fillStyle = '#5a3a1a'; g.fillRect(0, -2, 26, 4); g.fillStyle = '#a8acb8'; g.fillRect(22, -8, 6, 16); g.fillStyle = '#e0e3ea'; g.fillRect(22, -8, 6, 3); g.restore();
  } else if (p.sel === 0) drawGun(0, gx, gy, a, P_COLORS[ci]); else if (p.sel === 1) drawGun(2, gx, gy, a, P_COLORS[ci]); else customGun(g, p.sel, gx, gy, a);
  g.globalAlpha = 1;
  // barra de vida sobre la cabeza
  const bx = Math.round(p.x - 16), by = Math.round(p.y - p.h - 14);
  g.fillStyle = '#000'; g.fillRect(bx - 2, by - 2, 36, 8); g.fillStyle = '#0c0c0e'; g.fillRect(bx, by, 32, 4);
  g.fillStyle = p.hp > 35 ? '#4ade80' : '#e63946'; g.fillRect(bx, by, Math.round(32 * p.hp / HP_MAX), 4);
  if (mine) { g.fillStyle = '#ffd166'; g.fillRect(Math.round(p.x) - 3, by - 10, 6, 4); }
}

/* -------------------------------------------------------------------- mundo */
export function drawArena(g, w, tv, fx, cam, W, H, DPR, t, me, ui) {
  const zs = zoomFor(W, H), k = zs / 2;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.imageSmoothingEnabled = false;
  // cielo y colinas
  const th = THEMES.day, bg = backgroundFor(th), grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, th.sky[0]); grad.addColorStop(1, th.sky[1]); g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (const L of bg.layers) { const lw = 256 * zs, lh = 112 * zs, off = -((cam.x * (L.f || .2) * k + (L.drift ? t * L.drift * zs : 0)) % lw + lw) % lw; const y = L.top ? 10 * zs - cam.y * .05 * k : Math.min(H, (WORLD_H * .55 - cam.y) * k) - lh * .35; for (let x = off; x < W; x += lw) g.drawImage(L.c, x, y, lw, lh); }

  const sx = (Math.random() - .5) * fx.shake, sy = (Math.random() - .5) * fx.shake;
  const cx = Math.round((cam.x + sx) / 2) * 2, cy = Math.round((cam.y + sy) / 2) * 2;
  g.setTransform(DPR * k, 0, 0, DPR * k, -cx * DPR * k, -cy * DPR * k);
  const vw = W / k, vh = H / k;
  g.save(); g.beginPath(); g.rect(0, 0, WORLD_W, WORLD_H); g.clip();
  // lava (detras del terreno: se ve en el aire y en las cuevas)
  if (w.lavaY < WORLD_H) {
    const top = Math.max(0, w.lavaY);
    for (let x = Math.floor(cx / 32) * 32; x < cx + vw + 32; x += 32) {
      const f = Math.floor(t * 4 + x / 32) % 4;
      g.drawImage(LAVA.top[f], x, top - 4, 32, 32);
    }
    g.fillStyle = '#e8541a'; g.fillRect(cx, top + 28, vw + 32, WORLD_H - top);
  }
  // terreno
  tv.sync(w);
  const sxp = Math.max(0, cx / 2), syp = Math.max(0, cy / 2), swp = Math.min(WORLD_W / 2 - sxp, vw / 2 + 2), shp = Math.min(WORLD_H / 2 - syp, vh / 2 + 2);
  g.drawImage(tv.c, sxp, syp, swp, shp, sxp * 2, syp * 2, swp * 2, shp * 2);

  // suministros
  for (const d of w.drops) {
    const col = { shotgun: '#ff7a3d', bazooka: '#e63946', laser: '#4aa3ff', medkit: '#4ade80', gold: '#ffd166' }[d.kind], lab = { shotgun: 'E', bazooka: 'B', laser: 'L', medkit: '+', gold: '$' }[d.kind];
    const bx = Math.round(d.x - 12), by = Math.round(d.y - 24);
    if (!d.landed) { g.fillStyle = '#f4f1e8'; g.fillRect(bx - 8, by - 26, 40, 8); g.fillRect(bx - 4, by - 30, 32, 4); g.fillRect(bx, by - 18, 24, 2); g.fillStyle = '#1a1a24'; g.fillRect(bx - 8, by - 26, 2, 22); g.fillRect(bx + 30, by - 26, 2, 22); g.fillRect(bx + 11, by - 18, 2, 18); }
    g.fillStyle = '#1a1a24'; g.fillRect(bx - 2, by - 2, 28, 28); g.fillStyle = '#8a5a2b'; g.fillRect(bx, by, 24, 24); g.fillStyle = col; g.fillRect(bx, by + 8, 24, 8);
    g.fillStyle = '#000'; g.font = '10px ' + PF; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lab, bx + 12, by + 13);
  }
  // jugadores
  drawPlayer(g, w, w.players[1 - me], t, false);
  drawPlayer(g, w, w.players[me], t, true);
  // proyectiles y rayos
  for (const b of w.proj) {
    if (b.kind === 'rocket') { const a = Math.atan2(b.vy, b.vx); g.save(); g.translate(b.x, b.y); g.rotate(a); g.fillStyle = '#ff7a3d'; g.fillRect(-16, -3, 10, 6); g.fillStyle = '#ffd166'; g.fillRect(-12, -2, 6, 4); g.fillStyle = '#1a1a24'; g.fillRect(-6, -5, 14, 10); g.fillStyle = '#a8acb8'; g.fillRect(-4, -3, 10, 6); g.fillStyle = '#e63946'; g.fillRect(6, -4, 4, 8); g.restore(); }
    else { g.save(); g.translate(b.x, b.y); g.rotate(Math.atan2(b.vy, b.vx)); g.fillStyle = '#ff7a3d'; g.fillRect(-12, -2, 12, 4); g.fillStyle = '#ffd166'; g.fillRect(-6, -2, 8, 4); g.fillStyle = '#fff'; g.fillRect(-2, -1, 4, 2); g.restore(); }
  }
  for (const b of w.beams) { const a = b.ttl / 10; g.globalAlpha = a; g.strokeStyle = '#8fe3ff'; g.lineWidth = 10 * a + 2; g.beginPath(); g.moveTo(b.x0, b.y0); g.lineTo(b.x1, b.y1); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.globalAlpha = 1; }
  for (const b of fx.boom) { const r = b.r * (.4 + b.t * 3), a = 1 - b.t / .35; g.globalAlpha = a; g.fillStyle = '#ffd166'; g.beginPath(); g.arc(b.x, b.y, r * .7, 0, 6.2832); g.fill(); g.strokeStyle = '#ff7a3d'; g.lineWidth = 6; g.beginPath(); g.arc(b.x, b.y, r, 0, 6.2832); g.stroke(); g.globalAlpha = 1; }
  for (const q of fx.parts) { g.globalAlpha = Math.min(1, q.life * 2); g.fillStyle = q.c; g.fillRect(Math.round(q.x / 2) * 2, Math.round(q.y / 2) * 2, q.s, q.s); }
  g.globalAlpha = 1;
  for (const tx of fx.texts) { g.globalAlpha = Math.min(1, tx.life * 2); g.font = '10px ' + PF; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(tx.s, tx.x + 2, tx.y + 2); g.fillStyle = tx.c; g.fillText(tx.s, tx.x, tx.y); g.globalAlpha = 1; }
  g.restore();

  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawHud(g, w, tv, W, H, me, t, ui, cam, k);
}

/* --------------------------------------------------------------------- HUD */
function pxBox(g, x, y, w, h, fill = '#1b1b1f') {
  g.fillStyle = '#000'; g.fillRect(x, y - 4, w, h + 8); g.fillRect(x - 4, y, w + 8, h);
  g.fillStyle = fill; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x, y, w, 3); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, y + h - 3, w, 3);
}
function bar(g, x, y, w, h, frac, col) {
  const n = Math.floor((w + 2) / 8), on = Math.ceil(Math.max(0, Math.min(1, frac)) * n - 1e-6);
  for (let i = 0; i < n; i++) { g.fillStyle = i < on ? col : '#0c0c0e'; g.fillRect(x + i * 8, y, 6, h); }
}
function drawHud(g, w, tv, W, H, me, t, ui, cam, k) {
  const p = w.players[me], q = w.players[1 - me];
  g.textBaseline = 'middle'; g.textAlign = 'left';
  // panel del jugador
  pxBox(g, 18, 18, 250, 128);
  g.font = '8px ' + PF; g.fillStyle = '#a09fa8'; g.fillText('VIDA', 30, 36); bar(g, 82, 30, 170, 12, p.hp / HP_MAX, p.hp > 35 ? '#4ade80' : '#e63946');
  g.fillText('FUEL', 30, 58); bar(g, 82, 52, 170, 12, p.fuel / FUEL_MAX, '#ff7a3d');
  g.fillStyle = '#ffd166'; g.font = '18px ' + VT; g.fillText('ORO ' + p.gold, 30, 84);
  g.fillStyle = '#a09fa8'; g.fillText('CONSTRUIR (Q): ' + BUILD_COST, 110, 84);
  // armas 1..4
  WEAPONS.forEach((wp, i) => {
    const x = 30 + i * 56, sel = p.sel === i, empty = wp.ammo >= 0 && p.ammo[i] === 0;
    g.fillStyle = sel ? '#ff7a3d' : '#0c0c0e'; g.fillRect(x, 98, 50, 36);
    g.fillStyle = sel ? '#000' : empty ? '#e63946' : '#f4f1e8'; g.font = '8px ' + PF; g.textAlign = 'center'; g.fillText(String(i + 1), x + 25, 108);
    g.font = '18px ' + VT; g.fillText(wp.ammo < 0 ? '∞' : String(p.ammo[i]), x + 25, 124); g.textAlign = 'left';
  });
  // mercado (precios compartidos)
  pxBox(g, 18, 164, 250, 66);
  g.font = '8px ' + PF; g.fillStyle = '#ff7a3d'; g.fillText('MERCADO COMPARTIDO', 30, 178);
  g.font = '18px ' + VT; g.fillStyle = '#f4f1e8';
  const cur = p.sel, ammoP = cur > 0 ? priceOf(w, 'ammo', cur) : '-';
  g.fillText('Z curar +40: ' + priceOf(w, 'heal') + '   X fuel: ' + priceOf(w, 'fuel'), 30, 198); g.fillText('C munición (' + WEAPONS[cur].name + '): ' + ammoP, 30, 218);

  // marcador y reloj (centro)
  const sw = 300; pxBox(g, Math.round(W / 2 - sw / 2), 18, sw, 44);
  g.textAlign = 'center'; g.font = '10px ' + PF; g.fillStyle = '#f4f1e8'; g.fillText('RONDA ' + w.round, W / 2, 30);
  for (let i = 0; i < 2; i++) { const pid = i === 0 ? me : 1 - me; for (let j = 0; j < w.winRounds; j++) { g.fillStyle = j < w.scores[pid] ? P_COLORS[i] : '#0c0c0e'; g.fillRect(i === 0 ? W / 2 - 130 + j * 18 : W / 2 + 130 - (j + 1) * 18 + 2, 44, 14, 10); } }
  const left = (LAVA_START - w.roundTick) / TICK_HZ;
  g.font = '8px ' + PF; g.fillStyle = left > 0 ? '#a09fa8' : Math.floor(t * 4) % 2 ? '#ff7a3d' : '#e63946'; g.fillText(left > 0 ? 'LAVA EN ' + Math.ceil(left) + ' s' : '¡LA LAVA SUBE!', W / 2, 49);
  g.textAlign = 'left';

  // minimapa
  const mw = COLS, mh = ROWS, mx = W - mw - 22, my = 18; tv.drawMini(w, 1 / 60);
  pxBox(g, mx, my, mw, mh, '#000'); g.imageSmoothingEnabled = false; g.drawImage(tv.mini, mx, my);
  if (w.lavaY < ROWS * CS) { g.fillStyle = 'rgba(232,84,26,.75)'; const ly = Math.max(0, w.lavaY / CS); g.fillRect(mx, my + ly, mw, mh - ly); }
  for (const pl of w.players) if (pl.alive) { g.fillStyle = P_COLORS[pl.id === me ? 0 : 1]; g.fillRect(mx + Math.round(pl.x / CS) - 2, my + Math.round((pl.y - 20) / CS) - 2, 5, 5); }
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.strokeRect(mx + cam.x / CS, my + cam.y / CS, W / k / CS, H / k / CS);

  // flecha hacia el rival si esta fuera de pantalla
  if (q.alive) {
    const sx = (q.x - cam.x) * k, sy = (q.y - q.h / 2 - cam.y) * k;
    if (sx < 0 || sy < 0 || sx > W || sy > H) {
      const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy, s = Math.min((W / 2 - 40) / Math.abs(dx || 1), (H / 2 - 40) / Math.abs(dy || 1));
      const ax = cx + dx * s, ay = cy + dy * s, ang = Math.atan2(dy, dx);
      g.save(); g.translate(ax, ay); g.rotate(ang); g.fillStyle = '#000'; g.beginPath(); g.moveTo(16, 0); g.lineTo(-10, -12); g.lineTo(-10, 12); g.fill(); g.fillStyle = P_COLORS[1]; g.beginPath(); g.moveTo(12, 0); g.lineTo(-7, -8); g.lineTo(-7, 8); g.fill(); g.restore();
    }
  }
  // mensajes de fase
  g.textAlign = 'center';
  if (w.phase === 'countdown') { const n = Math.ceil(w.phaseT / TICK_HZ); g.font = '48px ' + PF; g.fillStyle = '#000'; g.fillText(String(n), W / 2 + 4, H * .32 + 4); g.fillStyle = '#ffd166'; g.fillText(String(n), W / 2, H * .32); g.font = '12px ' + PF; g.fillStyle = '#f4f1e8'; g.fillText('RONDA ' + w.round, W / 2, H * .32 + 50); }
  if (w.phase === 'over') { const txt = w.winner < 0 ? 'EMPATE' : w.winner === me ? '¡GANASTE LA RONDA!' : 'PERDISTE LA RONDA'; g.font = '20px ' + PF; g.fillStyle = '#000'; g.fillText(txt, W / 2 + 3, H * .3 + 3); g.fillStyle = w.winner === me ? '#4ade80' : w.winner < 0 ? '#f4f1e8' : '#e63946'; g.fillText(txt, W / 2, H * .3); }
  if (ui.stall) { g.font = '10px ' + PF; g.fillStyle = '#000'; g.fillText('ESPERANDO AL RIVAL...', W / 2 + 2, H * .5 + 2); g.fillStyle = '#ffd166'; g.fillText('ESPERANDO AL RIVAL...', W / 2, H * .5); }
  if (ui.info) { g.font = '18px ' + VT; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(W - 240, H - 34, 230, 24); g.fillStyle = '#a09fa8'; g.textAlign = 'right'; g.fillText(ui.info, W - 18, H - 22); }
  if (ui.hint) { const txt = 'A/D mover · ESPACIO saltar/volar · CLICK disparar · CLICK DER. picar · 1-4 armas · Q construir · Z/X/C comprar'; g.font = '18px ' + VT; const hw = g.measureText(txt).width + 32; g.textAlign = 'center'; pxBox(g, Math.round(W / 2 - hw / 2), H - 40, hw, 26); g.fillStyle = '#a09fa8'; g.fillText(txt, W / 2, H - 27); }
  g.textAlign = 'left';
  if (ui.flash > 0) { g.fillStyle = 'rgba(230,57,70,' + Math.min(.4, ui.flash) + ')'; g.fillRect(0, 0, W, H); }
}
