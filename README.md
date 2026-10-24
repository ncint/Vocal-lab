# Vocal Lab

Aplicação web experimental para performances e instalações participativas:
quatro pessoas cantam em quatro microfones e as suas vozes controlam quatro
motores de síntese independentes. A voz original nunca é reproduzida na
saída — funciona como controlo, não como matéria audível.

Pensa-se para uso com uma interface multicanal (Midas MR18) em
Windows 10/11, Chrome/Edge actuais, com publicação no GitHub Pages.

## Funcionamento

- **4 canais independentes**: captura multicanal, análise de intensidade
  (RMS com suavização, sensibilidade, limiar e calibração por canal) e um
  motor de síntese por canal.
- **3 famílias sonoras**:
  - *Osciladores / Drone* — osciladores contínuos com filtro; a voz controla
    amplitude e brilho.
  - *Ruído / Matéria* — ruído branco/rosa/marrom filtrado; a voz abre o filtro
    e a amplitude.
  - *Percussivo / Ressonante* — disparos sintéticos com envelope; a voz dispara
    (com refrigeração mínima) e controla força e tom.
- **Arquitectura extensível**: novas famílias registam-se em
  `src/channel-processor.js` (`SYNTH_FAMILIES`) implementando `src/synth-base.js`.
- **Segurança de áudio**: por desenho, não existe caminho do microfone para o
  `destination`; só os motores sonoros chegam à mistura. A saída inicia em
  silêncio; o silêncio geral (master) é independente dos volumes de canal.
- **Diagnóstico**: enumeração de dispositivos, verificação dos canais
  efectivamente recebidos, frequência de amostragem real, tom de teste 440 Hz,
  medidores por canal e mensagens de erro claras (permissões, dispositivo
  desligado, canais insuficientes, saída não suportada).

## Estrutura

```
index.html                  Página única (HTML semântico)
styles.css                  Interface escura para performance
src/main.js                 Arranque e ligação UI ↔ motor
src/audio-engine.js         AudioContext, captura, splitters, canais, mistura
src/device-manager.js       enumerateDevices, getUserMedia, mapeamento de canais
src/channel-processor.js     Percurso por canal e registo de famílias
src/envelope-follower.js     RMS, suavização, limiar, calibração
src/synth-base.js            Interface comum das famílias
src/synths/oscillator.js    Família A — drones
src/synths/noise.js          Família B — ruído e matéria
src/synths/percussive.js     Família C — percussivo/ressonante
src/mixer.js                 Mistura, volume geral, limiter, silêncio geral
src/ui.js                   Módulos de canal, medidores, persistência
src/diagnostics.js           Registo de mensagens
test/test-engine.mjs         Testes automatizados (Node)
test/stub-audio.mjs          Stub da Web Audio API para testes
```

## Executar localmente

```bash
cd vocal-lab
node test/test-engine.mjs     # testes automatizados (sem áudio real)
npx serve .                   # ou: python -m http.server
# abrir http://localhost:8000
```

O microfone exige HTTPS ou localhost. Para testes com a MR18 fora de
localhost, usa HTTPS (GitHub Pages serve HTTPS por defeito).

## Publicar no GitHub Pages

1. Envia o repositório para GitHub.
2. `Settings → Pages → Source: main branch / (root)`.
3. A app fica em `https://<user>.github.io/<repo>/` — os caminhos são todos
   relativos, portanto funcionam em subdirectório.

## Configurar a Midas MR18 (Windows 10/11)

1. Liga a MR18 por USB e instala o driver ASIO da Behringer/Midas se ainda
   não estiver instalado.
2. Nas definições de som do Windows, define a MR18 como dispositivo de
   gravação (não é necessário torná-la saída por defeito).
3. **Importante**: desliga qualquer *direct monitoring* na mesa (monitor
   aux/USB direto das entradas para as saídas físicas) para garantir que a
   voz original não chega às colunas pela mesa. A app não pode silenciar
   canais de monitorização da própria MR18.
4. No Chrome/Edge, em `chrome://settings/content/microphone`, escolhe a MR18.
5. Na app: selecciona a MR18 como entrada, prime "Iniciar áudio" e verifica
   nos medidores quantos canais efectivos chegam (ver Limitações).

## Limitações conhecidas

- **Canais de captura**: em Windows, o Chrome/Edge captura via WASAPI e
  normalmente expõe a MR18 como 1–2 canais (mono/estéreo) por dispositivo,
  independentemente das 18 entradas físicas. A app **verifica e mostra** o
  número real de canais e activa apenas os processadores correspondentes —
  nunca simula canais em falta. Se vierem menos de 4 canais, o diagnóstico
  indica a causa provável e alternativas (driver que exponha multicanal WAVE
  16 canais no Windows, ou 4 interfaces mono/estéreo, ou ferramenta de
  dispositivos virtuais multicanal). **Ainda não foi testado com a MR18 real.**
- **Selecção de saída** (`setSinkId` no AudioContext): suportada apenas em
  Chrome/Edge recentes; caso contrário a saída usa o dispositivo por defeito
  do sistema e a limitação é mostrada na interface.
- **Latência**: depende do buffer do dispositivo, do WASAPI e do hardware —
  não foi medida no sistema alvo. Os medidores e o tom de teste permitem
  avaliar no local.
- **Família granular** (Família D): não implementada nesta versão; exige
  captura de buffer da voz para granulação (AudioWorklet) — deixada para a
  versão 2, com a arquitectura já preparada (registo de famílias).

## Testes

Executados (automatizados, Node):

- Grafo: nenhum caminho microfone → saída; motor sonoro → saída.
- Envelope follower: suavização e limiar.
- Percussivo: refrigeração de disparos e sensibilidade.
- Independência de parâmetros entre canais.
- Mistura: inicia em silêncio; mute geral independe do volume geral.
- Três famílias instanciáveis e distintas.

Pendentes (exigem hardware real — não simulados):

- 4 canais independentes da MR18 em Chrome/Edge (WASAPI).
- Identificação das entradas físicas pelos medidores com microfones reais.
- Latência e estabilidade em performance contínua.
- selectAudioOutput/setSinkId com a MR18 como saída.

## Próximos passos

1. Testar a captura multicanal com a MR18 real e documentar o número de
   canais efectivos no Chrome/Edge (e eventualmente com driver alternativo).
2. Implementar a família granular (AudioWorklet com buffer da voz).
3. Afinar musicalmente os mapeamentos voz→parâmetro de cada família.
