#!/usr/bin/env node
// Builds KIP's radio loop (spec 2026-10-15 §0, §8.2; P3 ruling 15): 20 seconds of quiet lo-fi in A minor at 72 bpm
// (6 bars, so it loops seamlessly: every voice is silent at a bar line), mono, encoded to AAC at 64 kb/s by macOS
// `afconvert` (about 160 KB, under the 300 KB budget). Deterministic: the same audio every run (only the m4a's
// creation time differs). An original tune, synthesised here: no samples. Logs its length and size only.
// Run from mobile/: node scripts/make-radio-loop.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const RATE = 22050;
const BEAT = 60 / 72;
const BARS = 6;
const SECONDS = BARS * 4 * BEAT; // 20 s
const N = Math.round(SECONDS * RATE);
const OUT = join(process.cwd(), 'assets/sounds/radio-loop.m4a');

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// Am7, Fmaj7, Cmaj7, G6, Am7, Fmaj7: the last bar leads back to the first.
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 64], [57, 60, 64, 67], [53, 57, 60, 64]];
const ROOTS = [45, 41, 36, 43, 45, 41];
const SCALE = [69, 72, 74, 76, 79, 81]; // A minor pentatonic, high and soft

let seed = 7;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const mix = new Float32Array(N);
const add = (start, dur, f) => {
  const a = Math.max(0, Math.floor(start * RATE));
  const b = Math.min(N, Math.floor((start + dur) * RATE));
  for (let i = a; i < b; i++) mix[i] += f((i - a) / RATE, (i - a) / (b - a));
};
const tri = (x) => 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1;

for (let bar = 0; bar < BARS; bar++) {
  const t0 = bar * 4 * BEAT;
  // The pad: each chord tone a sine that swells in and out over its bar (silent at both bar lines).
  for (const note of CHORDS[bar]) add(t0, 4 * BEAT, (t, u) => 0.06 * Math.sin(2 * Math.PI * hz(note) * t) * Math.sin(Math.PI * u));
  // The bass on beats 1 and 3, fading out before the next.
  for (const beat of [0, 2]) add(t0 + beat * BEAT, 1.5 * BEAT, (t, u) => 0.12 * tri(hz(ROOTS[bar]) * t) * (1 - u) * Math.min(1, t * 200));
  // A brushed hat on the off-beats.
  for (let e = 1; e < 8; e += 2) add(t0 + (e * BEAT) / 2, 0.06, (_t, u) => 0.03 * (rand() * 2 - 1) * (1 - u));
  // A few plucked melody notes, each gone before the bar line.
  for (let e = 0; e < 7; e++) {
    if (rand() >= 0.35) continue;
    const note = SCALE[Math.floor(rand() * SCALE.length)];
    add(t0 + (e * BEAT) / 2, BEAT / 2, (t, u) => 0.05 * Math.sin(2 * Math.PI * hz(note) * t) * Math.exp(-6 * t) * Math.min(1, t * 300) * (1 - u));
  }
}
// Vinyl crackle: rare, tiny clicks.
for (let i = 0; i < N; i++) if (rand() < 0.0006) mix[i] += (rand() - 0.5) * 0.08;
// A one-pole low-pass for warmth, run twice round the loop so its start and end agree.
let y = 0;
for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { y += 0.18 * (mix[i] - y); if (pass === 1) mix[i] = y; }

const peak = mix.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
const wav = Buffer.alloc(44 + N * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + N * 2, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) wav.writeInt16LE(Math.round((mix[i] / peak) * 0.5 * 32767), 44 + i * 2);

const tmp = mkdtempSync(join(tmpdir(), 'kip-radio-'));
const src = join(tmp, 'radio-loop.wav');
writeFileSync(src, wav);
mkdirSync(dirname(OUT), { recursive: true });
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', '-c', '1', src, OUT]);
rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ event: 'radio.loop', seconds: Number(SECONDS.toFixed(2)), bytes: statSync(OUT).size }));
