// Arena: menu, partida contra la computadora o en linea, entrada, sonidos y bucle.
import { S, ctx, state } from '../state.js';
import { beep, boom, toggleMuted, jetSound } from '../audio.js';
import { aimIndex } from '../shared/dmath.js';
import { createMatch, stepTick, stateHash, mkInput, L, R, J, D, FIRE, DIG, BUILD, TICK_HZ, WEAPONS } from './sim.js';
import { makeBot, botInput } from './bot.js';
import { Lockstep, hostOffer, guestAnswer, localRoom } from './net.js';
import { TerrainView, makeFx, fxBurst, updateFx, updateCamera, drawArena, zoomFor } from './render.js';

const TICK = 1 / TICK_HZ, $ = s => document.querySelector(s);
const A = {
  on: false, ready: false, screen: 'menu', w: null, me: 0, mode: 'bot', bot: null, level: 2, ls: null, transport: null, seed: 1, acc: 0, t: 0, keys: {}, latch: { sel: 0, buy: 0, bits: 0 },
  mouse: { x: 0, y: 0, down: false, right: false }, tv: new TerrainView(), fx: makeFx(), cam: { x: 0, y: 0, init: false }, onExit: null, rematch: { me: false, other: false },
  ui: { stall: false, info: '', hint: true, flash: 0 }, ended: false, paused: false
};

/* ---------------------------------------------------------------------- DOM */
function modal(kind, eyebrow, title, body, buttons) {
  $('#mK').textContent = eyebrow; $('#mT').textContent = title; $('#mB').innerHTML = body;
  $('#msg').className = kind;
  const b = $('#mBtns'); b.innerHTML = '';
  buttons.forEach(([label, fn, alt]) => { const el = document.createElement('button'); el.textContent = label; el.className = alt ? 'ghost' : 'primary'; el.onclick = () => { el.blur(); hideModal(); fn(); }; b.appendChild(el); });
  $('#msg').style.display = 'flex';
}
const hideModal = () => { $('#msg').style.display = 'none'; };
async function copy(text) { try { await navigator.clipboard.writeText(text); return true; } catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* nada */ } ta.remove(); return ok; } }

let sel = null;
function buildMenu() {
  sel = document.createElement('div'); sel.id = 'arenaSel';
  sel.innerHTML = '<div class="card arenacard"><div class="logo">ARE<span>NA</span></div>' +
    '<p class="tag">Duelo 1 contra 1 en un mapa que se rompe. Cavá para juntar oro, comprá en un mercado que comparten los dos (cada compra sube el precio para ambos), construí refugios y sobreviví a la lava que sube. El primero en ganar 3 rondas gana la partida.</p>' +
    '<div class="sec"><label>Contra la computadora</label><div class="row lv"><button class="ghost" data-lv="1">Fácil</button><button class="primary" data-lv="2">Normal</button><button class="ghost" data-lv="3">Difícil</button></div></div>' +
    '<div class="sec"><label>En línea (2 jugadores)</label><div class="row"><button class="ghost" id="arHost">Crear partida</button><button class="ghost" id="arJoin">Unirme</button></div>' +
    '<div id="arNet" style="display:none"><p id="arNetMsg"></p><textarea id="arOut" readonly rows="3"></textarea><div class="row"><button class="ghost" id="arCopy">Copiar código</button></div><textarea id="arIn" rows="3" placeholder="Pegá acá el código del otro jugador"></textarea><div class="row"><button class="primary" id="arGo">Conectar</button></div></div></div>' +
    '<details class="controls"><summary>Dos pestañas en esta PC</summary><div class="imp"><input id="arRoom" placeholder="nombre de la sala" value="sala1"><button class="primary" id="arLocal">Entrar</button></div></details>' +
    '<div id="arStatus"></div><div class="row"><button class="ghost" id="arBack">Volver al menú</button></div></div>';
  document.body.appendChild(sel);
  sel.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { b.blur(); startBot(+b.dataset.lv); }; });
  $('#arBack').onclick = e => { e.target.blur(); leave(); };
  $('#arHost').onclick = e => { e.target.blur(); netHost(); };
  $('#arJoin').onclick = e => { e.target.blur(); netJoin(); };
  $('#arLocal').onclick = e => { e.target.blur(); netLocal($('#arRoom').value.trim() || 'sala1'); };
  $('#arCopy').onclick = async e => { const ok = await copy($('#arOut').value); e.target.textContent = ok ? '¡Copiado!' : 'Copiá a mano'; };
  $('#arRoom').addEventListener('keydown', e => e.stopPropagation());
  ['#arIn', '#arOut'].forEach(s => $(s).addEventListener('keydown', e => e.stopPropagation()));
}
const status = t => { $('#arStatus').textContent = t || ''; };
function showMenu() {
  A.screen = 'menu'; hideModal(); sel.style.display = 'flex'; $('#arNet').style.display = 'none'; status('');
  if (A.ls) { A.ls.close(); A.ls = null; }
  A.w = null; jetSound(false);
  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0); ctx.clearRect(0, 0, state.W, state.H);
}

/* ------------------------------------------------------------------- flujo */
export function initArena(onExit) { A.onExit = onExit; }
export function openArena() {
  if (!A.ready) { A.ready = true; buildMenu(); bindInput(); }
  A.on = true; S.mode = 'arena';
  if (import.meta.env && import.meta.env.DEV) window.__arena = A;
  $('#menu').style.display = 'none'; document.body.classList.add('arena');
  showMenu();
}
function leave() {
  if (A.ls) { A.ls.close(); A.ls = null; }
  A.on = false; A.w = null; hideModal(); sel.style.display = 'none'; document.body.classList.remove('arena'); jetSound(false);
  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0); ctx.clearRect(0, 0, state.W, state.H);
  if (A.onExit) A.onExit();
}
function begin(seed) {
  A.seed = seed; A.w = createMatch(seed); A.tv = new TerrainView(); A.fx = makeFx(); A.cam = { x: 0, y: 0, init: false };
  A.acc = 0; A.screen = 'play'; A.ended = false; A.paused = false; A.ui.stall = false; A.ui.hint = true; A.ui.flash = 0; A.rematch = { me: false, other: false };
  A.latch = { sel: 0, buy: 0, bits: 0 };
  sel.style.display = 'none'; hideModal();
  setTimeout(() => { A.ui.hint = false; }, 12000);
}
function startBot(level) {
  A.mode = 'bot'; A.me = 0; A.level = level; const seed = (Math.random() * 0x7fffffff) >>> 0 || 1;
  A.bot = makeBot(1, level, seed); begin(seed);
}

/* --------------------------------------------------------------- en linea */
async function netHost() {
  const box = $('#arNet'); box.style.display = ''; $('#arNetMsg').textContent = 'Generando el código...'; $('#arOut').value = ''; $('#arIn').value = '';
  $('#arGo').textContent = 'Conectar';
  try {
    const h = await hostOffer();
    $('#arNetMsg').textContent = '1) Mandale este código al otro jugador. 2) Pegá su respuesta abajo y tocá Conectar.'; $('#arOut').value = h.code;
    $('#arGo').onclick = async e => {
      e.target.blur();
      try { await h.accept($('#arIn').value); status('Conectando...'); const t = await h.transport; startOnline(t, true); } catch (err) { status(err.message || 'No se pudo conectar'); }
    };
  } catch (err) { $('#arNetMsg').textContent = 'No pude crear la partida: ' + (err.message || err); }
}
async function netJoin() {
  const box = $('#arNet'); box.style.display = ''; $('#arNetMsg').textContent = 'Pegá abajo el código que te mandó el anfitrión y tocá Generar respuesta.'; $('#arOut').value = ''; $('#arIn').value = '';
  $('#arGo').textContent = 'Generar respuesta';
  $('#arGo').onclick = async e => {
    e.target.blur();
    try {
      status('Generando la respuesta...'); const g = await guestAnswer($('#arIn').value); $('#arOut').value = g.code;
      $('#arNetMsg').textContent = 'Mandale este código de vuelta al anfitrión. La partida empieza sola cuando lo pegue.'; status('Esperando al anfitrión...');
      const t = await g.transport; startOnline(t, false);
    } catch (err) { status(err.message || 'No se pudo conectar'); }
  };
}
async function netLocal(room) {
  status('Esperando al otro jugador en la sala «' + room + '»... abrí otra pestaña y entrá a la misma sala.');
  const { transport, host } = await localRoom(room); startOnline(transport, host);
}
function startOnline(t, host) {
  A.mode = 'online'; A.me = host ? 0 : 1; A.transport = t;
  const launch = seed => { A.ls = new Lockstep(t, A.me, 6); wireLs(); begin(seed); };
  if (host) { const seed = (crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff) || 1; t.send(JSON.stringify({ k: 'start', seed })); launch(seed); }
  else { t.onmessage = s => { let m; try { m = JSON.parse(s); } catch (e) { return; } if (m.k === 'start') launch(m.seed); }; status('Conectado. Esperando que el anfitrión empiece...'); }
  t.onclose = () => { if (A.on && A.mode === 'online' && !A.ended) { A.ended = true; A.screen = 'end'; modal('over', 'DESCONECTADO', 'El rival se fue', '<p class="lead">Se cortó la conexión.</p>', [['Menú', showMenu, false]]); } };
}
// mensajes que no son entradas: pedido de revancha y arranque de una partida nueva
function wireLs() {
  A.ls.onother = m => {
    if (m.k === 'rm') { A.rematch.other = true; tryRematch(); }
    else if (m.k === 'start') { A.ls = new Lockstep(A.transport, A.me, 6); wireLs(); begin(m.seed); }
  };
}
function tryRematch() {
  if (!(A.rematch.me && A.rematch.other) || A.me !== 0) return;
  const seed = (crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff) || 1;
  A.transport.send(JSON.stringify({ k: 'start', seed })); A.ls = new Lockstep(A.transport, A.me, 6); wireLs(); begin(seed);
}

/* ------------------------------------------------------------------- input */
const GAME = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyZ', 'KeyX', 'KeyC', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'ShiftLeft', 'ShiftRight']);
function bindInput() {
  addEventListener('keydown', e => {
    if (!A.on) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (GAME.has(e.code) && A.screen === 'play') e.preventDefault();
    if (e.code === 'Escape') { if (A.screen === 'play') pause(); else if (A.screen === 'paused') resume(); else if (A.screen === 'menu') leave(); return; }
    if (e.code === 'KeyM') { toggleMuted(); return; }
    if (e.code === 'KeyH') { A.ui.hint = !A.ui.hint; return; }
    if (A.screen !== 'play') return;
    if (!e.repeat) {
      if (e.code === 'Digit1') A.latch.sel = 1; if (e.code === 'Digit2') A.latch.sel = 2; if (e.code === 'Digit3') A.latch.sel = 3; if (e.code === 'Digit4') A.latch.sel = 4;
      if (e.code === 'KeyZ') A.latch.buy = 1; if (e.code === 'KeyX') A.latch.buy = 2; if (e.code === 'KeyC') A.latch.buy = 3;
      if (e.code === 'KeyQ') A.latch.bits |= BUILD;
    }
    A.keys[e.code] = true;
  });
  addEventListener('keyup', e => { A.keys[e.code] = false; });
  addEventListener('blur', () => { A.keys = {}; A.mouse.down = A.mouse.right = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && A.on && A.mode === 'bot' && A.screen === 'play') pause(); });
  addEventListener('mousemove', e => { A.mouse.x = e.clientX; A.mouse.y = e.clientY; });
  addEventListener('mousedown', e => { if (!A.on || e.target.closest('button,input,select,textarea')) return; A.mouse.x = e.clientX; A.mouse.y = e.clientY; if (e.button === 0) { A.mouse.down = true; A.latch.bits |= FIRE; } if (e.button === 2) { A.mouse.right = true; A.latch.bits |= DIG; } });
  addEventListener('mouseup', e => { if (e.button === 0) A.mouse.down = false; if (e.button === 2) A.mouse.right = false; });
  addEventListener('wheel', e => { if (A.on && A.screen === 'play') { const cur = A.w.players[A.me].sel; A.latch.sel = ((cur + (e.deltaY > 0 ? 1 : 3)) % 4) + 1; } }, { passive: true });
}
function pause() {
  if (A.screen !== 'play') return;
  if (A.mode === 'online') { modal('pause', 'EN LÍNEA', 'Salir de la partida', '<p class="lead">La partida sigue corriendo para tu rival mientras decidís.</p>', [['Seguir jugando', () => {}, false], ['Salir', showMenu, true]]); return; }
  A.screen = 'paused'; jetSound(false);
  modal('pause', 'PAUSA', 'Arena', '<p class="lead">Ronda ' + A.w.round + ' · ' + A.w.scores[0] + ' - ' + A.w.scores[1] + '</p>', [['Reanudar', resume, false], ['Nueva partida', () => startBot(A.level), true], ['Menú', showMenu, true]]);
}
function resume() { if (A.screen === 'paused') { hideModal(); A.screen = 'play'; } }

function sample() {
  const k = A.keys, w = A.w, p = w.players[A.me], zs = zoomFor(state.W, state.H), kk = zs / 2;
  let bits = A.latch.bits; A.latch.bits = 0;
  if (k.KeyA || k.ArrowLeft) bits |= L; if (k.KeyD || k.ArrowRight) bits |= R;
  if (k.Space || k.KeyW || k.ArrowUp) bits |= J; if (k.KeyS || k.ArrowDown || k.ShiftLeft || k.ShiftRight) bits |= D;
  if (A.mouse.down) bits |= FIRE; if (A.mouse.right) bits |= DIG;
  if (k.KeyQ) bits |= BUILD;
  const wx = A.mouse.x / kk + A.cam.x, wy = A.mouse.y / kk + A.cam.y;
  const m = mkInput(bits, aimIndex(wx - p.x, wy - (p.y - 22)), A.latch.sel, A.latch.buy); A.latch.sel = 0; A.latch.buy = 0;
  return m;
}

/* ------------------------------------------------------------- efectos y sonido */
function handleEvents(w) {
  const me = A.me, fx = A.fx;
  for (const e of w.ev) {
    switch (e.name) {
      case 'shoot': beep(e.w === 2 ? 130 : e.w === 3 ? 700 : e.w === 1 ? 160 : 520, e.w === 3 ? .18 : .07, e.w === 3 ? 'sawtooth' : 'square', .035, e.w === 3 ? -500 : -200); if (e.id !== me) { /* disparo del rival */ } break;
      case 'boom': boom(.25); fx.boom.push({ x: e.x, y: e.y, r: e.r, t: 0 }); fxBurst(fx, e.x, e.y, 26, '#ff7a3d', 320, 80); fxBurst(fx, e.x, e.y, 14, '#8a5a2b', 240, 120); fx.shake = Math.max(fx.shake, 10); break;
      case 'dig': fxBurst(fx, e.x, e.y, 6, '#8a5a2b', 150, 60); beep(200, .05, 'square', .02, -80); break;
      case 'impact': fxBurst(fx, e.x, e.y, 4, '#ffd166', 120, 20); break;
      case 'hurt': { const p = w.players[e.id]; fx.texts.push({ x: p.x, y: p.y - p.h - 22, s: '-' + e.amt, c: '#ff8a93', life: .9 }); fxBurst(fx, p.x, p.y - 20, 8, '#c0392b', 200, 60); beep(110, .18, 'sawtooth', .06, -60); if (e.id === me) { A.ui.flash = .4; fx.shake = Math.max(fx.shake, 7); } break; }
      case 'kill': fxBurst(fx, e.x, e.y, 40, '#ff7a3d', 360, 100); boom(.3); fx.shake = 16; break;
      case 'gold': { const p = w.players[e.id]; fx.texts.push({ x: p.x, y: p.y - p.h - 22, s: '+' + e.n + ' oro', c: '#ffd166', life: 1 }); if (e.id === me) beep(880, .06, 'square', .03, 400); break; }
      case 'buy': beep(660, .08, 'square', .04, 200); { const p = w.players[e.id]; fx.texts.push({ x: p.x, y: p.y - p.h - 22, s: '-' + e.price + ' oro', c: '#a09fa8', life: .9 }); } break;
      case 'poor': if (e.id === me) beep(140, .12, 'square', .04, 0); break;
      case 'build': beep(300, .06, 'triangle', .04, 100); break;
      case 'pickup': beep(520, .1, 'triangle', .05, 300); break;
      case 'drop': beep(400, .12, 'triangle', .03, 200); break;
      case 'empty': if (e.id === me) beep(120, .04, 'square', .03, 0); break;
      case 'jump': if (e.id === me) beep(300, .08, 'square', .02, 250); break;
      case 'go': beep(880, .2, 'square', .05, 0); break;
      case 'round': A.tv.round = -1; break;
      case 'roundover': beep(e.winner === me ? 784 : 196, .3, 'square', .05, 0); break;
      case 'matchover': endMatch(e.winner); break;
    }
  }
  w.ev.length = 0;
}
function endMatch(winner) {
  if (A.ended) return; A.ended = true; A.screen = 'end'; jetSound(false);
  const w = A.w, won = winner === A.me;
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(won ? f : f / 2, .14, 'square', .04, 0), i * 100));
  const btns = [['Revancha', () => { if (A.mode === 'bot') startBot(A.level); else { A.rematch.me = true; A.transport.send(JSON.stringify({ k: 'rm' })); A.ui.info = 'Esperando la revancha...'; A.screen = 'end'; tryRematch(); } }, false], ['Menú', showMenu, true]];
  setTimeout(() => modal(won ? 'win' : 'over', won ? 'VICTORIA' : 'DERROTA', won ? '¡Ganaste la partida!' : 'Perdiste la partida', '<p class="lead">Resultado: <b>' + w.scores[A.me] + ' - ' + w.scores[1 - A.me] + '</b></p>', btns), 700);
}

/* ------------------------------------------------------------------ bucle */
export function arenaFrame(dt) {
  if (!A.on) return;
  A.t += dt;
  const w = A.w;
  if (!w || A.screen === 'menu') return;
  if (A.screen === 'play' || A.screen === 'end') {
    A.acc += Math.min(dt, .1);
    let n = 0; A.ui.stall = false;
    while (A.acc >= TICK && n < 6) {
      if (A.mode === 'bot') { if (A.screen !== 'play') { A.acc = 0; break; } stepTick(w, [sample(), botInput(w, A.bot)]); }
      else {
        const ls = A.ls; if (!ls) { A.acc = 0; break; }
        ls.feed(sample);
        if (!ls.ready()) { A.ui.stall = A.screen === 'play'; A.acc = Math.min(A.acc, TICK); break; }
        const masks = ls.take(); stepTick(w, masks);
        if (import.meta.env && import.meta.env.DEV && w.tick % 60 === 0) (A.hist = A.hist || new Map()).set(w.tick, stateHash(w));   // solo pruebas
        if (ls.checkHash(w.tick, stateHash(w)) && !A.ended) { A.ended = true; A.screen = 'end'; modal('over', 'ERROR', 'Desincronizado', '<p class="lead">Las dos partidas dejaron de coincidir. Puede pasar entre navegadores muy distintos. Volvé a crear la partida.</p>', [['Menú', showMenu, false]]); }
      }
      A.acc -= TICK; n++;
      handleEvents(w);
    }
    if (A.mode === 'online' && A.ls && A.ls.closed && !A.ended) { A.ended = true; A.screen = 'end'; modal('over', 'DESCONECTADO', 'El rival se fue', '<p class="lead">Se cortó la conexión.</p>', [['Menú', showMenu, false]]); }
    if (A.mode === 'online' && A.ls && (Math.floor(A.t) % 3 === 0) && !A.pinged) { A.pinged = true; A.ls.ping(); } else if (Math.floor(A.t) % 3 !== 0) A.pinged = false;
    A.ui.info = A.mode === 'online' && A.ls ? 'ping ' + Math.round(A.ls.rtt) + ' ms' : '';
    jetSound(w.players[A.me].flying && w.players[A.me].alive);
  }
  updateFx(A.fx, dt); A.ui.flash = Math.max(0, A.ui.flash - dt * 1.5);
  const kk = zoomFor(state.W, state.H) / 2;
  updateCamera(A.cam, w, A.me, state.W, state.H, { x: A.mouse.x / kk + A.cam.x, y: A.mouse.y / kk + A.cam.y }, dt);
  drawArena(ctx, w, A.tv, A.fx, A.cam, state.W, state.H, state.DPR, A.t, A.me, A.ui);
}
export const arenaActive = () => A.on;
