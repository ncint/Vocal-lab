// channel-processor.js — percurso de sinal de cada canal:
// fonte (canal do splitter) → analyser (intensidade) → motor sonoro → gain → mistura.
// A fonte vocal nunca é ligada a destination; só o motor sonoro produz som.

import { EnvelopeFollower } from './envelope-follower.js';
import { OscillatorSynth } from './synths/oscillator.js';
import { NoiseSynth } from './synths/noise.js';
import { PercussiveSynth } from './synths/percussive.js';

export const SYNTH_FAMILIES = {
  oscillator: { label: 'Osciladores / Drone', cls: OscillatorSynth },
  noise: { label: 'Ruído / Matéria', cls: NoiseSynth },
  percussive: { label: 'Percussivo / Ressonante', cls: PercussiveSynth },
};

export class ChannelProcessor {
  constructor(ctx, channelIndex, sourceNode, mixerBus) {
    this.ctx = ctx;
    this.index = channelIndex;
    this.source = sourceNode;
    this.envelope = new EnvelopeFollower(ctx, this.source);

    this.outGain = ctx.createGain();
    this.outGain.gain.value = 0.7;
    this.muteGain = ctx.createGain();
    this.muteGain.gain.value = 1;
    this.outGain.connect(this.muteGain).connect(mixerBus);

    this.familyId = 'oscillator';
    this.muted = false;
    this.name = `Canal ${channelIndex + 1}`;
    this._createSynth(this.familyId);
  }

  _createSynth(familyId) {
    const Fam = SYNTH_FAMILIES[familyId].cls;
    if (this.synth) this.synth.dispose();
    this.synth = new Fam(this.ctx);
    this.synth.output.connect(this.outGain);
    this.synth.start();
    this.familyId = familyId;
  }

  setFamily(familyId) {
    if (!SYNTH_FAMILIES[familyId] || familyId === this.familyId) return;
    this._createSynth(familyId);
  }

  setParams(params) {
    this.synth.setParams(params);
  }

  setEnvelopeSettings(partial) {
    this.envelope.setSettings(partial);
  }

  setVolume(v) {
    this.outGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setMuted(muted) {
    this.muted = muted;
    this.muteGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
  }

  update(dt) {
    const recalibrated = this.envelope.update(dt);
    this.synth.setVoiceLevel(this.envelope.level, this.envelope.gate);
    return recalibrated;
  }

  dispose() {
    this.synth.dispose();
    this.outGain.disconnect();
    this.muteGain.disconnect();
  }
}
