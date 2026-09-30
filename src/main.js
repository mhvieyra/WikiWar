// Bucle principal y flujo de partida: carga un articulo de Wikipedia como
// nivel, corre el update/draw de cada frame, y conecta el input del
// teclado y el mouse con el resto de los modulos.
import '@fontsource/press-start-2p';
import '@fontsource/vt323';
import './style.css';
import { RS, REGEN, CRATE_EVERY, CRATE_H, RUN, JUMP, FLY_ACC, FLY_MAX, FUEL_DRAIN, FUEL_REGEN, STAND_H, CROUCH_H, CROUCH_SPEED_MULT } from './config.js';
import { S, state, cv, ctx } from './state.js';
import { $, clamp, norm, sleep, nextFrame } from './utils.js';
import { fetchParse, fetchInfo, buildDOM, buildLevel, measure } from './wiki.js';
import { spawnPlayer, fire, throwGrenade, drawPlayer, updateJetSmoke, drawSmoke } from './player.js';
import { updateCrates, updateItems, drawCrates, drawItems, hitCrate } from './crates.js';
import { spawnEnemy, updateEnemy, drawEnemy, hitEnemy } from './enemies.js';
import { physics, canStandUp } from './physics.js';
import { WEAPONS, resetAmmo } from './weapons.js';
import { makeCrater, holeTouches, inCrater, shedLetters, shootLetter, letterGoneAt, resetLetters, spawnShards, updateDebris, drawDebris, drawTerrain, drawDamage } from './craters.js';
import { playSfx, boom, toggleMuted, jetSound } from './audio.js';
import { okSpr, drawSpr, SHOULDER_STAND_Y, SHOULDER_CROUCH_Y, CHEST_Y } from './sprites.js';
import { fade, toast, win, gameOver, pause, hideMsg, setGoal, drawHud, updateHud, initUI, toggleHelp, pxBox, PF, VT, pickPair, toMenu } from './ui.js';
import { openEco, ecoFrame, initEco } from './eco/index.js';
import { openArena, arenaFrame, initArena } from './arena/index.js';

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
  state.crates = []; state.items = []; state.smoke = []; state.debris = [];
  spawnPlayer(); state.cam = 0; state.near = null; S.spawnT = 1.5;
  $('#tFrom').textContent = data.title;
  S.mode = 'play'; fade(false);
}

export function resetRun() {
  S.clicks = 0; S.kills = 0; S.words = 0; S.time = 0; S.settled = false; S.lives = 3; S.path = [];
  resetAmmo(); S.strengthT = 0; S.ammoFlash = 0; S.crateT = CRATE_EVERY;
  loadLevel(S.from, true);
}

function applyPair(a, b, target) {
  S.from = a.title; S.toCanon = b.title; S.toNorm2 = norm(target); S.toInfo = b;
  $('#menu').style.display = 'none'; document.body.classList.add('play'); setGoal();
}

// Sortea rutas hasta encontrar una cuyos dos articulos existan (reintenta
// unas pocas veces por si Wikipedia devuelve un titulo que cambio).
async function drawRoute(lang) {
  S.lang = lang;
  for (let i = 0; i < 4; i++) {
    const [f, t] = pickPair(lang);
    try {
      const [a, b] = await Promise.all([fetchInfo(f), fetchInfo(t)]);
      if (a && b && norm(a.title) !== norm(b.title)) return { a, b, t };
    } catch (e) { return null; }
  }
  return null;
}

// "Jugar otra vez": nueva ruta aleatoria en el mismo idioma.
export async function playRandom() {
  S.mode = 'loading'; fade(true);
  const r = await drawRoute(S.lang);
  if (!r) { fade(false); toMenu(); $('#status').textContent = 'No pude sortear una ruta nueva. Revisá tu conexión.'; return; }
  applyPair(r.a, r.b, r.t);
  resetRun();
}

export async function startGame() {
  const st = $('#status');
  S.ranked = $('#mode').value === 'ranked';
  S.untimed = !S.ranked && $('#timing').value === 'untimed';
  const lang = $('#lang').value;
  if (S.ranked) {
    st.textContent = 'Sorteando tu ruta...';
    const r = await drawRoute(lang);
    if (!r) { st.textContent = 'No pude sortear una ruta. Revisá tu conexión con Wikipedia.'; return; }
    applyPair(r.a, r.b, r.t); resetRun(); return;
  }
  const from = $('#inFrom').value.trim(), to = $('#inTo').value.trim();
  if (!from || !to) { st.textContent = 'Poné un origen y un destino, o tocá ALEATORIO.'; return; }
  S.lang = lang; st.textContent = 'Buscando los artículos...';
  let a, b;
  try { [a, b] = await Promise.all([fetchInfo(from), fetchInfo(to)]); }
  catch (e) { st.textContent = 'No pude conectar con Wikipedia: ' + e.message; return; }
  if (!a) { st.textContent = 'No encontré «' + from + '».'; return; }
  if (!b) { st.textContent = 'No encontré «' + to + '».'; return; }
  if (norm(a.title) === norm(b.title)) { st.textContent = 'El origen y el destino son el mismo artículo.'; return; }
  applyPair(a, b, to);
  resetRun();
}

/* ---------------------------------------------------------- efectos / danio */
export function burst(x, y, n, col, spd, up) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = (.3 + Math.random()) * (spd || 180);
    state.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (up || 60), life: .5 + Math.random() * .5, c: col, s: 2 + Math.random() * 3 });
  }
}
// permanent: la rompio un crater, asi que no reaparece. blast: [x, y, fuerza]
// de la explosion, para que el escombro salga despedido hacia afuera.
function destroyPlat(pl, permanent, blast) {
  const L = state.L;
  if (!pl.alive || pl.link) return;
  pl.alive = false; pl.deadAt = performance.now(); pl.el.style.visibility = 'hidden';
  if (!permanent) L.destroyed.push(pl);
  if (pl.kind === 'word') {
    S.words++; burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 4, '#202122', 140, 40);
    shedLetters(pl, blast, true);
  } else {
    burst(pl.x + pl.w / 2, pl.y + pl.h / 2, 26, '#8a8f98', 260, 80);
    spawnShards(pl, blast); S.shake = Math.max(S.shake, 6);
  }
}
function hitPlat(pl, d, blast) {
  pl.hp -= d;
  if (pl.hp <= 0) destroyPlat(pl, false, blast); else burst(pl.x + pl.w / 2, pl.y + pl.h / 2, pl.kind === 'img' ? 6 : 3, '#8a8f98', 120, 30);
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
function explode(x, y, mult) {
  const R = 95, p = state.p;
  state.fx.push({ type: 'boom', x, y, t: 0 }); S.shake = 14; boom(.3);
  burst(x, y, 30, '#ff7a3d', 360, 100);
  const L = state.L, bb = makeCrater(x, y, R * 1.15), blast = [x, y, 420];
  for (const pl of L.plats) {
    if (pl.x > bb.x1 || pl.x + pl.w < bb.x0 || pl.y > bb.y1 || pl.y + pl.h < bb.y0) continue;
    if (pl.link) { if (holeTouches(pl) && !L.covered.includes(pl)) L.covered.push(pl); continue; }
    if (!pl.alive) continue;
    if (pl.kind === 'img') {
      const nx = clamp(x, pl.x, pl.x + pl.w), ny = clamp(y, pl.y, pl.y + pl.h);
      if (Math.hypot(nx - x, ny - y) < R) hitPlat(pl, 4, blast);
    } else if (shedLetters(pl, blast, false) === 0) destroyPlat(pl, true, blast);
  }
  for (const e of state.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - 20 - y) < R * 1.1) hitEnemy(e, 4 * mult, Math.sign(e.x - x), -1);
  for (const c of state.crates) if (Math.hypot(c.x - x, c.y - CRATE_H / 2 - y) < R * 1.1) hitCrate(c, 2 * mult);
  const d = Math.hypot(p.x - x, p.y - 20 - y);
  if (d < R) { const k = 1 - d / R; hurt(Math.round(10 + 25 * k), Math.sign(p.x - x || 1) * 320 * k); }
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  const p = state.p, L = state.L, keys = state.keys;
  if (!S.untimed) S.time += dt;
  S.cool -= dt; S.gcool -= dt; p.t += dt; p.inv -= dt;

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
  }
  if (p.onGround) { p.fuel = Math.min(100, p.fuel + FUEL_REGEN * dt); p.usedFlip = false; }
  if ((keys.KeyS || keys.ArrowDown) && p.onGround) p.drop = .22;
  if (p.flipping) { p.spin += 13 * dt; if (p.spin >= 6.283) { p.spin = 0; p.flipping = false; } }

  const wy = state.my + state.cam;
  const shoulderY = p.crouch ? SHOULDER_CROUCH_Y : SHOULDER_STAND_Y;
  p.aim = Math.atan2(wy - (p.y + shoulderY), state.mx - p.x); p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
  if (state.mouseDown && S.cool <= 0) fire();
  const vyBefore = p.vy, wasAir = !p.onGround;
  physics(p, dt);
  jetSound(p.flying);
  if (wasAir && p.onGround && vyBefore > 300) playSfx('land', 90, .14, 'triangle', Math.min(.1, .04 + vyBefore / 20000), -50);
  updateJetSmoke(dt);

  // camara
  const tgt = clamp(p.y - state.H * .6, 0, Math.max(0, L.h - state.H));
  state.cam += (tgt - state.cam) * Math.min(1, 6 * dt);

  // enemigos, balas, granadas
  S.spawnT -= dt; if (S.spawnT <= 0) { S.spawnT = 1.2; spawnEnemy(); }
  for (const e of state.enemies) if (!e.dead) updateEnemy(e, dt);
  state.enemies = state.enemies.filter(e => !e.dead);
  updBullets(dt);
  updateCrates(dt); updateItems(dt);
  S.strengthT = Math.max(0, S.strengthT - dt); S.ammoFlash = Math.max(0, S.ammoFlash - dt);
  for (const g of state.grenades) {
    g.t += dt; const vy0 = g.vy; physics(g, dt);
    if (g.onGround && vy0 > 150) { g.vy = -vy0 * .4; g.onGround = false; }
    g.vx *= g.onGround ? .9 : .995;
    if (g.t > 1.3) g.boom = true;
    else for (const e of state.enemies) if (Math.abs(e.x - g.x) < 12 && g.y > e.y - e.h - 4 && g.y < e.y + 4) g.boom = true;
    if (g.boom) explode(g.x, g.y - 3, g.mult);
  }
  state.grenades = state.grenades.filter(g => !g.boom);

  // particulas y fx
  for (const q of state.parts) { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
  state.parts = state.parts.filter(q => q.life > 0);
  updateDebris(dt);
  for (const f of state.fx) f.t += dt;
  state.fx = state.fx.filter(f => f.t < (f.type === 'die' ? .45 : 1));
  S.shake = Math.max(0, S.shake - 30 * dt);

  // las palabras rotas reaparecen
  const now = performance.now();
  L.shot = L.shot.filter(pl => {
    if (!pl.alive) return false;
    if (now - pl.shotAt <= REGEN) return true;
    resetLetters(pl); return false;
  });
  while (L.destroyed.length && now - L.destroyed[0].deadAt > REGEN) {
    const pl = L.destroyed.shift();
    if (inCrater(pl.x + pl.w / 2, pl.y + pl.h / 2)) continue;
    pl.alive = true; pl.hp = pl.maxhp; pl.cracks = null; pl.el.style.visibility = 'visible';
    if (pl.kind === 'word') resetLetters(pl);
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
          if (!e.dead && b.x > e.x - e.w / 2 - 2 && b.x < e.x + e.w / 2 + 2 && b.y > e.y - e.h && b.y < e.y) { hitEnemy(e, b.dmg, Math.sign(b.vx), b.wi); b.dead = true; break; }
        }
        if (b.dead) break;
        for (const c of state.crates) {
          if (c.breakT < 0 && b.x > c.x - c.w / 2 && b.x < c.x + c.w / 2 && b.y > c.y - c.h && b.y < c.y) { hitCrate(c, b.dmg); b.dead = true; break; }
        }
        if (b.dead) break;
        const arr = L.full.get(Math.floor(b.y / RS));
        if (arr) for (const pl of arr) {
          if (!pl.alive || (!pl.link && inCrater(b.x, b.y)) || b.x < pl.x || b.x > pl.x + pl.w || b.y < pl.y || b.y > pl.y + pl.h) continue;
          if (pl.link) { burst(b.x, b.y, 3, '#0645ad', 120, 20); b.dead = true; }
          else if (pl.kind === 'word') {
            if (letterGoneAt(pl, b.x)) continue;
            burst(b.x, b.y, 3, '#8a8f98', 120, 30);
            if (shootLetter(pl, b.x, b.y) === 0) destroyPlat(pl, false, [b.x, b.y, 240]);
            if (--b.pierce <= 0) b.dead = true;
          }
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
const pageEl = $('#page');
function draw() {
  const L = state.L, p = state.p;
  ctx.clearRect(0, 0, state.W, state.H);
  let shx = 0, shy = 0;
  if (S.shake > 0) { shx = (Math.random() - .5) * S.shake; shy = (Math.random() - .5) * S.shake; }
  const ty = -Math.round(state.cam) + Math.round(shy);
  pageEl.style.transform = 'translate3d(' + Math.round(shx) + 'px,' + ty + 'px,0)';
  if (!L || !p) return;
  ctx.save(); ctx.translate(Math.round(shx), ty);
  const vt = state.cam - 60, vb = state.cam + state.H + 60, now = performance.now();

  // suelo
  drawTerrain(vt, vb, Math.round(shx), ty); drawDamage(vt, vb);

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

  drawCrates(); drawItems();
  for (const e of state.enemies) if (e.y > vt && e.y < vb + 100) drawEnemy(e);
  drawSmoke();
  drawPlayer();
  drawDebris();

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
      drawSpr('enemyDie', f.t, f.x, f.y, f.face < 0, 0, .5, 1, false, f.hue);
    }
  }
  for (const q of state.parts) { ctx.globalAlpha = Math.min(1, q.life * 2); ctx.fillStyle = q.c; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
  ctx.globalAlpha = 1;

  // prompt de link
  if (state.near) {
    const near = state.near;
    const isT = norm(near.link) === norm(S.toCanon) || norm(near.link) === S.toNorm2;
    const txt = (isT ? '¡LLEGAR A «' : 'ENTRAR A «') + near.link + '»';
    ctx.font = '18px ' + VT; ctx.textBaseline = 'middle';
    const kw = 22, w = Math.round(ctx.measureText(txt).width) + kw + 26, bx = Math.round(clamp(p.x - w / 2, 8, state.W - w - 8)), by = Math.round(p.y - 78);
    pxBox(bx, by, w, 28, isT ? '#3a2f10' : '#1b1b1f');
    ctx.fillStyle = '#ff7a3d'; ctx.fillRect(bx + 6, by + 6, kw, 16);
    ctx.fillStyle = '#000'; ctx.font = '8px ' + PF; ctx.textAlign = 'center'; ctx.fillText('E', bx + 6 + kw / 2, by + 15);
    ctx.font = '18px ' + VT; ctx.textAlign = 'left'; ctx.fillStyle = isT ? '#ffd166' : '#f4f1e8'; ctx.fillText(txt, bx + kw + 14, by + 15);
  }
  ctx.restore();
  drawHud();
}

/* ------------------------------------------------------------------- input */
initUI();
// Ecos: puzzles cooperativos contra tus propias grabaciones (src/eco/), independiente de Wikipedia.
initEco(toMenu);
$('#bEco').onclick = e => { e.target.blur(); openEco(); };
// Arena: duelo 1 contra 1 con terreno destructible, contra la compu o en línea (src/arena/).
initArena(toMenu);
$('#bArena').onclick = e => { e.target.blur(); openArena(); };

addEventListener('keydown', e => {
  const keys = state.keys;
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (S.mode === 'eco' || S.mode === 'arena') return;   // Ecos y Arena manejan sus propias teclas
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && S.mode !== 'menu') e.preventDefault();
  if (e.code === 'Escape') { if (S.mode === 'pause') { hideMsg(); S.mode = 'play'; } else pause(); return; }
  if (e.code === 'KeyH') { toggleHelp(); return; }
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
  if (S.mode === 'eco') ecoFrame(dt);
  if (S.mode === 'arena') arenaFrame(dt);
  if (S.mode === 'play' && state.L && state.p) update(dt);
  if (state.L && state.p) draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
