// audio-engine.js — orquestra AudioContext, captura, splitters, canais e mistura.
// Grafo garantido: mic → splitter → gain(análise) → analyser (sem saída)
//                                    └→ só o motor sonoro gera áudio → mixer → destination.
// Nunca existe um caminho do microfone para destination.

import { DeviceManager } from './device-manager.js';
import { Mixer } from './mixer.js';
import { ChannelProcessor } from './channel-processor.js';

const MAX_CHANNELS = 4;

export class AudioEngine {
  constructor(diagnostics) {
    this.diag = diagnostics;
    this.deviceManager = new DeviceManager();
    this.deviceManager.addEventListener('devicemessage', (e) =>
      this.diag[e.detail.level === 'err' ? 'err' : 'info'](e.detail.message));
    this.ctx = null;
    this.mixer = null;
    this.channels = [];
    this.sourceNode = null;
    this.stream = null;
    this.running = false;
    this.testOsc = null;
    this._raf = null;
    this._lastTime = 0;
    this.onFrame = null;   // callback UI (níveis por canal)
    this.onState = null;   // callback UI (estado textual)
  }

  get supportsContextSinkId() {
    return this.ctx && typeof this.ctx.setSinkId === 'function';
  }

  async start(deviceId) {
    if (this.running) await this.stop();
    try {
      this.stream = await this.deviceManager.requestStream(deviceId);
    } catch {
      return false;
    }

    if (!this.ctx || this.ctx.state === 'closed') {
      try {
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
      } catch (err) {
        this.diag.err(`Falha na inicialização do AudioContext: ${err.message}`);
        return false;
      }
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const channelCount = this.deviceManager.getChannelCount(this.stream);
    this.diag.info(`Frequência de amostragem efectiva: ${(this.ctx.sampleRate / 1000).toFixed(1)} kHz`);
    this.diag.info(`Canais recebidos do dispositivo: ${channelCount}`);

    this.sourceNode = this.ctx.createMediaStreamSource(this.stream);
    const splitter = this.ctx.createChannelSplitter(Math.max(MAX_CHANNELS, channelCount));
    this.sourceNode.connect(splitter);

    this.mixer = new Mixer(this.ctx);
    this.channels = [];

    const usable = Math.min(MAX_CHANNELS, channelCount);
    for (let i = 0; i < usable; i++) {
      const tap = this.ctx.createGain();
      splitter.connect(tap, i, 0);
      this.channels.push(new ChannelProcessor(this.ctx, i, tap, this.mixer.bus));
    }

    if (channelCount < MAX_CHANNELS) {
      this.diag.warn(
        `Dispositivo disponibiliza apenas ${channelCount} canal(is). ` +
        `Apenas ${usable} canal(is) activo(s); não são simulados canais em falta. ` +
        'Nota: em Windows, o Chrome/Edge normalmente abre dispositivos WASAPI em estéreo. ' +
        'Para 4 canais independentes de uma MR18 é necessário que o dispositivo seja exposto ' +
        'como multicanal (ex.: driver ASIO suportado pelo navegador ou agregado de 4 entradas mono); ' +
        'alternativa técnica: usar 4 interfaces mono/estéreo ou uma ferramenta que crie dispositivos virtuais multicanal.'
      );
    } else {
      this.diag.ok(`4 canais mapeados nas entradas físicas do dispositivo. Identifica cada entrada cantando num microfone de cada vez e observando os medidores.`);
    }

    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        this.diag.err('Dispositivo de entrada desligado durante a utilização. Tenta novamente com "Iniciar áudio".');
        this._setRunning(false);
      });
    }

    this._lastTime = performance.now() / 1000;
    this._setRunning(true);
    this._loop();
    return true;
  }

  _setRunning(running) {
    this.running = running;
    this.onState?.(running ? 'on' : 'off');
  }

  _loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(() => this._loop());
    const now = performance.now() / 1000;
    const dt = Math.min(0.1, now - this._lastTime);
    this._lastTime = now;
    const levels = [];
    for (const ch of this.channels) {
      const recalibrated = ch.update(dt);
      if (recalibrated) this.diag.ok(`Canal ${ch.index + 1} calibrado (sensibilidade ${ch.envelope.settings.sensitivity.toFixed(1)}).`);
      levels.push({ raw: ch.envelope.rawRms, level: ch.envelope.level, gate: ch.envelope.gate });
    }
    this.onFrame?.(levels, this.mixer ? this.mixer.getLevel() : 0);
  }

  async stop() {
    this._setRunning(false);
    if (this._raf) cancelAnimationFrame(this._raf);
    this.channels.forEach((c) => c.dispose());
    this.channels = [];
    this._stopTestTone();
    if (this.mixer) {
      this.mixer.dispose();
      this.mixer = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.deviceManager.releaseStream();
  }

  async setOutput(deviceId) {
    if (!this.ctx) {
      this.diag.warn('Inicia o áudio primeiro para escolher o dispositivo de saída.');
      return false;
    }
    if (typeof this.ctx.setSinkId !== 'function') {
      this.diag.warn('selectAudioOutput/setSinkId não suportado neste navegador; a saída usa o dispositivo por omissão do sistema.');
      return false;
    }
    try {
      await this.ctx.setSinkId(deviceId || '');
      this.diag.ok(deviceId ? `Saída de áudio alterada para o dispositivo seleccionado.` : 'Saída de áudio: dispositivo por omissão.');
      return true;
    } catch (err) {
      this.diag.err(`Saída de áudio não disponível: ${err.message}`);
      return false;
    }
  }

  _stopTestTone() {
    if (!this.testOsc) return;
    try { this.testOsc.stop(); } catch {}
    this.testOsc.disconnect();
    this.testOsc = null;
    this.diag.info('Tom de teste desligado.');
  }

  toggleTestTone() {
    if (this.testOsc) {
      this._stopTestTone();
      return false;
    }
    if (!this.ctx || !this.mixer) {
      this.diag.warn('Inicia o áudio primeiro para ouvir o tom de teste.');
      return false;
    }
    this.testOsc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.gain.value = 0.2;
    this.testOsc.frequency.value = 440;
    this.testOsc.connect(g).connect(this.mixer.bus);
    this.testOsc.start();
    this.diag.ok('Tom de teste 440 Hz activo — verifica o percurso de saída (a saída parte em silêncio: activa o som geral).');
    return true;
  }
}
