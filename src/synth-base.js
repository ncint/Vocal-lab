// synth-base.js — interface comum das famílias sonoras.
// Cada família implementa: setParams, setVoiceLevel, start, stop, dispose.
// A voz NUNCA é ligada à saída; o motor recebe apenas o nível de controlo.

export class SynthBase {
  constructor(ctx) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.running = false;
    this.params = {};
  }

  setParams(params) {
    Object.assign(this.params, params);
    this._applyParams();
  }

  setVoiceLevel(level, gate) {
    this.voiceLevel = level;
    this.voiceGate = gate;
    this._applyLevel(level, gate);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._start();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this._stop();
  }

  dispose() {
    this.stop();
    this.output.disconnect();
  }

  _applyParams() {}
  _applyLevel() {}
  _start() {}
  _stop() {}
}
