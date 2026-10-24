// envelope-follower.js — análise de intensidade por canal (RMS) com suavização,
// sensibilidade, limiar e calibração. Não gera som: apenas controlo.

export class EnvelopeFollower {
  constructor(audioContext, sourceNode) {
    this.ctx = audioContext;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    sourceNode.connect(this.analyser);
    // NOTA: o analyser não é ligado a destination; o sinal vocal morre aqui.
    this.buf = new Float32Array(this.analyser.fftSize);

    this.rawRms = 0;
    this.level = 0;          // 0..1 suavizado
    this.gate = 0;           // 0/1 após limiar
    this.settings = {
      sensitivity: 1.0,       // multiplicador
      threshold: 0.02,       // limiar RMS
      attack: 0.05,          // segundos (subida)
      release: 0.25,         // segundos (descida)
    };
  }

  setSettings(partial) {
    Object.assign(this.settings, partial);
  }

  calibrate(seconds = 2) {
    this._calibSamples = Math.ceil(seconds * this.ctx.sampleRate / this.analyser.fftSize);
    this._calibMax = 0;
  }

  update(dt) {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
    this.rawRms = Math.sqrt(sum / this.buf.length);

    if (this._calibSamples > 0) {
      this._calibMax = Math.max(this._calibMax, this.rawRms);
      this._calibSamples--;
      if (this._calibSamples === 0 && this._calibMax > 0) {
        this.settings.sensitivity = Math.min(50, 0.9 / this._calibMax);
        return true;
      }
      return false;
    }

    const target = Math.min(1, this.rawRms * this.settings.sensitivity);
    const tau = target > this.level ? this.settings.attack : this.settings.release;
    const coeff = tau <= 0 ? 1 : Math.exp(-dt / tau);
    this.level = target + (this.level - target) * coeff;
    this.gate = this.rawRms >= this.settings.threshold ? 1 : 0;
    return false;
  }
}
