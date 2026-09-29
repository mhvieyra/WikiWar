// Destruccion del terreno: las explosiones abren crateres reales. Un crater
// es un grupo de circulos guardados en L.craters; las palabras cuyo centro
// cae adentro se destruyen para siempre, las que quedan a medias siguen en
// pie pero ya no sostienen a nadie sobre la parte hueca, y el piso se hunde
// (L.depth guarda cuanto se hundio cada columna). Tambien vuela el "escombro":
// las palabras rotas salen despedidas como fragmentos de texto.
import { state, ctx } from './state.js';
import { clamp } from './utils.js';

const MAX_DEPTH = 90;          // hundimiento maximo del piso (px)
const BG = '#fafaf7';          // color de la pagina, con el que se "borra" el hueco
const DEBRIS_G = 1500;

export function initCraters(L) {
  L.craters = [];
  L.depth = new Float32Array(4096);
  L.covered = [];              // links que quedaron dentro de un crater (se redibujan encima)
}

export function inCrater(x, y) {
  const cs = state.L && state.L.craters;
  if (!cs) return false;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], dx = x - c.x, dy = y - c.y;
    if (dx * dx + dy * dy < c.r * c.r) return true;
  }
  return false;
}

// Una plataforma-palabra no sostiene a nadie donde tiene un hueco debajo.
// Los links son portales: nunca se hunden.
export function holedAt(pl, x) {
  if (pl.link || !state.L.craters.length) return false;
  return inCrater(clamp(x, pl.x, pl.x + pl.w), pl.y + 1);
}

export function floorAt(x) {
  const L = state.L;
  return L.floorY + L.depth[clamp(Math.round(x), 0, 4095)];
}

function digFloor(c) {
  const L = state.L, x0 = Math.max(0, Math.floor(c.x - c.r)), x1 = Math.min(4095, Math.ceil(c.x + c.r));
  for (let i = x0; i <= x1; i++) {
    const dy = Math.sqrt(Math.max(0, c.r * c.r - (i - c.x) * (i - c.x)));
    if (c.y - dy > L.floorY + L.depth[i]) continue;
    L.depth[i] = Math.max(L.depth[i], Math.min(MAX_DEPTH, c.y + dy - L.floorY));
  }
}

// Forma irregular: un circulo grande mas varios "mordiscos" alrededor.
export function makeCrater(x, y, R) {
  const cs = [{ x, y, r: R * .78 }];
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * 6.283, d = R * (.35 + Math.random() * .4);
    cs.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * .85, r: R * (.24 + Math.random() * .22) });
  }
  const L = state.L;
  for (const c of cs) { L.craters.push(c); digFloor(c); }
  return cs;
}

export function coveredBy(cs, x, y) {
  for (const c of cs) if (Math.hypot(x - c.x, y - c.y) < c.r) return true;
  return false;
}

// El rectangulo toca alguno de los circulos?
export function touches(cs, pl) {
  for (const c of cs) {
    const nx = clamp(c.x, pl.x, pl.x + pl.w), ny = clamp(c.y, pl.y, pl.y + pl.h);
    if (Math.hypot(nx - c.x, ny - c.y) < c.r + 2) return true;
  }
  return false;
}

/* ---------------------------------------------------------------- escombro */
export function spawnDebris(pl, cx, cy, power) {
  if (state.debris.length > 220) return;
  const mx = pl.x + pl.w / 2, my = pl.y + pl.h / 2;
  const a = Math.atan2(my - cy, mx - cx) + (Math.random() - .5) * .8, s = (power || 200) * (.5 + Math.random() * .8);
  if (!pl.font) pl.font = getComputedStyle(pl.el).font;
  state.debris.push({
    x: mx, y: my, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120 * (power ? 1 : 0), rot: 0, vr: (Math.random() - .5) * 14,
    txt: pl.el.textContent, font: pl.font, life: 1.1 + Math.random() * .5, max: 1.6
  });
}

export function updateDebris(dt) {
  for (const d of state.debris) { d.vy += DEBRIS_G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.life -= dt; }
  state.debris = state.debris.filter(d => d.life > 0);
}

export function drawDebris() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#202122';
  for (const d of state.debris) {
    ctx.globalAlpha = clamp(d.life * 2, 0, 1);
    ctx.font = d.font;
    ctx.save(); ctx.translate(Math.round(d.x), Math.round(d.y)); ctx.rotate(d.rot); ctx.fillText(d.txt, 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

/* ------------------------------------------------------------------ dibujo */
// Piso con hundimientos y crateres sobre el texto. Va antes que todo lo demas.
export function drawTerrain(vt, vb) {
  const L = state.L, W = state.W, fy = L.floorY, bottom = fy + Math.max(200, L.h - fy + 400);
  if (!L.craters.length) {
    ctx.fillStyle = '#272727'; ctx.fillRect(0, fy, W, bottom - fy);
    ctx.fillStyle = '#ff7a3d'; ctx.fillRect(0, fy, W, 4);
  } else {
    const step = 2, n = Math.ceil(W / step);
    ctx.beginPath(); ctx.moveTo(0, bottom);
    for (let i = 0; i <= n; i++) ctx.lineTo(i * step, fy + L.depth[Math.min(4095, i * step)]);
    ctx.lineTo(W, bottom); ctx.closePath(); ctx.fillStyle = '#272727'; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const y = fy + L.depth[Math.min(4095, i * step)]; if (i) ctx.lineTo(i * step, y); else ctx.moveTo(0, y); }
    ctx.strokeStyle = '#ff7a3d'; ctx.lineWidth = 4; ctx.stroke();
    // oscurecer las paredes del hundimiento
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    for (let i = 0; i <= n; i++) { const d = L.depth[Math.min(4095, i * step)]; if (d > 0) ctx.fillRect(i * step, fy + 4, step, d); }
  }

  // crateres sobre el texto (solo por encima del piso original)
  const vis = L.craters.filter(c => c.y + c.r > vt && c.y - c.r < vb);
  if (!vis.length) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, vt - 200, W, fy - vt + 200); ctx.clip();
  ctx.fillStyle = 'rgba(30,20,10,.16)';
  for (const c of vis) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 16, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = '#2a2622';
  for (const c of vis) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 4, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = BG;
  for (const c of vis) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.283); ctx.fill(); }
  ctx.restore();

  // los links no se rompen: se redibujan encima del hueco
  ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = '#0645ad';
  for (const pl of L.covered) {
    if (pl.y > vb || pl.y + pl.h < vt) continue;
    if (!pl.font) pl.font = getComputedStyle(pl.el).font;
    ctx.font = pl.font; ctx.fillText(pl.el.textContent, pl.x, pl.y);
    ctx.fillRect(pl.x, pl.y + pl.h - 3, pl.w, 2);
  }
}
