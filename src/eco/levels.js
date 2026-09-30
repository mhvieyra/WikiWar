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

level(1, 'Contrapeso', 'cave', 'Tu eco sostiene el botón mientras vos cruzás.', { limit: 20, par: 1 }, 24, 12, L => {
  L.room(10);
  L.put(2, 9, 'P'); L.put(5, 9, '1'); L.gate(12, 6, 9, 'a'); L.put(20, 9, 'X');
  L.sign(3, 9, 'R: cerrar ciclo. Tus ciclos anteriores se repiten solos.');
});

level(2, 'Dos pesos', 'cave', 'Una puerta, dos botones y un solo cuerpo.', { limit: 25, par: 2 }, 28, 12, L => {
  L.room(10);
  L.put(3, 9, 'P'); L.put(6, 9, '1'); L.put(9, 9, '1'); L.gate(14, 6, 9, 'a'); L.put(24, 9, 'X');
  L.sign(4, 9, 'La puerta abre si TODOS los botones del mismo color están apretados.');
});

level(3, 'Escalón vivo', 'night', 'Un eco quieto es una escalera.', { limit: 30, par: 2 }, 26, 14, L => {
  L.room(12); L.fill(14, 9, 25, 13);
  L.put(3, 11, 'P'); L.put(15, 8, '1'); L.gate(20, 5, 8, 'a'); L.put(23, 8, 'X');
  L.sign(4, 11, 'Sobre la cabeza de un eco podés llegar más alto.');
});

level(4, 'Ventana', 'factory', 'La puerta solo abre un instante.', { limit: 15, par: 1, pulse: 1.5 }, 30, 12, L => {
  L.room(10);
  L.put(2, 9, 'P'); L.put(5, 9, 'u'); L.gate(22, 6, 9, 'a'); L.put(27, 9, 'X');
  L.sign(3, 9, 'El pulsador abre la puerta 1,5 s. Quedarse encima no lo mantiene.');
});

level(5, 'Cadena', 'cave', 'Cada eco le abre el camino al siguiente.', { limit: 30, par: 2 }, 32, 14, L => {
  L.room(12);
  L.put(2, 11, 'P'); L.put(8, 11, '1'); L.gate(12, 8, 11, 'a'); L.put(17, 11, '2'); L.gate(22, 8, 11, 'b'); L.put(28, 11, 'X');
});

level(6, 'Torre', 'night', 'Una caja, un eco y una cornisa demasiado alta.', { limit: 30, par: 1 }, 26, 16, L => {
  L.room(14); L.fill(15, 10, 25, 15);
  L.put(2, 13, 'P'); L.put(6, 13, 'M'); L.put(23, 9, 'X');
  L.sign(3, 13, 'Empujá la caja contra la pared y subite.');
});

level(7, 'Ventana y peso', 'factory', 'Cruzá en el instante justo y dejá algo pesando.', { limit: 30, par: 2, pulse: 1.5 }, 34, 12, L => {
  L.room(10);
  L.put(2, 9, 'P'); L.put(5, 9, 'u'); L.gate(12, 6, 9, 'a'); L.put(17, 9, '2'); L.gate(23, 6, 9, 'b'); L.put(30, 9, 'X');
});

level(8, 'Relevos', 'night', 'Un eco puede servir de escalón y después de contrapeso.', { limit: 40, par: 2 }, 30, 14, L => {
  L.room(12); L.fill(1, 9, 7, 13);
  L.put(11, 11, 'P'); L.put(4, 8, '4'); L.gate(16, 8, 11, 'a'); L.put(20, 11, '2'); L.gate(24, 8, 11, 'b'); L.put(27, 11, 'X');
  L.sign(10, 11, 'E: usar la palanca (queda puesta).');
});

export const LEVELS = defs;
