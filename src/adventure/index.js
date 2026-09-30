// Modo Aventura: niveles de plataformas con jetpack, cajas, botones, llaves y
// enemigos. Este archivo es el "pegamento" con el resto del juego: menu de
// niveles, entrada de teclado y mouse, pausa, victoria, progreso guardado y
// sonidos. La logica del mundo esta en sim.js y el dibujo en render.js.
import { S, cv, ctx, state } from '../state.js';
import { beep, boom, jetSound, toggleMuted } from '../audio.js';
import { LEVELS } from './levels.js';
import { createWorld, stepWorld, coinsTaken } from './sim.js';
import { DT, SHOULDER } from './consts.js';
import { drawWorld, makeCamera, updateCamera, zoomFor } from './render.js';

const STORE = 'wikiwar.adventure.v1';
const A = {
  on: false, screen: 'select', w: null, idx: 0, cam: makeCamera(), acc: 0, t: 0, ui: { help: 0, banner: 0, flash: 0 },
  keys: {}, mouse: { x: 0, y: 0, down: false }, edge: { jump: false, down: false, interact: false }, onExit: null, ready: false
};

/* ----------------------------------------------------------------- progreso */
function load() { try { return JSON.parse(localStorage.getItem(STORE)) || { best: {} }; } catch (e) { return { best: {} }; } }
function save(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const fmt = s => { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------------------------------------------------------------------- DOM */
const $ = s => document.querySelector(s);
function modal(kind, eyebrow, title, body, buttons) {
  $('#mK').textContent = eyebrow; $('#mT').textContent = title; $('#mB').innerHTML = body;
  $('#msg').className = kind;
  const b = $('#mBtns'); b.innerHTML = '';
  buttons.forEach(([label, fn, alt]) => {
    const el = document.createElement('button'); el.textContent = label; el.className = alt ? 'ghost' : 'primary';
    el.onclick = () => { el.blur(); hideModal(); fn(); }; b.appendChild(el);
  });
  $('#msg').style.display = 'flex';
}
function hideModal() { $('#msg').style.display = 'none'; }

let selEl = null;
function buildSelect() {
  selEl = document.createElement('div'); selEl.id = 'advSel';
  selEl.innerHTML = '<div class="card advcard"><div class="logo">AVEN<span>TURA</span></div>' +
    '<p class="tag">Siete niveles de plataformas. Volá con el jetpack, empujá cajas, apretá botones, juntá llaves y vencé al jefe.</p>' +
    '<div id="advGrid"></div><div class="row"><button class="ghost" id="advBack">Volver al menú</button></div></div>';
  document.body.appendChild(selEl);
  $('#advBack').onclick = e => { e.target.blur(); leave(); };
}
function renderSelect() {
  const d = load(), grid = $('#advGrid'); grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const b = d.best[lv.id], el = document.createElement('button'); el.className = 'lvl';
    el.innerHTML = '<b>' + lv.id + '</b><span class="nm">' + lv.name + '</span><small>' + lv.desc + '</small><em>' + (b ? stars(b.stars) + ' · ' + b.coins + ' monedas · ' + fmt(b.time) : 'sin jugar') + '</em>';
    el.onclick = () => { el.blur(); startLevel(i); };
    grid.appendChild(el);
  });
}
function showSelect() {
  A.screen = 'select'; hideModal(); jetSound(false);
  renderSelect(); selEl.style.display = 'flex';
}

/* ------------------------------------------------------------------- flujo */
export function initAdventure(onExit) { A.onExit = onExit; }

export function openAdventure() {
  if (!A.ready) { A.ready = true; buildSelect(); bindInput(); }
  A.on = true; S.mode = 'adv';
  $('#menu').style.display = 'none';
  document.body.classList.add('adv');
  showSelect();
}
function leave() {
  A.on = false; A.w = null; jetSound(false); hideModal();
  selEl.style.display = 'none'; document.body.classList.remove('adv');
  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0); ctx.clearRect(0, 0, state.W, state.H);
  if (A.onExit) A.onExit();
}
function startLevel(i) {
  A.idx = i; A.w = createWorld(LEVELS[i]); A.cam = makeCamera(); A.acc = 0; A.screen = 'play';
  A.ui.help = 9; A.ui.banner = 2.6; A.ui.flash = 1;
  selEl.style.display = 'none'; hideModal();
  A.edge.jump = A.edge.down = A.edge.interact = false;
  if (import.meta.env && import.meta.env.DEV) window.__adv = A;
}
function pause() {
  if (A.screen !== 'play') return;
  A.screen = 'paused'; jetSound(false);
  modal('pause', 'PAUSA', LEVELS[A.idx].name, '<p class="lead">Nivel ' + LEVELS[A.idx].id + ' de ' + LEVELS.length + '</p>', [
    ['Reanudar', () => { A.screen = 'play'; }, false],
    ['Reiniciar nivel', () => startLevel(A.idx), true],
    ['Niveles', showSelect, true],
    ['Menú', leave, true]]);
}
function win() {
  const w = A.w, lv = LEVELS[A.idx], coins = coinsTaken(w);
  const st = 1 + (coins === w.coinsTotal ? 1 : 0) + (w.deaths === 0 ? 1 : 0);
  const d = load(), prev = d.best[lv.id];
  if (!prev || st > prev.stars || (st === prev.stars && w.time < prev.time)) d.best[lv.id] = { stars: st, coins, time: w.time };
  save(d);
  A.screen = 'won'; jetSound(false);
  const last = A.idx === LEVELS.length - 1;
  const tile = (v, l) => '<div class="tile"><b>' + v + '</b><small>' + l + '</small></div>';
  const body = '<p class="lead"><b>' + stars(st) + '</b><br>' + (last ? 'Vencés al Ojo y terminaste la aventura.' : 'Nivel completado.') + '</p>' +
    '<div class="tiles t3">' + tile(coins + '/' + w.coinsTotal, 'Monedas') + tile(fmt(w.time), 'Tiempo') + tile(w.deaths, 'Muertes') + '</div>' +
    '<p class="lead" style="margin-top:14px"><small>★ terminar · ★ todas las monedas · ★ sin morir</small></p>';
  const btns = [];
  if (!last) btns.push(['Siguiente nivel', () => startLevel(A.idx + 1), false]);
  btns.push(['Repetir', () => startLevel(A.idx), last], ['Niveles', showSelect, true]);
  setTimeout(() => { if (A.screen === 'won') modal('win', last ? 'AVENTURA COMPLETA' : 'NIVEL COMPLETO', last ? '¡Ganaste!' : lv.name, body, btns); }, 700);
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .16, 'square', .04, 0), i * 110));
}

/* ------------------------------------------------------------------- input */
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyC', 'KeyR', 'ShiftLeft', 'ShiftRight']);
function bindInput() {
  addEventListener('keydown', e => {
    if (!A.on) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (GAME_KEYS.has(e.code) && A.screen === 'play') e.preventDefault();
    if (e.code === 'Escape') { if (A.screen === 'paused') { hideModal(); A.screen = 'play'; } else if (A.screen === 'play') pause(); else if (A.screen === 'select') leave(); return; }
    if (e.code === 'KeyM') { toggleMuted(); return; }
    if (e.code === 'KeyH') { A.ui.help = A.ui.help > 0 ? 0 : 9; return; }
    if (A.screen !== 'play') return;
    if (!e.repeat) {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') A.edge.jump = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') A.edge.down = true;
      if (e.code === 'KeyE' || e.code === 'Enter') A.edge.interact = true;
      if (e.code === 'KeyR') { startLevel(A.idx); return; }
    }
    A.keys[e.code] = true;
  });
  addEventListener('keyup', e => { A.keys[e.code] = false; });
  addEventListener('blur', () => { A.keys = {}; A.mouse.down = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && A.on) pause(); });
  addEventListener('mousemove', e => { A.mouse.x = e.clientX; A.mouse.y = e.clientY; });
  addEventListener('mousedown', e => {
    if (!A.on || e.target.closest('button,input,select')) return;
    A.mouse.x = e.clientX; A.mouse.y = e.clientY;
    if (e.button === 0) A.mouse.down = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) A.mouse.down = false; });
}

function readInput(w) {
  const k = A.keys, kk = zoomFor(state.H) / 2, p = w.p;
  const wx = A.mouse.x / kk + A.cam.x, wy = A.mouse.y / kk + A.cam.y;
  p.aim = Math.atan2(wy - (p.y + (p.crouch ? -28 : SHOULDER)), wx - p.x);
  p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
  return {
    left: k.KeyA || k.ArrowLeft ? 1 : 0, right: k.KeyD || k.ArrowRight ? 1 : 0,
    jump: !!(k.Space || k.KeyW || k.ArrowUp), down: !!(k.KeyS || k.ArrowDown || k.KeyC || k.ShiftLeft || k.ShiftRight),
    shoot: A.mouse.down, jumpPressed: A.edge.jump, downPressed: A.edge.down, interactPressed: A.edge.interact
  };
}

/* ------------------------------------------------------------------ sonidos */
function sfx(w, ev) {
  switch (ev.name) {
    case 'jump': beep(300, .1, 'square', .03, 250); break;
    case 'land': beep(90, .14, 'triangle', Math.min(.1, .04 + ev.v / 20000), -50); break;
    case 'coin': beep(880, .07, 'square', .03, 500); setTimeout(() => beep(1320, .09, 'square', .03, 0), 60); break;
    case 'heart': beep(520, .12, 'triangle', .05, 300); break;
    case 'fuel': beep(300, .18, 'sawtooth', .04, 500); break;
    case 'key': [660, 880, 1100].forEach((f, i) => setTimeout(() => beep(f, .1, 'square', .035, 0), i * 70)); break;
    case 'unlock': beep(200, .25, 'square', .05, 400); break;
    case 'shoot': beep(520, .06, 'square', .04, -200); break;
    case 'eshoot': beep(240, .08, 'square', .025, -100); break;
    case 'hurt': beep(110, .22, 'sawtooth', .07, -60); A.cam.shake = 8; break;
    case 'die': boom(.25); A.cam.shake = 14; break;
    case 'stomp': beep(200, .1, 'square', .05, -100); break;
    case 'enemyhit': beep(340, .04, 'square', .03, -60); break;
    case 'enemydie': beep(140, .18, 'sawtooth', .05, -80); break;
    case 'bossdie': boom(.4); A.cam.shake = 20; break;
    case 'spring': beep(300, .22, 'triangle', .06, 700); break;
    case 'plate': beep(ev.down ? 180 : 140, .06, 'square', .04, 0); break;
    case 'lever': beep(260, .05, 'square', .05, -80); break;
    case 'door': beep(120, .25, 'sawtooth', .03, ev.open ? 90 : -60); break;
    case 'crack': beep(280, .05, 'square', .03, -100); break;
    case 'boom': boom(.2); A.cam.shake = 6; break;
    case 'checkpoint': [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, .1, 'square', .035, 0), i * 80)); break;
    case 'respawn': A.ui.flash = .8; break;
    case 'win': win(); break;
  }
}

/* ------------------------------------------------------------------ bucle */
export function advFrame(dt) {
  if (!A.on) return;
  A.t += dt;
  const w = A.w;
  if (!w || A.screen === 'select') return;
  if (A.screen === 'play') {
    A.acc += Math.min(dt, .1);
    let n = 0;
    const inp = readInput(w);
    while (A.acc >= DT && n++ < 12) {
      stepWorld(w, inp, DT); A.acc -= DT;
      inp.jumpPressed = inp.downPressed = inp.interactPressed = false;
      for (const ev of w.ev) sfx(w, ev);
      w.ev.length = 0;
      if (A.screen !== 'play') break;
    }
    A.edge.jump = A.edge.down = A.edge.interact = false;
    jetSound(w.p.flying && !w.p.dead);
    A.ui.help = Math.max(0, A.ui.help - dt); A.ui.banner = Math.max(0, A.ui.banner - dt); A.ui.flash = Math.max(0, A.ui.flash - dt * 1.6);
  }
  updateCamera(A.cam, w, state.W, state.H, dt);
  drawWorld(ctx, w, A.cam, state.W, state.H, state.DPR, A.t, A.ui);
}

export const adventureActive = () => A.on;
