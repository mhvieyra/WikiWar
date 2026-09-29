// Fisica compartida por el jugador, los enemigos y las granadas: gravedad,
// colision contra las plataformas-palabra (desde arriba, tipo "one way
// platform") y el piso del nivel.
import { RS, G } from './config.js';
import { state } from './state.js';
import { clamp } from './utils.js';

export function physics(e, dt) {
  e.x = clamp(e.x + e.vx * dt, e.w / 2, state.W - e.w / 2);
  const pb = e.y;
  e.vy = Math.min(e.vy + G * dt, 1400);
  e.y += e.vy * dt;
  e.onGround = false;
  if (e.vy >= 0 && !(e.drop > 0)) {
    const r0 = Math.floor((pb - 10) / RS), r1 = Math.floor((e.y + 2) / RS);
    let best = null;
    for (let r = r0; r <= r1; r++) {
      const arr = state.L.top.get(r); if (!arr) continue;
      for (const pl of arr) {
        if (!pl.alive) continue;
        if (e.x + e.w / 2 < pl.x - 1 || e.x - e.w / 2 > pl.x + pl.w + 1) continue;
        if (pb <= pl.y + 8 && e.y >= pl.y && (best === null || pl.y < best)) best = pl.y;
      }
    }
    if (best !== null) { e.y = best; e.vy = 0; e.onGround = true; }
  }
  if (e.y >= state.L.floorY) { e.y = state.L.floorY; e.vy = 0; e.onGround = true; }
  if (e.drop > 0) e.drop -= dt;
}
