// stub-audio.mjs — AudioContext mínimo para testes em Node (sem áudio real).
export class FakeParam {
  constructor(v = 0) { this.value = v; this._targets = []; }
  setValueAtTime(v) { this.value = v; return this; }
  setTargetAtTime(v) { this.value = v; return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
}
export class FakeNode {
  constructor(ctx, name) {
    this.ctx = ctx;
    this.name = name;
    this.params = {};
    this.connections = [];
    this.gain = new FakeParam(1);
    this.frequency = new FakeParam(440);
    this.Q = new FakeParam(1);
    this.onended = null;
  }
  connect(dest) {
    if (dest instanceof FakeParam) { this.connections.push({ param: dest }); return this; }
    this.connections.push(dest);
    this.ctx.edges.push({ from: this, to: dest });
    return dest;
  }
  disconnect() { this.connections = []; }
  start() { this.ctx.started.push(this); return this; }
  stop() { this.ctx.stopped.push(this); return this; }
  getFloatTimeDomainData(buf) {
    for (let i = 0; i < buf.length; i++) buf[i] = this.ctx.signalFn ? this.ctx.signalFn(i) : 0;
  }
}
export class FakeAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.destination = new FakeNode(this, 'destination');
    this.currentTime = 0;
    this.edges = [];       // todos os caminhos node→node criados
    this.started = [];
    this.stopped = [];
    this.signalFn = null;  // sinal sintético para analysers
  }
  createGain() { return new FakeNode(this, 'gain'); }
  createOscillator() { return new FakeNode(this, 'osc'); }
  createBiquadFilter() { return new FakeNode(this, 'filter'); }
  createAnalyser() { const n = new FakeNode(this, 'analyser'); n.fftSize = 2048; return n; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource() { return new FakeNode(this, 'bufferSource'); }
  createDynamicsCompressor() {
    const n = new FakeNode(this, 'compressor');
    n.threshold = new FakeParam(-24);
    n.knee = new FakeParam(30);
    n.ratio = new FakeParam(12);
    n.attack = new FakeParam(0.003);
    n.release = new FakeParam(0.25);
    return n;
  }
  createChannelSplitter() { return new FakeNode(this, 'splitter'); }
  createMediaStreamSource() { return new FakeNode(this, 'mediaStreamSource'); }
  resume() { return Promise.resolve(); }
}
export function pathsTo(from, to, seen = new Set()) {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  for (const c of from.connections) {
    const node = c.param ? null : c;
    if (c.param) continue;
    if (pathsTo(c, to, seen)) return true;
  }
  return false;
}
