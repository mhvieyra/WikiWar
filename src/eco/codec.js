// Codificacion compacta de una solucion (lista de ciclos, cada uno un array de
// entradas enteras por tick). Sirve para guardar soluciones de referencia y
// para el "codigo de repeticion" que se comparte con otras personas.
//
// Formato: RLE de pares (valor, repeticiones) como enteros de longitud variable,
// los ciclos separados por un 0 de longitud de ciclo, todo en base64 seguro para URL.

function pushVar(out, n) { while (n >= 128) { out.push((n & 127) | 128); n >>>= 7; } out.push(n); }
function readVar(bytes, pos) { let n = 0, shift = 0, b; do { b = bytes[pos.i++]; n |= (b & 127) << shift; shift += 7; } while (b & 128); return n >>> 0; }

export function packRuns(runs) {
  const out = [];
  pushVar(out, runs.length);
  for (const log of runs) {
    const pairs = [];
    for (let i = 0; i < log.length;) { let j = i; while (j < log.length && log[j] === log[i]) j++; pairs.push([log[i], j - i]); i = j; }
    pushVar(out, pairs.length);
    for (const [v, n] of pairs) { pushVar(out, v); pushVar(out, n); }
  }
  return out;
}
export function unpackRuns(bytes) {
  const pos = { i: 0 }, runs = [], n = readVar(bytes, pos);
  if (n > 64) throw new Error('demasiados ciclos');
  for (let r = 0; r < n; r++) {
    const pairs = readVar(bytes, pos), log = [];
    if (pairs > 100000) throw new Error('grabacion invalida');
    for (let k = 0; k < pairs; k++) { const v = readVar(bytes, pos), c = readVar(bytes, pos); if (log.length + c > 20000) throw new Error('grabacion demasiado larga'); for (let q = 0; q < c; q++) log.push(v); }
    runs.push(log);
  }
  return runs;
}

const b64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Array.from(s, c => c.charCodeAt(0)); };

// codigo de repeticion: ECO1-<nivel>-<datos>
export function encodeShare(levelId, runs) { return 'ECO1-' + levelId + '-' + b64(packRuns(runs)); }
export function decodeShare(code) {
  const m = /^ECO1-(\d+)-([A-Za-z0-9_-]+)$/.exec((code || '').trim());
  if (!m) throw new Error('El código no tiene el formato esperado');
  return { levelId: +m[1], runs: unpackRuns(unb64(m[2])) };
}
