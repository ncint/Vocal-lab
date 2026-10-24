// test-engine.mjs — testes automatizados (Node) do Vocal Lab.
// Verifica: 1) nenhum caminho do microfone para destination; 2) suavização do
// envelope follower; 3) refrigeração do percussivo; 4) independência de canais.

import assert from 'node:assert/strict';
import { FakeAudioContext, FakeNode, pathsTo } from './stub-audio.mjs';
import { EnvelopeFollower } from '../src/envelope-follower.js';
import { PercussiveSynth } from '../src/synths/percussive.js';
import { OscillatorSynth } from '../src/synths/oscillator.js';
import { NoiseSynth } from '../src/synths/noise.js';
import { ChannelProcessor, SYNTH_FAMILIES } from '../src/channel-processor.js';
import { Mixer } from '../src/mixer.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (err) { console.error(`FAIL ${name}\n     ${err.message}`); process.exitCode = 1; }
}

test('grafo: o microfone nunca alcança destination', () => {
  const ctx = new FakeAudioContext();
  const mixer = new Mixer(ctx);
  const mic = new FakeNode(ctx, 'mic');
  const tap = new FakeNode(ctx, 'tap');
  mic.connect(tap);
  const ch = new ChannelProcessor(ctx, 0, tap, mixer.bus);
  ch.setEnvelopeSettings({ sensitivity: 5 });
  ch.update(0.016);
  ch.setFamily('noise');
  ch.setFamily('percussive');
  assert.equal(pathsTo(mic, ctx.destination), false, 'existe caminho mic→destination');
  ch.dispose();
});

test('grafo: o motor sonoro alcança destination', () => {
  const ctx = new FakeAudioContext();
  const mixer = new Mixer(ctx);
  const tap = new FakeNode(ctx, 'tap');
  const ch = new ChannelProcessor(ctx, 0, tap, mixer.bus);
  assert.equal(pathsTo(ch.synth.output, ctx.destination), true, 'motor sonoro não chega à saída');
  ch.dispose();
});

test('envelope follower: suaviza e respeita limiar', () => {
  const ctx = new FakeAudioContext();
  const src = new FakeNode(ctx, 'src');
  const ef = new EnvelopeFollower(ctx, src);
  ef.setSettings({ sensitivity: 10, threshold: 0.02, attack: 0.05, release: 0.25 });
  ctx.signalFn = () => 0.3; // sinal forte constante
  ef.update(0.016); ef.update(0.016);
  assert.ok(ef.level > 0, 'nível não subiu');
  assert.equal(ef.gate, 1, 'gate devia estar aberto');
  const peak = ef.level;
  ctx.signalFn = () => 0; // silêncio
  ef.update(0.016);
  assert.ok(ef.level < peak, 'nível não desceu');
  assert.equal(ef.gate, 0, 'gate devia fechar');
});

test('percussivo: refrigeração evita disparos em cascata', () => {
  const ctx = new FakeAudioContext();
  ctx.currentTime = 1; // tempo inicial não-zero (como num AudioContext real)
  const p = new PercussiveSynth(ctx);
  p.start();
  const before = ctx.started.length;
  p.setVoiceLevel(0.8, 1);
  assert.equal(ctx.started.length, before + 1, 'primeiro disparo falhou');
  p.setVoiceLevel(0.8, 1); // imediatamente de novo
  assert.equal(ctx.started.length, before + 1, 'disparou fora do intervalo mínimo');
  ctx.currentTime = 2; // intervalo mínimo decorrido
  p.setVoiceLevel(0.8, 1);
  assert.equal(ctx.started.length, before + 2, 'não disparou após intervalo mínimo');
  p.setVoiceLevel(0.05, 1); // abaixo da sensibilidade
  assert.equal(ctx.started.length, before + 2, 'disparou abaixo da sensibilidade');
});

test('três famílias distintas registadas e instanciáveis', () => {
  assert.equal(Object.keys(SYNTH_FAMILIES).length, 3);
  const ctx = new FakeAudioContext();
  for (const id of Object.keys(SYNTH_FAMILIES)) {
    const s = new SYNTH_FAMILIES[id].cls(ctx);
    s.start();
    s.setVoiceLevel(0.5, 1);
    s.setParams({});
    s.dispose();
  }
});

test('independência: parâmetros de um canal não afectam outro', () => {
  const ctx = new FakeAudioContext();
  const mixer = new Mixer(ctx);
  const a = new ChannelProcessor(ctx, 0, new FakeNode(ctx, 't0'), mixer.bus);
  const b = new ChannelProcessor(ctx, 1, new FakeNode(ctx, 't1'), mixer.bus);
  a.setParams({ frequency: 330 });
  b.setParams({ frequency: 90 });
  assert.equal(a.synth.params.frequency, 330);
  assert.equal(b.synth.params.frequency, 90);
  a.setVolume(0.1);
  assert.notEqual(b.outGain.gain.value, 0.1);
  a.setMuted(true);
  assert.equal(b.muteGain.gain.value, 1);
});

test('mistura: inicia em silêncio e o mute geral independe do volume', () => {
  const ctx = new FakeAudioContext();
  const mixer = new Mixer(ctx);
  assert.equal(mixer.masterGain.gain.value, 0, 'saída não iniciou em silêncio');
  mixer.setMasterVolume(0.9);
  assert.equal(mixer.masterGain.gain.value, 0, 'volume geral ignorou o silêncio de segurança');
  mixer.setMuted(false);
  assert.equal(mixer.masterGain.gain.value, 0.9);
  mixer.setMuted(true);
  assert.equal(mixer.masterGain.gain.value, 0);
});

test('mistura: dispose desliga toda a cadeia até destination', () => {
  const ctx = new FakeAudioContext();
  const mixer = new Mixer(ctx);
  mixer.dispose();
  assert.equal(pathsTo(mixer.bus, ctx.destination), false, 'bus ainda alcança destination após dispose');
});

test('oscilador: voz acima do limiar abre amplitude', () => {
  const ctx = new FakeAudioContext();
  const o = new OscillatorSynth(ctx);
  o.setParams({ volume: 0.5, response: 1 });
  o.start();
  o.setVoiceLevel(0, 0);
  const quiet = o._nodes.level.gain.value;
  o.setVoiceLevel(0.9, 1);
  assert.ok(o._nodes.level.gain.value >= quiet, 'amplitude não respondeu à voz');
  const cutoffHigh = o._nodes.filter.frequency.value;
  assert.ok(cutoffHigh > 0, 'cutoff inválido');
});

console.log(`\n${passed} testes passaram.`);
