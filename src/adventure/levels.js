// Niveles del modo Aventura. Cada nivel se dibuja con un mini DSL sobre una
// grilla de tiles y se compila a filas de texto que lee sim.js.
//
// Leyenda (una letra = un tile):
//   .  aire            #  bloque solido        =  plataforma (se atraviesa desde abajo)
//   ^  pinchos         ~  lava                 %  bloque agrietado (se rompe a tiros)
//   L  cerradura (se abre con una llave)       s  resorte
//   P  inicio          X  salida               C  punto de control
//   o  moneda          h  corazon              f  celda de combustible     k  llave
//   M  caja empujable  S  slime                B  murcielago               T  torreta     G  jefe
//   1 2 3  botones (canal 1..3)   a b c  puertas (canal 1..3)   4 5 6  palancas (canal 1..3)
// Un objeto en (x, y) ocupa ese tile y apoya sobre el tile de abajo.
// Los movers son plataformas moviles: { x, y, len, dx, dy, speed } en tiles.

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
    ground(x0, x1, top) { api.fill(x0, top, x1, H - 1, '#'); },
    col(x, y0, y1, c) { api.fill(x, y0, x, y1, c); },
    sign(x, y, text) { signs.push({ x, y, text }); },
    mover(x, y, len, dx, dy, speed) { movers.push({ x, y, len, dx, dy, speed }); },
    coins(list) { list.forEach(([x, y]) => put(x, y, 'o')); }
  };
  fn(api);
  return { rows: g.map(r => r.join('')), signs, movers };
}

const defs = [];
const level = (id, name, theme, desc, W, H, fn) => defs.push({ id, name, theme, desc, ...build(W, H, fn) });

/* 1 ----------------------------------------------------------------------- */
level(1, 'Valle verde', 'day', 'Correr, saltar, disparar y agacharse.', 64, 16, L => {
  L.ground(0, 13, 12); L.ground(17, 31, 12); L.fill(24, 11, 31, 15); L.ground(35, 63, 12);
  L.put(2, 11, 'P');
  L.sign(3, 11, 'A / D: mover     ESPACIO: saltar');
  L.coins([[6, 10], [7, 10], [8, 10]]);
  L.sign(11, 11, 'Saltá los pozos');
  L.coins([[14, 9], [15, 8], [16, 9]]);
  L.fill(19, 10, 21, 10, '='); L.coins([[19, 9], [20, 9], [21, 9]]);
  L.put(22, 11, 'S');
  L.sign(17, 11, 'Pisale la cabeza a los enemigos, o dispará con el mouse');
  L.put(27, 10, '^'); L.put(28, 10, '^'); L.coins([[27, 8], [28, 8]]);
  L.put(30, 10, 'C');
  L.coins([[32, 9], [33, 8], [34, 9]]);
  L.put(39, 11, 'S'); L.put(44, 11, 'S');
  L.sign(46, 11, 'S o C: agacharse');
  L.fill(48, 7, 54, 10, '#'); L.coins([[50, 11], [51, 11], [52, 11]]);
  L.put(58, 11, 'h');
  L.put(61, 11, 'X');
});

/* 2 ----------------------------------------------------------------------- */
level(2, 'Cielo abierto', 'sunset', 'Volá con el jetpack: mantené ESPACIO en el aire.', 76, 24, L => {
  L.ground(0, 16, 20);
  L.fill(9, 14, 10, 19);
  L.put(2, 19, 'P');
  L.sign(4, 19, 'En el aire, mantené ESPACIO para volar');
  L.sign(6, 19, 'El combustible se recarga en el piso');
  L.coins([[9, 12], [10, 12]]);
  L.put(14, 19, 'C');
  L.put(24, 15, 'f'); L.put(29, 13, 'f');
  L.coins([[19, 17], [20, 16], [21, 16], [26, 14], [27, 13], [31, 15]]);
  L.fill(33, 20, 53, 23);
  L.put(36, 14, 'B'); L.put(40, 12, 'B');
  L.coins([[37, 19], [38, 19], [39, 19]]); L.put(43, 19, 'h');
  L.fill(46, 3, 47, 17); L.fill(54, 6, 55, 23);
  L.put(50, 14, 'f'); L.put(50, 8, 'f');
  L.put(49, 10, 'B'); L.put(52, 5, 'B');
  L.coins([[49, 17], [52, 12], [49, 6]]);
  L.fill(56, 5, 63, 23); L.fill(67, 5, 75, 23);
  L.put(57, 4, 'C');
  L.put(60, 4, '^'); L.put(61, 4, '^');
  L.coins([[60, 2], [61, 2], [65, 3], [65, 2]]);
  L.put(66, 2, 'B');
  L.put(73, 4, 'X');
});

/* 3 ----------------------------------------------------------------------- */
level(3, 'Cajas y botones', 'cave', 'Empujá cajas, apretá botones y usá palancas.', 64, 18, L => {
  L.fill(0, 0, 63, 2); L.fill(0, 14, 63, 17);
  L.put(2, 13, 'P');
  L.sign(3, 13, 'Empujá la caja hasta el botón: abre la puerta');
  L.put(8, 13, 'M'); L.coins([[5, 12], [6, 12]]);
  L.put(19, 13, '1'); L.col(20, 10, 13, 'a'); L.col(20, 3, 9);
  L.sign(23, 13, 'E: usar la palanca');
  L.put(24, 13, '5'); L.col(34, 10, 13, 'b'); L.col(34, 3, 9);
  L.put(28, 13, 'S'); L.put(31, 13, '^'); L.put(30, 13, '^');
  L.coins([[26, 11], [27, 11], [30, 11], [31, 11]]);
  L.put(37, 13, 'C');
  L.sign(38, 13, 'Apilá la caja para llegar a la llave');
  L.put(39, 13, 'M'); L.fill(44, 11, 50, 13);
  L.put(47, 10, 'k'); L.coins([[45, 10], [49, 10]]);
  L.put(52, 13, 'T');
  L.sign(53, 9, 'La llave abre la cerradura');
  L.col(54, 10, 13, 'L'); L.col(54, 3, 9);
  L.put(56, 13, 'h'); L.put(57, 13, 'C');
  L.coins([[58, 13], [59, 13]]);
  L.put(61, 13, 'X');
});

/* 4 ----------------------------------------------------------------------- */
level(4, 'La mina', 'cave', 'Bloques agrietados, lava, torretas y llaves.', 84, 20, L => {
  L.fill(0, 0, 83, 1); L.fill(0, 16, 17, 19); L.fill(30, 16, 83, 19);
  L.fill(18, 18, 29, 19, '~');
  L.put(2, 15, 'P');
  L.sign(3, 15, 'Disparales a los bloques agrietados');
  L.fill(12, 14, 13, 15, '%'); L.fill(12, 2, 13, 13);
  L.coins([[15, 15], [16, 15]]); L.put(6, 15, 'C');
  L.mover(18, 14, 3, 5, 0, 60); L.mover(25, 12, 3, 5, 0, 60);
  L.put(22, 9, 'B'); L.coins([[20, 12], [27, 10], [28, 10]]);
  L.put(30, 15, 'h');
  L.fill(34, 2, 50, 10);
  L.put(36, 15, 'M'); L.put(39, 15, 'M');
  L.sign(33, 15, 'Las cajas frenan las balas');
  L.put(45, 15, '1'); L.col(46, 11, 15, 'a'); L.col(46, 2, 10);
  L.put(49, 15, 'T'); L.coins([[42, 15], [43, 15]]);
  L.put(52, 15, 'C'); L.put(54, 15, 'S'); L.put(60, 15, 'S');
  L.fill(56, 12, 58, 12, '='); L.put(57, 11, 'k');
  L.fill(57, 17, 61, 17, '.'); L.fill(58, 16, 60, 16, '%');
  L.coins([[58, 17], [59, 17], [60, 17]]); L.sign(57, 15, '¿Y si dispararas al piso?');
  L.put(65, 15, 'B'); L.put(67, 12, 'B');
  L.fill(72, 2, 72, 9); L.col(72, 10, 15, 'L');
  L.put(75, 15, 'C'); L.coins([[74, 15], [77, 15]]);
  L.put(80, 15, 'X');
});

/* 5 ----------------------------------------------------------------------- */
level(5, 'Torre de acero', 'night', 'Subí la torre: resortes, plataformas y jetpack.', 32, 46, L => {
  L.ground(0, 31, 42);
  L.put(3, 41, 'P');
  L.sign(5, 41, 'Los resortes te lanzan bien alto');
  L.put(10, 41, 's'); L.coins([[10, 36], [10, 35]]);
  L.fill(5, 38, 8, 38, '='); L.fill(16, 36, 20, 36, '=');
  L.fill(22, 33, 27, 33, '='); L.put(24, 32, 'f');
  L.fill(4, 30, 9, 30, '='); L.put(7, 29, 'B');
  L.fill(12, 27, 15, 27, '=');
  L.mover(17, 26, 3, 8, 0, 70);
  L.fill(24, 23, 29, 23, '='); L.put(26, 22, 'C');
  L.fill(0, 24, 3, 24, '#'); L.put(2, 23, 's'); L.coins([[2, 18], [2, 17]]);
  L.fill(6, 20, 10, 20, '='); L.put(8, 19, 'T');
  L.fill(14, 18, 17, 18, '='); L.put(15, 17, 'f');
  L.fill(21, 16, 26, 16, '='); L.put(23, 15, 'B');
  L.fill(26, 13, 29, 13, '='); L.coins([[27, 12], [28, 12]]);
  L.fill(18, 10, 24, 10, '='); L.put(21, 9, 'h');
  L.mover(6, 9, 3, 0, -4, 55);
  L.fill(10, 6, 14, 6, '#'); L.put(12, 5, 'C');
  L.fill(17, 5, 20, 5, '='); L.put(18, 4, 'B');
  L.fill(23, 4, 30, 4, '='); L.put(27, 3, 'X');
  L.coins([[19, 3], [25, 2], [26, 2]]);
});

/* 6 ----------------------------------------------------------------------- */
level(6, 'Fábrica', 'factory', 'Un poco de todo: cajas, palancas, llaves y torretas.', 76, 22, L => {
  L.fill(0, 0, 75, 2); L.fill(0, 18, 75, 21);
  L.put(2, 17, 'P');
  L.sign(3, 17, 'Dos botones, una puerta: necesitás dos cajas');
  L.put(7, 17, 'M'); L.put(10, 17, 'M');
  L.put(17, 17, '1'); L.put(18, 17, '1'); L.col(19, 12, 17, 'a'); L.col(19, 3, 11);
  L.coins([[13, 16], [14, 16]]);
  L.put(24, 17, '5'); L.put(29, 17, 'T');
  L.fill(26, 15, 27, 15, '='); L.coins([[26, 13], [27, 13]]);
  L.col(32, 12, 17, 'b'); L.col(32, 3, 11);
  L.put(36, 17, 'C');
  L.fill(38, 18, 50, 21, '~'); L.mover(38, 16, 3, 5, 0, 65); L.mover(45, 16, 3, 5, 0, 65);
  L.put(40, 12, 'B'); L.put(47, 11, 'f'); L.coins([[42, 13], [43, 13], [48, 13]]);
  L.fill(51, 15, 56, 17);
  L.put(54, 14, 'k'); L.put(57, 17, 'S'); L.put(60, 17, 'S');
  L.put(62, 17, 'C');
  L.col(66, 12, 17, 'L'); L.col(66, 3, 11);
  L.put(64, 17, 'T'); L.put(69, 17, 'h');
  L.put(72, 17, 'X');
});

/* 7 ----------------------------------------------------------------------- */
level(7, 'El Ojo', 'factory', 'El jefe final. Pisale la cabeza o dispará.', 42, 20, L => {
  L.fill(0, 0, 41, 1); L.fill(0, 18, 41, 19);
  L.put(3, 17, 'P'); L.put(5, 17, 'C');
  L.sign(4, 17, 'Esquivá sus balas y devolvele el fuego');
  L.fill(6, 13, 9, 13, '='); L.fill(32, 13, 35, 13, '=');
  L.fill(17, 10, 24, 10, '='); L.fill(12, 15, 13, 15, '='); L.fill(28, 15, 29, 15, '=');
  L.put(7, 12, 'h'); L.put(34, 12, 'h'); L.put(20, 9, 'f');
  L.put(21, 6, 'G');
  L.put(38, 17, 'X');
});

export const LEVELS = defs;
