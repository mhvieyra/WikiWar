// Niveles de Ecos. Cada nivel es un cuarto que se ve entero en pantalla.
//
// Leyenda (una letra = un tile):
//   .  aire        #  bloque        =  plataforma (se atraviesa desde abajo)      ^  pinchos    ~  lava
//   P  inicio      X  salida        M  caja empujable                           s  resorte
//   1 2 3  boton pesado (canal 1..3): se mantiene apretado mientras algo lo pisa
//   a b c  puerta (canal 1..3): abierta mientras su canal esta activo
//   A B C  puerta invertida: cerrada mientras su canal esta activo
//   4 5 6  palanca (canal 1..3): se acciona con E y queda puesta
//   u v w  pulsador (canal 1..3): al pisarlo activa el canal `pulse` segundos
//   x y z  diana (canal 1..3): un disparo activa el canal `pulse` segundos
// Un canal esta activo si TODOS sus botones estan apretados, o su palanca esta
// puesta, o alguno de sus pulsos esta corriendo.
//
// `par` es la cantidad de ecos de una solucion que conocemos (se puede mejorar).

function build(W, H, fn) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const signs = [], movers = [];
  const put = (x, y, c) => {
    if (x < 0 || x >= W || y < 0 || y >= H) throw new Error('fuera del nivel: ' + x + ',' + y + ' ' + c);
    g[y][x] = c;
  };
  const api = {
    W, H, signs, movers, put,
    fill(x0, y0, x1, y1, c = '#') { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); },
    col(x, y0, y1, c) { api.fill(x, y0, x, y1, c); },
    room(floorTop) { api.fill(0, 0, W - 1, 0); api.fill(0, floorTop, W - 1, H - 1); },
    // pared con puerta: la puerta ocupa [d0, d1] y el resto va de bloque hasta el techo
    gate(x, d0, d1, c) { api.col(x, d0, d1, c); if (d0 > 1) api.col(x, 1, d0 - 1, '#'); },
    sign(x, y, text) { signs.push({ x, y, text }); },
    mover(x, y, len, dx, dy, speed, phase = 0) { movers.push({ x, y, len, dx, dy, speed, phase }); }
  };
  fn(api);
  return { rows: g.map(r => r.join('')), signs, movers };
}

const defs = [];
const level = (id, name, theme, desc, meta, W, H, fn) => defs.push({ id, name, theme, desc, ...meta, ...build(W, H, fn) });

level(1, 'Tres llaves', 'cave', 'Tres botones sobre pinchos y una sola puerta. Nadie cruza solo.', { limit: 10, par: 3 }, 37, 12, L => {
  L.room(10);
  for (const [a, b] of [[8, 10], [17, 19], [26, 28]]) L.fill(a, 10, b, 10, '^');
  L.put(2, 9, 'P'); L.put(13, 9, '1'); L.put(22, 9, '1'); L.put(31, 9, '1'); L.gate(34, 6, 9, 'a'); L.put(36, 9, 'X');
});

level(2, 'Torre de ecos', 'night', 'Una muralla de seis bloques y lava al otro lado. Subí sobre tus propios fantasmas.', { limit: 12, par: 3 }, 30, 14, L => {
  L.room(12);
  L.fill(14, 6, 20, 11); L.fill(21, 12, 24, 12, '~'); L.fill(25, 6, 29, 11);
  L.put(2, 11, 'P'); L.put(27, 5, 'X');
});

level(3, 'Dos cerraduras', 'factory', 'Dos puertas en serie, cuatro botones. Los ecos de la primera abren paso a los de la segunda.', { limit: 14, par: 4 }, 34, 12, L => {
  L.room(10);
  L.put(2, 9, 'P'); L.put(4, 9, '1'); L.put(7, 9, '1'); L.gate(11, 6, 9, 'a');
  L.put(15, 9, '2'); L.put(18, 9, '2'); L.gate(24, 6, 9, 'b'); L.fill(26, 10, 28, 10, '^'); L.put(32, 9, 'X');
});

level(4, 'Ventana larga', 'factory', 'Cada puerta se abre 1,2 s y queda lejos de su pulsador. Alguien tiene que pisar a tiempo.', { limit: 10, par: 2, pulse: 1.2 }, 44, 12, L => {
  L.room(10);
  L.put(2, 9, 'P'); L.put(4, 9, 'u'); L.gate(16, 6, 9, 'a'); L.put(19, 9, 'v'); L.gate(31, 6, 9, 'b');
  L.fill(35, 10, 37, 10, '^'); L.put(42, 9, 'X');
});

level(5, 'Escalera y peso', 'night', 'El botón está sobre un bloque demasiado alto. Dos ecos hacen de escalera y un tercero lo pisa.', { limit: 14, par: 3 }, 30, 14, L => {
  L.room(12);
  L.fill(8, 7, 11, 11); L.put(9, 6, '1');
  L.put(2, 11, 'P'); L.gate(18, 8, 11, 'a'); L.fill(22, 12, 24, 12, '~'); L.put(27, 11, 'X');
});

level(6, 'Palanca alta', 'night', 'La palanca está arriba, la segunda puerta pide peso y hay pinchos de por medio.', { limit: 18, par: 4 }, 36, 14, L => {
  L.room(12);
  L.fill(8, 7, 11, 11); L.put(10, 6, '4');
  L.put(2, 11, 'P'); L.gate(14, 8, 11, 'a'); L.put(18, 11, '2'); L.gate(22, 8, 11, 'b'); L.fill(25, 12, 27, 12, '^'); L.put(33, 11, 'X');
});

level(7, 'La gran muralla', 'cave', 'Primero hay que abrir la puerta. Después, una torre de tres ecos para pasar la muralla y la lava.', { limit: 20, par: 5 }, 44, 14, L => {
  L.room(12);
  L.put(2, 11, 'P'); L.put(4, 11, '1'); L.put(7, 11, '1'); L.gate(11, 8, 11, 'a');
  L.fill(22, 6, 28, 11); L.fill(29, 12, 32, 12, '~'); L.fill(33, 6, 43, 11); L.put(36, 5, 'X');
});

export const LEVELS = defs;
