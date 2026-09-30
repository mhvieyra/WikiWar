// Matematica determinista para las simulaciones que se repiten o se sincronizan
// entre navegadores (Ecos y Arena). Math.sin/cos/hypot/atan2 pueden dar
// resultados distintos en motores distintos; estas usan solo + - * / y
// Math.sqrt/floor (que son exactas segun IEEE), asi que dan lo mismo en todos.
const PI = 3.141592653589793, TAU = 6.283185307179586, HALF_PI = 1.5707963267948966;

export function dsin(x) {
  x = x - TAU * Math.floor((x + PI) / TAU);
  if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800)))))));
}
export const dcos = x => dsin(x + HALF_PI);
export const dhypot = (x, y) => Math.sqrt(x * x + y * y);

// 64 direcciones de apuntado (el mouse se cuantiza a estas antes de guardarse)
export const AIM_N = 64;
export const AIM = Array.from({ length: AIM_N }, (_, i) => ({ x: dcos(i * TAU / AIM_N), y: dsin(i * TAU / AIM_N) }));
export function aimIndex(dx, dy) {          // solo lado del cliente: se guarda como entero
  let a = Math.atan2(dy, dx); if (a < 0) a += TAU;
  return Math.round(a / TAU * AIM_N) % AIM_N;
}

// PRNG determinista (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.state = () => s; f.set = v => { s = v >>> 0; };
  return f;
}
