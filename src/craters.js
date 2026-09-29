// Destruccion del terreno: las explosiones abren crateres reales en una
// grilla de pixeles gruesos (L.hg). El hueco es una ventana a un fondo pixel
// art (estilo Windows XP): las letras cubiertas se caen una por una, las
// palabras a medias siguen en pie pero no sostienen a nadie sobre la parte
// hueca, y el piso se hunde (L.depth guarda cuanto se hundio cada columna).
// Las imagenes no se cavan: se agrietan y, al romperse, salen en pedazos.
import { state, ctx, cv } from './state.js';
import { clamp } from './utils.js';

const PX = 4;                  // tamano de cada "pixel" del crater (px de pantalla)
const COLS = 1024;             // ancho maximo de la grilla (4096 px)
const MAX_DEPTH = 90;          // hundimiento maximo del piso (px)
const DEBRIS_G = 1500;
const MAX_LETTERS = 500, MAX_SHARDS = 320;

export function initCraters(L) {
  L.hg = null;                 // grilla de huecos (1 = hueco)
  L.hcount = 0;
  L.depth = new Float32Array(4096);
  L.covered = [];              // links que quedaron dentro de un crater (se redibujan encima)
  L.imgs = null;
}

/* ------------------------------------------------------------------ grilla */
function ensureGrid(L) {
  if (L.hg) return;
  const rows = Math.ceil((L.h + 800) / PX);
  L.rows = rows; L.hg = new Uint8Array(COLS * rows);
  const mk = () => { const c = document.createElement('canvas'); c.width = COLS; c.height = rows; return c; };
  L.holeCv = mk(); L.ringCv = mk(); L.shadeCv = mk();
}

export function inCrater(x, y) {
  const L = state.L;
  if (!L || !L.hg) return false;
  const cx = Math.floor(x / PX), cy = Math.floor(y / PX);
  return cx >= 0 && cx < COLS && cy >= 0 && cy < L.rows && L.hg[cy * COLS + cx] === 1;
}

// Hay algun pixel de hueco dentro del rectangulo?
export function holeTouches(pl) {
  const L = state.L;
  if (!L || !L.hg) return false;
  const x0 = Math.max(0, Math.floor(pl.x / PX)), x1 = Math.min(COLS - 1, Math.floor((pl.x + pl.w) / PX));
  const y0 = Math.max(0, Math.floor(pl.y / PX)), y1 = Math.min(L.rows - 1, Math.floor((pl.y + pl.h) / PX));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (L.hg[cy * COLS + cx]) return true;
  return false;
}

// Una plataforma-palabra no sostiene a nadie donde tiene un hueco debajo.
// Los links son portales: nunca se hunden.
export function holedAt(pl, x) {
  if (pl.link || !state.L.hcount) return false;
  return inCrater(clamp(x, pl.x, pl.x + pl.w), pl.y + 1);
}

export function floorAt(x) {
  const L = state.L;
  return L.floorY + L.depth[clamp(Math.round(x), 0, 4095)];
}

// El piso se hunde en escalones de PX, igual que el hueco.
function digFloor(c) {
  const L = state.L, g0 = Math.max(0, Math.floor((c.x - c.r) / PX)), g1 = Math.min(1023, Math.ceil((c.x + c.r) / PX));
  for (let g = g0; g <= g1; g++) {
    const xc = g * PX + PX / 2, dy = Math.sqrt(Math.max(0, c.r * c.r - (xc - c.x) * (xc - c.x)));
    if (dy === 0 || c.y - dy > L.floorY + L.depth[g * PX]) continue;
    const d = Math.min(MAX_DEPTH, Math.ceil((c.y + dy - L.floorY) / PX) * PX);
    for (let i = g * PX; i < g * PX + PX; i++) L.depth[i] = Math.max(L.depth[i], d);
  }
}

function hash(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }

// Forma irregular: un circulo grande mas varios "mordiscos" alrededor,
// rasterizados a pixeles gruesos con el borde dentado.
export function makeCrater(x, y, R) {
  const L = state.L; ensureGrid(L);
  const cs = [{ x, y, r: R * .78 }];
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * 6.283, d = R * (.35 + Math.random() * .4);
    cs.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * .85, r: R * (.24 + Math.random() * .22) });
  }
  for (const c of cs) digFloor(c);
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const c of cs) { bx0 = Math.min(bx0, c.x - c.r); by0 = Math.min(by0, c.y - c.r); bx1 = Math.max(bx1, c.x + c.r); by1 = Math.max(by1, c.y + c.r); }
  const cx0 = clamp(Math.floor(bx0 / PX) - 1, 0, COLS - 1), cx1 = clamp(Math.ceil(bx1 / PX) + 1, 0, COLS - 1);
  const cy0 = clamp(Math.floor(by0 / PX) - 1, 0, L.rows - 1), cy1 = clamp(Math.ceil(by1 / PX) + 1, 0, L.rows - 1);
  if (!L.imgs) L.imgs = L.plats.filter(p => p.kind === 'img');
  const imgs = L.imgs.filter(p => p.alive);
  for (let cy = cy0; cy <= cy1; cy++) {
    const py = (cy + .5) * PX;
    if (py >= L.floorY - 2) continue;
    for (let cx = cx0; cx <= cx1; cx++) {
      const i = cy * COLS + cx;
      if (L.hg[i]) continue;
      const px = (cx + .5) * PX;
      let inside = false;
      const jit = (hash(cx, cy) - .5) * PX * 1.8;
      for (const c of cs) if (Math.hypot(px - c.x, py - c.y) < c.r + jit) { inside = true; break; }
      if (!inside) continue;
      let onImg = false;
      for (const im of imgs) if (px >= im.x && px <= im.x + im.w && py >= im.y && py <= im.y + im.h) { onImg = true; break; }
      if (onImg) continue;
      L.hg[i] = 1; L.hcount++;
    }
  }
  refresh(L, cx0 - 3, cy0 - 3, cx1 + 3, cy1 + 3);
  return { x0: bx0, y0: by0, x1: bx1, y1: by1 };
}

// Repinta las tres capas (hueco, aro y sombra) en la zona indicada.
function refresh(L, x0, y0, x1, y1) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(COLS - 1, x1); y1 = Math.min(L.rows - 1, y1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w <= 0 || h <= 0) return;
  const hole = new ImageData(w, h), ring = new ImageData(w, h), shade = new ImageData(w, h);
  const at = (cx, cy) => (cx < 0 || cy < 0 || cx >= COLS || cy >= L.rows) ? 0 : L.hg[cy * COLS + cx];
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const o = ((cy - y0) * w + (cx - x0)) * 4;
    if (at(cx, cy)) {
      hole.data[o] = hole.data[o + 1] = hole.data[o + 2] = 255; hole.data[o + 3] = 255;
      let a = 0;
      if (!at(cx, cy - 1)) a = 120; else if (!at(cx, cy - 2)) a = 60;
      if (!at(cx - 1, cy)) a = Math.max(a, 70);
      if (a) shade.data[o + 3] = a;
    } else {
      let d = 9;
      for (let dy = -3; dy <= 3 && d > 1; dy++) for (let dx = -3; dx <= 3; dx++) if (at(cx + dx, cy + dy)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
      if (d === 1) { ring.data[o] = 0x2a; ring.data[o + 1] = 0x26; ring.data[o + 2] = 0x22; ring.data[o + 3] = 255; }
      else if (d === 2 && ((cx + cy) & 1) === 0) { ring.data[o] = 30; ring.data[o + 1] = 20; ring.data[o + 2] = 10; ring.data[o + 3] = 90; }
      else if (d === 3 && (cx & 1) === 0 && (cy & 1) === 0) { ring.data[o] = 30; ring.data[o + 1] = 20; ring.data[o + 2] = 10; ring.data[o + 3] = 60; }
    }
  }
  L.holeCv.getContext('2d').putImageData(hole, x0, y0);
  L.ringCv.getContext('2d').putImageData(ring, x0, y0);
  L.shadeCv.getContext('2d').putImageData(shade, x0, y0);
}

/* ------------------------------------------------------------ fondo pixel art */
// Paisaje estilo "Bliss" de Windows XP: cielo azul con nubes y una colina verde.
// Vive en coordenadas de pantalla, asi que los crateres son ventanas a el.
let bliss = null;
const SKY = ['#1c53c8', '#2966d6', '#3a7ae2', '#5493ec', '#78adf3', '#9cc4f7', '#bcd9fa'];
const GRASS = ['#a4d94a', '#86c934', '#67b526', '#4fa020', '#3b8a1a', '#2d7415'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }

function getBliss() {
  const W = Math.ceil(state.W / PX), H = Math.ceil(state.H / PX);
  if (bliss && bliss.width === W && bliss.height === H) return bliss;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  const sky = SKY.map(hex), grass = GRASS.map(hex);
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const horizon = u => H * (.55 + .02 * Math.sin(u * 2) - .03 * (1 - smooth(u / .3)) + .16 * smooth((u - .28) / .75));
  const clouds = [[.16, .2, .11, .05], [.24, .17, .07, .045], [.1, .25, .08, .035], [.55, .3, .1, .04], [.62, .27, .07, .04], [.85, .15, .09, .05], [.9, .2, .06, .035], [.4, .1, .07, .03], [.72, .42, .1, .03]];
  const inCloud = (x, y) => {
    for (const [cx, cy, rx, ry] of clouds) { const dx = (x / W - cx) / rx, dy = (y / H - cy) / ry; if (dx * dx + dy * dy < 1) return true; }
    return false;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, u = x / W, hz = horizon(u), b = BAYER[(y & 3) * 4 + (x & 3)] / 16;
    let col;
    if (y >= hz) {
      const t = clamp((y - hz) / (H - hz), 0, 1);
      // sombra diagonal sobre la colina
      const sh = clamp((u - .35) * .9 + (t - .3) * .4, 0, .55);
      const k = clamp(t * 2.2 + sh * 2.2, 0, 1) * (GRASS.length - 1);
      col = grass[Math.min(GRASS.length - 1, Math.floor(k + b))];
      if (y - hz < 1.2) col = grass[0];
      // flores amarillas diminutas
      if (t > .55 && hash(x, y) > .992) col = [255, 226, 60];
    } else if (inCloud(x, y)) {
      col = inCloud(x, y - 2) ? (inCloud(x, y - 4) ? [255, 255, 255] : [236, 244, 253]) : [206, 224, 247];
    } else {
      const t = clamp(y / hz, 0, 1) * (SKY.length - 1);
      col = sky[Math.min(SKY.length - 1, Math.floor(t + b))];
    }
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  bliss = c; return c;
}

let layer = null;
function getLayer() {
  if (!layer || layer.width !== cv.width || layer.height !== cv.height) {
    layer = document.createElement('canvas'); layer.width = cv.width; layer.height = cv.height;
  }
  return layer;
}

/* ---------------------------------------------------------------- letras */
// Posicion de cada letra de una palabra (se calcula midiendo el texto).
function letters(pl) {
  if (pl.lt && pl.lt.w === pl.w && pl.lt.x === pl.x) return pl.lt.arr;
  if (!pl.font) pl.font = getComputedStyle(pl.el).font;
  const txt = pl.el.textContent, arr = [];
  ctx.save(); ctx.font = pl.font;
  const total = ctx.measureText(txt).width || 1, k = pl.w / total;
  for (let i = 0; i < txt.length; i++) {
    const x0 = ctx.measureText(txt.slice(0, i)).width * k, w = ctx.measureText(txt[i]).width * k;
    arr.push({ ch: txt[i], cx: pl.x + x0 + w / 2, cy: pl.y + pl.h / 2 });
  }
  ctx.restore();
  const old = pl.gone;
  pl.lt = { w: pl.w, x: pl.x, arr };
  if (!old || old.length !== arr.length) pl.gone = arr.map(() => false);
  return arr;
}

// Suelta las letras de una palabra. all: todas las que no estaban ya en el
// hueco (la palabra entera se rompio); si no, solo las que cayeron dentro del
// crater. Devuelve cuantas letras quedan en pie.
export function shedLetters(pl, blast, all) {
  const arr = letters(pl);
  let left = 0;
  for (let i = 0; i < arr.length; i++) {
    const l = arr[i];
    if (pl.gone[i]) continue;
    if (all || inCrater(l.cx, l.cy)) {
      pl.gone[i] = true;
      if (!(all && inCrater(l.cx, l.cy))) spawnLetter(pl, l, blast);
    } else left++;
  }
  return left;
}

// Al reaparecer una palabra, las letras que siguen en un hueco quedan marcadas.
export function resetLetters(pl) {
  pl.gone = null;
  const arr = letters(pl);
  pl.gone = arr.map(l => inCrater(l.cx, l.cy));
}

function spawnLetter(pl, l, blast) {
  if (state.debris.length > MAX_LETTERS + MAX_SHARDS || !/\S/.test(l.ch)) return;
  let vx, vy;
  if (blast) {
    const a = Math.atan2(l.cy - blast[1], l.cx - blast[0]) + (Math.random() - .5) * .9, s = blast[2] * (.25 + Math.random() * .6);
    vx = Math.cos(a) * s; vy = Math.sin(a) * s * .7 - 180 - Math.random() * 120;
  } else { vx = (Math.random() - .5) * 220; vy = -160 - Math.random() * 160; }
  state.debris.push({ k: 'l', x: l.cx, y: l.cy, vx, vy, rot: 0, vr: (Math.random() - .5) * 12, txt: l.ch, font: pl.font, life: 2.2 + Math.random() * 1.2 });
}

/* ------------------------------------------------------------- pedazos de imagen */
export function spawnShards(pl, blast) {
  const cols = clamp(Math.round(pl.w / 34), 3, 7), rows = clamp(Math.round(pl.h / 34), 3, 7);
  const cw = pl.w / cols, ch = pl.h / rows;
  const pts = [];
  for (let j = 0; j <= rows; j++) {
    pts.push([]);
    for (let i = 0; i <= cols; i++) {
      const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
      pts[j].push([i * cw + (edgeX ? 0 : (Math.random() - .5) * cw * .6), j * ch + (edgeY ? 0 : (Math.random() - .5) * ch * .6)]);
    }
  }
  const mx = pl.x + pl.w / 2, my = pl.y + pl.h / 2, power = blast ? blast[2] : 260;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
    const tris = Math.random() < .5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const t of tris) {
      if (state.debris.length > MAX_LETTERS + MAX_SHARDS + 200) return;
      const ox = (t[0][0] + t[1][0] + t[2][0]) / 3, oy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const wx = pl.x + ox, wy = pl.y + oy;
      const ang = Math.atan2(wy - (blast ? blast[1] : my), wx - (blast ? blast[0] : mx)) + (Math.random() - .5) * .8, s = power * (.3 + Math.random() * .7);
      state.debris.push({
        k: 's', el: pl.el, pw: pl.w, ph: pl.h, ox, oy, poly: t.map(p => [p[0] - ox, p[1] - oy]),
        x: wx, y: wy, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s * .8 - 200, rot: 0, vr: (Math.random() - .5) * 9, life: 2.6 + Math.random() * 1.2
      });
    }
  }
}

/* ------------------------------------------------------------ escombro (update) */
export function updateDebris(dt) {
  const L = state.L;
  for (const d of state.debris) {
    d.vy += DEBRIS_G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.life -= dt;
    const fl = floorAt(d.x) - (d.k === 's' ? 4 : 5);
    if (d.y > fl && L) { d.y = fl; d.vy *= -.3; d.vx *= .6; d.vr *= .5; if (Math.abs(d.vy) < 30) d.vy = 0; }
  }
  state.debris = state.debris.filter(d => d.life > 0);
}

export function drawDebris() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#202122';
  for (const d of state.debris) {
    ctx.globalAlpha = clamp(d.life, 0, 1);
    ctx.save(); ctx.translate(Math.round(d.x), Math.round(d.y)); ctx.rotate(Math.round(d.rot * 4) / 4);
    if (d.k === 's') {
      ctx.beginPath(); ctx.moveTo(d.poly[0][0], d.poly[0][1]); ctx.lineTo(d.poly[1][0], d.poly[1][1]); ctx.lineTo(d.poly[2][0], d.poly[2][1]); ctx.closePath();
      ctx.save(); ctx.clip();
      try { ctx.drawImage(d.el, -d.ox, -d.oy, d.pw, d.ph); } catch (e) { ctx.fillStyle = '#8a8f98'; ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1; ctx.stroke();
    } else { ctx.font = d.font; ctx.fillText(d.txt, 0, 0); }
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

/* ------------------------------------------------------------ grietas en imagenes */
function cracksFor(pl) {
  if (pl.cracks) return pl.cracks;
  const segs = [], branches = 5 + Math.floor(Math.random() * 3);
  const ix = pl.w * (.3 + Math.random() * .4), iy = pl.h * (.3 + Math.random() * .4);
  for (let b = 0; b < branches; b++) {
    let x = ix, y = iy, a = (b / branches) * 6.283 + Math.random() * .8;
    for (let s = 0; s < 5; s++) {
      a += (Math.random() - .5) * .9;
      const l = 12 + Math.random() * 22, nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
      segs.push([x, y, nx, ny]); x = nx; y = ny;
      if (x < 0 || y < 0 || x > pl.w || y > pl.h) break;
    }
  }
  // de a poco: primero las cercanas al impacto
  segs.sort((p, q) => Math.hypot(p[0] - ix, p[1] - iy) - Math.hypot(q[0] - ix, q[1] - iy));
  return pl.cracks = segs;
}

export function drawDamage(vt, vb) {
  const L = state.L;
  if (!L.imgs) L.imgs = L.plats.filter(p => p.kind === 'img');
  for (const pl of L.imgs) {
    if (!pl.alive || pl.hp >= pl.maxhp || pl.y > vb || pl.y + pl.h < vt) continue;
    const segs = cracksFor(pl), n = Math.ceil(segs.length * (1 - pl.hp / pl.maxhp));
    ctx.save(); ctx.beginPath(); ctx.rect(pl.x, pl.y, pl.w, pl.h); ctx.clip();
    ctx.lineCap = 'square';
    for (const [c, w] of [['rgba(255,255,255,.55)', 3], ['rgba(15,15,15,.85)', 2]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = segs[i], off = w === 3 ? 1 : 0;
        ctx.moveTo(Math.round((pl.x + s[0]) / 2) * 2 + off, Math.round((pl.y + s[1]) / 2) * 2 + off);
        ctx.lineTo(Math.round((pl.x + s[2]) / 2) * 2 + off, Math.round((pl.y + s[3]) / 2) * 2 + off);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ dibujo */
// Piso con hundimientos y crateres sobre el texto. Va antes que todo lo demas.
// ox/oy: desplazamiento de pantalla del mundo (camara y temblor).
export function drawTerrain(vt, vb, ox, oy) {
  const L = state.L, W = state.W, fy = L.floorY, bottom = fy + Math.max(200, L.h - fy + 400);
  if (!L.hcount) {
    ctx.fillStyle = '#272727'; ctx.fillRect(0, fy, W, bottom - fy);
    ctx.fillStyle = '#ff7a3d'; ctx.fillRect(0, fy, W, 4);
  } else {
    const n = Math.ceil(W / PX), dep = i => L.depth[Math.min(4095, i * PX)];
    ctx.beginPath(); ctx.moveTo(0, bottom);
    for (let i = 0; i < n; i++) { const y = fy + dep(i); ctx.lineTo(i * PX, y); ctx.lineTo((i + 1) * PX, y); }
    ctx.lineTo(W, bottom); ctx.closePath(); ctx.fillStyle = '#272727'; ctx.fill();
    // paredes del hundimiento y borde naranja en escalones
    for (let i = 0; i < n; i++) {
      const d = dep(i);
      if (d > 0) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(i * PX, fy + 4, PX, d); }
      ctx.fillStyle = '#ff7a3d'; ctx.fillRect(i * PX, fy + d, PX, 4);
      const nd = dep(i + 1);
      if (nd > d) ctx.fillRect(i * PX + PX - 4, fy + d, 4, nd - d + 4);
      if (i > 0 && dep(i - 1) > d) ctx.fillRect(i * PX, fy + d, 4, dep(i - 1) - d + 4);
    }
  }
  if (!L.hcount) return;

  // hueco: aro y quemado, y adentro la ventana al fondo pixel art
  const cy0 = Math.max(0, Math.floor(vt / PX)), cy1 = Math.min(L.rows, Math.ceil(vb / PX)), n = cy1 - cy0;
  if (n > 0) {
    const dy = cy0 * PX;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(L.ringCv, 0, cy0, COLS, n, 0, dy, COLS * PX, n * PX);
    const ly = getLayer(), g = ly.getContext('2d');
    g.setTransform(state.DPR, 0, 0, state.DPR, 0, 0); g.imageSmoothingEnabled = false;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, state.W, state.H);
    g.drawImage(L.holeCv, 0, cy0, COLS, n, ox, dy + oy, COLS * PX, n * PX);
    g.globalCompositeOperation = 'source-in';
    g.drawImage(getBliss(), 0, 0, state.W, state.H);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(L.shadeCv, 0, cy0, COLS, n, ox, dy + oy, COLS * PX, n * PX);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(ly, 0, 0);
    ctx.restore();
  }

  // los links no se rompen: se redibujan encima del hueco
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  for (const pl of L.covered) {
    if (pl.y > vb || pl.y + pl.h < vt) continue;
    if (!pl.font) pl.font = getComputedStyle(pl.el).font;
    ctx.fillStyle = '#fafaf7'; ctx.fillRect(pl.x - 1, pl.y, pl.w + 2, pl.h);
    ctx.fillStyle = '#0645ad'; ctx.font = pl.font; ctx.fillText(pl.el.textContent, pl.x, pl.y);
    ctx.fillRect(pl.x, pl.y + pl.h - 3, pl.w, 2);
  }
}
