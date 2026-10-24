// main.js — arranque, cabeçalho, configuração de dispositivos e ligação UI ↔ motor.

import { AudioEngine } from './audio-engine.js';
import { Diagnostics } from './diagnostics.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);

const diag = new Diagnostics($('diagnostics'));
const engine = new AudioEngine(diag);
const ui = new UI(engine, diag);

let masterMuted = true;

function setStateBadge(state, text) {
  const badge = $('engine-state');
  badge.className = `state-badge ${state}`;
  badge.textContent = text;
}

engine.onState = (state) => {
  if (state === 'on') {
    setStateBadge('on', 'Motor: activo');
    masterMuted = true; // cada sessão arranca em silêncio de segurança
    $('sample-rate').textContent = `Frequência: ${(engine.ctx.sampleRate / 1000).toFixed(1)} kHz`;
    const cc = engine.deviceManager.getChannelCount(engine.stream);
    $('inputs-label').textContent = `Entradas: ${Math.min(4, cc)} de ${cc} canal(is)`;
    $('device-label').textContent = `Dispositivo: ${$('input-device').selectedOptions[0]?.textContent || '—'}`;
    ui.buildChannels($('channels'));
    updateMasterUi();
  } else {
    setStateBadge('off', 'Motor: inativo');
    $('inputs-label').textContent = 'Entradas: —';
  }
  $('btn-start').disabled = state === 'on';
  $('btn-stop').disabled = state !== 'on';
  $('btn-master-mute').disabled = state !== 'on';
  $('btn-test-tone').disabled = state !== 'on';
  $('btn-test-tone').textContent = 'Tom de teste';
};

engine.onFrame = (levels, masterLevel) => {
  ui.update(levels, masterLevel, masterLevel > 0.99);
};

async function refreshDeviceLists() {
  await engine.deviceManager.refreshDevices();
  const inSel = $('input-device');
  const outSel = $('output-device');
  inSel.innerHTML = '<option value="">(predefinido)</option>';
  engine.deviceManager.inputDevices.forEach((d) => {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = d.label || d.deviceId.slice(0, 20);
    inSel.appendChild(o);
  });
  if (engine.deviceManager.outputDevices.length && typeof AudioContext !== 'undefined' && typeof AudioContext.prototype.setSinkId === 'function') {
    outSel.disabled = false;
    outSel.innerHTML = '<option value="">(predefinido do sistema)</option>';
    engine.deviceManager.outputDevices.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || d.deviceId.slice(0, 20);
      outSel.appendChild(o);
    });
  } else {
    outSel.disabled = true;
    outSel.innerHTML = '<option value="">Não suportado neste navegador</option>';
    diag.warn('Selecção de saída não suportada: a saída usa o dispositivo por omissão do sistema operativo.');
  }
}

function updateMasterUi() {
  const btn = $('btn-master-mute');
  btn.classList.toggle('active', masterMuted);
  btn.textContent = masterMuted ? 'Som geral: desligado' : 'Silêncio geral';
  $('master-state').textContent = masterMuted ? 'Saída: silenciada' : 'Saída: activa';
}

$('btn-start').addEventListener('click', async () => {
  diag.info('A pedir acesso ao dispositivo de entrada (4 canais, sem processamento do navegador)...');
  const ok = await engine.start($('input-device').value || null);
  if (ok) {
    const cc = engine.deviceManager.getChannelCount(engine.stream);
    $('channel-info').textContent =
      cc >= 4
        ? `4 canais recebidos do dispositivo. Canta num microfone de cada vez para identificar as entradas físicas pelos medidores.`
        : `Atenção: recebidos ${cc} canal(is). Apenas ${Math.min(4, cc)} processador(es) activo(s). Não foram simulados canais em falta.`;
  }
});

$('btn-stop').addEventListener('click', async () => {
  await engine.stop();
  ui.buildChannels($('channels'));
});

$('btn-refresh-devices').addEventListener('click', refreshDeviceLists);

$('input-device').addEventListener('change', () => {
  diag.info('Dispositivo de entrada seleccionado. Prime "Iniciar áudio" para o activar.');
});

$('output-device').addEventListener('change', async (e) => {
  await engine.setOutput(e.target.value || null);
});

$('btn-master-mute').addEventListener('click', () => {
  masterMuted = !masterMuted;
  engine.mixer?.setMuted(masterMuted);
  updateMasterUi();
});

$('master-volume').addEventListener('input', (e) => {
  engine.mixer?.setMasterVolume(+e.target.value);
});

$('btn-test-tone').addEventListener('click', (e) => {
  const on = engine.toggleTestTone();
  e.target.textContent = on ? 'Parar tom' : 'Tom de teste';
});

navigator.mediaDevices?.addEventListener('devicechange', () => {
  diag.warn('Lista de dispositivos alterada (ligação/desligação). Usa "Actualizar dispositivos".');
  refreshDeviceLists();
});

if (!navigator.mediaDevices?.getUserMedia) {
  diag.err('Este navegador não suporta getUserMedia. Usa Chrome ou Edge actualizados.');
} else if (!window.isSecureContext) {
  diag.err('Contexto não seguro (HTTPS ou localhost obrigatório para o microfone).');
} else {
  diag.info('Ambiente pronto. Nota: em Windows, o Chrome/Edge normalmente captura via WASAPI; verifica os canais efectivos após iniciar.');
}

refreshDeviceLists();
updateMasterUi();
