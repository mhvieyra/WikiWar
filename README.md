# WikiWar

Un platformer de wiki-race: el jugador va de un artículo de Wikipedia a
otro. Cada palabra del artículo es una plataforma rompible, los links azules
son portales (se entra con **E**), hay stickmans enemigos persiguiéndote, y
tenés 3 vidas para llegar al destino.

WikiWar es un proyecto independiente y sin fines de lucro, **no afiliado a
la Fundación Wikimedia**. El contenido de los artículos viene de la API
pública de Wikipedia y se usa bajo su licencia correspondiente.

## Controles

| Tecla | Acción |
|---|---|
| A / D o flechas | Mover |
| Espacio / W / ↑ | Saltar (mantené apretado en el aire para volar) |
| S / ↓ | Bajar de la plataforma actual |
| C o Shift | Agacharse (mientras se mantiene apretada) |
| Click izquierdo | Disparar |
| Click derecho | Tirar granada |
| 1, 2, 3 | Cambiar de arma |
| E | Entrar al link donde estás parado |
| Esc | Pausa |
| M | Silenciar/activar sonido |
| H | Mostrar/ocultar la ayuda de controles (se oculta sola a los 9 s) |

## Modos y Elo

- **Clasificatoria** (por defecto): la ruta se sortea al empezar, así que
  no sabés qué palabras te tocan hasta que arranca la partida. Cronómetro
  visible y suma o resta Elo. Al terminar, «Jugar otra vez» te lleva a otra
  ruta aleatoria.
- **Personalizado**: elegís origen y destino (o tocás Aleatorio) y si querés
  jugar con o sin cronómetro. No afecta el Elo.

El Elo arranca en 1000 y se guarda en el navegador (`localStorage`). Cada
clasificatoria se juega contra una ruta de rating fijo (1200). Una derrota
vale 0; una victoria vale entre 0.5 y 1 según rapidez, saltos y vidas que
sobran. Abandonar una clasificatoria desde la pausa cuenta como derrota. K
es 40 en las primeras 10 partidas y 24 después. Rangos: Bronce, Plata
(900), Oro (1100), Platino (1300), Diamante (1500), Maestro (1700) y
Leyenda (1900). Todo está en `src/elo.js`.

## Cajas de suministros

Cada 60 segundos cae una caja con paracaídas cerca del jugador (dura 30 s si
no se rompe). Se rompe a tiros o con granadas (3 de vida) y suelta un ítem
que desaparece a los 20 s: munición (55%), poción de fuerza (37%, daño x1.5
por 15 s) o botiquín (8%, +50 de vida).

La pistola tiene balas infinitas; la SMG y la escopeta tienen reserva
limitada (se ve en el HUD). Matar un enemigo con la pistola te da algo de
munición de ambas. Los valores están en `src/weapons.js` y `src/config.js`.

Agachado la hitbox se achica, caminás a la mitad de velocidad y no podés
saltar ni volar; al soltar la tecla solo te parás si hay espacio libre
arriba.

## Cómo funciona

El texto del artículo sale de la API de Wikipedia (`action=parse`, con
`origin=*` para CORS) y se convierte en DOM real dentro de `#content`: cada
palabra queda envuelta en un `<span class="w">`, y el juego mide su
posición en pantalla con `getBoundingClientRect` para armar el nivel. Por
eso el juego sigue siendo DOM + Canvas 2D puro, no un motor tipo Phaser.

## Estructura del proyecto

- `index.html` — markup y metadatos, sin lógica.
- `src/main.js` — bucle principal (update/draw) y flujo de partida (cargar nivel, reiniciar, pausa, input).
- `src/config.js` — constantes de balance (gravedad, velocidades, escala de sprites, etc).
- `src/state.js` — estado global mutable compartido entre módulos (jugador, nivel, cámara, input) y el canvas.
- `src/utils.js` — helpers chicos sin estado ($, clamp, norm, fmtTime, etc).
- `src/wiki.js` — llamadas a la API de Wikipedia, armado del DOM del artículo y medición del nivel.
- `src/elo.js` — sistema Elo local y rangos.
- `src/physics.js` — gravedad y colisión contra plataformas/piso.
- `src/player.js` — spawn, disparo, granada y dibujo del jugador.
- `src/crates.js` — cajas con paracaídas, ítems (botiquín, fuerza, munición) y su dibujo.
- `src/enemies.js` — aparición, IA y dibujo de los enemigos.
- `src/weapons.js` — tabla de armas (agregar una es agregar una entrada).
- `src/audio.js` — sonido: hoy son beeps sintetizados, preparado para cargar `.mp3`/`.ogg` desde `public/sounds/` con el beep como fallback si falta el archivo.
- `src/sprites.js` — carga de sprites desde `public/sprites/` con fallback a placeholders dibujados por código.
- `src/ui.js` — HUD, menú, pausa y mensajes (victoria/derrota).
- `src/style.css` — todos los estilos.
- `public/sprites/`, `public/sounds/` — assets opcionales (ver `SPRITES.md`).

## Requisitos

- Node.js 20.19+ o 22.12+ (lo que pide Vite 8).

## Desarrollo

```bash
npm install
npm run dev
```

Abrí la URL que imprime la terminal (por defecto `http://localhost:5173`).

## Build de producción

```bash
npm run build
npm run preview
```

`npm run build` genera `dist/`. `npm run preview` sirve ese build localmente
para probarlo antes de deployar.

## Deploy en Vercel

El proyecto es un sitio estático generado por Vite:

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`

Esto ya está en `vercel.json`, así que importar el repo en Vercel alcanza.

## Agregar sprites y sonidos

Ver `SPRITES.md` para la lista completa de archivos esperados en
`public/sprites/` y `public/sounds/`, sus tamaños de frame y sus claves.

## Ecos

Desde el menú, **Ecos** es un juego de puzles que no usa Wikipedia (`src/eco/`).
Cada intento (ciclo) se graba, y en el ciclo siguiente esa versión tuya, un
*eco*, repite lo que hiciste mientras jugás el ciclo nuevo. Los ecos son cuerpos
de verdad: aprietan botones, tiran palancas, disparan a dianas, empujan cajas y
sirven de escalón. Hay que llegar a la salida con la menor cantidad de ecos
posible (y después con el menor tiempo).

| Tecla | Acción |
|---|---|
| A / D | Mover |
| Espacio / W | Saltar |
| S / C / Shift | Agacharse y bajar de una plataforma |
| Click | Disparar (para las dianas) |
| E | Usar una palanca |
| R | Cerrar el ciclo y guardarlo como eco |
| Q | Reiniciar el ciclo sin guardarlo |
| Retroceso | Quitar el último eco |

Mecánicas: botones pesados (todos los del mismo color tienen que estar
apretados), puertas y puertas invertidas, palancas, pulsadores que abren por un
instante, dianas, cajas, resortes, plataformas móviles, pinchos y lava.

- **Desafío diario:** el mismo nivel para todos cada día (fecha en UTC), con racha.
- **Ranking local y códigos de repetición:** al resolver un nivel te da un código
  `ECO1-...`. Cualquiera puede pegarlo en «Código de repetición»: el juego lo
  verifica volviendo a simular la solución (no se puede falsificar) y permite
  verla o competir contra ese resultado.
- Los 8 niveles están en `src/eco/levels.js` con su leyenda de símbolos. Las
  soluciones de referencia (`src/eco/solutions.js`) las genera un bot
  (`tools/eco-bot.mjs`) y se verifican con `node tools/test-eco.mjs`.

## Arena

**Arena** es un duelo 1 contra 1 con terreno destructible (`src/arena/`). Se
juega contra la computadora (tres niveles) o en línea. El primero en ganar 3
rondas gana la partida.

| Control | Acción |
|---|---|
| A / D, Espacio | Mover, saltar y volar con el jetpack (mantené espacio en el aire) |
| Click / Click derecho | Disparar / picar (cava y saca oro; también pega de cerca) |
| 1 a 4 (o rueda) | Pistola, escopeta, bazuca (rompe el terreno), láser (atraviesa la tierra) |
| Q | Construir un bloque de 3x3 (cuesta oro) |
| Z / X / C | Comprar: curarte, combustible, munición del arma elegida |

El oro sale de las vetas al romper el terreno (con cualquier arma). El mercado
es **compartido**: cada compra sube el precio para los dos. Caen cajas de
suministro del cielo cada 12 s, y a los 40 s empieza a subir la lava.

**En línea** no necesita servidor: la simulación es determinista, así que solo
se intercambian las entradas de cada tick (lockstep) y se comparan hashes del
estado para detectar desincronizaciones. Para conectar, quien crea la partida le
manda un código al otro, el otro devuelve su respuesta y listo (WebRTC con
códigos para copiar y pegar; usa el STUN público de Google, y con algunos NAT
estrictos puede no conectar). «Dos pestañas en esta PC» sirve para probar.
`node tools/test-arena.mjs` verifica determinismo, simetría del mapa y partidas
de bot contra bot.
