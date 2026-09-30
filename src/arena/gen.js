// Generador de arenas. Es determinista (misma semilla, mismo mapa en todas las
// maquinas): usa el PRNG de shared/dmath.js y dsin en lugar de Math.sin. La
// arena es simetrica (la mitad derecha es el espejo de la izquierda) para que
// ningun jugador tenga ventaja de posicion.
import { dsin, rng } from '../shared/dmath.js';

export const CS = 8;                 // lado de una celda en unidades de mundo
export const COLS = 192, ROWS = 108; // 1536 x 864 unidades (48 x 27 tiles)
export const AIR = 0, DIRT = 1, ROCK = 2, ORE = 3, BUILT = 4;

export function generate(seed) {
  const r = rng(seed * 2654435761 >>> 0 || 1), cells = new Uint8Array(COLS * ROWS), half = COLS >> 1;
  const at = (x, y) => y * COLS + x;
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const inHalf = x => x >= 3 && x < half;
  const disc = (cx, cy, rad, val, only) => {
    for (let y = Math.max(3, cy - rad); y <= Math.min(ROWS - 4, cy + rad); y++) for (let x = Math.max(3, cx - rad); x <= Math.min(half - 1, cx + rad); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > rad * rad) continue;
      const c = cells[at(x, y)];
      if (only !== undefined && c !== only) continue;
      if (c !== ROCK) cells[at(x, y)] = val;
    }
  };

  // relieve: tierra hasta la altura h(x), aire arriba
  const p1 = r() * 6.283, p2 = r() * 6.283, p3 = r() * 6.283, f1 = .035 + r() * .02, f2 = .09 + r() * .04, f3 = .17 + r() * .05;
  const base = 46 + ri(-3, 3), A1 = 10 + ri(0, 5), A2 = 5 + ri(0, 3), A3 = 2 + ri(0, 2);
  const height = new Array(half);
  for (let x = 0; x < half; x++) {
    let h = base + A1 * dsin(x * f1 + p1) + A2 * dsin(x * f2 + p2) + A3 * dsin(x * f3 + p3);
    // el centro (donde se juntan las dos mitades) se hunde para armar una cuenca
    const toMid = (half - x) / half; h += (1 - toMid) * 10 * (1 - toMid);
    height[x] = Math.max(26, Math.min(ROWS - 30, Math.floor(h)));
    for (let y = 0; y < ROWS; y++) cells[at(x, y)] = y < height[x] ? AIR : DIRT;
  }
  // islas flotantes
  const nIsl = ri(3, 5);
  for (let i = 0; i < nIsl; i++) {
    const cx = ri(16, half - 6), cy = ri(10, 28), rx = ri(5, 10), ry = ri(2, 3);
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      if (!inHalf(x) || y < 4 || y >= ROWS - 4) continue;
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && cells[at(x, y)] === AIR) cells[at(x, y)] = DIRT;
    }
  }
  // cuevas: caminantes que van tallando circulos
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const nCave = ri(6, 9), starts = [];
  for (let i = 0; i < nCave; i++) {
    let x = ri(10, half - 4), y = ri(62, ROWS - 12); starts.push([x, y]);
    let d = DIRS[ri(0, 7)];
    for (let s = 0; s < ri(40, 80); s++) {
      disc(x, y, ri(3, 5), AIR);
      if (r() < .3) d = DIRS[ri(0, 7)];
      x = Math.max(6, Math.min(half - 2, x + d[0] * 2)); y = Math.max(height[Math.min(x, half - 1)] + 10, Math.min(ROWS - 10, y + d[1] * 2));
    }
  }
  // pozos que unen la superficie con algunas cuevas
  for (let i = 0; i < 3 && i < starts.length; i++) {
    const [sx, sy] = starts[i]; const top = height[Math.min(sx, half - 1)];
    for (let y = top - 2; y < sy; y += 2) disc(sx, y, 3, AIR);
  }
  // veta de oro
  const nOre = ri(13, 18);
  for (let i = 0; i < nOre; i++) {
    const cx = ri(8, half - 2), cy = ri(50, ROWS - 8), rad = ri(2, 4);
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (!inHalf(x) || y < 4 || y >= ROWS - 4) continue;
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= rad * rad && cells[at(x, y)] === DIRT && r() < .8) cells[at(x, y)] = ORE;
    }
  }
  // zona de aparicion: plataforma plana con aire encima
  const sx = 14, gy = height[sx];
  for (let x = sx - 6; x <= sx + 6; x++) {
    for (let y = gy - 10; y < gy; y++) cells[at(x, y)] = AIR;
    for (let y = gy; y < gy + 6; y++) cells[at(x, y)] = DIRT;
  }
  // espejo y borde de roca
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < half; x++) cells[at(COLS - 1 - x, y)] = cells[at(x, y)];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (x < 3 || x >= COLS - 3 || y < 3 || y >= ROWS - 3) cells[at(x, y)] = ROCK;
  return { cells, spawns: [{ x: sx * CS + CS / 2, y: gy * CS }, { x: (COLS - 1 - sx) * CS + CS / 2, y: gy * CS }] };
}
