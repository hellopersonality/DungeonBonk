// Synthesized sound effects (WebAudio). No audio files: every sound is built from
// oscillators and filtered noise, so tweaking a sound means editing a line below.
import { S } from './state.js';

let AC = null, master = null, noiseBuf = null;

export function initAudio() {
  if (AC) { try { AC.resume(); } catch (_) {} return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0.45;
    master.connect(AC.destination);
  } catch (_) { AC = null; }
}

function tone(type, f0, f1, dur, vol, delay) {
  if (!AC || S.muted || vol <= 0.001) return;
  const t = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function nz(dur, vol, ftype, f0, f1, q, delay) {
  if (!AC || S.muted || vol <= 0.001) return;
  const t = AC.currentTime + (delay || 0);
  if (!noiseBuf) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = AC.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = AC.createBiquadFilter(); f.type = ftype; f.Q.value = q || 1;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

/** Distance attenuation: 1 up close, 0 at 24 units. */
export const av = d => Math.max(0, Math.min(1, 1 - d / 24));

let emberPitch = 0, emberPitchT = 0;

export const sfx = {
  swing() { nz(0.13, 0.22, 'bandpass', 2200, 500, 1.3); },
  hit(crit) {
    tone('sine', 170, 55, 0.13, 0.45); nz(0.05, 0.25, 'highpass', 2200, 1800, 0.7);
    if (crit) { tone('triangle', 880, 1400, 0.2, 0.16); tone('square', 1760, 1760, 0.07, 0.04, 0.02); }
  },
  kill() { tone('sawtooth', 220, 40, 0.35, 0.2); nz(0.3, 0.22, 'lowpass', 1400, 200, 0.8); },
  hurt() { tone('square', 150, 70, 0.22, 0.25); nz(0.16, 0.3, 'lowpass', 900, 250, 1); },
  dash() { nz(0.22, 0.28, 'bandpass', 500, 2800, 0.9); },
  windup(type, dur, v) {
    if (v <= 0) return;
    if (type === 'husk') tone('sawtooth', 65, 150, dur, 0.13 * v);
    else if (type === 'skitter') { for (let i = 0; i < 6; i++) tone('square', 1300 + i * 180, 1100 + i * 180, 0.03, 0.05 * v, i * dur / 6); }
    else if (type === 'spitter') { tone('sine', 180, 560, dur, 0.16 * v); nz(dur, 0.08 * v, 'bandpass', 300, 900, 4); }
    else { tone('sawtooth', 42, 115, dur, 0.24 * v); tone('square', 85, 230, dur, 0.05 * v); }
  },
  slam(v) { tone('sine', 95, 30, 0.42, 0.55 * v); nz(0.35, 0.35 * v, 'lowpass', 700, 80, 0.7); },
  lunge(v) { nz(0.18, 0.22 * v, 'highpass', 3200, 1500, 1); },
  spit(v) { nz(0.15, 0.22 * v, 'bandpass', 500, 1600, 3); tone('sine', 300, 900, 0.12, 0.1 * v); },
  splat(v) { nz(0.22, 0.28 * v, 'lowpass', 900, 180, 1); },
  ember() {
    if (S.clock - emberPitchT > 0.4) emberPitch = 0;
    emberPitchT = S.clock; emberPitch = Math.min(emberPitch + 60, 900);
    tone('triangle', 800 + emberPitch, 1200 + emberPitch, 0.06, 0.05);
  },
  flask() { tone('sine', 660, 990, 0.15, 0.16); tone('sine', 990, 1320, 0.2, 0.1, 0.08); },
  drink() { for (let i = 0; i < 3; i++) tone('sine', 320, 170, 0.09, 0.13, i * 0.14); },
  heal() { tone('triangle', 520, 780, 0.25, 0.13); tone('triangle', 780, 1040, 0.3, 0.09, 0.1); },
  rest() { [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, f * 1.001, 1.3, 0.07, i * 0.09)); },
  save() { tone('square', 220, 200, 0.08, 0.18); nz(0.25, 0.22, 'highpass', 3000, 5000, 1); tone('triangle', 1760, 1760, 0.7, 0.05, 0.02); },
  boon() { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.14, 0.05, i * 0.07)); },
  altar() { tone('sine', 220, 440, 0.6, 0.08); tone('sine', 330, 660, 0.6, 0.05, 0.1); },
  forge() { tone('square', 220, 200, 0.08, 0.18); nz(0.25, 0.22, 'highpass', 3000, 5000, 1); tone('triangle', 1760, 1760, 0.7, 0.05, 0.02); },
  death() { tone('sawtooth', 300, 40, 1.4, 0.22); nz(1.2, 0.15, 'lowpass', 600, 100, 1); },
  roar() { tone('sawtooth', 62, 38, 1.1, 0.35); nz(1.0, 0.28, 'lowpass', 500, 180, 1); },
  gate() { nz(1.2, 0.22, 'lowpass', 320, 140, 1); tone('sine', 52, 44, 1.2, 0.22); },
  explode(v) { tone('sine', 130, 30, 0.45, 0.45 * v); nz(0.42, 0.4 * v, 'lowpass', 2200, 150, 0.8); },
  wave() { nz(0.28, 0.18, 'bandpass', 1500, 400, 2); tone('triangle', 600, 300, 0.2, 0.06); },
  riposte() { tone('triangle', 1320, 1980, 0.22, 0.14); tone('triangle', 1980, 2640, 0.2, 0.08, 0.06); },
  burn(v) { nz(0.08, 0.06 * v, 'highpass', 2500, 3500, 1); },
  ui() { tone('triangle', 700, 900, 0.06, 0.06); },
};
