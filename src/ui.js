// ui.js — construção dos módulos de canal, medidores e cabeçalho.
// Nenhum controlo aqui cria caminhos de áudio; tudo passa pelo AudioEngine.

import { SYNTH_FAMILIES } from './channel-processor.js';

const FAMILY_PARAMS = {
  oscillator: [
    { key: 'waveform', label: 'Onda', type: 'select', options: ['sine', 'triangle', 'sawtooth', 'square'] },
    { key: 'frequency', label: 'Frequência base', type: 'range', min: 30, max: 400, step: 1, value: 110 },
    { key: 'filterCutoff', label: 'Brilho (cutoff)', type: 'range', min: 100, max: 6000, step: 10, value: 1200 },
    { key: 'response', label: 'Resposta à voz', type: 'range', min: 0, max: 1, step: 0.01, value: 0.8 },
  ],
  noise: [
    { key: 'color', label: 'Cor do ruído', type: 'select', options: ['white', 'pink', 'brown'] },
    { key: 'cutoff', label: 'Corte', type: 'range', min: 60, max: 3000, step: 10, value: 400 },
    { key: 'resonance', label: 'Ressonância', type: 'range', min: 0.5, max: 20, step: 0.1, value: 2 },
    { key: 'response', label: 'Resposta à voz', type: 'range', min: 0, max: 1, step: 0.01, value: 0.8 },
  ],
  percussive: [
    { key: 'timbre', label: 'Timbre', type: 'select', options: ['metal', 'wood', 'membrane'] },
    { key: 'resonance', label: 'Ressonância (Hz)', type: 'range', min: 60, max: 800, step: 1, value: 220 },
    { key: 'attack', label: 'Ataque (s)', type: 'range', min: 0.001, max: 0.05, step: 0.001, value: 0.005 },
    { key: 'decay', label: 'Decaimento (s)', type: 'range', min: 0.05, max: 1.5, step: 0.01, value: 0.35 },
    { key: 'sensitivity', label: 'Sensibilidade de disparo', type: 'range', min: 0.05, max: 0.8, step: 0.01, value: 0.25 },
  ],
};

export class UI {
  constructor(engine, diag) {
    this.engine = engine;
    this.diag = diag;
    this.channelEls = [];
    this.paramsPanel = new Map(); // channelId -> {container, inputs}
    this.saved = this._loadSaved();
  }

  _loadSaved() {
    try { return JSON.parse(localStorage.getItem('vocal-lab-v1') || '{}'); } catch { return {}; }
  }

  _save() {
    const data = { channels: this.engine.channels.map((c) => ({
      name: c.name, family: c.familyId, muted: c.muted,
      params: c.synth.params, envelope: c.envelope.settings,
      volume: c.outGain.gain.value,
    })) };
    try { localStorage.setItem('vocal-lab-v1', JSON.stringify(data)); } catch {}
  }

  buildChannels(container) {
    container.innerHTML = '';
    this.channelEls = [];
    this.engine.channels.forEach((ch) => {
      const el = this._buildChannel(ch);
      container.appendChild(el);
    });
  }

  _buildChannel(ch) {
    const panel = document.createElement('section');
    panel.className = 'panel channel';
    const savedCh = this.saved.channels?.[ch.index] || {};

    panel.innerHTML = `
      <div class="channel-head">
        <span class="channel-id">${ch.index + 1}</span>
        <input type="text" value="${savedCh.name || ch.name}" aria-label="Nome do canal">
        <span class="state-dot" data-role="dot"></span>
        <button class="btn small" data-role="mute">Silenciar</button>
      </div>
      <canvas class="meter-canvas" width="600" height="28" data-role="meter"></canvas>
      <div class="param-grid">
        <label class="field"><span>Sensibilidade</span>
          <input type="range" data-role="sensitivity" min="0.5" max="30" step="0.5"></label>
        <label class="field"><span>Limiar</span>
          <input type="range" data-role="threshold" min="0.001" max="0.2" step="0.001"></label>
        <label class="field"><span>Família sonora</span>
          <select data-role="family">
            ${Object.entries(SYNTH_FAMILIES).map(([id, f]) => `<option value="${id}">${f.label}</option>`).join('')}
          </select></label>
        <label class="field"><span>Volume</span>
          <input type="range" data-role="volume" min="0" max="1" step="0.01" value="${savedCh.volume ?? 0.7}"></label>
      </div>
      <div class="param-grid" data-role="fparams"></div>
      <div class="channel-foot">
        <button class="btn small" data-role="calibrate">Calibrar (2 s)</button>
      </div>
    `;

    const q = (role) => panel.querySelector(`[data-role="${role}"]`);

    const savedEnv = savedCh.envelope || {};
    const env = { sensitivity: savedEnv.sensitivity ?? 8, threshold: savedEnv.threshold ?? 0.02, attack: 0.05, release: 0.25 };
    ch.setEnvelopeSettings(env);
    q('sensitivity').value = env.sensitivity;
    q('threshold').value = env.threshold;

    if (savedCh.family && SYNTH_FAMILIES[savedCh.family]) {
      ch.setFamily(savedCh.family);
      q('family').value = savedCh.family;
    }
    if (savedCh.params) ch.setParams(savedCh.params);
    ch.setVolume(savedCh.volume ?? 0.7);
    if (savedCh.muted) { ch.setMuted(true); q('mute').classList.add('active'); q('mute').textContent = 'Activar'; }

    q('sensitivity').addEventListener('input', (e) => { ch.setEnvelopeSettings({ sensitivity: +e.target.value }); this._save(); });
    q('threshold').addEventListener('input', (e) => { ch.setEnvelopeSettings({ threshold: +e.target.value }); this._save(); });
    q('volume').addEventListener('input', (e) => { ch.setVolume(+e.target.value); this._save(); });

    q('family').addEventListener('change', (e) => {
      ch.setFamily(e.target.value);
      this._renderFamilyParams(ch, q('fparams'));
      this._save();
    });
    q('mute').addEventListener('click', (e) => {
      ch.setMuted(!ch.muted);
      e.target.classList.toggle('active', ch.muted);
      e.target.textContent = ch.muted ? 'Activar' : 'Silenciar';
      this._save();
    });
    q('calibrate').addEventListener('click', () => {
      ch.envelope.calibrate(2);
      this.diag.info(`Calibração do canal ${ch.index + 1} iniciada — canta com intensidade de performance.`);
    });
    panel.querySelector('input[type="text"]').addEventListener('change', (e) => {
      ch.name = e.target.value || ch.name;
      this._save();
    });

    this._renderFamilyParams(ch, q('fparams'));
    this.channelEls[ch.index] = { panel, ch, meter: q('meter'), dot: q('dot') };
    return panel;
  }

  _renderFamilyParams(ch, container) {
    container.innerHTML = '';
    const defs = FAMILY_PARAMS[ch.familyId] || [];
    for (const def of defs) {
      const label = document.createElement('label');
      label.className = 'field';
      const val = ch.synth.params[def.key] ?? def.value;
      label.innerHTML = `<span>${def.label}</span>`;
      if (def.type === 'select') {
        const sel = document.createElement('select');
        def.options.forEach((o) => {
          const opt = document.createElement('option');
          opt.value = o; opt.textContent = o;
          if (o === val) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', () => { ch.setParams({ [def.key]: sel.value }); this._save(); });
        label.appendChild(sel);
      } else {
        const input = document.createElement('input');
        input.type = 'range';
        input.min = def.min; input.max = def.max; input.step = def.step;
        input.value = val;
        input.addEventListener('input', () => { ch.setParams({ [def.key]: +input.value }); this._save(); });
        label.appendChild(input);
      }
      container.appendChild(label);
    }
  }

  drawMeter(canvas, level, gate) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#0c0f13';
    ctx.fillRect(0, 0, w, h);
    const x = Math.min(1, level);
    ctx.fillStyle = gate ? '#3ddc84' : '#4f9cff';
    ctx.fillRect(0, 0, w * x, h);
  }

  update(levels, masterLevel, clipping) {
    levels.forEach((lv, i) => {
      const el = this.channelEls[i];
      if (!el) return;
      this.drawMeter(el.meter, lv.level, lv.gate);
      el.dot.classList.toggle('live', lv.gate === 1);
    });
    const master = document.getElementById('master-meter');
    if (master) this.drawMeter(master, masterLevel, false);
    const clip = document.getElementById('clip-indicator');
    if (clip) clip.classList.toggle('active', !!clipping);
  }
}
