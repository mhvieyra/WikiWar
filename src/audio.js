// Sonido. Hoy todo son beeps sintetizados (osciladores Web Audio), igual
// que en la version original. playSfx() ya esta listo para el dia que haya
// archivos reales en public/sounds/<key>.mp3 (o .ogg): si el archivo carga
// bien lo reproduce, si no existe (404 -> error) usa el beep sintetizado
// como fallback, sin que el resto del juego tenga que cambiar nada.

let actx = null;
export let muted = false;
export function toggleMuted() { muted = !muted; return muted; }

function getCtx() {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}

export function beep(freq, dur, type, vol, slide) {
  if (muted) return;
  try {
    const c = getCtx(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol || .04, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur);
  } catch (e) {}
}

export function boom(vol) {
  if (muted) return;
  try {
    const c = getCtx();
    const len = c.sampleRate * .45, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = vol || .25; s.connect(g); g.connect(c.destination); s.start();
  } catch (e) {}
}

// Jetpack: un ruido grave y continuo (ruido blanco filtrado) que se enciende
// y apaga con un fundido corto. Volumen bajo a proposito.
let jet = null;
export function jetSound(on) {
  if (muted && !jet) return;
  try {
    const c = getCtx();
    if (!jet) {
      if (!on) return;
      const len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; src.loop = true; lp.type = 'lowpass'; lp.frequency.value = 500; g.gain.value = 0;
      src.connect(lp); lp.connect(g); g.connect(c.destination); src.start();
      jet = { g };
    }
    jet.g.gain.setTargetAtTime(on && !muted ? .05 : 0, c.currentTime, .06);
  } catch (e) {}
}

// registro de archivos de audio: se intenta cargar una vez por clave y se
// recuerda si existe o no. Mientras no haya archivos en public/sounds/,
// SFX[key].ok queda en false para siempre y playSfx cae al beep.
const SFX = Object.create(null);
const EXTS = ['mp3', 'ogg'];

function registerSfx(key) {
  const entry = { el: null, ok: false };
  SFX[key] = entry;
  (async () => {
    for (const ext of EXTS) {
      const ok = await new Promise(resolve => {
        const el = new Audio();
        el.oncanplaythrough = () => resolve(true);
        el.onerror = () => resolve(false);
        el.src = `/sounds/${key}.${ext}`;
      });
      if (ok) { entry.el = new Audio(`/sounds/${key}.${ext}`); entry.ok = true; return; }
    }
  })();
  return entry;
}

export function playSfx(key, freq, dur, type, vol, slide) {
  if (muted) return;
  const entry = SFX[key] || registerSfx(key);
  if (entry.ok && entry.el) {
    try { const n = entry.el.cloneNode(); n.volume = clampVol(vol); n.play().catch(() => {}); }
    catch (e) { beep(freq, dur, type, vol, slide); }
  } else beep(freq, dur, type, vol, slide);
}

export function playBoomSfx(key, vol) {
  if (muted) return;
  const entry = SFX[key] || registerSfx(key);
  if (entry.ok && entry.el) {
    try { const n = entry.el.cloneNode(); n.volume = clampVol(vol); n.play().catch(() => {}); }
    catch (e) { boom(vol); }
  } else boom(vol);
}

function clampVol(v) { return Math.max(0, Math.min(1, v == null ? 1 : v)); }
