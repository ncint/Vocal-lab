// synths/percussive.js — Família C: sons sintéticos curtos com envelope.
// A voz dispara percussões (com intervalo mínimo para evitar instabilidade)
// e a intensidade controla a força e o tom do disparo.

import { SynthBase } from '../synth-base.js';

export class PercussiveSynth extends SynthBase {
  constructor(ctx) {
    super(ctx);
    this.params = {
      timbre: 'metal',       // metal | wood | membrane
      resonance: 220,        // frequência de ressonância
      attack: 0.005,
      decay: 0.35,
      sensitivity: 0.25,      // limiar de disparo
      volume: 0.5,
    };
    this._lastTrigger = 0;
    this._minInterval = 0.12;
  }

  setVoiceLevel(level, gate) {
    super.setVoiceLevel(level, gate);
    const now = this.ctx.currentTime;
    if (!gate || level < this.params.sensitivity) return;
    if (now - this._lastTrigger < this._minInterval) return;
    this._lastTrigger = now;
    this._trigger(level, now);
  }

  _trigger(level, when) {
    const ctx = this.ctx;
    const p = this.params;
    const strength = Math.min(1, level);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    let freq = p.resonance;
    let type = 'triangle';
    if (p.timbre === 'metal') { type = 'square'; freq *= 1 + strength * 2.5; }
    else if (p.timbre === 'wood') { type = 'sine'; freq *= 1.4; }
    osc.type = type;
    osc.frequency.setValueAtTime(freq * (1 + strength), when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.5), when + p.decay);

    const peak = strength * p.volume;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + p.attack);
    gain.gain.exponentialRampToValueAtTime(0.001, when + p.attack + p.decay);

    osc.connect(gain).connect(this.output);
    osc.start(when);
    osc.stop(when + p.attack + p.decay + 0.05);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  _applyParams() {
    this._minInterval = Math.max(0.08, this.params.decay * 0.4);
  }
}
