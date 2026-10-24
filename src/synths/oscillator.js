// synths/oscillator.js — Família A: osciladores e drones.
// A intensidade vocal controla continuamente o brilho (cutoff do filtro)
// e a amplitude do drone.

import { SynthBase } from '../synth-base.js';

const WAVEFORMS = ['sine', 'triangle', 'sawtooth', 'square'];

export class OscillatorSynth extends SynthBase {
  constructor(ctx) {
    super(ctx);
    this.params = {
      waveform: 'sawtooth',
      frequency: 110,
      filterCutoff: 1200,
      response: 0.8,     // peso da voz no brilho/amplitude
      volume: 0.5,
    };
    this._nodes = null;
  }

  _start() {
    const ctx = this.ctx;
    const nodes = {
      oscs: [],
      filter: ctx.createBiquadFilter(),
      lfo: ctx.createOscillator(),
      lfoGain: ctx.createGain(),
      level: ctx.createGain(),
    };
    nodes.filter.type = 'lowpass';
    nodes.filter.Q.value = 4;
    nodes.lfo.frequency.value = 0.3;
    nodes.lfoGain.gain.value = 3;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = this.params.waveform;
      osc.connect(nodes.filter);
      osc.start();
      nodes.oscs.push(osc);
    }
    nodes.lfo.connect(nodes.lfoGain).connect(nodes.filter.frequency);
    nodes.filter.connect(nodes.level).connect(this.output);
    nodes.lfo.start();
    this._nodes = nodes;
    this._applyParams();
  }

  _applyParams() {
    const p = this.params;
    if (!this._nodes) return;
    if (!WAVEFORMS.includes(p.waveform)) p.waveform = 'sawtooth';
    const now = this.ctx.currentTime;
    const ramp = (param, v) => param.setTargetAtTime(v, now, 0.03);
    this._nodes.oscs.forEach((osc, i) => {
      osc.type = p.waveform;
      ramp(osc.frequency, p.frequency * (i === 1 ? 1.005 : i === 2 ? 0.5 : 1));
    });
    ramp(this._nodes.filter.frequency, p.filterCutoff);
  }

  _applyLevel(level, gate) {
    if (!this._nodes) return;
    const p = this.params;
    const now = this.ctx.currentTime;
    const amp = (gate ? level * p.response : 0.15) * p.volume;
    this._nodes.level.gain.setTargetAtTime(amp * 0.5, now, 0.05);
    const cutoff = p.filterCutoff * (1 + level * p.response * 3);
    this._nodes.filter.frequency.setTargetAtTime(Math.min(12000, cutoff), now, 0.06);
  }

  _stop() {
    const n = this._nodes;
    if (!n) return;
    const now = this.ctx.currentTime;
    n.level.gain.setTargetAtTime(0, now, 0.05);
    setTimeout(() => {
      n.oscs.forEach((o) => { try { o.stop(); o.disconnect(); } catch {} });
      try { n.lfo.stop(); n.lfo.disconnect(); } catch {}
      n.lfoGain.disconnect();
      n.filter.disconnect();
      n.level.disconnect();
    }, 200);
    this._nodes = null;
  }
}
