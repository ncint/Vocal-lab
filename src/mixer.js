// mixer.js — mistura final: bus → masterGain (inicia em silêncio) → limiter → analyser → destination.
// O silêncio geral é o masterGain a 0, independente dos volumes dos canais.

export class Mixer {
  constructor(ctx) {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0; // inicializa em silêncio
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 2;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.buf = new Float32Array(this.analyser.fftSize);

    this.bus.connect(this.masterGain).connect(this.limiter).connect(this.analyser).connect(ctx.destination);
    this.masterVolume = 0.8;
    this.muted = true;
  }

  setMasterVolume(v) {
    this.masterVolume = v;
    if (!this.muted) {
      this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime, 0.02);
  }

  getLevel() {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    return Math.sqrt(sum / this.buf.length);
  }
}
