// Multijugador de la Arena. Como la simulacion es determinista, los dos
// navegadores solo se intercambian las ENTRADAS de cada tick (lockstep con
// retraso de entrada) y comparan un hash del estado cada medio segundo para
// detectar desincronizaciones. No hace falta servidor de partida.
//
// Transportes:
//  - WebRTC (RTCDataChannel) con "codigos" que se copian y pegan entre los dos
//    jugadores, sin servidor de senalizacion. Usa un STUN publico de Google
//    para atravesar routers; con algunos NAT simetricos puede no conectar.
//  - BroadcastChannel para dos pestanas del mismo navegador (sirve para probar).

/* --------------------------------------------------------------- codigos */
const b64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function pipe(bytes, stream) { const s = new Blob([bytes]).stream().pipeThrough(stream); return new Uint8Array(await new Response(s).arrayBuffer()); }
export async function packSdp(desc) {
  const raw = new TextEncoder().encode(JSON.stringify({ t: desc.type, s: desc.sdp }));
  if (typeof CompressionStream === 'undefined') return 'ARN0-' + b64(raw);
  return 'ARN1-' + b64(await pipe(raw, new CompressionStream('deflate-raw')));
}
export async function unpackSdp(code) {
  const m = /^ARN([01])-([A-Za-z0-9_-]+)$/.exec((code || '').trim());
  if (!m) throw new Error('El código no es válido');
  let bytes = unb64(m[2]);
  if (m[1] === '1') { if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede leer el código'); bytes = await pipe(bytes, new DecompressionStream('deflate-raw')); }
  const o = JSON.parse(new TextDecoder().decode(bytes));
  return { type: o.t, sdp: o.s };
}

/* ------------------------------------------------------------- WebRTC */
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
function gathered(pc, ms = 5000) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { pc.removeEventListener('icegatheringstatechange', on); clearTimeout(t); res(); };
    const on = () => { if (pc.iceGatheringState === 'complete') done(); };
    const t = setTimeout(done, ms);
    pc.addEventListener('icegatheringstatechange', on);
  });
}
function wrapChannel(dc, pc) {
  const t = { onmessage: null, onclose: null, send: s => { if (dc.readyState === 'open') dc.send(s); }, close: () => { try { dc.close(); pc.close(); } catch (e) { /* ya cerrado */ } }, open: dc.readyState === 'open' };
  dc.onmessage = e => t.onmessage && t.onmessage(e.data);
  dc.onclose = () => { t.onclose && t.onclose(); };
  t.ready = new Promise((res, rej) => { if (dc.readyState === 'open') res(t); else { dc.onopen = () => res(t); pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') rej(new Error('No se pudo conectar (¿firewall o NAT?)')); }; } });
  return t;
}
// Anfitrion: devuelve el codigo a compartir y una funcion para aceptar la respuesta.
export async function hostOffer() {
  const pc = new RTCPeerConnection(ICE), dc = pc.createDataChannel('arena');
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const transport = wrapChannel(dc, pc);
  return { code: await packSdp(pc.localDescription), transport: transport.ready, accept: async answerCode => { await pc.setRemoteDescription(await unpackSdp(answerCode)); } };
}
// Invitado: recibe el codigo del anfitrion y devuelve su respuesta.
export async function guestAnswer(offerCode) {
  const pc = new RTCPeerConnection(ICE);
  const ready = new Promise((res, rej) => { pc.ondatachannel = e => { const t = wrapChannel(e.channel, pc); t.ready.then(res, rej); }; });
  await pc.setRemoteDescription(await unpackSdp(offerCode));
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  return { code: await packSdp(pc.localDescription), transport: ready };
}

/* ------------------------------------------------- dos pestanas (misma PC) */
// Los dos lados anuncian un id al azar; el de id menor es el anfitrion.
export function localRoom(room) {
  const ch = new BroadcastChannel('wikiwar-arena-' + room), me = Math.random().toString(36).slice(2), t = { onmessage: null, onclose: null, send: s => ch.postMessage({ from: me, s }), close: () => ch.close(), open: true };
  return new Promise(resolve => {
    let peer = null;
    ch.onmessage = e => {
      const d = e.data; if (!d || d.from === me) return;
      if (d.hello) { if (!peer) { peer = d.from; ch.postMessage({ from: me, hello: me }); resolve({ transport: t, host: me < peer }); } return; }
      if (d.from === peer && t.onmessage) t.onmessage(d.s);
    };
    const iv = setInterval(() => { if (peer) return clearInterval(iv); ch.postMessage({ from: me, hello: me }); }, 400);
  });
}

/* ----------------------------------------------------------- lockstep */
// Sincroniza dos simulaciones. `delay` es el retraso de entrada en ticks: cada
// lado manda su entrada del tick T+delay cuando va por el tick T.
export class Lockstep {
  constructor(transport, me, delay = 6) {
    this.t = transport; this.me = me; this.delay = delay; this.next = 0; this.sent = -1;
    this.inputs = [new Map(), new Map()]; this.hashes = new Map(); this.remoteHashes = new Map();
    this.desync = false; this.closed = false; this.lastRecv = performance.now(); this.rtt = 0;
    for (let t = 0; t < delay; t++) { this.inputs[0].set(t, 0); this.inputs[1].set(t, 0); }
    this.sent = delay - 1;
    transport.onmessage = s => this.recv(s);
    transport.onclose = () => { this.closed = true; };
  }
  recv(s) {
    this.lastRecv = performance.now();
    let m; try { m = JSON.parse(s); } catch (e) { return; }
    if (m.k === 'i') this.inputs[1 - this.me].set(m.t, m.m | 0);
    else if (m.k === 'h') this.remoteHashes.set(m.t, m.v);
    else if (m.k === 'ping') this.t.send(JSON.stringify({ k: 'pong', c: m.c }));
    else if (m.k === 'pong') this.rtt = performance.now() - m.c;
    else if (m.k === 'bye') this.closed = true;
    else if (this.onother) this.onother(m);
  }
  // Pone en cola la entrada local hasta el tick next+delay (una sola vez por tick).
  feed(sample) {
    while (this.sent < this.next + this.delay - 1) {
      this.sent++;
      const m = sample(); this.inputs[this.me].set(this.sent, m);
      this.t.send(JSON.stringify({ k: 'i', t: this.sent, m }));
    }
  }
  ready() { return this.inputs[0].has(this.next) && this.inputs[1].has(this.next); }
  take() { const a = [this.inputs[0].get(this.next), this.inputs[1].get(this.next)]; this.inputs[0].delete(this.next); this.inputs[1].delete(this.next); this.next++; return a; }
  // Cada 30 ticks se intercambian hashes; devuelve true si detecta que divergieron.
  checkHash(tick, hash) {
    if (tick % 30 !== 0) return false;
    this.hashes.set(tick, hash); this.t.send(JSON.stringify({ k: 'h', t: tick, v: hash }));
    for (const [t, v] of this.remoteHashes) { if (this.hashes.has(t) && this.hashes.get(t) !== v) { this.desync = true; } if (this.hashes.has(t)) { this.hashes.delete(t); this.remoteHashes.delete(t); } }
    return this.desync;
  }
  ping() { this.t.send(JSON.stringify({ k: 'ping', c: performance.now() })); }
  close() { try { this.t.send(JSON.stringify({ k: 'bye' })); } catch (e) { /* nada */ } this.t.close(); this.closed = true; }
}
