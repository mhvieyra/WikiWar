# Sprites de Wiki Destroy Race

Poné los PNG en una carpeta `sprites/` al lado de `index.html`. No hace falta que estén todos: el juego dibuja un placeholder por código para cada sprite que falte, así que podés ir reemplazando de a uno.

## Reglas generales

- Cada archivo es una **tira horizontal** de frames del mismo tamaño (frame 1 a la izquierda).
- Todo se dibuja **mirando a la derecha**. El juego lo espeja solo cuando mira a la izquierda.
- Se dibuja a **x2** (`SPR_SCALE` en `index.html`), con pixel art nítido. Un frame de 32x32 se ve de 64x64 px.
- Fondo transparente.

## Lista de archivos

| Archivo | Frame | Frames | Anclaje | Qué es |
|---|---|---|---|---|
| `player_idle.png` | 32x32 | 2 a 4 | pies, centro abajo | Jugador quieto |
| `player_run.png` | 32x32 | 6 a 8 | pies, centro abajo | Jugador corriendo |
| `player_jump.png` | 32x32 | 1 | pies, centro abajo | Jugador en el aire |
| `player_fly.png` | 32x32 | 2 a 4 | pies, centro abajo | Jugador volando (jetpack) |
| `enemy_run.png` | 32x32 | 6 a 8 | pies, centro abajo | Enemigo cuerpo a cuerpo |
| `enemy_gunner.png` | 32x32 | 6 a 8 | pies, centro abajo | Enemigo que dispara |
| `enemy_die.png` | 32x32 | 4 a 6 | pies, centro abajo | Muerte del enemigo (se reproduce una vez) |
| `gun_pistol.png` | 16x16 | 1 | 20% desde la izquierda, mitad vertical | Pistola |
| `gun_smg.png` | 24x16 | 1 | igual | SMG |
| `gun_shotgun.png` | 28x16 | 1 | igual | Escopeta |
| `bullet.png` | 8x8 | 1 | centro | Bala |
| `grenade.png` | 8x8 | 1 | centro | Granada (gira sola) |
| `explosion.png` | 64x64 | 6 a 10 | centro | Explosión (se reproduce una vez) |
| `heart.png` | 8x8 | 1 | esquina superior izquierda | Corazón de vida |

## Detalles que conviene saber

- **Las armas son sprites aparte** del cuerpo. El juego las rota hacia el mouse desde el hombro del stickman, así que dibujá el cuerpo con los brazos sueltos o bajos y el arma mirando a la derecha. Si apuntás a la izquierda se espeja en vertical para que no quede al revés.
- **Hitbox:** el jugador y los enemigos miden 16x40 px en el juego, con independencia del tamaño del sprite. Con un frame de 32x32 a x2 el dibujo queda de 64x64, más grande que la hitbox. Si querés que coincidan más, dibujá el stickman ocupando el centro del frame.
- **Velocidad de animación** (fps) y tamaños de frame están en el objeto `SPRITES` al principio del script. Si tus frames miden otra cosa, cambiás `fw`, `fh` y `fps` ahí.
- Si un sprite existe pero querés volver al placeholder, renombrá o borrá el archivo.
- Abrí el juego con un servidor local (`python3 -m http.server` o `npx serve`) para que el navegador cargue los PNG sin problemas.

## Cómo jugarlo

1. `python3 -m http.server 8000` dentro de la carpeta y abrí `http://localhost:8000`.
2. Elegí idioma, origen y destino, o tocá **ALEATORIO**.
3. Los links azules son portales. Parate sobre uno y apretá **E**.
4. El link al destino, cuando aparece en la página, brilla en dorado.
