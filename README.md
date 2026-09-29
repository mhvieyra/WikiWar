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

- **Clasificatoria** (por defecto): cronómetro visible y la partida suma o
  resta Elo.
- **Sin tiempo**: sin cronómetro y sin efecto sobre el Elo, para jugar
  relajado.

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
