// Todo lo que habla con la API de Wikipedia y arma el nivel jugable a
// partir del HTML de un articulo: cada palabra se envuelve en un span (una
// plataforma rompible), los links se convierten en portales, y measure()
// mide la posicion real de cada span en el DOM con getBoundingClientRect.
import { MAXH, REMOVE, STOP, RS } from './config.js';
import { S, state } from './state.js';
import { $, norm } from './utils.js';
import { initCraters } from './craters.js';

async function api(params) {
  const q = new URLSearchParams(Object.assign({ format: 'json', formatversion: '2', origin: '*' }, params));
  const r = await fetch('https://' + S.lang + '.wikipedia.org/w/api.php?' + q);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function fetchParse(title) {
  const j = await api({ action: 'parse', page: title, prop: 'text', redirects: '1', disableeditsection: '1', disabletoc: '1' });
  if (j.error) throw new Error(j.error.info || 'error');
  return { title: j.parse.title, html: j.parse.text };
}

export async function fetchInfo(title) {
  async function q(t) {
    const j = await api({ action: 'query', titles: t, redirects: '1', prop: 'extracts|pageimages', exintro: '1', explaintext: '1', exsentences: '2', piprop: 'thumbnail', pithumbsize: '160' });
    const pg = j.query && j.query.pages && j.query.pages[0];
    if (!pg || pg.missing || pg.invalid) return null;
    return { title: pg.title, extract: pg.extract || '', thumb: pg.thumbnail ? pg.thumbnail.source : '' };
  }
  let r = await q(title);
  if (r) return r;
  const o = await api({ action: 'opensearch', search: title, limit: '1', namespace: '0' });
  if (Array.isArray(o) && o[1] && o[1][0]) return q(o[1][0]);
  return null;
}

export function buildDOM(data) {
  const doc = new DOMParser().parseFromString(data.html, 'text/html');
  const root = doc.querySelector('.mw-parser-output') || doc.body;
  root.querySelectorAll(REMOVE).forEach(n => n.remove());
  for (const h of root.querySelectorAll('h2')) {
    if (STOP.has((h.id || '').toLowerCase())) {
      let start = h.closest('.mw-heading') || h;
      while (start.parentNode && start.parentNode !== root) start = start.parentNode;
      let n = start;
      while (n) { const nx = n.nextSibling; n.remove(); n = nx; }
      break;
    }
  }
  root.querySelectorAll('table').forEach(t => { if (!t.classList.contains('infobox')) t.remove(); });
  root.querySelectorAll('[style]').forEach(n => n.removeAttribute('style'));
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    let t = null;
    if (href.startsWith('/wiki/')) {
      const raw = href.slice(6).split('#')[0];
      let dec; try { dec = decodeURIComponent(raw); } catch (e) { dec = raw; }
      if (dec && !dec.includes(':')) t = dec.replace(/_/g, ' ');
    }
    if (t) { a.className = 'wl'; a.dataset.t = t; a.removeAttribute('href'); a.removeAttribute('title'); }
    else { while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a); a.remove(); }
  });
  root.querySelectorAll('img').forEach(im => {
    let s = im.getAttribute('src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    im.setAttribute('src', s); im.removeAttribute('srcset'); im.removeAttribute('loading');
    const w = +im.getAttribute('width'), h = +im.getAttribute('height');
    if (w && h && (w < 24 || h < 24)) { im.remove(); return; }
    if (w > 260) { im.setAttribute('width', 260); im.setAttribute('height', Math.round(h * 260 / w)); }
  });

  const c = $('#content');
  c.innerHTML = '';
  const h1 = document.createElement('h1'); h1.className = 't'; h1.textContent = data.title; c.appendChild(h1);
  const wrap = document.adoptNode(root); c.appendChild(wrap);

  // limitar el alto del nivel
  const cr = c.getBoundingClientRect(), kids = [...wrap.children];
  for (let i = 3; i < kids.length; i++) {
    if (kids[i].getBoundingClientRect().bottom - cr.top > MAXH) { for (let j = kids.length - 1; j >= i; j--) kids[j].remove(); break; }
  }

  // envolver cada palabra en un span (cada palabra es una plataforma)
  const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT), nodes = [];
  while (tw.nextNode()) nodes.push(tw.currentNode);
  for (const n of nodes) {
    const txt = n.nodeValue;
    if (!/\S/.test(txt)) continue;
    const frag = document.createDocumentFragment();
    for (const part of txt.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
      else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s); }
    }
    n.parentNode.replaceChild(frag, n);
  }
}

export function buildLevel() {
  const plats = [], byAnchor = new Map();
  document.querySelectorAll('#content .w').forEach(el => {
    const a = el.closest('a.wl');
    const pl = { el, kind: 'word', x: 0, y: 0, w: 0, h: 0, hp: 1, maxhp: 1, alive: true, link: a ? a.dataset.t : null, a, deadAt: 0 };
    plats.push(pl);
    if (a) { if (!byAnchor.has(a)) byAnchor.set(a, []); byAnchor.get(a).push(pl); }
  });
  document.querySelectorAll('#content img').forEach(el => {
    plats.push({ el, kind: 'img', x: 0, y: 0, w: 0, h: 0, hp: 6, maxhp: 6, alive: true, link: null, a: null, deadAt: 0 });
  });
  const t1 = S.toNorm2, t2 = norm(S.toCanon);
  const targetPlats = plats.filter(pl => pl.link && (norm(pl.link) === t2 || norm(pl.link) === t1));
  const L = { plats, byAnchor, targetPlats, top: new Map(), full: new Map(), destroyed: [], h: 0, floorY: 0, spawn: { x: state.W / 2, y: 120 } };
  initCraters(L);
  return L;
}

export function measure() {
  const L = state.L;
  if (!L) return;
  const cr = $('#page').getBoundingClientRect();
  for (const pl of L.plats) {
    const r = pl.el.getBoundingClientRect();
    pl.x = r.left - cr.left; pl.y = r.top - cr.top; pl.w = r.width; pl.h = r.height;
  }
  L.h = $('#page').offsetHeight;
  L.floorY = L.h - 130;
  L.top = new Map(); L.full = new Map();
  const add = (m, r, pl) => { let a = m.get(r); if (!a) { a = []; m.set(r, a); } a.push(pl); };
  for (const pl of L.plats) {
    add(L.top, Math.floor(pl.y / RS), pl);
    for (let r = Math.floor(pl.y / RS), r1 = Math.floor((pl.y + pl.h) / RS); r <= r1; r++) add(L.full, r, pl);
  }
  const first = L.plats.find(pl => pl.kind === 'word');
  if (first) L.spawn = { x: first.x + first.w / 2, y: first.y };
}
