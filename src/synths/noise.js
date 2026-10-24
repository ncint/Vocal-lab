// synths/noise.js — Família B: ruído filtrado e matéria sonora.
// A voz controla a abertura do filtro (cutoff) e a amplitude, com modulação.

import { SynthBase } from '../synth-base.js';

export class NoiseSynth extends SynthBase {
  constructor(ctx) {
    super(ctx);
    this.params = {
      color: 'white',
      cutoff: 400,
      resonance: 2,
      response: 0.8,
      volume: 0.5,
    };
    this._nodes = null;
  }

  _start() {
    const ctx = this.ctx;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      if (this.params.color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      } else if (this.params.color === 'pink') {
        last = 0.96 * last + 0.04 * w;
        data[i] = last * 2;
      } else {
        data[i] = w;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const level = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain).connect(filter.frequency);

    src.connect(filter).connect(level).connect(this.output);
    src.start();
    lfo.start();
    this._nodes = { src, filter, level, lfo, lfoGain };
    this._applyParams();
  }

  _applyParams() {
    const p = this.params;
    if (!this._nodes) return;
    const now = this.ctx.currentTime;
    this._nodes.filter.Q.setTargetAtTime(p.resonance, now, 0.03);
    this._nodes.filter.frequency.setTargetAtTime(p.cutoff, now, 0.05);
  }

  _applyLevel(level, gate) {
    if (!this._nodes) return;
    const p = this.params;
    const now = this.ctx.currentTime;
    const amp = (gate ? level : 0.05) * p.response * p.volume;
    this._nodes.level.gain.setTargetAtTime(amp * 0.6, now, 0.08);
    const cutoff = p.cutoff * (1 + level * 4);
    this._nodes.filter.frequency.setTargetAtTime(Math.min(10000, cutoff), now, 0.08);
  }

  _stop() {
    const n = this._nodes;
    if (!n) return;
    const now = this.ctx.currentTime;
    n.level.gain.setTargetAtTime(0, now, 0.05);
    setTimeout(() => {
      try { n.src.stop(); n.src.disconnect(); } catch {}
      try { n.lfo.stop(); n.lfo.disconnect(); } catch {}
      n.lfoGain.disconnect();
      n.filter.disconnect();
      n.level.disconnect();
    }, 200);
    this._nodes = null;
  }
}
