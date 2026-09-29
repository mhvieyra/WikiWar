// Bucle principal y flujo de partida: carga un articulo de Wikipedia como
// nivel, corre el update/draw de cada frame, y conecta el input del
// teclado y el mouse con el resto de los modulos.
import './style.css';
import { RS, REGEN, RUN, JUMP, FLY_ACC, FLY_MAX, FUEL_DRAIN, FUEL_REGEN, STAND_H, CROUCH_H, CROUCH_SPEED_MULT } from './config.js';
import { S, state, cv, ctx } from './state.js';
import { $, clamp, norm, sleep, nextFrame } from './utils.js';
import { fetchParse, fetchInfo, buildDOM, buildLevel, measure } from './wiki.js';
import { spawnPlayer, fire, throwGrenade, drawPlayer } from './player.js';
import { spawnEnemy, updateEnemy, drawEnemy, hitEnemy } from './enemies.js';
import { physics, canStandUp } from './physics.js';
import { WEAPONS } from './weapons.js';
import { playSfx, boom, toggleMuted } from './audio.js';
import { okSpr, drawSpr, SHOULDER_STAND_Y, SHOULDER_CROUCH_Y, CHEST_Y } from './sprites.js';
import { fade, toast, win, gameOver, pause, hideMsg, setGoal, drawHud, updateHud, initUI } from './ui.js';

/* ------------------------------------------------------------------ canvas */
function resize() {
  state.W = innerWidth; state.H = innerHeight; state.DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(state.W * state.DPR); cv.height = Math.round(state.H * state.DPR);
  cv.style.width = state.W + 'px'; cv.style.height = state.H + 'px';
  ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0); ctx.imageSmoothingEnabled = false;
  clearTimeout(resize.t); resize.t = setTimeout(() => { if (state.L) measure(); }, 150);
}
addEventListener('resize', resize); resize();

/* ------------------------------------------------------------------ niveles */
export async function loadLevel(title, first) {
  const prev = S.mode;
  S.mode = 'loading'; fade(true); await sleep(260);
  let data;
  try { data = await fetchParse(title); }
  catch (e) {
    fade(false);
    if (first) { S.mode = 'menu'; $('#menu').style.display = 'flex'; document.body.classList.remove('play'); $('#status').textContent = 'No pude cargar «' + title + '»: ' + e.message; }
    else { S.mode = prev === 'loading' ? 'play' : prev; toast('No pude cargar esa página'); }
    return;
  }
  S.path.push(data.title);
  if (norm(data.title) === norm(S.toCanon) && S.path.length > 1) { fade(false); win(data.title); return; }
  buildDOM(data);
  state.L = buildLevel();
  await (document.fonts && document.fonts.ready || Promise.resolve());
  await nextFrame();
  measure();
  setTimeout(measure, 900);
  state.enemies = []; state.bullets = []; state.grenades = []; state.parts = []; state.fx = [];
  spawnPlayer(); state.cam = 0; state.near = null; S.spawnT = 1.5;
  $('#tFrom').textContent = data.title;
  S.mode = 'play'; fade(false);
}

export function resetRun() {
  S.clicks = 0; S.kills = 0; S.words = 0; S.time = 0; S.lives = 3; S.path = [];
  loadLevel(S.from, true);
}

export async function startGame() {
  const from = $('#inFrom').value.trim(), to = $('#inTo').value.trim(), st = $('#status');
  if (!from || !to) { st.textContent = 'Poné un origen y un destino, o tocá ALEATORIO.'; return; }
  S.lang = $('#lang').value; st.textContent = 'Buscando los artículos...';
  let a, b;
  try { [a, b] = await Promise.all([fetchInfo(from), fetchInfo(to)]); }
  catch (e) { st.textContent = 'No pude conectar con Wikipedia: ' + e.message; return; }
  if (!a) { st.textContent = 'No encontré «' + from + '».'; return; }
  if (!b) { st.textContent = 'No encontré «' + to + '».'; return; }
  if (norm(a.title) === norm(b.title)) { st.textContent = 'El origen y el destino son el mismo artículo.'; return; }
  S.from = a.title; S.toCanon = b.title; S.toNorm2 = norm(to); S.toInfo = b;
  $('#menu').style.display = 'none'; document.body.classList.add('play'); setGoal();
  resetRun();
}

/* ---------------------------------------------------------- efectos / danio */
export function burst(x, y, n, col, spd, up) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = (.3 + Math.random()) * (spd || 180);
    state.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (up || 60), life: .5 + Math.random() * .5, c: col, s: 2 + Math.random() * 3 });
  }
}
function destroyPlat(pl) {
  const L = state.L;
  if (!pl.alive || pl.link) return;
  pl.alive = false; pl.deadAt = performance.now(); pl.el.style.visibility = 'hidden'; L.destroyed.push(pl);
  if (pl.kind === 'word') { S.words++; burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 4, '#202122', 140, 40); }
  else burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 26, '#8a8f98', 260, 80);
}
function hitPlat(pl, d) {
  pl.hp -= d;
  if (pl.hp <= 0) destroyPlat(pl); else burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 3, '#8a8f98', 120, 30);
}
export function hurt(d, kx) {
  const p = state.p;
  if (p.inv > 0 || S.mode !== 'play') return;
  p.hp -= d; p.inv = .9; p.vx = kx; p.vy = -260; p.onGround = false; S.shake = 8;
  burst(p.x, p.y + CHEST_Y, 14, '#c0392b', 220, 100); playSfx('player_hurt', 110, .22, 'sawtooth', .07, -60);
  if (p.hp <= 0) loseLife();
}
function loseLife() {
  const p = state.p;
  S.lives--; burst(p.x, p.y + CHEST_Y, 40, '#202122', 320, 160);
  if (S.lives <= 0) { gameOver(); return; }
  toast('Perdiste una vida. Te quedan ' + S.lives);
  const keepInv = 2.5;
  state.enemies = []; state.bullets = []; state.grenades = [];
  spawnPlayer(); state.p.inv = keepInv; state.cam = 0;
}
function explode(x, y) {
  const R = 95, p = state.p;
  state.fx.push({ type: 'boom', x, y, t: 0 }); S.shake = 14; boom(.3);
  burst(x, y, 30, '#ff7a3d', 360, 100);
  for (const pl of state.L.plats) {
    if (!pl.alive || pl.link) continue;
    const cx = pl.x + pl.w / 2, cy = pl.y + pl.h / 2;
    if (Math.abs(cx - x) > R + pl.w / 2 || Math.abs(cy - y) > R) continue;
    if (Math.hypot(cx - x, cy - y) < R) { if (pl.kind === 'img') hitPlat(pl, 3); else destroyPlat(pl); }
  }
  for (const e of state.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - 20 - y) < R * 1.1) hitEnemy(e, 4, Math.sign(e.x - x));
  const d = Math.hypot(p.x - x, p.y - 20 - y);
  if (d < R) { const k = 1 - d / R; hurt(Math.round(10 + 25 * k), Math.sign(p.x - x || 1) * 320 * k); }
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  const p = state.p, L = state.L, keys = state.keys;
  S.time += dt; S.cool -= dt; S.gcool -= dt; p.t += dt; p.inv -= dt;

  // link cercano (se calcula antes de agacharse: agacharse solo tiene efecto
  // parado encima de un link).
  state.near = null;
  for (let r = Math.floor((p.y - p.h) / RS); r <= Math.floor(p.y / RS) && !state.near; r++) {
    const arr = L.full.get(r); if (!arr) continue;
    for (const pl of arr) {
      if (pl.link && pl.x < p.x + p.w / 2 + 6 && pl.x + pl.w > p.x - p.w / 2 - 6 && pl.y < p.y + 4 && pl.y + pl.h > p.y - p.h) { state.near = pl; break; }
    }
  }

  // Agacharse con C o Shift solo funciona parado encima de un link: es la
  // forma de entrar (ver el keydown de mas abajo, que dispara loadLevel).
  // En el aire, o lejos de un link, nunca queda agachado. Al soltar la tecla
  // o alejarse del link solo se para si hay espacio libre arriba.
  const crouchKey = keys.KeyC || keys.ShiftLeft || keys.ShiftRight;
  if (!p.onGround) p.crouch = false;
  else if (crouchKey && state.near) p.crouch = true;
  else if (p.crouch && canStandUp(p)) p.crouch = false;
  p.h = p.crouch ? CROUCH_H : STAND_H;

  const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
  const ax = (right ? 1 : 0) - (left ? 1 : 0);
  const spd = RUN * (p.crouch ? CROUCH_SPEED_MULT : 1);
  p.vx += (ax * spd - p.vx) * Math.min(1, (p.onGround ? 18 : 6) * dt);
  if (!ax && p.onGround && Math.abs(p.vx) < 5) p.vx = 0;

  const hold = (keys.Space || keys.KeyW || keys.ArrowUp) && !p.crouch;
  if (hold) p.holdT += dt; else p.holdT = 0;
  p.flying = false;
  if (!p.onGround && hold && p.holdT > .2 && p.fuel > 0) {
    p.vy = Math.max(p.vy - FLY_ACC * dt, -FLY_MAX); p.fuel -= FUEL_DRAIN * dt; p.flying = true;
    if (Math.random() < .7) state.parts.push({ x: p.x + (Math.random() - .5) * 6, y: p.y, vx: (Math.random() - .5) * 40, vy: 120 + Math.random() * 100, life: .35, c: Math.random() < .5 ? '#ff7a3d' : '#ffd166', s: 3 });
  }
  if (p.onGround) { p.fuel = Math.min(100, p.fuel + FUEL_REGEN * dt); p.usedFlip = false; }
  if ((keys.KeyS || keys.ArrowDown) && p.onGround) p.drop = .22;
  if (p.flipping) { p.spin += 13 * dt; if (p.spin >= 6.283) { p.spin = 0; p.flipping = false; } }

  const wy = state.my + state.cam;
  const shoulderY = p.crouch ? SHOULDER_CROUCH_Y : SHOULDER_STAND_Y;
  p.aim = Math.atan2(wy - (p.y + shoulderY), state.mx - p.x); p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
  if (state.mouseDown && S.cool <= 0) fire();
  physics(p, dt);

  // camara
  const tgt = clamp(p.y - state.H * .6, 0, Math.max(0, L.h - state.H));
  state.cam += (tgt - state.cam) * Math.min(1, 6 * dt);

  // enemigos, balas, granadas
  S.spawnT -= dt; if (S.spawnT <= 0) { S.spawnT = 1.2; spawnEnemy(); }
  for (const e of state.enemies) if (!e.dead) updateEnemy(e, dt);
  state.enemies = state.enemies.filter(e => !e.dead);
  updBullets(dt);
  for (const g of state.grenades) {
    g.t += dt; const vy0 = g.vy; physics(g, dt);
    if (g.onGround && vy0 > 150) { g.vy = -vy0 * .4; g.onGround = false; }
    g.vx *= g.onGround ? .9 : .995;
    if (g.t > 1.3) g.boom = true;
    else for (const e of state.enemies) if (Math.abs(e.x - g.x) < 12 && g.y > e.y - e.h - 4 && g.y < e.y + 4) g.boom = true;
    if (g.boom) explode(g.x, g.y - 3);
  }
  state.grenades = state.grenades.filter(g => !g.boom);

  // particulas y fx
  for (const q of state.parts) { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  state.parts = state.parts.filter(q => q.life > 0);
  for (const f of state.fx) f.t += dt;
  state.fx = state.fx.filter(f => f.t < (f.type === 'die' ? .45 : 1));
  S.shake = Math.max(0, S.shake - 30 * dt);

  // las palabras rotas reaparecen
  const now = performance.now();
  while (L.destroyed.length && now - L.destroyed[0].deadAt > REGEN) {
    const pl = L.destroyed.shift(); pl.alive = true; pl.hp = pl.maxhp; pl.el.style.visibility = 'visible';
  }
  updateHud();
}

function updBullets(dt) {
  const p = state.p, L = state.L;
  for (const b of state.bullets) {
    const sp = Math.hypot(b.vx, b.vy), n = Math.max(1, Math.ceil(sp * dt / 6)), sx = b.vx * dt / n, sy = b.vy * dt / n;
    for (let i = 0; i < n && !b.dead; i++) {
      b.x += sx; b.y += sy;
      if (b.own === 'p') {
        for (const e of state.enemies) {
          if (!e.dead && b.x > e.x - e.w / 2 - 2 && b.x < e.x + e.w / 2 + 2 && b.y > e.y - e.h && b.y < e.y) { hitEnemy(e, b.dmg, Math.sign(b.vx)); b.dead = true; break; }
        }
        if (b.dead) break;
        const arr = L.full.get(Math.floor(b.y / RS));
        if (arr) for (const pl of arr) {
          if (!pl.alive || b.x < pl.x || b.x > pl.x + pl.w || b.y < pl.y || b.y > pl.y + pl.h) continue;
          if (pl.link) { burst(b.x, b.y, 3, '#0645ad', 120, 20); b.dead = true; }
          else { hitPlat(pl, 1); if (--b.pierce <= 0) b.dead = true; }
          break;
        }
      } else if (p.inv <= 0 && b.x > p.x - p.w / 2 && b.x < p.x + p.w / 2 && b.y > p.y - p.h && b.y < p.y) {
        hurt(b.dmg, Math.sign(b.vx) * 200); b.dead = true;
      }
    }
    b.life -= dt;
    if (b.life <= 0 || b.x < -60 || b.x > state.W + 60 || b.y < -60 || b.y > L.h + 60) b.dead = true;
  }
  state.bullets = state.bullets.filter(b => !b.dead);
}

/* --------------------------------------------------------------------- dibujo */
function draw() {
  const L = state.L, p = state.p;
  ctx.clearRect(0, 0, state.W, state.H);
  let shx = 0, shy = 0;
  if (S.shake > 0) { shx = (Math.random() - .5) * S.shake; shy = (Math.random() - .5) * S.shake; }
  const ty = -Math.round(state.cam) + Math.round(shy);
  $('#page').style.transform = 'translate3d(' + Math.round(shx) + 'px,' + ty + 'px,0)';
  if (!L || !p) return;
  ctx.save(); ctx.translate(Math.round(shx), ty);
  const vt = state.cam - 60, vb = state.cam + state.H + 60, now = performance.now();

  // suelo
  ctx.fillStyle = '#272727'; ctx.fillRect(0, L.floorY, state.W, Math.max(200, L.h - L.floorY + 400));
  ctx.fillStyle = '#ff7a3d'; ctx.fillRect(0, L.floorY, state.W, 4);

  // link resaltado y destino
  const pulse = .5 + .5 * Math.sin(now / 180);
  for (const pl of L.targetPlats) {
    if (pl.y < vt || pl.y > vb) continue;
    ctx.strokeStyle = 'rgba(255,190,0,' + (.5 + .5 * pulse) + ')'; ctx.lineWidth = 3;
    ctx.strokeRect(Math.round(pl.x) - 2, Math.round(pl.y) - 2, Math.round(pl.w) + 4, Math.round(pl.h) + 4);
  }
  if (state.near) {
    ctx.fillStyle = 'rgba(6,69,173,.18)'; ctx.strokeStyle = '#0645ad'; ctx.lineWidth = 2;
    for (const pl of L.byAnchor.get(state.near.a) || [state.near]) { ctx.fillRect(pl.x, pl.y, pl.w, pl.h); ctx.strokeRect(pl.x, pl.y, pl.w, pl.h); }
  }

  for (const e of state.enemies) if (e.y > vt && e.y < vb + 100) drawEnemy(e);
  drawPlayer();

  // balas
  for (const b of state.bullets) {
    if (okSpr('bullet')) drawSpr('bullet', 0, b.x, b.y, false, Math.atan2(b.vy, b.vx), .5, .5);
    else { ctx.strokeStyle = b.own === 'p' ? '#e67e22' : '#8e2bb0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .018, b.y - b.vy * .018); ctx.stroke(); }
  }
  for (const g of state.grenades) {
    if (okSpr('grenade')) drawSpr('grenade', 0, g.x, g.y, false, g.t * 8, .5, .5);
    else { ctx.fillStyle = '#2d6a4f'; ctx.fillRect(Math.round(g.x) - 4, Math.round(g.y) - 8, 8, 8); ctx.fillStyle = '#ff7a3d'; ctx.fillRect(Math.round(g.x) - 1, Math.round(g.y) - 10, 2, 3); }
  }
  for (const f of state.fx) {
    if (f.type === 'boom') {
      if (okSpr('explosion')) drawSpr('explosion', f.t, f.x, f.y, false, 0, .5, .5, false);
      else { const r = 95 * Math.min(1, f.t * 5); ctx.globalAlpha = 1 - f.t; ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(f.x, f.y, r * .6, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#ff7a3d'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
    } else if (f.type === 'die' && okSpr('enemyDie')) {
      if (f.hue) { ctx.save(); ctx.filter = 'hue-rotate(' + f.hue + 'deg)'; drawSpr('enemyDie', f.t, f.x, f.y, f.face < 0, 0, .5, 1, false); ctx.restore(); }
      else drawSpr('enemyDie', f.t, f.x, f.y, f.face < 0, 0, .5, 1, false);
    }
  }
  for (const q of state.parts) { ctx.globalAlpha = Math.min(1, q.life * 2); ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
  ctx.globalAlpha = 1;

  // prompt de link
  if (state.near) {
    const near = state.near;
    const isT = norm(near.link) === norm(S.toCanon) || norm(near.link) === S.toNorm2;
    const txt = (isT ? 'E/C · ¡LLEGAR A «' : 'E/C · entrar a «') + near.link + '»';
    ctx.font = 'bold 12px "Courier New",monospace';
    const w = ctx.measureText(txt).width + 16, bx = Math.round(clamp(p.x - w / 2, 6, state.W - w - 6)), by = Math.round(p.y - 72);
    ctx.fillStyle = '#272727'; ctx.fillRect(bx, by, w, 22); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, w, 22);
    ctx.fillStyle = isT ? '#ffd166' : '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx + 8, by + 12);
  }
  ctx.restore();
  drawHud();
}

/* ------------------------------------------------------------------- input */
initUI();

addEventListener('keydown', e => {
  const keys = state.keys;
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && S.mode !== 'menu') e.preventDefault();
  if (e.code === 'Escape') { if (S.mode === 'pause') { hideMsg(); S.mode = 'play'; } else pause(); return; }
  if (e.code === 'KeyM') { const m = toggleMuted(); toast(m ? 'Sonido apagado' : 'Sonido encendido'); return; }
  if (S.mode !== 'play') { keys[e.code] = true; return; }
  if (!e.repeat) {
    const p = state.p;
    if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp')) {
      if (p.onGround && !p.crouch) { p.vy = -JUMP; p.onGround = false; p.holdT = 0; playSfx('jump', 300, .1, 'square', .03, 250); }
      else if (!p.onGround && !p.usedFlip && !p.flying) { p.usedFlip = true; p.flipping = true; p.spin = .01; }
    }
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (state.near) { S.clicks++; loadLevel(state.near.link, false); }
    }
    if (e.code === 'Digit1') S.wi = 0;
    if (e.code === 'Digit2') S.wi = 1;
    if (e.code === 'Digit3') S.wi = 2;
  }
  keys[e.code] = true;
});
addEventListener('keyup', e => { state.keys[e.code] = false; });
addEventListener('blur', () => { for (const k in state.keys) state.keys[k] = false; state.mouseDown = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('mousemove', e => { state.mx = e.clientX; state.my = e.clientY; });
addEventListener('mousedown', e => {
  state.mx = e.clientX; state.my = e.clientY;
  if (S.mode !== 'play' || e.target.closest('button,input,select')) return;
  if (e.button === 0) state.mouseDown = true;
  if (e.button === 2 && S.gcool <= 0) throwGrenade();
});
addEventListener('mouseup', e => { if (e.button === 0) state.mouseDown = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (S.mode === 'play') S.wi = (S.wi + (e.deltaY > 0 ? 1 : WEAPONS.length - 1)) % WEAPONS.length; }, { passive: true });

/* ---------------------------------------------------------------- bucle */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.033, (now - last) / 1000); last = now;
  if (S.mode === 'play' && state.L && state.p) update(dt);
  if (state.L && state.p) draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
