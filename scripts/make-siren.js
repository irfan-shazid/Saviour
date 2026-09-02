/**
 * Generates assets/siren.wav — the audible alarm played during the
 * "Are you OK?" countdown.
 *
 * Synthesised rather than sourced so the asset is licence-free and
 * reproducible. Run with:  node scripts/make-siren.js
 *
 * Design: a classic two-tone emergency sweep. Four 500 ms tones over
 * exactly 2 s, so the file loops seamlessly, with a 12 ms attack/release
 * on each tone to avoid the click you get from cutting a sine mid-cycle.
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const DURATION = 2.0; // seconds — one full loop
const TONES = [800, 1000, 800, 1000]; // Hz
const TONE_LEN = DURATION / TONES.length;
const EDGE = 0.012; // seconds of fade at each tone boundary
const AMPLITUDE = 0.72; // headroom so the mix never clips

const total = Math.floor(SAMPLE_RATE * DURATION);
const pcm = Buffer.alloc(total * 2);

for (let i = 0; i < total; i++) {
  const t = i / SAMPLE_RATE;
  const toneIndex = Math.min(TONES.length - 1, Math.floor(t / TONE_LEN));
  const freq = TONES[toneIndex];
  const tInTone = t - toneIndex * TONE_LEN;

  // Attack/release envelope so tone edges don't click.
  let env = 1;
  if (tInTone < EDGE) env = tInTone / EDGE;
  else if (tInTone > TONE_LEN - EDGE) env = (TONE_LEN - tInTone) / EDGE;

  // Carrier plus a quiet octave, which reads as more urgent than a pure sine.
  const carrier = Math.sin(2 * Math.PI * freq * tInTone);
  const octave = 0.25 * Math.sin(4 * Math.PI * freq * tInTone);
  const sample = AMPLITUDE * env * (carrier + octave) * 0.8;

  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), i * 2);
}

/** Minimal 44-byte canonical WAV header for 16-bit mono PCM. */
function wavHeader(dataLength) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + dataLength, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); // PCM chunk size
  h.writeUInt16LE(1, 20); // format = PCM
  h.writeUInt16LE(1, 22); // channels
  h.writeUInt32LE(SAMPLE_RATE, 24);
  h.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write('data', 36);
  h.writeUInt32LE(dataLength, 40);
  return h;
}

const out = path.join(__dirname, '..', 'assets', 'siren.wav');
fs.writeFileSync(out, Buffer.concat([wavHeader(pcm.length), pcm]));
console.log(`Wrote ${out} (${(pcm.length / 1024).toFixed(0)} KB PCM)`);
