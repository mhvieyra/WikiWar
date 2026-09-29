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
import { resetRun, startGame } from './main.js';

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

export function toMenu() { S.mode = 'menu'; $('#menu').style.display = 'flex'; document.body.classList.remove('play'); $('#status').textContent = ''; }

export function stats() {
  const tile = (v, l) => '<div class="tile"><b>' + v + '</b><small>' + l + '</small></div>';
  return '<div class="tiles">' + tile(S.clicks, 'Saltos') + tile(fmtTime(S.time), 'Tiempo') + tile(S.kills, 'Bajas') + tile(S.words, 'Palabras') + '</div>' +
    '<div class="path"><span class="lbl">Ruta</span>' + S.path.map(p => '<span class="chip">' + esc(p) + '</span>').join('<i>→</i>') + '</div>';
}

export function win(title) {
  S.mode = 'win';
  showMsg('Llegaste a «' + title + '»', stats(), [['Jugar otra vez', () => resetRun(), false], ['Menú', toMenu, true]], 'win', 'VICTORIA');
}

export function gameOver() {
  S.mode = 'over';
  showMsg('Te quedaste sin vidas', '<p class="lead">No llegaste a <b>«' + esc(S.toCanon) + '»</b>.</p>' + stats(),
    [['Reintentar', () => resetRun(), false], ['Menú', toMenu, true]], 'over', 'GAME OVER');
}

export function pause() {
  if (S.mode !== 'play') return;
  S.mode = 'pause';
  showMsg('En pausa', '<p class="lead">Destino: <b>«' + esc(S.toCanon) + '»</b> · Vidas: <b>' + S.lives + '</b></p>' + stats(), [
    ['Reanudar', () => { S.mode = 'play'; }, false],
    ['Reiniciar', () => resetRun(), true],
    ['Menú', toMenu, true]], 'pause', 'PAUSA');
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

export function randomPair() {
  const lang = $('#lang').value, P = PAIRS[lang];
  const a = P.starts[Math.floor(Math.random() * P.starts.length)];
  let b; do { b = P.ends[Math.floor(Math.random() * P.ends.length)]; } while (norm(a) === norm(b));
  $('#inFrom').value = a; $('#inTo').value = b;
}

const HUD_FONT = '600 11px ui-monospace,Menlo,Consolas,monospace';
function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(18,19,22,.88)'; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + .5, y + .5, w, h, 12); ctx.fill(); ctx.stroke();
}
function bar(x, y, w, h, frac, col) {
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  if (frac <= 0) return;
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * frac), h, h / 2); ctx.fill();
}

export function drawHud() {
  const p = state.p, X = 10, Y = 10, W = 196;
  ctx.font = HUD_FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  panel(X, Y, W, 96);
  for (let i = 0; i < 3; i++) { if (i < S.lives) drawHeart(X + 12 + i * 30, Y + 8, 3); else { ctx.globalAlpha = .22; drawHeart(X + 12 + i * 30, Y + 8, 3); ctx.globalAlpha = 1; } }
  ctx.fillStyle = '#9da0a8'; ctx.fillText('VIDA', X + 12, Y + 46);
  bar(X + 56, Y + 41, W - 68, 9, clamp(p.hp / 100, 0, 1), p.hp > 35 ? '#4ade80' : '#ef4444');
  ctx.fillStyle = '#9da0a8'; ctx.fillText('FUEL', X + 12, Y + 63);
  bar(X + 56, Y + 58, W - 68, 9, clamp(p.fuel / 100, 0, 1), '#ff7a3d');
  // arma actual y reserva de balas (la pistola es infinita)
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(X + 12, Y + 73, W - 24, 1);
  ctx.fillStyle = '#ffd166'; ctx.fillText('[' + (S.wi + 1) + '] ' + WEAPONS[S.wi].name, X + 12, Y + 84);
  const ammo = S.ammo[S.wi], lim = WEAPONS[S.wi].ammo;
  ctx.textAlign = 'right';
  ctx.fillStyle = S.ammoFlash > 0 && Math.floor(S.ammoFlash * 10) % 2 ? '#fff' : !lim ? '#ffd166' : ammo <= 0 ? '#ef4444' : ammo <= lim.max * .2 ? '#ff7a3d' : '#ffd166';
  ctx.fillText(lim ? magsLeft(S.wi) + '/3 · ' + ammo : '∞', X + W - 12, Y + 84);
  ctx.textAlign = 'left';
  // pocion de fuerza (solo mientras esta activa)
  if (S.strengthT > 0) {
    const sy = Y + 104;
    panel(X, sy, W, 42);
    if (okSpr('itemStrength')) { const d = SPRITES.itemStrength; ctx.drawImage(d.img, 0, 0, d.fw, d.fh, X + 8, sy + 5, d.fw * SPR_SCALE, d.fh * SPR_SCALE); }
    ctx.fillStyle = '#c77dff'; ctx.fillText('FUERZA x' + STRENGTH_MULT, X + 46, sy + 14);
    ctx.textAlign = 'right'; ctx.fillText(Math.ceil(S.strengthT) + 's', X + W - 12, sy + 14); ctx.textAlign = 'left';
    bar(X + 46, sy + 26, W - 58, 8, clamp(S.strengthT / STRENGTH_TIME, 0, 1), S.strengthT < 3 && Math.floor(S.strengthT * 6) % 2 ? '#fff' : '#c77dff');
  }
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
