// HUD, menu, pausa y mensajes (pantalla de victoria/derrota). Todo lo que
// es presentacion: leer/escribir el DOM del menu y overlays, dibujar el
// HUD sobre el canvas. El flujo de partida (cargar nivel, reiniciar,
// arrancar el juego) vive en main.js; ui.js lo llama cuando hace falta
// (por ejemplo desde los botones del menu o de las pantallas de mensaje).
import { PAIRS, SPR_SCALE, STRENGTH_MULT, STRENGTH_TIME } from './config.js';
import { S, state, ctx } from './state.js';
import { $, clamp, esc, fmtTime, norm } from './utils.js';
import { WEAPONS, magsLeft } from './weapons.js';
import { SPRITES, okSpr, drawHeart } from './sprites.js';
import { resetRun, startGame, playRandom } from './main.js';
import { loadElo, rankOf, recordGame } from './elo.js';

export function fade(on) { $('#fade').style.opacity = on ? 1 : 0; }

export function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.classList.remove('on'); }, 1800);
}

export function showMsg(title, body, btns, kind = 'pause', eyebrow = '') {
  $('#mK').textContent = eyebrow; $('#mT').textContent = title; $('#mB').innerHTML = body;
  $('#msg').className = kind;
  const b = $('#mBtns'); b.innerHTML = '';
  btns.forEach(([label, fn, alt]) => {
    const el = document.createElement('button'); el.textContent = label; el.className = alt ? 'ghost' : 'primary';
    el.onclick = () => { el.blur(); hideMsg(); fn(); }; b.appendChild(el);
  });
  $('#msg').style.display = 'flex';
}
export function hideMsg() { $('#msg').style.display = 'none'; }

// Cierra la partida clasificatoria (una sola vez) y devuelve el bloque HTML del Elo.
export function settle(won) {
  if (!S.ranked || S.settled) return '';
  S.settled = true;
  const r = recordGame(won, S);
  return eloHtml(r);
}
function eloHtml(r) {
  const sign = r.delta > 0 ? '+' : '';
  return '<div class="eloRes ' + (r.delta >= 0 ? 'up' : 'down') + '"><b>ELO ' + r.after + '</b><span>' + sign + r.delta + '</span><small>' + r.rank + (r.promoted ? ' · ¡SUBISTE DE RANGO!' : '') + '</small></div>';
}
// Abandonar una clasificatoria en curso cuenta como derrota.
function leave(fn) { return () => { if (S.mode === 'pause' && S.ranked && !S.settled) { const r = recordGame(false, S); S.settled = true; toast('Abandonaste: ELO ' + r.after + ' (' + r.delta + ')'); } fn(); }; }
export function renderElo() {
  const d = loadElo();
  const ranked = $('#mode').value === 'ranked';
  $('#customBox').style.display = ranked ? 'none' : '';
  $('#bRand').style.display = ranked ? 'none' : '';
  $('#eloBox').innerHTML = !ranked
    ? '<small>Modo libre: elegís las palabras y el tiempo. Esta partida no modifica tu Elo.</small>'
    : '<small>La ruta se sortea al empezar, no sabés qué te toca.</small>'
      + '<b>ELO ' + d.rating + '</b><span>' + rankOf(d.rating) + '</span><small>' + d.wins + '/' + d.games + ' victorias · récord ' + d.peak + '</small>';
}

export function toMenu() { renderElo(); S.mode = 'menu'; $('#menu').style.display = 'flex'; document.body.classList.remove('play'); $('#status').textContent = ''; }

export function stats() {
  const tile = (v, l) => '<div class="tile"><b>' + v + '</b><small>' + l + '</small></div>';
  return '<div class="tiles' + (S.untimed ? ' t3' : '') + '">' + tile(S.clicks, 'Saltos') + (S.untimed ? '' : tile(fmtTime(S.time), 'Tiempo')) + tile(S.kills, 'Bajas') + tile(S.words, 'Palabras') + '</div>' +
    '<div class="path"><span class="lbl">Ruta</span>' + S.path.map(p => '<span class="chip">' + esc(p) + '</span>').join('<i>&gt;</i>') + '</div>';
}

export function win(title) {
  S.mode = 'win';
  showMsg('Llegaste a «' + title + '»', stats() + settle(true), [['Jugar otra vez', () => playRandom(), false]].concat(S.ranked ? [] : [['Repetir esta ruta', () => resetRun(), true]], [['Menú', toMenu, true]]), 'win', 'VICTORIA');
}

export function gameOver() {
  S.mode = 'over';
  showMsg('Te quedaste sin vidas', '<p class="lead">No llegaste a <b>«' + esc(S.toCanon) + '»</b>.</p>' + stats() + settle(false),
    (S.ranked ? [['Jugar otra vez', () => playRandom(), false]] : [['Reintentar', () => resetRun(), false], ['Otro aleatorio', () => playRandom(), true]]).concat([['Menú', toMenu, true]]), 'over', 'GAME OVER');
}

export function pause() {
  if (S.mode !== 'play') return;
  S.mode = 'pause';
  showMsg('En pausa', '<p class="lead">Destino: <b>«' + esc(S.toCanon) + '»</b> · Vidas: <b>' + S.lives + '</b>' + (S.ranked ? '<br>Si abandonás, cuenta como derrota.' : '') + '</p>' + stats(), [
    ['Reanudar', () => { S.mode = 'play'; }, false],
    [S.ranked ? 'Otra ruta' : 'Reiniciar', leave(() => S.ranked ? playRandom() : resetRun()), true],
    ['Menú', leave(toMenu), true]], 'pause', 'PAUSA');
}

export function setGoal() {
  $('#tTo').textContent = S.toCanon; $('#tFrom').textContent = S.from;
  $('#gTitle').textContent = S.toCanon;
  const ex = (S.toInfo.extract || '').replace(/\s+/g, ' ');
  $('#gText').textContent = ex.length > 150 ? ex.slice(0, 147) + '…' : ex;
  showHelp(9000);
  const im = $('#gImg'); if (S.toInfo.thumb) { im.src = S.toInfo.thumb; im.style.display = 'block'; } else im.style.display = 'none';
}

export function showHelp(ms) {
  const el = $('#help'); el.classList.remove('off');
  clearTimeout(showHelp.t); if (ms) showHelp.t = setTimeout(() => el.classList.add('off'), ms);
}
export function toggleHelp() {
  const el = $('#help'); clearTimeout(showHelp.t); el.classList.toggle('off');
}

export function pickPair(lang) {
  const P = PAIRS[lang];
  const a = P.starts[Math.floor(Math.random() * P.starts.length)];
  let b; do { b = P.ends[Math.floor(Math.random() * P.ends.length)]; } while (norm(a) === norm(b));
  return [a, b];
}
export function randomPair() {
  const [a, b] = pickPair($('#lang').value);
  $('#inFrom').value = a; $('#inTo').value = b;
}

export const PF = '"Press Start 2P",monospace', VT = '"VT323",monospace';
// caja pixel art: contorno negro de 4px con esquinas cortadas + luz arriba / sombra abajo
export function pxBox(x, y, w, h, fill = '#1b1b1f') {
  ctx.fillStyle = '#000'; ctx.fillRect(x, y - 4, w, h + 8); ctx.fillRect(x - 4, y, w + 8, h);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, y + h - 3, w, 3);
}
// barra segmentada (bloques de 6px con 2px de separacion)
function bar(x, y, w, h, frac, col) {
  const n = Math.floor((w + 2) / 8);
  const on = Math.ceil(clamp(frac, 0, 1) * n - 1e-6);
  for (let i = 0; i < n; i++) { ctx.fillStyle = i < on ? col : '#0c0c0e'; ctx.fillRect(x + i * 8, y, 6, h); }
}

export function drawHud() {
  const p = state.p, X = 18, Y = 18, W = 208, H = 104;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  pxBox(X, Y, W, H);
  for (let i = 0; i < 3; i++) { if (i < S.lives) drawHeart(X + 14 + i * 32, Y + 10, 3); else { ctx.globalAlpha = .2; drawHeart(X + 14 + i * 32, Y + 10, 3); ctx.globalAlpha = 1; } }
  ctx.font = '8px ' + PF;
  ctx.fillStyle = '#a09fa8'; ctx.fillText('VIDA', X + 14, Y + 51);
  bar(X + 62, Y + 45, W - 78, 12, p.hp / 100, p.hp > 35 ? '#4ade80' : '#e63946');
  ctx.fillStyle = '#a09fa8'; ctx.fillText('FUEL', X + 14, Y + 71);
  bar(X + 62, Y + 65, W - 78, 12, p.fuel / 100, '#ff7a3d');
  // arma actual y reserva de balas (la pistola es infinita)
  ctx.fillStyle = '#34343c'; ctx.fillRect(X + 14, Y + 82, W - 28, 2);
  ctx.fillStyle = '#ffd166'; ctx.font = '8px ' + PF; ctx.fillText('[' + (S.wi + 1) + '] ' + WEAPONS[S.wi].name, X + 14, Y + 93);
  const ammo = S.ammo[S.wi], lim = WEAPONS[S.wi].ammo;
  ctx.textAlign = 'right'; ctx.font = '18px ' + VT;
  ctx.fillStyle = S.ammoFlash > 0 && Math.floor(S.ammoFlash * 10) % 2 ? '#fff' : !lim ? '#ffd166' : ammo <= 0 ? '#e63946' : ammo <= lim.max * .2 ? '#ff7a3d' : '#ffd166';
  ctx.fillText(lim ? magsLeft(S.wi) + '/3 · ' + ammo : '∞', X + W - 14, Y + 92);
  ctx.textAlign = 'left';
  // pocion de fuerza (solo mientras esta activa)
  if (S.strengthT > 0) {
    const sy = Y + H + 16;
    pxBox(X, sy, W, 48);
    if (okSpr('itemStrength')) { const d = SPRITES.itemStrength; ctx.drawImage(d.img, 0, 0, d.fw, d.fh, X + 10, sy + 8, d.fw * SPR_SCALE, d.fh * SPR_SCALE); }
    ctx.fillStyle = '#c77dff'; ctx.font = '8px ' + PF; ctx.fillText('FUERZA x' + STRENGTH_MULT, X + 50, sy + 15);
    ctx.textAlign = 'right'; ctx.font = '18px ' + VT; ctx.fillText(Math.ceil(S.strengthT) + 's', X + W - 14, sy + 14); ctx.textAlign = 'left';
    bar(X + 50, sy + 28, W - 66, 10, S.strengthT / STRENGTH_TIME, S.strengthT < 3 && Math.floor(S.strengthT * 6) % 2 ? '#fff' : '#c77dff');
  }
}

let hudCache = '';
export function updateHud() {
  const s = S.untimed + '|' + S.clicks + '|' + fmtTime(S.time) + '|' + S.kills + '|' + S.words;
  if (s === hudCache) return; hudCache = s;
  $('#nClicks').textContent = S.clicks; $('#sTime').style.display = S.untimed ? 'none' : ''; $('#nTime').textContent = fmtTime(S.time); $('#nKills').textContent = S.kills; $('#nWords').textContent = S.words;
}

export function initUI() {
  if (document.fonts) { document.fonts.load('8px "Press Start 2P"'); document.fonts.load('18px VT323'); }
  $('#bPlay').onclick = e => { e.target.blur(); startGame(); };
  $('#bRand').onclick = e => { e.target.blur(); randomPair(); };
  $('#lang').onchange = randomPair;
  $('#mode').onchange = renderElo; renderElo();
  ['#inFrom', '#inTo'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); }));
  randomPair();
}
