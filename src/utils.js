// Helpers chicos y sin estado, compartidos por varios modulos.

export const $ = s => document.querySelector(s);
export const norm = t => (t || '').replace(/_/g, ' ').trim().toLowerCase();
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const nextFrame = () => new Promise(r => requestAnimationFrame(r));
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function fmtTime(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

// Rota el matiz (hue) de un color hex #rrggbb en `deg` grados, conservando
// saturacion y luminosidad. Se usa para variar el color de los stickmans
// enemigos (mismo sprite/placeholder, distinto tinte por instancia).
export function hueRotate(hex, deg) {
  if (!deg) return hex;
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h, s;
  if (max === min) h = s = 0;
  else {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  h = ((h * 360 + deg) % 360 + 360) % 360 / 360;
  const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  let nr, ng, nb;
  if (s === 0) nr = ng = nb = l;
  else {
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    nr = hue2rgb(p, q, h + 1 / 3); ng = hue2rgb(p, q, h); nb = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(nr) + toHex(ng) + toHex(nb);
}
