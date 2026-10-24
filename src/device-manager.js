// device-manager.js — enumeração, selecção e captura de dispositivos de áudio.
// A MR18 expõe-se ao Chrome/Edge como dispositivo multicanal; o número real de
// canais recebidos é verificado após a captura, nunca assumido.

export class DeviceManager extends EventTarget {
  constructor() {
    super();
    this.inputDevices = [];
    this.outputDevices = [];
    this.activeStream = null;
    this.selectedInputId = null;
  }

  get supportsOutputSelection() {
    return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  }

  async refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      this._emitError('enumerateDevices não suportado neste navegador.');
      return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.inputDevices = devices.filter((d) => d.kind === 'audioinput');
    this.outputDevices = devices.filter((d) => d.kind === 'audiooutput');
    this.dispatchEvent(new CustomEvent('deviceschanged'));
  }

  // Pede 4 canais ao dispositivo. Sem suporte multicanal, o Chrome entrega o
  // dispositivo com o número de canais que o WASAPI expõe (normalmente 1–2).
  async requestStream(deviceId) {
    if (this.activeStream) this.releaseStream();
    const constraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        channelCount: 4,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // Alguns dispositivos recusam channelCount=4; tentar sem essa restrição.
      try {
        delete constraints.audio.channelCount;
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err2) {
        this._mapError(err2);
        throw err2;
      }
    }
    this.activeStream = stream;
    this.selectedInputId = deviceId || stream.getAudioTracks()[0]?.getSettings().deviceId;
    return stream;
  }

  getChannelCount(stream) {
    const track = stream.getAudioTracks()[0];
    const settings = track?.getSettings() || {};
    return settings.channelCount || 1;
  }

  releaseStream() {
    this.activeStream?.getTracks().forEach((t) => t.stop());
    this.activeStream = null;
  }

  handleDeviceChange() {
    this.dispatchEvent(new CustomEvent('devicechange'));
  }

  _mapError(err) {
    const name = err?.name;
    let msg;
    switch (name) {
      case 'NotAllowedError':
        msg = 'Permissão de microfone recusada. Autoriza o microfone nas definições do site e tenta novamente.';
        break;
      case 'NotFoundError':
        msg = 'Dispositivo de entrada indisponível. Verifica a ligação da interface e tenta novamente.';
        break;
      case 'NotReadableError':
        msg = 'Dispositivo não pôde ser lido (em uso por outra aplicação?). Fecha outras aplicações de áudio e tenta de novo.';
        break;
      case 'OverconstrainedError':
        msg = 'O dispositivo não satisfaz as restrições pedidas (canais).';
        break;
      default:
        msg = `Erro de captura: ${name || 'desconhecido'} — ${err?.message || ''}`;
    }
    this._emitError(msg);
  }

  _emitError(message) {
    this.dispatchEvent(new CustomEvent('devicemessage', { detail: { level: 'err', message } }));
  }
}
