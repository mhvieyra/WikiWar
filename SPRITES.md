# Sprites y sonidos de WikiWar

Poné los PNG en `public/sprites/` y los audios en `public/sounds/`. No hace
falta que estén todos: el juego dibuja un placeholder por código para cada
sprite que falte, y usa un beep sintetizado para cada sonido que falte, así
que podés ir reemplazando de a uno.

Estas dos carpetas se sirven desde la raíz del sitio (`public/` de Vite), por
eso el juego pide los archivos en rutas absolutas como `/sprites/player_idle.png`
y `/sounds/jump.mp3`, no relativas.

Los nombres de archivo son **case-sensitive en Vercel** (Linux), a diferencia
de tu máquina si es Mac o Windows. Usá siempre minúsculas y snake_case, tal
cual estan en las tablas de abajo. Hoy no hay ningún desajuste entre los
nombres que pide el código (`src/sprites.js`, `src/audio.js`) y los que
describe este archivo.

## Reglas generales para los sprites

- Cada archivo es una **tira horizontal** de frames del mismo tamaño (frame 1 a la izquierda).
- Todo se dibuja **mirando a la derecha**. El juego lo espeja solo cuando mira a la izquierda.
- Se dibuja a **x2** (`SPR_SCALE` en `src/config.js`), con pixel art nítido. Un frame de 32x32 se ve de 64x64 px.
- Fondo transparente.

## Lista de archivos de sprites (`public/sprites/`)

| Archivo | Frame | Frames | Anclaje | Qué es |
|---|---|---|---|---|
| `player_idle.png` | 32x32 | 2 a 4 | pies, centro abajo | Jugador quieto |
| `player_run.png` | 32x32 | 6 a 8 | pies, centro abajo | Jugador corriendo |
| `player_jump.png` | 32x32 | 1 | pies, centro abajo | Jugador en el aire |
| `player_fly.png` | 32x32 | 2 a 4 | pies, centro abajo | Jugador volando (jetpack) |
| `player_crouch.png` | 32x32 | 2 | pies, centro abajo | Jugador agachado quieto (respirando) |
| `player_crouch_walk.png` | 32x32 | 6 | pies, centro abajo | Jugador agachado caminando |
| `player_arm.png` | 16x16 | 1 | hombro en el pixel (1.5, 8.5), apunta a +x | Brazo que apunta al mouse (aparte del cuerpo) |
| `enemy_run.png` | 32x32 | 6 a 8 | pies, centro abajo | Enemigo cuerpo a cuerpo |
| `enemy_gunner.png` | 32x32 | 6 a 8 | pies, centro abajo | Enemigo que dispara (con el arma ya dibujada) |
| `enemy_die.png` | 32x32 | 4 a 6 | pies, centro abajo | Muerte del enemigo (se reproduce una vez) |
| `gun_pistol.png` | 16x16 | 1 | 20% desde la izquierda, mitad vertical | Pistola |
| `gun_smg.png` | 24x16 | 1 | igual | SMG |
| `gun_shotgun.png` | 28x16 | 1 | igual | Escopeta |
| `bullet.png` | 8x8 | 1 | centro | Bala |
| `grenade.png` | 8x8 | 1 | centro | Granada (gira sola) |
| `explosion.png` | 64x64 | 6 a 10 | centro | Explosión (se reproduce una vez) |
| `heart.png` | 8x8 | 1 | esquina superior izquierda | Corazón de vida |

## Lista de archivos de sonido (`public/sounds/`)

Cada clave admite `.mp3` u `.ogg` (se prueba `.mp3` primero). Si falta el
archivo, `src/audio.js` cae automáticamente al beep sintetizado con los
mismos parámetros de siempre.

| Clave | Archivo | Cuándo suena |
|---|---|---|
| `jump` | `jump.mp3` | Al saltar |
| `shoot_pistola` | `shoot_pistola.mp3` | Disparo de pistola |
| `shoot_smg` | `shoot_smg.mp3` | Disparo de SMG |
| `shoot_escopeta` | `shoot_escopeta.mp3` | Disparo de escopeta |
| `grenade_throw` | `grenade_throw.mp3` | Al tirar una granada |
| `enemy_shoot` | `enemy_shoot.mp3` | Disparo de un enemigo gunner |
| `enemy_die` | `enemy_die.mp3` | Muerte de un enemigo |
| `player_hurt` | `player_hurt.mp3` | El jugador recibe daño |
| `explosion` | `explosion.mp3` | Explosión de granada |

Si agregás un arma nueva en `src/weapons.js`, la clave de su disparo es
siempre `shoot_<nombre en minúsculas>` (el campo `name` del arma).

> `public/sprites/player_walk.png` está subido pero **no se usa todavía**: el
> juego no distingue entre "caminar" y "correr" (una sola velocidad, un solo
> estado `moving`), así que por ahora `player_run.png` cubre cualquier
> movimiento horizontal en el piso.

## Detalles que conviene saber

- **El brazo y el arma del jugador son sprites aparte** del cuerpo (`player_arm.png` + `gun_*.png`). El juego rota el brazo hacia el mouse desde el hombro, y el arma sale de la mano (16px más allá del hombro en la dirección de apuntado). Por eso el cuerpo (`player_idle.png`, `player_run.png`, etc.) va **sin brazo**: se dibuja el torso y las piernas nomás, el brazo se superpone encima. Los enemigos son la excepción: `enemy_gunner.png` ya trae el brazo/arma dibujado en el mismo sprite, no hay `enemy_arm.png` aparte.
- **`player_arm.png`** mide 16x16, el hombro (el pivote de rotación) es el pixel (1.5, 8.5), y el arte apunta hacia +x (derecha) en reposo. Al apuntar a la izquierda se espeja en **vertical** (no horizontal), igual que las armas.
- **Altura del hombro sobre los pies:** 32px de pie, 28px agachado (`SHOULDER_STAND_Y`/`SHOULDER_CROUCH_Y` en `src/sprites.js`). Ahí se ancla el brazo, y de ahí sale el ángulo de apuntado y el origen de balas/granadas.
- **Hitbox:** el jugador mide 16px de ancho por 40px de alto de pie, 24px agachado (`STAND_H`/`CROUCH_H` en `src/config.js`); los enemigos miden 16x40 fijo. Todo esto es independiente del tamaño del sprite. Con un frame de 32x32 a x2 el dibujo queda de 64x64, más grande que la hitbox. Si querés que coincidan más, dibujá el stickman ocupando el centro del frame.
- **Velocidad de animación** (fps) y tamaños de frame están en el objeto `SPRITES` de `src/sprites.js`. Si tus frames miden otra cosa, cambiás `fw`, `fh` y `fps` ahí.
- Si un sprite o sonido existe pero querés volver al placeholder, borrá el archivo (o sacalo de `public/`).

## Cómo jugarlo en desarrollo

1. `npm install` (una sola vez) y después `npm run dev`.
2. Abrí la URL que imprime Vite (por defecto `http://localhost:5173`).
3. Elegí idioma, origen y destino, o tocá **ALEATORIO**.
4. Los links azules son portales. Parate sobre uno y apretá **E**.
5. El link al destino, cuando aparece en la página, brilla en dorado.
