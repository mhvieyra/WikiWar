// Ecos: flujo de juego, menu de niveles, desafio diario, ranking local y
// codigos de repeticion. La logica del mundo esta en sim.js y el dibujo en render.js.
import { S, ctx, state } from '../state.js';
import { beep, toggleMuted } from '../audio.js';
import { aimIndex } from '../shared/dmath.js';
import { LEVELS } from './levels.js';
import { createWorld, stepTick, verify, timeUp, L, R, J, D, S as SHOOT, E as USE, mk, TICK_HZ } from './sim.js';
import { SHOULDER } from './consts.js';
import { drawWorld, layoutFor } from './render.js';
import { encodeShare, decodeShare } from './codec.js';

const STORE = 'wikiwar.eco.v1', MAX_ECHOES = 8, TICK = 1 / TICK_HZ;
const $ = s => document.querySelector(s);
const E = {
  on: false, ready: false, screen: 'select', def: null, daily: null, echoes: [], cycle: 1, w: null, acc: 0, t: 0,
  keys: {}, latch: 0, mouse: { x: 0, y: 0, down: false }, deadT: 0, winT: 0, replay: null, speed: 1, onExit: null,
  ui: { hint: true, flash: 0, deadT: 0, msg: '', msgT: 0, cycle: 1, echoes: 0, showSigns: true, replay: false, speed: 1, title: '' }
};

/* ----------------------------------------------------------------- progreso */
function load() { try { const d = JSON.parse(localStorage.getItem(STORE)); return d && d.best ? d : { best: {}, daily: {} }; } catch (e) { return { best: {}, daily: {} }; } }
function save(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
const better = (a, b) => !b || a.echoes < b.echoes || (a.echoes === b.echoes && a.time < b.time);
const fmt = s => Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60).toFixed(1);
const medalOf = (echoes, par) => echoes <= par ? 'ORO' : echoes === par + 1 ? 'PLATA' : 'BRONCE';

// desafio diario: el mismo nivel para todos ese dia (fecha en UTC)
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export function dailyLevel(key) { let h = 5381; for (const c of key) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return LEVELS[h % LEVELS.length]; }
function streak(d) {
  let n = 0; const day = new Date(dayKey() + 'T00:00:00Z');
  if (!d.daily[dayKey(day)]) day.setUTCDate(day.getUTCDate() - 1);
  while (d.daily[dayKey(day)]) { n++; day.setUTCDate(day.getUTCDate() - 1); }
  return n;
}

/* ---------------------------------------------------------------------- DOM */
function modal(kind, eyebrow, title, body, buttons) {
  $('#mK').textContent = eyebrow; $('#mT').textContent = title; $('#mB').innerHTML = body;
  $('#msg').className = kind;
  const b = $('#mBtns'); b.innerHTML = '';
  buttons.forEach(([label, fn, alt, keep]) => {
    const el = document.createElement('button'); el.textContent = label; el.className = alt ? 'ghost' : 'primary';
    el.onclick = () => { el.blur(); if (!keep) hideModal(); fn(el); }; b.appendChild(el);
  });
  $('#msg').style.display = 'flex';
}
function hideModal() { $('#msg').style.display = 'none'; }
function say(t) { E.ui.msg = t; E.ui.msgT = 2.2; }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* nada */ } ta.remove(); return ok; }
}

let selEl = null;
function buildSelect() {
  selEl = document.createElement('div'); selEl.id = 'ecoSel';
  selEl.innerHTML = '<div class="card ecocard"><div class="logo">EC<span>OS</span></div>' +
    '<p class="tag">Cada ciclo que jugás se graba, y en el siguiente esa versión tuya (un eco) se repite sola. Coordinate con tu pasado para llegar a la salida con la menor cantidad de ecos.</p>' +
    '<div id="ecoDaily"></div><div id="ecoGrid"></div>' +
    '<details class="controls" id="ecoImp"><summary>Código de repetición</summary><div class="imp"><input id="ecoCode" placeholder="ECO1-8-..." autocomplete="off" spellcheck="false"><button class="primary" id="ecoVer">Verificar</button></div><div id="ecoImpMsg"></div></details>' +
    '<div class="row"><button class="ghost" id="ecoBack">Volver al menú</button></div></div>';
  document.body.appendChild(selEl);
  $('#ecoBack').onclick = e => { e.target.blur(); leave(); };
  $('#ecoVer').onclick = e => { e.target.blur(); importCode($('#ecoCode').value); };
  $('#ecoCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') importCode($('#ecoCode').value); });
}
function renderSelect() {
  const d = load(), today = dayKey(), dl = dailyLevel(today), dd = d.daily[today];
  $('#ecoDaily').innerHTML = '<div class="dailyc"><div><small>DESAFÍO DE HOY · ' + today + '</small><b>' + dl.name + '</b><span>' + (dd ? 'Tu mejor: ' + dd.echoes + ' ecos · ' + fmt(dd.time) + ' (' + medalOf(dd.echoes, dl.par) + ')' : 'Todavía no lo jugaste. Mismo nivel para todos hoy.') + '</span><em>Racha: ' + streak(d) + (streak(d) === 1 ? ' día' : ' días') + '</em></div><button class="primary" id="ecoDailyGo">Jugar</button></div>';
  $('#ecoDailyGo').onclick = e => { e.target.blur(); startLevel(dl, true); };
  const grid = $('#ecoGrid'); grid.innerHTML = '';
  LEVELS.forEach(lv => {
    const b = d.best[lv.id], el = document.createElement('button'); el.className = 'lvl';
    el.innerHTML = '<b>' + lv.id + '</b><span class="nm">' + lv.name + '</span><small>' + lv.desc + '</small><em>' + (b ? medalOf(b.echoes, lv.par) + ' · ' + b.echoes + ' ecos · ' + fmt(b.time) + ' · par ' + lv.par : 'sin resolver · par ' + lv.par) + '</em>';
    el.onclick = () => { el.blur(); startLevel(lv, false); };
    grid.appendChild(el);
  });
}
function showSelect() {
  E.screen = 'select'; hideModal(); E.w = null; renderSelect(); selEl.style.display = 'flex';
  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0); ctx.clearRect(0, 0, state.W, state.H);
}

/* ------------------------------------------------------------------- flujo */
export function initEco(onExit) { E.onExit = onExit; }
export function openEco() {
  if (!E.ready) { E.ready = true; buildSelect(); bindInput(); }
  E.on = true; S.mode = 'eco';
  if (import.meta.env && import.meta.env.DEV) window.__eco = E;
  $('#menu').style.display = 'none';
  document.body.classList.add('eco');
  showSelect();
}
function leave() {
  E.on = false; E.w = null; hideModal(); selEl.style.display = 'none'; document.body.classList.remove('eco');
  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0); ctx.clearRect(0, 0, state.W, state.H);
  if (E.onExit) E.onExit();
}
function startLevel(def, daily) {
  E.def = def; E.daily = daily ? dayKey() : null; E.echoes = []; E.cycle = 1; E.replay = null; E.speed = 1;
  selEl.style.display = 'none'; hideModal();
  newCycle(); E.ui.hint = true; E.ui.showSigns = true; E.ui.title = (daily ? 'HOY · ' : 'NIVEL ' + def.id + ' · ') + def.name;
}
function newCycle() {
  E.w = createWorld(E.def, E.echoes); E.acc = 0; E.deadT = 0; E.winT = 0; E.screen = E.replay ? 'replay' : 'play';
  E.ui.flash = .5; E.ui.deadT = 0; E.ui.cycle = E.cycle; E.ui.echoes = E.echoes.length; E.ui.replay = !!E.replay; E.ui.speed = E.speed;
  E.latch = 0;
}
function closeCycle(auto) {
  if (E.screen !== 'play') return;
  if (E.echoes.length >= MAX_ECHOES) { say('Máximo de ' + MAX_ECHOES + ' ecos. Quitá uno con RETROCESO.'); if (auto) restartCycle(); return; }
  if (E.w.liveLog.length < 20) { say('Jugá un poco más antes de cerrar el ciclo'); return; }
  E.echoes.push(E.w.liveLog.slice()); E.cycle++;
  say(auto ? 'Se acabó el tiempo: ciclo guardado como eco ' + E.echoes.length : 'Eco ' + E.echoes.length + ' guardado');
  newCycle();
}
function restartCycle() { if (E.screen !== 'play' && E.screen !== 'dead') return; newCycle(); }
function undoEcho() { if (E.screen !== 'play' || !E.echoes.length) return; E.echoes.pop(); E.cycle = Math.max(1, E.cycle - 1); say('Último eco quitado'); newCycle(); }
function pause() {
  if (E.screen !== 'play' && E.screen !== 'replay') return;
  const was = E.screen; E.screen = 'paused';
  modal('pause', 'PAUSA', E.def.name, '<p class="lead">Ciclo ' + E.cycle + ' · ' + E.echoes.length + ' ecos guardados · par ' + E.def.par + '</p>', [
    ['Reanudar', () => { E.screen = was; }, false],
    ['Reiniciar nivel', () => (E.replay ? startReplay(E.def, E.replay.runs) : startLevel(E.def, !!E.daily)), true],
    ['Niveles', showSelect, true], ['Menú', leave, true]]);
}

function win() {
  const w = E.w, def = E.def, ticks = w.winTick + 1, time = ticks / TICK_HZ;
  if (E.replay) {
    E.screen = 'won';
    setTimeout(() => { if (E.screen === 'won') modal('win', 'REPETICIÓN', def.name, '<p class="lead">' + E.echoes.length + ' ecos · ' + fmt(time) + '</p>', [['Otra vez', () => startReplay(def, E.replay.runs), false], ['Niveles', showSelect, true]]); }, 500);
    return;
  }
  const runs = [...E.echoes, w.liveLog.slice(0, ticks)], res = verify(def, runs);
  E.screen = 'won';
  const echoes = E.echoes.length, code = encodeShare(def.id, runs), d = load(), rec = { echoes, time, code, date: dayKey() };
  const prev = d.best[def.id]; let record = false;
  if (res.ok) {
    if (better(rec, prev)) { d.best[def.id] = rec; record = true; }
    if (E.daily && better(rec, d.daily[E.daily])) d.daily[E.daily] = { ...rec, id: def.id };
    else if (E.daily && !d.daily[E.daily]) d.daily[E.daily] = { ...rec, id: def.id };
    save(d);
  }
  const tile = (v, l) => '<div class="tile"><b>' + v + '</b><small>' + l + '</small></div>';
  const body = '<p class="lead"><b>' + medalOf(echoes, def.par) + '</b>' + (record ? ' · ¡nuevo récord!' : '') + '<br>' + (echoes < def.par ? 'Mejor que el par: encontraste un atajo.' : echoes === def.par ? 'Igualaste el par.' : 'El par es ' + def.par + ' ecos.') + '</p>' +
    '<div class="tiles t3">' + tile(echoes, 'Ecos') + tile(def.par, 'Par') + tile(fmt(time), 'Tiempo') + '</div>' +
    '<p class="lead" style="margin-top:14px"><small>Código de repetición (verificable por cualquiera):</small></p><input class="codebox" readonly value="' + code + '">';
  const idx = LEVELS.indexOf(def), btns = [];
  btns.push(['Copiar resultado', async el => { const ok = await copy('WikiWar Ecos' + (E.daily ? ' · ' + E.daily : '') + ' · ' + def.name + ' · ' + echoes + ' ecos (par ' + def.par + ') · ' + fmt(time) + '\n' + code); el.textContent = ok ? '¡Copiado!' : 'No pude copiar'; }, false, true]);
  if (!E.daily && idx < LEVELS.length - 1) btns.push(['Siguiente nivel', () => startLevel(LEVELS[idx + 1], false), true]);
  btns.push(['Repetir', () => startLevel(def, !!E.daily), true], ['Niveles', showSelect, true]);
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .14, 'square', .04, 0), i * 100));
  setTimeout(() => { if (E.screen === 'won') { modal('win', E.daily ? 'DESAFÍO DIARIO' : 'NIVEL RESUELTO', def.name, body, btns); const cb = $('.codebox'); if (cb) cb.onfocus = () => cb.select(); } }, 900);
}

/* ---------------------------------------------------------- repeticiones */
function startReplay(def, runs) {
  E.def = def; E.daily = null; E.replay = { runs }; E.echoes = runs.slice(0, -1); E.cycle = runs.length; E.speed = 1;
  selEl.style.display = 'none'; hideModal();
  newCycle(); E.ui.hint = true; E.ui.showSigns = false; E.ui.title = 'REPETICIÓN · ' + def.name;
}
function importCode(text) {
  const msg = $('#ecoImpMsg');
  try {
    const { levelId, runs } = decodeShare(text), def = LEVELS.find(l => l.id === levelId);
    if (!def) throw new Error('Ese código es de un nivel que no existe en esta versión');
    const v = verify(def, runs);
    if (!v.ok) throw new Error('La repetición no es válida: ' + v.reason);
    const mine = load().best[def.id];
    msg.innerHTML = '<p class="ok">Verificada: <b>' + def.name + '</b>, ' + v.echoes + ' ecos, ' + fmt(v.time) + ' (par ' + def.par + ').' + (mine ? ' Tu mejor: ' + mine.echoes + ' ecos, ' + fmt(mine.time) + '.' : ' Vos todavía no lo resolviste.') + '</p>';
    const b = document.createElement('button'); b.className = 'ghost'; b.textContent = 'Ver repetición'; b.onclick = () => { b.blur(); startReplay(def, runs); };
    const c = document.createElement('button'); c.className = 'primary'; c.textContent = 'Competir'; c.onclick = () => { c.blur(); startLevel(def, false); };
    const row = document.createElement('div'); row.className = 'row'; row.append(c, b); msg.appendChild(row);
  } catch (e) { msg.innerHTML = '<p class="bad">' + e.message + '</p>'; }
}

/* ------------------------------------------------------------------- input */
const GAME = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyC', 'KeyR', 'KeyQ', 'Backspace', 'ShiftLeft', 'ShiftRight']);
function bindInput() {
  addEventListener('keydown', e => {
    if (!E.on) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (GAME.has(e.code) && E.screen !== 'select') e.preventDefault();
    if (e.code === 'Escape') { if (E.screen === 'paused') { hideModal(); E.screen = E.replay ? 'replay' : 'play'; } else if (E.screen === 'play' || E.screen === 'replay') pause(); else if (E.screen === 'select') leave(); return; }
    if (e.code === 'KeyM') { toggleMuted(); return; }
    if (e.code === 'KeyH') { E.ui.hint = !E.ui.hint; return; }
    if (E.screen === 'replay') { if (e.code === 'Space' && !e.repeat) { E.speed = E.speed === 1 ? 2 : E.speed === 2 ? 4 : 1; E.ui.speed = E.speed; } return; }
    if (E.screen !== 'play') return;
    if (!e.repeat) {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') E.latch |= J;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') E.latch |= D;
      if (e.code === 'KeyE' || e.code === 'Enter') E.latch |= USE;
      if (e.code === 'KeyR') { closeCycle(false); return; }
      if (e.code === 'KeyQ') { restartCycle(); return; }
      if (e.code === 'Backspace') { undoEcho(); return; }
    }
    E.keys[e.code] = true;
  });
  addEventListener('keyup', e => { E.keys[e.code] = false; });
  addEventListener('blur', () => { E.keys = {}; E.mouse.down = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && E.on) pause(); });
  addEventListener('mousemove', e => { E.mouse.x = e.clientX; E.mouse.y = e.clientY; });
  addEventListener('mousedown', e => { if (!E.on || e.target.closest('button,input,select,textarea')) return; E.mouse.x = e.clientX; E.mouse.y = e.clientY; if (e.button === 0) { E.mouse.down = true; E.latch |= SHOOT; } });
  addEventListener('mouseup', e => { if (e.button === 0) E.mouse.down = false; });
}

function liveMask() {
  const k = E.keys, w = E.w, a = w.live, { k: kk, ox, oy } = layoutFor(w, state.W, state.H);
  let m = E.latch; E.latch = 0;
  if (k.KeyA || k.ArrowLeft) m |= L;
  if (k.KeyD || k.ArrowRight) m |= R;
  if (k.Space || k.KeyW || k.ArrowUp) m |= J;
  if (k.KeyS || k.ArrowDown || k.KeyC || k.ShiftLeft || k.ShiftRight) m |= D;
  if (E.mouse.down) m |= SHOOT;
  const wx = (E.mouse.x - ox) / kk, wy = (E.mouse.y - oy) / kk;
  return mk(m, aimIndex(wx - a.x, wy - (a.y + (a.crouch ? -28 : SHOULDER))));
}

/* ------------------------------------------------------------------ sonidos */
function sfx(ev) {
  const mine = ev.id === undefined || ev.id === E.w.live.id;
  switch (ev.name) {
    case 'jump': if (mine) beep(300, .1, 'square', .03, 250); break;
    case 'land': if (mine) beep(90, .14, 'triangle', Math.min(.1, .04 + ev.v / 20000), -50); break;
    case 'shoot': if (mine) beep(520, .06, 'square', .04, -200); break;
    case 'plate': beep(ev.down ? 180 : 140, .06, 'square', .04, 0); break;
    case 'pad': beep(660, .08, 'square', .04, 300); break;
    case 'target': beep(880, .1, 'triangle', .05, 300); break;
    case 'lever': beep(260, .05, 'square', .05, -80); break;
    case 'door': beep(120, .25, 'sawtooth', .03, ev.open ? 90 : -60); break;
    case 'spring': beep(300, .22, 'triangle', .06, 700); break;
    case 'echodie': beep(200, .3, 'sawtooth', .05, -120); say('Un eco murió: cambió algo del mundo'); break;
    case 'die': beep(110, .3, 'sawtooth', .07, -60); E.deadT = .9; break;
    case 'win': break;
  }
}

/* ------------------------------------------------------------------ bucle */
export function ecoFrame(dt) {
  if (!E.on) return;
  E.t += dt;
  const w = E.w;
  if (!w || E.screen === 'select') return;
  const ui = E.ui;
  ui.flash = Math.max(0, ui.flash - dt * 2); ui.msgT = Math.max(0, ui.msgT - dt);
  if (E.screen === 'play' || E.screen === 'replay' || E.screen === 'won') {
    E.acc += Math.min(dt, .1) * (E.screen === 'replay' ? E.speed : 1);
    let n = 0;
    while (E.acc >= TICK && n++ < 16) {
      E.acc -= TICK;
      if (E.screen === 'replay') stepTick(w, E.replay.runs[E.replay.runs.length - 1][w.tick] || 0);
      else if (E.screen === 'play') stepTick(w, w.liveDead ? 0 : liveMask());
      else stepTick(w, 0);
      for (const ev of w.ev) { if (ev.name === 'win') { win(); } else sfx(ev); }
      w.ev.length = 0;
      if (E.screen === 'won' && !w.won) break;
      if (E.screen === 'play' && timeUp(w) && !w.won) { closeCycle(true); break; }
      if (E.screen === 'replay' && timeUp(w) && !w.won) { E.screen = 'won'; modal('pause', 'REPETICIÓN', 'Terminó', '<p class="lead">La repetición se quedó sin tiempo.</p>', [['Otra vez', () => startReplay(E.def, E.replay.runs), false], ['Niveles', showSelect, true]]); break; }
    }
    if (E.screen === 'play' && E.deadT > 0) {
      E.deadT -= dt; ui.deadT = E.deadT;
      if (E.deadT <= 0) { ui.deadT = 0; restartCycle(); }
    }
  }
  drawWorld(ctx, E.w, state.W, state.H, state.DPR, E.t, ui);
}
export const ecoActive = () => E.on;
export function ecoState() { return E; }      // para pruebas en desarrollo
