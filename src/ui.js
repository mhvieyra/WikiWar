// HUD, menu, pausa y mensajes (pantalla de victoria/derrota). Todo lo que
// es presentacion: leer/escribir el DOM del menu y overlays, dibujar el
// HUD sobre el canvas. El flujo de partida (cargar nivel, reiniciar,
// arrancar el juego) vive en main.js; ui.js lo llama cuando hace falta
// (por ejemplo desde los botones del menu o de las pantallas de mensaje).
import { PAIRS } from './config.js';
import { S, state, ctx } from './state.js';
import { $, clamp, esc, fmtTime, norm } from './utils.js';
import { WEAPONS } from './weapons.js';
import { drawHeart } from './sprites.js';
import { resetRun, startGame } from './main.js';

export function fade(on) { $('#fade').style.opacity = on ? 1 : 0; }

export function toast(t) {
  const el = $('#toast'); el.textContent = t; el.style.opacity = 1;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.style.opacity = 0; }, 1800);
}

export function showMsg(title, body, btns) {
  $('#mT').textContent = title; $('#mB').innerHTML = body;
  const b = $('#mBtns'); b.innerHTML = '';
  btns.forEach(([label, fn, alt]) => {
    const el = document.createElement('button'); el.textContent = label; if (alt) el.className = 'alt';
    el.onclick = () => { el.blur(); hideMsg(); fn(); }; b.appendChild(el);
  });
  $('#msg').style.display = 'flex';
}
export function hideMsg() { $('#msg').style.display = 'none'; }

export function toMenu() { S.mode = 'menu'; $('#menu').style.display = 'flex'; document.body.classList.remove('play'); $('#status').textContent = ''; }

export function stats() {
  return 'Saltos: <b>' + S.clicks + '</b><br>Tiempo: <b>' + fmtTime(S.time) + '</b><br>Bajas: <b>' + S.kills + '</b><br>Palabras destruidas: <b>' + S.words + '</b><br><br>Ruta: ' + S.path.map(esc).join(' → ');
}

export function win(title) {
  S.mode = 'win';
  showMsg('¡LLEGASTE A «' + title.toUpperCase() + '»!', stats(), [['JUGAR OTRA VEZ', () => resetRun(), false], ['MENÚ', toMenu, true]]);
}

export function gameOver() {
  S.mode = 'over';
  showMsg('GAME OVER', 'Te quedaste sin vidas antes de llegar a «' + esc(S.toCanon) + '».<br><br>' + stats(), [['REINTENTAR', () => resetRun(), false], ['MENÚ', toMenu, true]]);
}

export function pause() {
  if (S.mode !== 'play') return;
  S.mode = 'pause';
  showMsg('PAUSA', 'Destino: <b>' + esc(S.toCanon) + '</b><br>Vidas: <b>' + S.lives + '</b>', [
    ['REANUDAR', () => { S.mode = 'play'; }, false],
    ['REINICIAR', () => resetRun(), true],
    ['MENÚ', toMenu, true]]);
}

export function setGoal() {
  $('#tTo').textContent = S.toCanon; $('#tFrom').textContent = S.from;
  $('#gTitle').textContent = S.toCanon;
  const ex = (S.toInfo.extract || '').replace(/\s+/g, ' ');
  $('#gText').textContent = ex.length > 150 ? ex.slice(0, 147) + '…' : ex;
  const im = $('#gImg'); if (S.toInfo.thumb) { im.src = S.toInfo.thumb; im.style.display = 'block'; } else im.style.display = 'none';
}

export function randomPair() {
  const lang = $('#lang').value, P = PAIRS[lang];
  const a = P.starts[Math.floor(Math.random() * P.starts.length)];
  let b; do { b = P.ends[Math.floor(Math.random() * P.ends.length)]; } while (norm(a) === norm(b));
  $('#inFrom').value = a; $('#inTo').value = b;
}

export function drawHud() {
  const p = state.p;
  ctx.font = 'bold 12px "Courier New",monospace'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#272727'; ctx.fillRect(10, 10, 178, 74); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, 178, 74);
  for (let i = 0; i < 3; i++) { if (i < S.lives) drawHeart(20 + i * 30, 17, 3); else { ctx.globalAlpha = .25; drawHeart(20 + i * 30, 17, 3); ctx.globalAlpha = 1; } }
  ctx.fillStyle = '#fff'; ctx.fillText('VIDA', 20, 47);
  ctx.fillStyle = '#111'; ctx.fillRect(62, 41, 116, 10); ctx.fillStyle = p.hp > 35 ? '#4ade80' : '#e63946'; ctx.fillRect(62, 41, 116 * clamp(p.hp / 100, 0, 1), 10);
  ctx.fillStyle = '#fff'; ctx.fillText('FUEL', 20, 62);
  ctx.fillStyle = '#111'; ctx.fillRect(62, 57, 116, 10); ctx.fillStyle = '#ff7a3d'; ctx.fillRect(62, 57, 116 * clamp(p.fuel / 100, 0, 1), 10);
  ctx.fillStyle = '#ffd166'; ctx.fillText('[' + (S.wi + 1) + '] ' + WEAPONS[S.wi].name, 20, 77);
}

let hudCache = '';
export function updateHud() {
  const s = S.clicks + '|' + fmtTime(S.time) + '|' + S.kills + '|' + S.words;
  if (s === hudCache) return; hudCache = s;
  $('#nClicks').textContent = S.clicks; $('#nTime').textContent = fmtTime(S.time); $('#nKills').textContent = S.kills; $('#nWords').textContent = S.words;
}

export function initUI() {
  $('#bPlay').onclick = e => { e.target.blur(); startGame(); };
  $('#bRand').onclick = e => { e.target.blur(); randomPair(); };
  $('#lang').onchange = randomPair;
  ['#inFrom', '#inTo'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); }));
  randomPair();
}
