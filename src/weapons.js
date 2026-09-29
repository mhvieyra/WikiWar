import { S } from './state.js';
import { STRENGTH_MULT } from './config.js';

// Tabla de armas. Agregar un arma nueva es agregar una entrada aca:
// name (texto del HUD), rate (cooldown entre disparos, s), dmg (daño por
// proyectil), speed (velocidad de la bala, px/s), spread (dispersion en
// radianes), pellets (proyectiles por disparo), pierce (cuantas plataformas
// atraviesa antes de desaparecer), kick (retroceso aplicado al jugador),
// snd (frecuencia y duracion del beep de fallback si no hay archivo de sonido),
// ammo (reserva limitada: start al empezar, max de tope, kill lo que da matar
// un enemigo con la pistola; sin `ammo` el arma es infinita).
export const WEAPONS = [
  { name: 'PISTOLA', rate: .28, dmg: 1, speed: 1300, spread: .02, pellets: 1, pierce: 2, kick: 20, snd: [520, .06], ammo: null },
  { name: 'SMG', rate: .075, dmg: .7, speed: 1500, spread: .08, pellets: 1, pierce: 1, kick: 10, snd: [380, .04], ammo: { start: 90, max: 150, kill: 10 } },
  { name: 'ESCOPETA', rate: .75, dmg: 1, speed: 1200, spread: .22, pellets: 7, pierce: 1, kick: 150, snd: [160, .12], ammo: { start: 16, max: 28, kill: 2 } }
];

// Reservas de balas: S.ammo[i] es la cantidad de la arma i (Infinity = infinita).
export function resetAmmo() {
  S.ammo = WEAPONS.map(w => (w.ammo ? w.ammo.start : Infinity));
}
export function hasAmmo(i) { return S.ammo[i] > 0; }
export function addAmmo(i, n) {
  const a = WEAPONS[i].ammo; if (!a) return;
  S.ammo[i] = Math.min(a.max, S.ammo[i] + n); S.ammoFlash = .8;
}
export function refillAmmo() {
  WEAPONS.forEach((w, i) => { if (w.ammo) S.ammo[i] = w.ammo.max; });
}
// Al matar un enemigo con la pistola te quedas con su municion.
export function lootAmmo() {
  WEAPONS.forEach((w, i) => { if (w.ammo) addAmmo(i, w.ammo.kill); });
}

// Multiplicador de daño de todas las armas (pocion de fuerza activa).
export function dmgMult() { return S.strengthT > 0 ? STRENGTH_MULT : 1; }
