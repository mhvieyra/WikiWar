// Tabla de armas. Agregar un arma nueva es agregar una entrada aca:
// name (texto del HUD), rate (cooldown entre disparos, s), dmg (daño por
// proyectil), speed (velocidad de la bala, px/s), spread (dispersion en
// radianes), pellets (proyectiles por disparo), pierce (cuantas plataformas
// atraviesa antes de desaparecer), kick (retroceso aplicado al jugador),
// snd (frecuencia y duracion del beep de fallback si no hay archivo de sonido).
export const WEAPONS = [
  { name: 'PISTOLA', rate: .28, dmg: 1, speed: 1300, spread: .02, pellets: 1, pierce: 2, kick: 20, snd: [520, .06] },
  { name: 'SMG', rate: .075, dmg: .7, speed: 1500, spread: .08, pellets: 1, pierce: 1, kick: 10, snd: [380, .04] },
  { name: 'ESCOPETA', rate: .75, dmg: 1, speed: 1200, spread: .22, pellets: 7, pierce: 1, kick: 150, snd: [160, .12] }
];
