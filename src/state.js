// Estado global del juego. En vez de variables sueltas a nivel de modulo
// (que no se pueden reasignar desde otros modulos con imports de ES),
// se agrupan en dos objetos mutables que todos los modulos comparten:
//
//  - S: estadisticas y modo de la partida actual (nunca se reasigna entero,
//    solo se le cambian propiedades).
//  - state: el mundo dinamico (nivel, jugador, enemigos, proyectiles,
//    camara, input). Sus propiedades si se reasignan enteras (por ejemplo
//    al respawnear al jugador o al filtrar la lista de enemigos), por eso
//    viven como propiedades de un objeto y no como bindings importados.

export const cv = document.querySelector('#c');
export const ctx = cv.getContext('2d');

export const S = {
  mode: 'menu', lang: 'es', from: '', toCanon: '', toNorm2: '', toInfo: null, path: [],
  clicks: 0, kills: 0, words: 0, time: 0, lives: 3, wi: 0, cool: 0, gcool: 0, shake: 0, spawnT: 1,
  ammo: [], ammoFlash: 0, strengthT: 0, crateT: 60
};

export const state = {
  L: null,
  p: null,
  enemies: [], bullets: [], grenades: [], parts: [], fx: [], crates: [], items: [], smoke: [],
  cam: 0, mx: 0, my: 0, mouseDown: false, near: null,
  keys: {},
  W: 0, H: 0, DPR: 1
};
