// Arena: menu, partida contra la computadora, entrada, sonidos y bucle.
import { S, ctx, state } from '../state.js';
import { beep, boom, toggleMuted, jetSound } from '../audio.js';
import { aimIndex } from '../shared/dmath.js';
import { createMatch, stepTick, mkInput, L, R, J, D, FIRE, DIG, BUILD, TICK_HZ, WEAPONS } from './sim.js';
import { makeBot, botInput } from './bot.js';
import { TerrainView, makeFx, fxBurst, updateFx, updateCamera, drawArena, zoomFor } from './render.js';

const TICK = 1 / TICK_HZ, $ = s => document.querySelector(s);
const A = {
  on: false, ready: false, screen: 'menu', w: null, me: 0, bot: null, level: 2, seed: 1, acc: 0, t: 0, keys: {}, latch: { sel: 0, buy: 0, bits: 0 },
  mouse: { x: 0, y: 0, down: false, right: false }, tv: new TerrainView(), fx: makeFx(), cam: { x: 0, y: 0, init: false }, onExit: null,
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

let sel = null;
function buildMenu() {
  sel = document.createElement('div'); sel.id = 'arenaSel';
  sel.innerHTML = '<div class="card arenacard"><div class="logo">ARE<span>NA</span></div>' +
    '<p class="tag">Duelo contra la computadora en un mapa que se rompe. Cavá para juntar oro, comprá en un mercado que comparten los dos (cada compra sube el precio para ambos), construí refugios y sobreviví a la lava que sube. El primero en ganar 3 rondas gana la partida.</p>' +
    '<div class="sec"><label>Contra la computadora</label><div class="row lv"><button class="ghost" data-lv="1">Fácil</button><button class="primary" data-lv="2">Normal</button><button class="ghost" data-lv="3">Difícil</button></div></div>' +
    '<div id="arStatus"></div><div class="row"><button class="ghost" id="arBack">Volver al menú</button></div></div>';
  document.body.appendChild(sel);
  sel.querySelectorAll('[data-lv]').forEach(b => { b.onclick = () => { b.blur(); startBot(+b.dataset.lv); }; });
  $('#arBack').onclick = e => { e.target.blur(); leave(); };
}
const status = t => { $('#arStatus').textContent = t || ''; };
function showMenu() {
  A.screen = 'menu'; hideModal(); sel.style.display = 'flex'; status('');
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
  A.on = false; A.w = null; hideModal(); sel.style.display = 'none'; document.body.classList.remove('arena'); jetSound(false);
  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0); ctx.clearRect(0, 0, state.W, state.H);
  if (A.onExit) A.onExit();
}
function begin(seed) {
  A.seed = seed; A.w = createMatch(seed); A.tv = new TerrainView(); A.fx = makeFx(); A.cam = { x: 0, y: 0, init: false };
  A.acc = 0; A.screen = 'play'; A.ended = false; A.paused = false; A.ui.hint = true; A.ui.flash = 0;
  A.latch = { sel: 0, buy: 0, bits: 0 };
  sel.style.display = 'none'; hideModal();
  setTimeout(() => { A.ui.hint = false; }, 12000);
}
function startBot(level) {
  A.me = 0; A.level = level; const seed = (Math.random() * 0x7fffffff) >>> 0 || 1;
  A.bot = makeBot(1, level, seed); begin(seed);
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
  document.addEventListener('visibilitychange', () => { if (document.hidden && A.on && A.screen === 'play') pause(); });
  addEventListener('mousemove', e => { A.mouse.x = e.clientX; A.mouse.y = e.clientY; });
  addEventListener('mousedown', e => { if (!A.on || e.target.closest('button,input,select,textarea')) return; A.mouse.x = e.clientX; A.mouse.y = e.clientY; if (e.button === 0) { A.mouse.down = true; A.latch.bits |= FIRE; } if (e.button === 2) { A.mouse.right = true; A.latch.bits |= DIG; } });
  addEventListener('mouseup', e => { if (e.button === 0) A.mouse.down = false; if (e.button === 2) A.mouse.right = false; });
  addEventListener('wheel', e => { if (A.on && A.screen === 'play') { const cur = A.w.players[A.me].sel; A.latch.sel = ((cur + (e.deltaY > 0 ? 1 : 3)) % 4) + 1; } }, { passive: true });
}
function pause() {
  if (A.screen !== 'play') return;
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
  const btns = [['Revancha', () => startBot(A.level), false], ['Menú', showMenu, true]];
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
    let n = 0;
    while (A.acc >= TICK && n < 6) {
      if (A.screen !== 'play') { A.acc = 0; break; }
      stepTick(w, [sample(), botInput(w, A.bot)]);
      A.acc -= TICK; n++;
      handleEvents(w);
    }
    jetSound(w.players[A.me].flying && w.players[A.me].alive);
  }
  updateFx(A.fx, dt); A.ui.flash = Math.max(0, A.ui.flash - dt * 1.5);
  const kk = zoomFor(state.W, state.H) / 2;
  updateCamera(A.cam, w, A.me, state.W, state.H, { x: A.mouse.x / kk + A.cam.x, y: A.mouse.y / kk + A.cam.y }, dt);
  drawArena(ctx, w, A.tv, A.fx, A.cam, state.W, state.H, state.DPR, A.t, A.me, A.ui);
}
export const arenaActive = () => A.on;
