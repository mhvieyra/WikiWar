// Arte del modo Aventura: convierte los datos de artData.js en canvases,
// genera por codigo los tiles, puertas, botones, fondos y demas, y expone
// helpers de dibujo. Todo se dibuja a x2 (ver SPR_SCALE) con pixel art nitido.
import { SPRITES as DATA, PAL, CHANNEL } from './artData.js';

export const T = 32;            // lado de un tile en unidades de mundo
const S2 = 2;                   // cada pixel de arte mide 2 unidades de mundo

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const R = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

/* ------------------------------------------------------------ sprites de datos */
function fromRows(rows, w) {
  const h = 16, c = mk(w, h), g = c.getContext('2d'), off = h - rows.length;
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch !== '.') R(g, x, y + off, 1, 1, PAL[ch]); } });
  return c;
}
export const SP = {};
for (const [name, frames] of Object.entries(DATA)) {
  const w = Math.max(...frames.flat().map(r => r.length));
  SP[name] = frames.map(f => fromRows(f, w));
}

// silueta blanca (para el destello al recibir daño), cacheada por canvas
const flashCache = new WeakMap();
export function flashOf(c) {
  let f = flashCache.get(c);
  if (!f) {
    f = mk(c.width, c.height); const g = f.getContext('2d');
    g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; R(g, 0, 0, c.width, c.height, '#ffffff');
    flashCache.set(c, f);
  }
  return f;
}

/* ----------------------------------------------------------- sprites por codigo */
// moneda: 4 frames de giro
SP.coin = [10, 8, 4, 8].map(w => {
  const c = mk(16, 16), g = c.getContext('2d'), x = 8 - w / 2;
  R(g, x, 3, w, 10, PAL.k); R(g, x + 1, 2, w - 2, 12, PAL.k);
  R(g, x + 1, 3, w - 2, 10, PAL.Y); if (w > 4) { R(g, x + 2, 4, w - 4, 8, PAL.y); R(g, x + 2, 4, 1, 4, PAL.w); R(g, 7, 6, 2, 4, PAL.Y); }
  return c;
});

// puertas, botones, palancas: [canal 1..3][estado]
export const DOOR = [], PLATE = [], LEVER = [];
CHANNEL.forEach((col, ch) => {
  if (!col) return;
  const door = [false, true].map(open => {
    const c = mk(16, 16), g = c.getContext('2d');
    if (!open) {
      R(g, 0, 0, 16, 16, PAL.k); R(g, 1, 0, 14, 16, '#4a4f60'); R(g, 2, 0, 12, 16, PAL.G);
      for (let y = 1; y < 16; y += 4) R(g, 2, y, 12, 1, PAL.g);
      R(g, 5, 0, 6, 16, col.dark); R(g, 6, 0, 4, 16, col.main); R(g, 6, 0, 1, 16, col.light);
    } else {
      R(g, 0, 0, 2, 16, PAL.k); R(g, 2, 0, 1, 16, col.dark); R(g, 14, 0, 2, 16, PAL.k); R(g, 13, 0, 1, 16, col.dark);
      g.globalAlpha = .4; for (let y = 0; y < 16; y += 4) R(g, 7, y, 2, 2, col.main);
    }
    return c;
  });
  const plate = [false, true].map(down => {
    const c = mk(16, 16), g = c.getContext('2d');
    R(g, 0, 13, 16, 3, PAL.k); R(g, 1, 13, 14, 2, PAL.d);
    const y = down ? 13 : 10;
    R(g, 2, y - 1, 12, down ? 1 : 4, PAL.k); if (!down) { R(g, 3, y, 10, 3, col.main); R(g, 3, y, 10, 1, col.light); R(g, 3, y + 2, 10, 1, col.dark); } else R(g, 3, y - 1, 10, 1, col.main);
    return c;
  });
  const lever = [false, true].map(on => {
    const c = mk(16, 16), g = c.getContext('2d');
    R(g, 2, 12, 12, 4, PAL.k); R(g, 3, 13, 10, 2, PAL.G); R(g, 6, 11, 4, 2, PAL.k);
    const kx = on ? 12 : 3, dir = on ? 1 : -1;
    for (let i = 0; i < 7; i++) { R(g, 8 + dir * (i * 4 / 7) - 1 + (dir > 0 ? .5 : 0), 11 - i, 2, 2, PAL.k); }
    for (let i = 1; i < 7; i++) R(g, Math.round(8 + dir * (i * 4 / 7)) - 1 + (dir > 0 ? 0 : 1), 11 - i, 1, 1, PAL.g);
    R(g, kx - 2, 2, 5, 5, PAL.k); R(g, kx - 1, 3, 3, 3, on ? col.main : col.dark); if (on) R(g, kx - 1, 3, 1, 1, col.light);
    return c;
  });
  DOOR[ch] = door; PLATE[ch] = plate; LEVER[ch] = lever;
});

SP.lock = [(() => {
  const c = mk(16, 16), g = c.getContext('2d');
  R(g, 0, 0, 16, 16, PAL.k); R(g, 1, 1, 14, 14, PAL.Y); R(g, 2, 2, 12, 12, PAL.y); R(g, 2, 2, 12, 1, '#fff2c0');
  R(g, 2, 13, 12, 1, PAL.Y); R(g, 6, 5, 4, 4, PAL.k); R(g, 7, 8, 2, 4, PAL.k);
  [[3, 3], [12, 3], [3, 12], [12, 12]].forEach(([x, y]) => R(g, x, y, 1, 1, PAL.Y));
  return c;
})()];

SP.sign = [(() => {
  const c = mk(16, 16), g = c.getContext('2d');
  R(g, 7, 9, 2, 7, PAL.k); R(g, 7, 9, 1, 7, PAL.n);
  R(g, 1, 2, 14, 9, PAL.k); R(g, 2, 3, 12, 7, PAL.t); R(g, 2, 3, 12, 1, '#e0c08a'); R(g, 2, 9, 12, 1, PAL.n);
  R(g, 4, 5, 8, 1, PAL.N); R(g, 4, 7, 6, 1, PAL.N);
  return c;
})()];

// bloque agrietado, 3 etapas de daño
SP.cracked = [0, 1, 2].map(stage => {
  const c = mk(16, 16), g = c.getContext('2d');
  R(g, 0, 0, 16, 16, PAL.k); R(g, 1, 1, 14, 14, '#7b7488'); R(g, 1, 1, 14, 2, '#9a94ab'); R(g, 1, 13, 14, 2, '#5d576b');
  const cracks = [[[6, 3], [7, 5], [6, 7], [8, 9]], [[11, 2], [10, 5], [12, 8], [11, 11]], [[3, 9], [5, 10], [4, 12], [6, 13]], [[9, 9], [8, 12], [10, 14]]];
  cracks.slice(0, 1 + stage * 1.5 | 0).forEach(l => l.forEach(([x, y]) => R(g, x, y, 1, 1, PAL.k)));
  if (stage === 0) { R(g, 4, 4, 1, 1, '#5d576b'); R(g, 11, 10, 1, 1, '#5d576b'); }
  return c;
});

// segmentos de plataforma movil: izquierda, medio, derecha (16x8)
SP.mover = ['L', 'M', 'R'].map(k => {
  const c = mk(16, 8), g = c.getContext('2d');
  R(g, 0, 0, 16, 8, PAL.k); R(g, k === 'L' ? 1 : 0, 1, k === 'M' ? 16 : 15, 6, PAL.G);
  R(g, k === 'L' ? 1 : 0, 1, k === 'M' ? 16 : 15, 2, PAL.g); R(g, 0, 6, 16, 1, PAL.d);
  if (k === 'L') R(g, 0, 0, 1, 8, 'rgba(0,0,0,0)'), g.clearRect(0, 0, 1, 1), g.clearRect(0, 7, 1, 1);
  if (k === 'R') g.clearRect(15, 0, 1, 1), g.clearRect(15, 7, 1, 1);
  R(g, k === 'L' ? 3 : k === 'R' ? 11 : 7, 3, 2, 2, PAL.y);
  return c;
});

// cuerpo del jefe (32x32) por codigo: esfera metalica con un gran ojo
SP.boss = [0, 1].map(hot => {
  const c = mk(32, 32), g = c.getContext('2d'), cx = 15.5, cy = 15.5;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > 15.5) continue;
    let col = PAL.G;
    if (d > 14) col = PAL.k;
    else if (dx + dy < -8) col = PAL.g; else if (dx + dy > 10) col = PAL.d;
    if (hot && d <= 14) col = dx + dy < -8 ? '#ff9b7a' : dx + dy > 10 ? PAL.R : PAL.r;
    R(g, x, y, 1, 1, col);
  }
  // panel del ojo
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = (x - cx) / 10.5, dy = (y - cy) / 8.5, d = dx * dx + dy * dy;
    if (d <= 1) R(g, x, y, 1, 1, d > .8 ? PAL.k : '#f4f1e8');
  }
  // tornillos y antenas
  [[6, 6], [25, 6], [6, 25], [25, 25]].forEach(([x, y]) => R(g, x, y, 2, 2, PAL.k));
  R(g, 15, 0, 2, 3, PAL.k); R(g, 14, 0, 4, 1, PAL.r);
  return c;
});

/* ------------------------------------------------------------------- portal */
export function drawPortal(g, x, by, t, active) {
  // 16x32 pixeles de arte, anclado con los pies en (x, by)
  for (let j = 0; j < 32; j++) for (let i = 0; i < 16; i++) {
    const dx = (i + .5 - 8) / 7.5, dy = (j + .5 - 16) / 15.5, d = Math.hypot(dx, dy);
    if (d > 1) continue;
    const a = Math.atan2(dy, dx);
    let col;
    if (d > .8) col = active ? (Math.sin(a * 4 - t * 6) > 0 ? '#ffd166' : '#ff7a3d') : (Math.sin(a * 4) > 0 ? '#6c7080' : '#3a3d4a');
    else if (d > .72) col = PAL.k;
    else if (!active) col = '#15151f';
    else { const s = Math.sin(a * 3 + d * 9 - t * 5); col = s > .7 ? '#e9ccff' : s > .1 ? '#8a4fd0' : '#3a1f66'; }
    g.fillStyle = col; g.fillRect(x + (i - 8) * S2, by + (j - 32) * S2, S2, S2);
  }
}

/* --------------------------------------------------------------------- temas */
export const THEMES = {
  day:     { name: 'day', sky: ['#5fb4ee', '#d4f0ff'], far: '#9ccbe8', near: '#6fb58a', style: 'grass', top: '#5cc84a', topD: '#2f8f3a', fill: ['#8a5a2b', '#835428', '#916031'], line: '#5a3a1a', decor: 'clouds' },
  sunset:  { name: 'sunset', sky: ['#ff8a5c', '#ffe0a8'], far: '#e58a86', near: '#a85a78', style: 'grass', top: '#8fc850', topD: '#4f8f3a', fill: ['#8a4a3b', '#834536', '#915040'], line: '#4a2a26', decor: 'clouds' },
  cave:    { name: 'cave', sky: ['#120f1c', '#241b33'], far: '#2b2340', near: '#1d172d', style: 'stone', top: '#6a657a', topD: '#4a4658', fill: ['#4a4658', '#454152', '#504b5f'], line: '#2a2636', decor: 'stalac' },
  night:   { name: 'night', sky: ['#070b28', '#233a80'], far: '#1c2a66', near: '#142052', style: 'grass', top: '#3f9a6a', topD: '#1f5a4a', fill: ['#3a3f66', '#373c61', '#40456e'], line: '#1c1f3a', decor: 'stars' },
  factory: { name: 'factory', sky: ['#1a1d26', '#343a48'], far: '#2a2f3c', near: '#20242e', style: 'metal', top: '#ffd166', topD: '#c99a2e', fill: ['#5a6072', '#565c6e', '#606678'], line: '#2a2f3c', decor: 'pipes' }
};

// pseudo-aleatorio determinista por coordenadas
export function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// Tile de suelo con autotile simple: pasto o borde arriba si no hay solido
// encima, sombra en los bordes libres.
export function drawGround(g, tx, ty, nb, th) {
  const X = tx * 16, Y = ty * 16, rnd = (i) => hash(tx, ty, i);
  const base = th.fill[Math.floor(rnd(1) * 3)];
  R(g, X, Y, 16, 16, base);
  if (th.style === 'stone') {
    R(g, X, Y + 7, 16, 1, th.line); R(g, X, Y + 15, 16, 1, th.line);
    const off = (ty & 1) ? 4 : 10; R(g, X + off, Y, 1, 7, th.line); R(g, X + (off + 8) % 16, Y + 8, 1, 7, th.line);
    R(g, X, Y, 16, 1, 'rgba(255,255,255,.07)');
  } else if (th.style === 'metal') {
    R(g, X, Y, 16, 1, 'rgba(255,255,255,.14)'); R(g, X, Y + 15, 16, 1, th.line); R(g, X + 15, Y, 1, 16, th.line);
    [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([a, b]) => R(g, X + a, Y + b, 1, 1, th.line));
    if (rnd(2) > .6) R(g, X + 5, Y + 6, 6, 4, th.line);
  } else {
    for (let i = 0; i < 6; i++) R(g, X + Math.floor(rnd(10 + i) * 15), Y + Math.floor(rnd(20 + i) * 15), 1 + (rnd(30 + i) > .7 ? 1 : 0), 1, rnd(40 + i) > .5 ? th.line : th.fill[2]);
  }
  if (!nb.up) {
    if (th.style === 'grass') {
      R(g, X, Y, 16, 3, th.top); R(g, X, Y, 16, 1, 'rgba(255,255,255,.22)');
      for (let x = 0; x < 16; x++) { const len = 3 + Math.floor(rnd(50 + x) * 3); R(g, X + x, Y + 3, 1, len - 3, th.topD); if (len > 3) R(g, X + x, Y + 3, 1, 1, th.top); }
    } else if (th.style === 'metal') {
      for (let x = 0; x < 16; x += 4) { R(g, X + x, Y, 2, 3, th.top); R(g, X + x + 2, Y, 2, 3, PAL.k); }
    } else { R(g, X, Y, 16, 2, th.top); R(g, X, Y + 2, 16, 1, th.line); }
  }
  if (!nb.left) R(g, X, Y, 1, 16, th.line);
  if (!nb.right) R(g, X + 15, Y, 1, 16, th.line);
  if (!nb.down) R(g, X, Y + 15, 16, 1, th.line);
}
export function drawOneWay(g, tx, ty, th) {
  const X = tx * 16, Y = ty * 16;
  if (th.style === 'metal' || th.style === 'stone') {
    R(g, X, Y, 16, 5, PAL.k); R(g, X, Y + 1, 16, 3, PAL.G); R(g, X, Y + 1, 16, 1, PAL.g);
    for (let x = 2; x < 16; x += 4) R(g, X + x, Y + 2, 1, 2, PAL.d);
  } else {
    R(g, X, Y, 16, 6, PAL.k); R(g, X, Y + 1, 16, 4, PAL.t); R(g, X, Y + 1, 16, 1, '#e0c08a'); R(g, X, Y + 4, 16, 1, PAL.n);
    R(g, X + 5, Y + 1, 1, 4, PAL.n); R(g, X + 11, Y + 1, 1, 4, PAL.n);
  }
}
export function drawSpikes(g, tx, ty) { g.drawImage(SP.spikes[0], 0, 8, 16, 8, tx * 16, ty * 16 + 8, 16, 8); }

// tile de lava con superficie animada (4 frames) y version "profunda"
const lavaFrames = [0, 1, 2, 3].map(f => {
  const c = mk(16, 16), g = c.getContext('2d');
  R(g, 0, 0, 16, 16, '#e8541a');
  for (let x = 0; x < 16; x++) { const h = 3 + Math.round(Math.sin((x + f * 4) / 16 * 6.283 * 2) * 1.5); R(g, x, 0, 1, h, 'rgba(0,0,0,0)'); g.clearRect(x, 0, 1, h); R(g, x, h, 1, 2, '#ffd166'); R(g, x, h + 2, 1, 2, '#ff9a3d'); }
  [[3, 9], [10, 11], [6, 13]].forEach(([x, y], i) => R(g, (x + f * 3) % 16, y, 2, 1, '#ff9a3d'));
  return c;
});
const lavaDeep = [0, 1, 2, 3].map(f => {
  const c = mk(16, 16), g = c.getContext('2d');
  R(g, 0, 0, 16, 16, '#e8541a'); [[3, 3], [10, 6], [6, 11], [13, 13]].forEach(([x, y]) => R(g, (x + f * 3) % 16, y, 3, 1, '#ff9a3d'));
  return c;
});
export const LAVA = { top: lavaFrames, deep: lavaDeep };

/* ------------------------------------------------------------------- fondos */
// Capas de parallax tileables: 256x112 px de arte. Las alturas usan senos con
// periodos que dividen 256 para que el borde derecho empalme con el izquierdo.
function silhouette(col, seed, base, amp, hi) {
  const c = mk(256, 112), g = c.getContext('2d');
  for (let x = 0; x < 256; x++) {
    const a = Math.sin(x / 256 * 6.283 * (1 + seed)) * .5 + Math.sin(x / 256 * 6.283 * (3 + seed * 2) + seed) * .3 + Math.sin(x / 256 * 6.283 * (7 + seed) + seed * 3) * .2;
    const h = Math.round(base + a * amp);
    R(g, x, 112 - h, 1, h, col); if (hi) R(g, x, 112 - h, 1, 1, hi);
  }
  return c;
}
function cloudLayer() {
  const c = mk(256, 112), g = c.getContext('2d');
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(hash(i, 1, 9) * 220), y = 8 + Math.floor(hash(i, 2, 9) * 45), w = 24 + Math.floor(hash(i, 3, 9) * 22);
    R(g, x + 4, y + 6, w - 8, 6, 'rgba(255,255,255,.85)'); R(g, x, y + 8, w, 4, 'rgba(255,255,255,.85)');
    R(g, x + 8, y + 2, w * .4, 6, 'rgba(255,255,255,.9)'); R(g, x + w * .45, y + 4, w * .3, 4, 'rgba(255,255,255,.9)');
    R(g, x, y + 11, w, 1, 'rgba(180,200,230,.5)');
  }
  return c;
}
function starLayer() {
  const c = mk(256, 112), g = c.getContext('2d');
  for (let i = 0; i < 60; i++) R(g, Math.floor(hash(i, 4, 3) * 256), Math.floor(hash(i, 5, 3) * 112), 1, 1, hash(i, 6, 3) > .8 ? '#fff' : 'rgba(255,255,255,.55)');
  R(g, 200, 14, 10, 10, '#f4f1e8'); R(g, 203, 12, 4, 14, '#f4f1e8'); R(g, 198, 17, 14, 4, '#f4f1e8'); R(g, 203, 14, 8, 8, '#070b28'); R(g, 205, 16, 6, 6, '#233a80');
  return c;
}
function stalacLayer(col) {
  const c = mk(256, 112), g = c.getContext('2d');
  for (let x = 0; x < 256; x += 2) { const h = Math.floor(6 + hash(x, 7, 5) * 28 * (Math.sin(x / 256 * 6.283 * 3) * .5 + .6)); R(g, x, 0, 2, h, col); R(g, x + (hash(x, 8, 5) > .5 ? 0 : 1), h, 1, 3 + Math.floor(hash(x, 9, 5) * 6), col); }
  return c;
}
function pipeLayer(col, lite) {
  const c = mk(256, 112), g = c.getContext('2d');
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(i * 21 + hash(i, 1, 6) * 8), w = 6 + Math.floor(hash(i, 2, 6) * 8), h = 30 + Math.floor(hash(i, 3, 6) * 70);
    R(g, x, 112 - h, w, h, col); R(g, x, 112 - h, w, 2, lite); R(g, x + 1, 112 - h + 6, w - 2, 1, 'rgba(0,0,0,.35)');
    for (let y = 112 - h + 10; y < 108; y += 12) if (hash(i, y, 7) > .6) R(g, x + 2, y, 2, 2, '#ffd166');
  }
  R(g, 0, 30, 256, 5, col); R(g, 0, 30, 256, 1, lite);
  return c;
}
const bgCache = {};
export function backgroundFor(th) {
  if (bgCache[th.name]) return bgCache[th.name];
  const layers = [];
  if (th.decor === 'stars') layers.push({ c: starLayer(), f: .05, top: true, anim: true });
  if (th.decor === 'clouds') layers.push({ c: cloudLayer(), f: .1, top: true, drift: 4 });
  if (th.decor === 'stalac') layers.push({ c: stalacLayer(th.far), f: .3, top: true, ceil: true });
  if (th.decor === 'pipes') layers.push({ c: pipeLayer(th.far, '#3a4152'), f: .25, top: false });
  else layers.push({ c: silhouette(th.far, .3, 44, 26, null), f: .25, top: false });
  layers.push({ c: th.decor === 'pipes' ? pipeLayer(th.near, '#2c313e') : silhouette(th.near, 1.1, 24, 16, null), f: .5, top: false });
  return (bgCache[th.name] = { layers });
}
