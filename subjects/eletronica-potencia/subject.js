/* ==========================================================================
   2. SIMULADOR & CALCULADORA INTERATIVA DE CONVERSORES CC-CC
   Calcula parâmetros em CCM e DCM e plota em tempo real as formas de onda SVG
   ========================================================================== */
function initCalculator() {
  const form = document.getElementById('converterCalcForm');
  if (!form) return;

  const inputs = ['calcTopology', 'calcVin', 'calcVo', 'calcPo', 'calcFs', 'calcL', 'calcC'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', runConverterCalculations);
      el.addEventListener('change', runConverterCalculations);
    }
  });

  // Execução inicial
  runConverterCalculations();
}

function runConverterCalculations() {
  const topology = document.getElementById('calcTopology')?.value || 'buck';
  const ids = ['calcVin', 'calcVo', 'calcPo', 'calcFs', 'calcL', 'calcC'];
  const values = ids.map(id => Number(document.getElementById(id)?.value));
  const [Vin, Vo, Po, fsKhz, L_uH, C_uF] = values;
  let error = values.some(v => !Number.isFinite(v) || v <= 0) ? 'Preencha todos os campos com valores positivos e finitos.' : '';
  if (!error && topology === 'buck' && Vo >= Vin) error = 'Para Buck chaveado, use 0 < Vo < Vin.';
  if (!error && topology === 'boost' && Vo <= Vin) error = 'Para Boost chaveado, use Vo > Vin.';
  const errorBox = document.getElementById('calcError');
  errorBox.textContent = error;
  errorBox.hidden = !error;
  ids.forEach((id, i) => {
    const invalid = !Number.isFinite(values[i]) || values[i] <= 0 || (id === 'calcVo' && !!error);
    document.getElementById(id).setAttribute('aria-invalid', String(invalid));
  });
  if (error) {
    document.getElementById('resConductionMode').textContent = 'Parâmetros inválidos';
    ['resDutyCycle', 'resIo', 'resDeltaIL', 'resILmax', 'resILmin', 'resDeltaVo', 'resLcrit', 'resVswMax'].forEach(id => { document.getElementById(id).textContent = '—'; });
    document.getElementById('waveformSvgContainer').innerHTML = '';
    return;
  }

  const fs = fsKhz * 1e3; // Hz
  const Ts = 1 / fs; // s
  const L = L_uH * 1e-6; // H
  const C = C_uF * 1e-6; // F

  const Io = Po / Vo; // A
  const R = Vo / Io; // Ohms
  const K = (2 * L * fs) / R; // Parâmetro adimensional K

  let mode = 'CCM';
  let D = 0;
  let D2 = 0;
  let deltaIL = 0;
  let IL_avg = 0;
  let IL_max = 0;
  let IL_min = 0;
  let deltaVo = 0;
  let Lcrit = 0;
  let Vs_max = 0;
  let Vd_max = 0;

  if (topology === 'buck') {
    // Topologia Buck (Rebaixador)
    const D_ideal = Vo / Vin;
    const Kcrit = 1 - D_ideal;
    Lcrit = ((1 - D_ideal) * R) / (2 * fs);
    Vs_max = Vin;
    Vd_max = Vin;

    if (K >= Kcrit - 1e-12 * Math.max(K, Kcrit)) {
      mode = 'CCM';
      D = D_ideal;
      D2 = 1 - D;
      deltaIL = ((Vin - Vo) * D) / (L * fs);
      IL_avg = Io;
      IL_max = IL_avg + deltaIL / 2;
      IL_min = IL_avg - deltaIL / 2;
      deltaVo = deltaIL / (8 * C * fs); // ou Vo*(1-D)/(8*L*C*fs^2)
    } else {
      mode = 'DCM';
      const M = Vo / Vin;
      // D = M * sqrt(K / (1 - M))
      D = M * Math.sqrt(K / (1 - M));
      D2 = D * ((Vin - Vo) / Vo);
      deltaIL = ((Vin - Vo) * D) / (L * fs);
      IL_avg = Io;
      IL_max = deltaIL;
      IL_min = 0;
      deltaVo = (Io / (C * fs)) * Math.pow(1 - (D + D2) / 2, 2);
    }
  } else if (topology === 'boost') {
    // Topologia Boost (Elevador)
    const D_ideal = 1 - (Vin / Vo);
    const Kcrit = D_ideal * Math.pow(1 - D_ideal, 2);
    Lcrit = (D_ideal * Math.pow(1 - D_ideal, 2) * R) / (2 * fs);
    Vs_max = Vo;
    Vd_max = Vo;

    if (K >= Kcrit - 1e-12 * Math.max(K, Kcrit)) {
      mode = 'CCM';
      D = D_ideal;
      D2 = 1 - D;
      deltaIL = (Vin * D) / (L * fs);
      IL_avg = Io / (1 - D);
      IL_max = IL_avg + deltaIL / 2;
      IL_min = IL_avg - deltaIL / 2;
      deltaVo = (Io * D) / (C * fs);
    } else {
      mode = 'DCM';
      const M = Vo / Vin;
      // D = sqrt(K * M * (M - 1))
      D = Math.sqrt(Math.max(0, K * M * (M - 1)));
      D2 = D / (M - 1);
      deltaIL = (Vin * D) / (L * fs);
      IL_avg = (deltaIL * (D + D2)) / 2;
      IL_max = deltaIL;
      IL_min = 0;
      deltaVo = (Io / (C * fs)) * Math.pow(1 - D2 / 2, 2);
    }
  } else if (topology === 'buck-boost') {
    // Topologia Buck-Boost (Inversor)
    const D_ideal = Vo / (Vin + Vo);
    const Kcrit = Math.pow(1 - D_ideal, 2);
    Lcrit = (Math.pow(1 - D_ideal, 2) * R) / (2 * fs);
    Vs_max = Vin + Vo;
    Vd_max = Vin + Vo;

    if (K >= Kcrit - 1e-12 * Math.max(K, Kcrit)) {
      mode = 'CCM';
      D = D_ideal;
      D2 = 1 - D;
      deltaIL = (Vin * D) / (L * fs);
      IL_avg = Io / (1 - D);
      IL_max = IL_avg + deltaIL / 2;
      IL_min = IL_avg - deltaIL / 2;
      deltaVo = (Io * D) / (C * fs);
    } else {
      mode = 'DCM';
      const M = Vo / Vin;
      D = M * Math.sqrt(K);
      D2 = Math.sqrt(K);
      deltaIL = (Vin * D) / (L * fs);
      IL_avg = (deltaIL * (D + D2)) / 2;
      IL_max = deltaIL;
      IL_min = 0;
      deltaVo = (Io / (C * fs)) * Math.pow(1 - D2 / 2, 2);
    }
  }

  // Integra a carga positiva de C quando iL cruza Io ainda no intervalo OFF.
  // Io*D/(C*fs) só dá o ripple completo se iL >= Io em todo esse intervalo.
  if (topology !== 'buck' && mode === 'CCM' && IL_min < Io) {
    deltaVo = D2 * Math.pow(IL_max - Io, 2) / (2 * deltaIL * C * fs);
  }
  const atBoundary = mode === 'CCM' && Math.abs(IL_min) <= 1e-10 * Math.max(1, IL_max);
  // Atualizar os elementos da UI com os resultados
  const modeBadge = document.getElementById('resConductionMode');
  if (modeBadge) {
    if (mode === 'CCM') {
      modeBadge.className = 'results-status-badge status-ccm';
      modeBadge.textContent = atBoundary ? 'Condução crítica (BCM): iL toca zero; D₃ = 0' : 'Modo de Condução Contínua (CCM)';
    } else {
      modeBadge.className = 'results-status-badge status-dcm';
      modeBadge.textContent = 'Modo de Condução Descontínua (DCM)';
    }
  }

  document.getElementById('resDutyCycle').textContent = `${(D * 100).toFixed(1)}% (D = ${D.toFixed(3)})`;
  document.getElementById('resDeltaIL').textContent = `${deltaIL.toFixed(2)} A (${((deltaIL / Math.max(0.01, IL_avg)) * 100).toFixed(1)}%)`;
  document.getElementById('resILmax').textContent = `${IL_max.toFixed(2)} A`;
  document.getElementById('resILmin').textContent = `${Math.max(0, IL_min).toFixed(2)} A`;
  document.getElementById('resDeltaVo').textContent = `${(deltaVo * 1000).toFixed(1)} mV (${((deltaVo / Vo) * 100).toFixed(2)}%)`;
  document.getElementById('resLcrit').textContent = `${(Lcrit * 1e6).toFixed(1)} µH`;
  document.getElementById('resVswMax').textContent = `${Vs_max.toFixed(1)} V`;
  document.getElementById('resIo').textContent = `${Io.toFixed(2)} A (R = ${R.toFixed(1)} Ω)`;

  // Desenhar Formas de Onda SVG
  drawWaveformsSVG({
    mode,
    topology,
    D,
    D2,
    IL_min: Math.max(0, IL_min),
    IL_max,
    Vin,
    Vo
  });
}

function drawWaveformsSVG(params) {
  const container = document.getElementById('waveformSvgContainer');
  if (!container) return;

  const { mode, D, D2, IL_min, IL_max, Vin, Vo } = params;

  // Dimensões
  const W = 620;
  const H = 240;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 25;
  const plotW = W - padLeft - padRight;
  const plotH = 85; // Altura de cada gráfico

  // Gráfico 1: Tensão no indutor vL(t) [padTop até padTop + plotH]
  // Gráfico 2: Corrente no indutor iL(t) [padTop + plotH + 35 até padTop + 2*plotH + 35]
  const yVL_mid = padTop + plotH / 2;
  const yIL_bottom = padTop + plotH + 40 + plotH;
  const yIL_top = padTop + plotH + 40;

  // Pontos de tempo normalizados (X)
  const x0 = padLeft;
  const x1 = padLeft + D * plotW;
  const x2 = mode === 'CCM' ? padLeft + plotW : padLeft + Math.min(plotW, (D + D2) * plotW);
  const xEnd = padLeft + plotW;

  // Níveis de vL
  let vL_on = 0;
  let vL_off = 0;
  if (params.topology === 'buck') {
    vL_on = Vin - Vo;
    vL_off = -Vo;
  } else if (params.topology === 'boost') {
    vL_on = Vin;
    vL_off = Vin - Vo;
  } else {
    vL_on = Vin;
    vL_off = -Vo;
  }

  const maxVL = Math.max(Math.abs(vL_on), Math.abs(vL_off), 1);
  const scaleVL = (plotH / 2 - 12) / maxVL;
  const yVL_on = yVL_mid - vL_on * scaleVL;
  const yVL_off = yVL_mid - vL_off * scaleVL;

  // Níveis de iL
  const maxIL = Math.max(IL_max, 1);
  const scaleIL = (plotH - 15) / maxIL;
  const yIL_valMax = yIL_bottom - IL_max * scaleIL;
  const yIL_valMin = yIL_bottom - IL_min * scaleIL;

  let svgContent = `
    <svg viewBox="0 0 ${W} ${H}" class="waveform-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--ahti-success)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--ahti-success)" stop-opacity="0.02"/>
        </linearGradient>
      </defs>

      <!-- Linhas de Grade e Eixos -->
      <!-- Eixo Zero vL -->
      <line x1="${padLeft}" y1="${yVL_mid}" x2="${xEnd + 15}" y2="${yVL_mid}" stroke="var(--ahti-border)" stroke-dasharray="3,3" stroke-width="1.2"/>
      <text x="${padLeft - 8}" y="${yVL_mid + 4}" fill="var(--ahti-subtle)" font-size="11" font-family="monospace" text-anchor="end">0V</text>

      <!-- Rótulo Tensão vL(t) -->
      <text x="${padLeft}" y="${padTop - 8}" fill="var(--ahti-info)" font-size="12" font-weight="bold" font-family="sans-serif">v_L(t) [Tensão no Indutor]</text>
      
      <!-- Linhas verticais de fase -->
      <line x1="${x1}" y1="${padTop - 5}" x2="${x1}" y2="${yIL_bottom + 15}" stroke="var(--ahti-control)" stroke-dasharray="4,4" stroke-width="1"/>
      <text x="${x1}" y="${yIL_bottom + 16}" fill="var(--ahti-subtle)" font-size="10" font-family="monospace" text-anchor="middle">DTs</text>
  `;

  if (mode === 'DCM') {
    svgContent += `
      <line x1="${x2}" y1="${padTop - 5}" x2="${x2}" y2="${yIL_bottom + 15}" stroke="var(--ahti-warning)" stroke-dasharray="4,4" stroke-width="1"/>
      <text x="${x2}" y="${yIL_bottom + 16}" fill="var(--ahti-warning)" font-size="10" font-family="monospace" text-anchor="middle">(D+D2)Ts</text>
    `;
  }

  svgContent += `
      <line x1="${xEnd}" y1="${padTop - 5}" x2="${xEnd}" y2="${yIL_bottom + 15}" stroke="var(--ahti-control)" stroke-dasharray="4,4" stroke-width="1"/>
      <text x="${xEnd}" y="${yIL_bottom + 16}" fill="var(--ahti-subtle)" font-size="10" font-family="monospace" text-anchor="middle">Ts</text>

      <!-- Traçado de vL(t) -->
  `;

  // Path de vL
  let vL_path = `M ${x0} ${yVL_mid} L ${x0} ${yVL_on} L ${x1} ${yVL_on} L ${x1} ${yVL_off} L ${x2} ${yVL_off}`;
  if (mode === 'DCM') {
    vL_path += ` L ${x2} ${yVL_mid} L ${xEnd} ${yVL_mid}`;
  }
  svgContent += `
      <path d="${vL_path}" fill="none" stroke="var(--ahti-info)" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="${padLeft - 8}" y="${yVL_on + 4}" fill="var(--ahti-info)" font-size="10" font-family="monospace" text-anchor="end">${vL_on > 0 ? '+' : ''}${vL_on.toFixed(0)}V</text>
      <text x="${padLeft - 8}" y="${yVL_off + 4}" fill="var(--ahti-info)" font-size="10" font-family="monospace" text-anchor="end">${vL_off.toFixed(0)}V</text>

      <!-- Rótulo Corrente iL(t) -->
      <text x="${padLeft}" y="${yIL_top - 12}" fill="var(--ahti-success)" font-size="12" font-weight="bold" font-family="sans-serif">i_L(t) [Corrente no Indutor]</text>
      <!-- Eixo Zero iL -->
      <line x1="${padLeft}" y1="${yIL_bottom}" x2="${xEnd + 15}" y2="${yIL_bottom}" stroke="var(--ahti-border)" stroke-width="1.5"/>
      <text x="${padLeft - 8}" y="${yIL_bottom + 4}" fill="var(--ahti-subtle)" font-size="11" font-family="monospace" text-anchor="end">0A</text>
  `;

  // Path de iL
  let iL_path = '';
  let iL_area = '';
  if (mode === 'CCM') {
    iL_path = `M ${x0} ${yIL_valMin} L ${x1} ${yIL_valMax} L ${xEnd} ${yIL_valMin}`;
    iL_area = `M ${x0} ${yIL_bottom} L ${x0} ${yIL_valMin} L ${x1} ${yIL_valMax} L ${xEnd} ${yIL_valMin} L ${xEnd} ${yIL_bottom} Z`;
  } else {
    // DCM: sobe de 0 até Max, desce até 0 em x2, fica em zero até xEnd
    iL_path = `M ${x0} ${yIL_bottom} L ${x1} ${yIL_valMax} L ${x2} ${yIL_bottom} L ${xEnd} ${yIL_bottom}`;
    iL_area = `M ${x0} ${yIL_bottom} L ${x1} ${yIL_valMax} L ${x2} ${yIL_bottom} Z`;
  }

  svgContent += `
      <!-- Área preenchida da corrente -->
      <path d="${iL_area}" fill="url(#gradCurrent)"/>
      <!-- Traço da corrente -->
      <path d="${iL_path}" fill="none" stroke="var(--ahti-success)" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="${padLeft - 8}" y="${yIL_valMax + 4}" fill="var(--ahti-success)" font-size="10" font-family="monospace" text-anchor="end">${IL_max.toFixed(1)}A</text>
  `;

  if (mode === 'CCM' && IL_min > 0.05) {
    svgContent += `
      <text x="${padLeft - 8}" y="${yIL_valMin + 4}" fill="var(--ahti-success)" font-size="10" font-family="monospace" text-anchor="end">${IL_min.toFixed(1)}A</text>
    `;
  }

  svgContent += `</svg>`;
  container.innerHTML = svgContent;
}


/* ==========================================================================
   3. SIMULADORES ANIMADOS & OSCILOSCÓPIO DE CONVERSORES (CCM & DCM)
   Renderiza o circuito com fluxo animado de corrente, polaridades dinâmicas,
   telemetria instantânea (v e i) e formas de onda sincronizadas com playhead.
   ========================================================================== */

// Exemplos ideais em regime periódico e pequena ondulação de saída.
// Io é derivada da área da corrente entregue à saída; isso garante <iC> = 0.
var CONVERTER_CONFIGS = {};
[
  ['mod4', 'buck', 'CCM', 24, 12, 0.5, 1.4, 2.6],
  ['mod5', 'boost', 'CCM', 12, 24, 0.5, 2.4, 3.6],
  ['mod6', 'buckboost', 'CCM', 24, 24, 0.5, 2.4, 3.6],
  ['mod7', 'buck', 'DCM', 24, 12, 0.35, 0, 2.8],
  ['mod8', 'boost', 'DCM', 12, 24, 0.35, 0, 3.2],
  ['mod9', 'buckboost', 'DCM', 24, 24, 0.35, 0, 3.2]
].forEach(function (spec) {
  var [id, topology, mode, Vin, Vo, D, Imin, Imax] = spec;
  var vOn = topology === 'buck' ? Vin - Vo : Vin;
  var vOff = topology === 'boost' ? Vin - Vo : -Vo;
  var D2 = mode === 'CCM' ? 1 - D : -vOn * D / vOff;
  var ILavg = (Imin + Imax) * (D + D2) / 2;
  var Io = topology === 'buck' ? ILavg : (Imin + Imax) * D2 / 2;
  var fs = 50000;
  var L = vOn * D / ((Imax - Imin) * fs);
  var names = { buck: 'Buck', boost: 'Boost', buckboost: 'Buck-Boost Inversor' };
  var stage = function (name, kind, start, end, note) {
    return { name: name, kind: kind,
      interval: (100 * start).toFixed(0) + '% ≤ t/Ts < ' + (100 * end).toFixed(0) + '%',
      sw: kind === 'on' ? 'FECHADA' : 'ABERTA',
      diode: kind === 'off' ? 'CONDUZ' : 'BLOQUEADO', note: note };
  };
  var stages = [
    stage('Etapa 1 · Chave ON', 'on', 0, D,
      'O comando PWM fecha S no início do ciclo. D fica reversamente polarizado. vL > 0 faz iL crescer, pois diL/dt = vL/L. ' +
      (topology === 'buck' ? 'A fonte alimenta o conjunto L, C e carga.' : 'O capacitor alimenta a carga enquanto o indutor armazena energia.')),
    stage('Etapa 2 · Chave OFF', 'off', D, D + D2,
      'Em t = D·Ts, o PWM abre S. A corrente de L é contínua na comutação e passa pelo diodo. vL < 0 reduz iL sem inverter seu sentido. ' +
      (topology === 'boost' ? 'A fonte e o indutor entregam energia à saída.' : topology === 'buck' ? 'A malha de roda-livre mantém a alimentação da saída.' : 'iL continua de cima para baixo; a corrente na carga sobe do terra à saída negativa.'))
  ];
  if (mode === 'DCM') stages.push(stage('Etapa 3 · Corrente nula', 'idle', D + D2, 1,
    'Em t = (D + D₂)·Ts, iL chega a zero. O diodo bloqueia naturalmente, pois não permite corrente reversa. S continua aberta: iL = 0 e vL = 0 até o próximo pulso PWM. C sustenta a carga.'));
  CONVERTER_CONFIGS[id] = {
    id: id, topology: topology, mode: mode, title: names[topology] + ' em ' + mode,
    params: { Vin: Vin, Vo: Vo, D: D, D2: D2, D3: Math.max(0, 1 - D - D2),
      Imin: Imin, Imax: Imax, Ipk: Imax, deltaIL: Imax - Imin, ILavg: ILavg,
      Io: Io, fs: fs, L: L, C: 100e-6, R: Vo / Io },
    stages: stages,
    formula: mode === 'CCM'
      ? ({ buck: 'Vo/Vin = D', boost: 'Vo/Vin = 1/(1 − D)', buckboost: 'vout/Vin = −D/(1 − D)' })[topology]
      : ({ buck: 'M = 2/[1 + √(1 + 4K/D²)]', boost: 'M = [1 + √(1 + 4D²/K)]/2', buckboost: 'vout/Vin = −D/√K' })[topology]
  };
});

function initConverterDashboards() {
  Object.keys(CONVERTER_CONFIGS).forEach(function (moduleId) {
    var host = document.getElementById('dashboard-host-' + moduleId);
    if (!host) {
      var section = document.getElementById(moduleId);
      if (!section || section.querySelector('.converter-dashboard')) return;
      var body = section.querySelector('.module-body');
      if (!body) return;
      var slot = body.querySelector('.converter-dashboard-slot');
      if (slot) {
        host = slot;
      } else {
        var heading = body.querySelector('h3');
        host = document.createElement('div');
        host.className = 'converter-dashboard-slot';
        if (heading) heading.insertAdjacentElement('afterend', host);
        else body.insertBefore(host, body.firstChild);
      }
    }
    createAnimatedConverterSimulator(host, CONVERTER_CONFIGS[moduleId]);
  });
}

function calculateInstantState(config, tau) {
  var p = config.params;
  tau = Math.max(0, Math.min(1, tau)); // 1 representa o limite Ts− no controle manual.
  var D2 = config.mode === 'CCM' ? 1 - p.D : p.D2;
  var idx = tau < p.D ? 0 : (config.mode === 'CCM' || tau < p.D + D2 ? 1 : 2);
  var on = idx === 0, off = idx === 1;
  var iL = on ? p.Imin + p.deltaIL * tau / p.D
    : off ? p.Imax - p.deltaIL * (tau - p.D) / D2 : 0;
  iL = Math.max(0, iL);
  var buck = config.topology === 'buck', boost = config.topology === 'boost';
  var vL = on ? (buck ? p.Vin - p.Vo : p.Vin) : off ? (boost ? p.Vin - p.Vo : -p.Vo) : 0;
  var iS = on ? iL : 0, iD = off ? iL : 0;
  return { tau: tau, stageIdx: idx, stage: config.stages[idx], vL: vL, iL: iL, iS: iS, iD: iD,
    vS: on ? 0 : off ? (buck ? p.Vin : boost ? p.Vo : p.Vin + p.Vo) : (buck ? p.Vin - p.Vo : p.Vin),
    vD: off ? 0 : on ? -(buck ? p.Vin : boost ? p.Vo : p.Vin + p.Vo) : (boost ? p.Vin - p.Vo : -p.Vo),
    iC: (buck ? iL : iD) - p.Io,
    iIn: boost ? iL : iS, Io: p.Io,
    // Corrente vertical física, positiva de cima para baixo.
    iCDown: ((buck ? iL : iD) - p.Io) * (config.topology === 'buckboost' ? -1 : 1),
    iOutDown: p.Io * (config.topology === 'buckboost' ? -1 : 1)
  };
}

function integrateCapacitorVoltageRise(config, tau) {
  var p = config.params;
  tau = Math.max(0, Math.min(1, tau));
  if (!p.C || !p.fs || tau <= 0) return 0;

  var breaks = [0, p.D, p.D + p.D2, 1]
    .filter(function (value, index, array) {
      return value >= 0 && value <= 1 && array.indexOf(value) === index;
    })
    .sort(function (a, b) { return a - b; });

  var normalizedCharge = 0;
  for (var i = 0; i < breaks.length - 1; i++) {
    var a = breaks[i], b = breaks[i + 1];
    if (a >= tau) break;
    var end = Math.min(b, tau);
    if (end <= a) continue;
    var epsilon = Math.min(1e-9, (end - a) * 1e-5);
    var leftTau = Math.min(end, a + epsilon);
    var rightTau = Math.max(a, end - epsilon);
    var iLeft = calculateInstantState(config, leftTau).iC;
    var iRight = calculateInstantState(config, rightTau).iC;
    normalizedCharge += (iLeft + iRight) * 0.5 * (end - a);
    if (end === tau) break;
  }
  return normalizedCharge / (p.C * p.fs);
}

function capacitorVoltageAt(config, tau) {
  var p = config.params;
  if (!Number.isFinite(config._capVoltageMeanRise)) {
    var samples = 256, sum = 0;
    for (var i = 0; i < samples; i++) {
      sum += integrateCapacitorVoltageRise(config, (i + 0.5) / samples);
    }
    config._capVoltageMeanRise = sum / samples;
  }
  return p.Vo + integrateCapacitorVoltageRise(config, tau) - config._capVoltageMeanRise;
}

function capacitorRipple(config) {
  var lo = Infinity, hi = -Infinity;
  for (var i = 0; i <= 256; i++) {
    var v = capacitorVoltageAt(config, i / 256);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return hi - lo;
}

function converterEvents(config) {
  var p = config.params, events = [
    { tau: 0, title: 'PWM fecha S', detail: 'Início do ciclo: S conduz e D bloqueia; vL torna-se positiva.' },
    { tau: p.D, title: 'PWM abre S', detail: 'iL não salta: a corrente comuta de S para D; vL torna-se negativa.' }
  ];
  if (config.mode === 'DCM') events.push({ tau: p.D + p.D2, title: 'iL = 0: D bloqueia',
    detail: 'Fim da desmagnetização: o diodo impede corrente negativa e começa o intervalo de corrente nula.' });
  var ratio = (p.Io - p.Imin) / p.deltaIL;
  if (ratio > 0 && ratio < 1) {
    if (config.topology === 'buck') events.push({ tau: ratio * p.D, title: 'iC = 0: C passa a carregar',
      detail: 'iL cruza Io: iC muda de negativa para positiva e a tensão do capacitor atinge um mínimo. S e D mantêm seus estados.' });
    events.push({ tau: p.D + (1 - ratio) * p.D2, title: 'iC = 0: C passa a descarregar',
      detail: 'A corrente entregue à saída cai abaixo de Io. A tensão do capacitor atinge um máximo; o diodo continua conduzindo.' });
  }
  return events.sort(function (a, b) { return a.tau - b.tau; });
}


function converterStageCardHtml(config, stageIdx) {
  var stage = config.stages[stageIdx];
  return '<div class="stage-number"><span>Etapa ' + (stageIdx + 1) + ' de ' + config.stages.length + '</span><span>' + stage.interval + '</span></div>' +
    '<h5>' + stage.name + '</h5>' +
    '<div class="stage-interval">Chave: ' + stage.sw + ' • Diodo: ' + stage.diode + '</div>' +
    '<p class="stage-note">' + stage.note + '</p>';
}

function stabilizeConverterDashboardHeights(container, config, events) {
  var panel = container.querySelector('.converter-dashboard-panel');
  var stageCard = container.querySelector('[data-role="simStageCard"]');
  var eventDetail = container.querySelector('[data-role="simEventDetail"]');
  var capStatus = container.querySelector('[data-role="simCapStatus"]');
  if (!panel || !stageCard || !eventDetail || !capStatus) return;

  var capVariants = [
    'iC = 0: instante de extremo da tensão de C.',
    'C carrega: a corrente entregue à saída supera Io; |vout| cresce.',
    'C descarrega: fornece a corrente que falta à carga; |vout| diminui.'
  ];

  function measure(reference, variants, htmlMode) {
    var rect = reference.getBoundingClientRect();
    if (!rect.width) return 0;
    var parent = reference.parentElement;
    var probe = reference.cloneNode(false);
    probe.removeAttribute('data-role');
    probe.removeAttribute('id');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.left = '-10000px';
    probe.style.top = '0';
    probe.style.width = rect.width + 'px';
    probe.style.height = 'auto';
    probe.style.minHeight = '0';
    probe.style.maxHeight = 'none';
    probe.style.overflow = 'visible';
    probe.style.marginTop = getComputedStyle(reference).marginTop;
    probe.style.marginBottom = getComputedStyle(reference).marginBottom;
    parent.appendChild(probe);

    var max = 0;
    variants.forEach(function (value) {
      if (htmlMode) probe.innerHTML = value;
      else probe.textContent = value;
      max = Math.max(max, Math.ceil(probe.getBoundingClientRect().height));
    });
    probe.remove();
    return max + 4;
  }

  function calibrate() {
    if (window.innerWidth <= 600) {
      container.style.removeProperty('--converter-stage-card-height');
      container.style.removeProperty('--converter-event-detail-height');
      container.style.removeProperty('--converter-cap-status-height');
      return;
    }
    var stageHeight = measure(stageCard, config.stages.map(function (_, idx) {
      return converterStageCardHtml(config, idx);
    }), true);
    var eventHeight = measure(eventDetail, events.map(function (event) { return event.detail; }), false);
    var capHeight = measure(capStatus, capVariants, false);

    if (stageHeight) container.style.setProperty('--converter-stage-card-height', stageHeight + 'px');
    if (eventHeight) container.style.setProperty('--converter-event-detail-height', eventHeight + 'px');
    if (capHeight) container.style.setProperty('--converter-cap-status-height', capHeight + 'px');
  }

  var lastWidth = -1;
  var resizeTimer = null;
  var observer = new ResizeObserver(function (entries) {
    var width = Math.round(entries[0].contentRect.width);
    if (Math.abs(width - lastWidth) < 2) return;
    lastWidth = width;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(calibrate, 80);
  });
  observer.observe(panel);

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      lastWidth = Math.round(panel.getBoundingClientRect().width);
      calibrate();
    });
  });
}


function createAnimatedConverterSimulator(host, config) {
  var tau = 0.15;
  var isPlaying = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var speed = 1.0;
  var activeChannel = 'indutor';
  var lastTimestamp = null;
  var animId = null;
  var isVisible = false;
  var flowPhase = 0;
  var renderedStage = -1;
  var renderedChannel = null;
  var events = converterEvents(config);

  var container = document.createElement('section');
  container.className = 'converter-dashboard';
  container.setAttribute('aria-label', 'Simulador dinâmico de ' + config.title);

  container.innerHTML =
    '<div class="converter-dashboard-head">' +
      '<div>' +
        '<span class="converter-dashboard-kicker">Simulador Interativo • Circuito & Osciloscópio</span>' +
        '<h4>' + config.title + '</h4>' +
        '<p>Acompanhe o caminho físico da corrente, as polaridades de tensão e as formas de onda simultâneas.</p>' +
      '</div>' +
      '<div class="converter-dashboard-tags">' +
        '<span class="tag-mode">' + config.mode + '</span>' +
        '<span>' + (config.topology === 'buckboost' ? 'Buck-Boost' : config.topology.charAt(0).toUpperCase() + config.topology.slice(1)) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="converter-dashboard-layout">' +
      '<div class="converter-animator-visual">' +
        '<div class="converter-circuit-box">' +
          '<div class="converter-box-title">' +
            '<span>Diagrama do Circuito</span>' +
            '<span class="active-indicator" data-role="simStageIndicator">● Etapa 1</span>' +
          '</div>' +
          '<div class="converter-dashboard-svg" data-role="simCircuitSvg"></div>' +
          '<div class="converter-dashboard-legend">' +
            '<span><i class="legend-current"></i> Corrente Ativa</span>' +
            '<span><i class="legend-blocked"></i> Ramo Bloqueado</span>' +
            '<span><i class="legend-vl"></i> Tensão (vL)</span>' +
            '<span><i class="legend-idle"></i> Corrente de C</span>' +
          '</div>' +
          '<p class="converter-conventions">Setas: corrente convencional. vL usa os sinais fixos junto a L; vD = vA − vK. iC é positiva entrando no terminal positivo de C, que fica embaixo no inversor. vS é medida da entrada ao nó comutado (no Boost, do nó ao terra).</p>' +
        '</div>' +
        '<div class="converter-scope-box">' +
          '<div class="converter-box-title">' +
            '<span>Formas de Onda (v e i)</span>' +
            '<div class="converter-channel-tabs" data-role="simChannelTabs">' +
              '<button type="button" data-chan="indutor" class="active">Indutor (vL, iL)</button>' +
              '<button type="button" data-chan="semicondutores">Semicondutores (S, D)</button>' +
              '<button type="button" data-chan="filtro">Capacitor (vC, iC)</button>' +
            '</div>' +
          '</div>' +
          '<div class="converter-scope-svg" data-role="simScopeSvg"></div>' +
          '<div class="converter-scope-legend">' +
            '<span><i class="legend-vl"></i> vL(t) Tensão</span>' +
            '<span><i class="legend-current"></i> iL(t) Corrente</span>' +
            '<span><i class="legend-sw"></i> iS Chave</span>' +
            '<span><i class="legend-idle"></i> vC / iD / iC</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="converter-dashboard-panel">' +
        '<div class="dashboard-controls-bar">' +
          '<div class="dashboard-controls-main">' +
            '<button type="button" class="btn-ctrl-play" data-role="simPlayBtn">Pausar</button>' +
            '<div class="btn-ctrl-speed-group">' +
              '<button type="button" class="btn-ctrl-speed" data-speed="0.5">0.5x</button>' +
              '<button type="button" class="btn-ctrl-speed active" data-speed="1.0">1.0x</button>' +
              '<button type="button" class="btn-ctrl-speed" data-speed="2.0">2.0x</button>' +
            '</div>' +
          '</div>' +
          '<div class="dashboard-scrubber-row">' +
            '<input type="range" class="timeline-scrubber" data-role="simScrubber" min="0" max="1000" value="150" aria-label="Tempo normalizado t / Ts">' +
            '<span class="scrubber-time-badge" data-role="simTimeBadge">15% Ts</span>' +
          '</div>' +
        '</div>' +
        '<div class="converter-stage-buttons" data-role="simStageButtons"></div>' +
        '<div class="converter-stage-card" data-role="simStageCard"></div>' +
        '<div class="converter-events"><strong>Eventos notáveis · clique para inspecionar</strong><div data-role="simEvents"></div><p data-role="simEventDetail"></p></div>' +
        '<p class="converter-cap-status" data-role="simCapStatus"></p>' +
        '<div class="stage-telemetry-grid" data-role="simTelemetryGrid">' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>vL (Indutor)</span><span>L</span></div><div class="telemetry-cell-val highlight-v" data-role="telVL">+12.0 V</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>iL (Indutor)</span><span>L</span></div><div class="telemetry-cell-val highlight-i" data-role="telIL">2.10 A</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>vS (Chave)</span><span>S</span></div><div class="telemetry-cell-val" data-role="telVS">0.0 V</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>iS (Chave)</span><span>S</span></div><div class="telemetry-cell-val" data-role="telIS">2.10 A</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>vD (Diodo)</span><span>D</span></div><div class="telemetry-cell-val highlight-warn" data-role="telVD">-24.0 V</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>iD (Diodo)</span><span>D</span></div><div class="telemetry-cell-val" data-role="telID">0.0 A</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>vC (Capacitor)</span><span>C</span></div><div class="telemetry-cell-val highlight-v" data-role="telVC">' + config.params.Vo.toFixed(2) + ' V</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>iC (Capacitor)</span><span>C</span></div><div class="telemetry-cell-val" data-role="telIC">+0.10 A</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>Saída (vout, |Io|)</span><span>R</span></div><div class="telemetry-cell-val" data-role="telVo">' + (config.topology === 'buckboost' ? '−' : '') + config.params.Vo + 'V / ' + config.params.Io.toFixed(2) + 'A</div></div>' +
        '</div>' +
        '<div class="converter-dashboard-formula">' +
          '<span>Relação Teórica de Ganho</span>' +
          '<strong>' + config.formula + '</strong>' +
        '</div>' +
        '<div class="converter-dashboard-formula">' +
          '<span>Tensão no Capacitor</span>' +
          '<strong>vC(t) = vC(t₀) + (1/C) ∫[t₀→t] iC(τ) dτ</strong>' +
          '<small>Em RPP: vC(Ts) = vC(0) e ⟨iC⟩ = 0. A inclinação de vC é iC/C; os extremos de vC ocorrem quando iC = 0.</small>' +
        '</div>' +
        '<p class="converter-conventions">Modelo ideal periódico, saída com pequena ondulação. fs = 50 kHz; L = ' + (config.params.L * 1e6).toFixed(1) + ' µH; C = ' + (config.params.C * 1e6).toFixed(0) + ' µF; R = ' + config.params.R.toFixed(2) + ' Ω. Tempo ampliado para estudo; pontos indicam o sentido, não a velocidade dos elétrons.</p>' +
      '</div>' +
    '</div>';

  host.innerHTML = '';
  host.appendChild(container);

  var circuitSvgBox = container.querySelector('[data-role="simCircuitSvg"]');
  var scopeSvgBox = container.querySelector('[data-role="simScopeSvg"]');
  var stageIndicator = container.querySelector('[data-role="simStageIndicator"]');
  var playBtn = container.querySelector('[data-role="simPlayBtn"]');
  var scrubber = container.querySelector('[data-role="simScrubber"]');
  var timeBadge = container.querySelector('[data-role="simTimeBadge"]');
  var stageButtons = container.querySelector('[data-role="simStageButtons"]');
  var stageCard = container.querySelector('[data-role="simStageCard"]');
  var channelTabs = container.querySelectorAll('[data-role="simChannelTabs"] button');
  var speedButtons = container.querySelectorAll('.btn-ctrl-speed');

  var telVL = container.querySelector('[data-role="telVL"]');
  var telIL = container.querySelector('[data-role="telIL"]');
  var telVS = container.querySelector('[data-role="telVS"]');
  var telIS = container.querySelector('[data-role="telIS"]');
  var telVD = container.querySelector('[data-role="telVD"]');
  var telID = container.querySelector('[data-role="telID"]');
  var telVC = container.querySelector('[data-role="telVC"]');
  var telIC = container.querySelector('[data-role="telIC"]');
  var eventDetail = container.querySelector('[data-role="simEventDetail"]');
  var capStatus = container.querySelector('[data-role="simCapStatus"]');
  var eventButtons = events.map(function (event) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = (event.tau * 100).toFixed(1) + '% · ' + event.title;
    button.addEventListener('click', function () {
      isPlaying = false;
      tau = event.tau;
      updatePlayBtnUI();
      render();
    });
    container.querySelector('[data-role="simEvents"]').appendChild(button);
    return button;
  });

  config.stages.forEach(function (stg, idx) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<strong>' + (idx + 1) + '</strong> ' + stg.name.split('·')[0];
    btn.addEventListener('click', function () {
      isPlaying = false;
      updatePlayBtnUI();
      if (idx === 0) tau = config.params.D / 2;
      else if (idx === 1) tau = config.params.D + config.params.D2 / 2;
      else tau = config.params.D + config.params.D2 + config.params.D3 / 2;
      scrubber.value = Math.round(tau * 1000);
      render();
    });
    stageButtons.appendChild(btn);
  });

  stabilizeConverterDashboardHeights(container, config, events);

  playBtn.addEventListener('click', function () {
    isPlaying = !isPlaying;
    updatePlayBtnUI();
  });

  function updatePlayBtnUI() {
    playBtn.innerHTML = '';
    if (window.UiIcons) playBtn.appendChild(window.UiIcons.create(isPlaying ? 'pause' : 'play'));
    const playLabel = document.createElement('span');
    playLabel.textContent = isPlaying ? 'Pausar' : 'Reproduzir';
    playBtn.appendChild(playLabel);
    playBtn.style.borderColor = isPlaying ? 'var(--ahti-info)' : 'var(--ahti-success)';
    playBtn.style.color = isPlaying ? 'var(--ahti-info)' : 'var(--ahti-success)';
    playBtn.setAttribute('aria-pressed', String(isPlaying));
    syncAnimation();
  }

  speedButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      speedButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      speed = parseFloat(btn.getAttribute('data-speed')) || 1.0;
    });
  });

  channelTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      channelTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      activeChannel = tab.getAttribute('data-chan');
      render();
    });
  });

  scrubber.addEventListener('input', function () {
    isPlaying = false;
    updatePlayBtnUI();
    tau = parseFloat(scrubber.value) / 1000;
    render();
  });

  function render() {
    var state = calculateInstantState(config, tau);
    state.vC = capacitorVoltageAt(config, tau);
    scrubber.value = Math.round(tau * 1000);
    var currentEvent = 0;
    events.forEach(function (event, i) { if (tau + 1e-10 >= event.tau) currentEvent = i; });
    eventButtons.forEach(function (button, i) {
      button.classList.toggle('active', i === currentEvent);
      button.setAttribute('aria-pressed', String(i === currentEvent));
    });
    eventDetail.textContent = events[currentEvent].detail;
    capStatus.textContent = Math.abs(state.iC) < 1e-9 ? 'iC = 0: instante de extremo da tensão de C.' :
      state.iC > 0 ? 'C carrega: a corrente entregue à saída supera Io; |vout| cresce.' :
      'C descarrega: fornece a corrente que falta à carga; |vout| diminui.';

    timeBadge.textContent = (tau * 100).toFixed(0) + '% Ts';
    stageIndicator.textContent = '● ' + state.stage.name;
    stageIndicator.style.color = state.stage.kind === 'on' ? 'var(--ahti-success)' : (state.stage.kind === 'off' ? 'var(--ahti-info)' : 'var(--ahti-capacitor)');

    var stageBtns = stageButtons.querySelectorAll('button');
    stageBtns.forEach(function (btn, i) {
      if (i === state.stageIdx) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    if (renderedStage !== state.stageIdx) stageCard.innerHTML = converterStageCardHtml(config, state.stageIdx);

    telVL.textContent = (state.vL > 0 ? '+' : '') + state.vL.toFixed(1) + ' V';
    telVL.className = 'telemetry-cell-val ' + (state.vL > 0 ? 'highlight-v' : (state.vL < 0 ? 'highlight-warn' : 'highlight-zero'));

    telIL.textContent = state.iL.toFixed(2) + ' A';
    telIL.className = 'telemetry-cell-val ' + (state.iL > 0 ? 'highlight-i' : 'highlight-zero');

    telVS.textContent = state.vS.toFixed(1) + ' V';
    telVS.className = 'telemetry-cell-val ' + (state.vS > 0 ? 'highlight-warn' : 'highlight-zero');

    telIS.textContent = state.iS.toFixed(2) + ' A';
    telIS.className = 'telemetry-cell-val ' + (state.iS > 0 ? 'highlight-i' : 'highlight-zero');

    telVD.textContent = state.vD.toFixed(1) + ' V';
    telVD.className = 'telemetry-cell-val ' + (state.vD < 0 ? 'highlight-warn' : 'highlight-zero');

    telID.textContent = state.iD.toFixed(2) + ' A';
    telID.className = 'telemetry-cell-val ' + (state.iD > 0 ? 'highlight-i' : 'highlight-zero');

    telVC.textContent = state.vC.toFixed(3) + ' V';
    telVC.className = 'telemetry-cell-val ' + (state.vC >= config.params.Vo ? 'highlight-v' : 'highlight-warn');

    telIC.textContent = (state.iC > 0 ? '+' : '') + state.iC.toFixed(2) + ' A';
    telIC.className = 'telemetry-cell-val ' + (state.iC >= 0 ? 'highlight-i' : 'highlight-v');

    renderedStage = state.stageIdx;
    if (!circuitSvgBox.firstElementChild) circuitSvgBox.innerHTML = generateCircuitSvgContent(config);
    updateCircuitSvg(circuitSvgBox, state, flowPhase);
    if (renderedChannel !== activeChannel) {
      scopeSvgBox.innerHTML = generateOscilloscopeSvgContent(config, state, activeChannel);
      renderedChannel = activeChannel;
    }
    updateOscilloscopeSvg(scopeSvgBox, state);
  }

  function animLoop(timestamp) {
    animId = null;
    if (!isPlaying || !isVisible || document.hidden || !container.isConnected) return;
    if (lastTimestamp === null) lastTimestamp = timestamp;
    var dt = Math.min(0.08, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    var cycleDuration = 3.6 / speed;
    tau = (tau + (dt / cycleDuration)) % 1.0;
    flowPhase = (flowPhase + dt * speed * 26) % 13;
    scrubber.value = Math.round(tau * 1000);

    render();
    animId = requestAnimationFrame(animLoop);
  }

  function syncAnimation() {
    if (animId !== null) cancelAnimationFrame(animId);
    animId = null;
    lastTimestamp = null;
    if (isPlaying && isVisible && !document.hidden && container.isConnected) animId = requestAnimationFrame(animLoop);
  }

  var observer = new IntersectionObserver(function (entries) {
    isVisible = entries[0].isIntersecting;
    syncAnimation();
  }, { threshold: 0 });

  observer.observe(container);
  document.addEventListener('visibilitychange', syncAnimation);
  render();
  updatePlayBtnUI();
}

// Os caminhos têm orientação física explícita. As setas e o fluxo usam a mesma corrente.
function generateCircuitSvgContent(config) {
  var buck = config.topology === 'buck', boost = config.topology === 'boost';
  var inverted = config.topology === 'buckboost', j = buck ? 215 : 260;
  var prefix = config.id + '-arrow';
  var html = '<svg viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Circuito ' + config.title + ': correntes convencionais e referências de tensão">' +
    '<defs><marker id="' + prefix + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9Z" fill="context-stroke"/></marker></defs>';
  function text(x, y, label, color, size) {
    return '<text x="' + x + '" y="' + y + '" fill="' + (color || 'var(--ahti-text)') + '" font-size="' + (size || 12) + '" font-family="sans-serif">' + label + '</text>';
  }
  function path(d, color, extra) {
    return '<path d="' + d + '" fill="none" stroke="' + (color || 'var(--ahti-control)') + '" stroke-width="2.5" stroke-linecap="round" ' + (extra || '') + '/>';
  }
  function wire(d, current) {
    html += path(d);
    if (current) html += path(d, current === 'iCDown' ? 'var(--ahti-capacitor)' : 'var(--ahti-success)',
      'data-flow="' + current + '" stroke-dasharray="6 7"');
  }
  function arrow(d, current) {
    html += path(d, current === 'iCDown' ? 'var(--ahti-capacitor)' : 'var(--ahti-success)',
      'data-arrow="' + current + '" data-marker="' + prefix + '"');
  }
  function inductor(x, y, vertical) {
    var d = 'M0 0';
    for (var i = 0; i < 4; i++) d += ' q12 -25 24 0';
    html += '<g transform="translate(' + x + ' ' + y + ')' + (vertical ? ' rotate(90)' : '') + '">' + path(d, 'var(--ahti-info)') + '</g>';
  }
  function sw(x, y, vertical) {
    html += '<g transform="translate(' + x + ' ' + y + ')' + (vertical ? ' rotate(90)' : '') + '">';
    html += '<circle r="4" fill="var(--ahti-text)"/><circle cx="50" r="4" fill="var(--ahti-text)"/>';
    html += path('M0 0 L50 0', 'var(--ahti-success)', 'data-switch="closed"');
    html += path('M0 0 L44 -20', 'var(--ahti-danger)', 'data-switch="open"') + '</g>';
  }
  // Símbolo local: A à esquerda e K à direita; a rotação preserva as conexões.
  function diode(x, y, rotation) {
    html += '<g data-diode transform="translate(' + x + ' ' + y + ') rotate(' + rotation + ')">';
    html += path('M-28 0 H-12 M12 0 H28');
    html += '<path d="M-12 -13 L12 0 L-12 13 Z" fill="var(--ahti-surface)" stroke="currentColor" stroke-width="2.5"/>';
    html += path('M12 -15 V15', 'currentColor') + '</g>';
  }
  // Fonte: terminal + em cima, terminal − embaixo; retorno em direção ao terminal −.
  html += '<circle cx="65" cy="135" r="24" fill="var(--ahti-surface)" stroke="var(--ahti-info)" stroke-width="2.5"/>';
  html += text(60, 129, '+', 'var(--ahti-info)', 15) + text(60, 148, '−', 'var(--ahti-info)', 15);
  html += text(14, 178, 'Vin = ' + config.params.Vin + ' V', 'var(--ahti-info)', 11);
  wire('M65 111 V70 H115', 'iIn');
  wire('M' + j + ' 200 H65 V159', 'iIn');
  if (boost) {
    inductor(115, 70, false);
    wire('M211 70 H260', 'iL');
    wire('M260 70 V105', 'iS'); sw(260, 105, true); wire('M260 155 V200', 'iS');
    wire('M260 70 H297', 'iD'); diode(325, 70, 0); wire('M353 70 H460', 'iD');
    wire('M460 200 H260', 'iD');
    html += text(140, 50, '+   L   −', 'var(--ahti-info)') + text(272, 145, 'S') + text(302, 51, 'A  D  K');
    arrow('M132 91 H197', 'iL'); html += text(157, 108, 'iL');
    arrow('M281 162 V191', 'iS'); html += text(290, 180, 'iS');
    arrow('M367 89 H417', 'iD'); html += text(385, 107, 'iD');
  } else {
    sw(115, 70, false); wire('M165 70 H' + j, 'iS');
    html += text(130, 42, 'S'); arrow('M175 90 H205', 'iS'); html += text(177, 108, 'iS');
    if (buck) {
      wire('M215 200 V163', 'iD'); diode(215, 135, -90); wire('M215 107 V70', 'iD');
      wire('M215 70 H270', 'iL'); inductor(270, 70, false); wire('M366 70 H460', 'iL');
      wire('M460 200 H215', 'iL');
      html += text(233, 119, 'K') + text(233, 139, 'D') + text(233, 158, 'A');
      html += text(289, 50, '+   L   −', 'var(--ahti-info)');
      arrow('M175 163 V125', 'iD'); html += text(153, 148, 'iD');
      arrow('M282 91 H354', 'iL'); html += text(310, 108, 'iL');
    } else {
      wire('M260 70 V85', 'iL'); inductor(260, 85, true); wire('M260 181 V200', 'iL');
      wire('M460 70 H353', 'iD'); diode(325, 70, 180); wire('M297 70 H260', 'iD');
      wire('M260 200 H460', 'iD');
      html += text(240, 99, '+', 'var(--ahti-info)') + text(240, 177, '−', 'var(--ahti-info)') + text(240, 138, 'L', 'var(--ahti-info)');
      html += text(302, 51, 'K  D  A');
      arrow('M296 120 V166', 'iL'); html += text(305, 148, 'iL');
      arrow('M417 89 H367', 'iD'); html += text(385, 107, 'iD');
    }
  }
  // C e R compartilham os nós de saída. Os fios terminam nos componentes.
  wire('M460 70 V126 M460 144 V200', 'iCDown');
  html += path('M442 126 H478 M442 144 H478', 'var(--ahti-capacitor)');
  html += text(429, 139, 'C', 'var(--ahti-capacitor)');
  html += text(426, 116, inverted ? '− vC' : '+ vC', 'var(--ahti-capacitor)', 10);
  html += text(426, 162, inverted ? '+' : '−', 'var(--ahti-capacitor)', 10);
  arrow('M498 112 V160', 'iCDown'); html += text(504, 139, 'iC', 'var(--ahti-capacitor)');
  wire('M460 70 H560 V112 M560 158 V200 H460', 'iOutDown');
  html += '<rect x="550" y="112" width="20" height="46" fill="var(--ahti-surface)" stroke="var(--ahti-warning)" stroke-width="2.5"/>';
  html += text(572, 139, 'R', 'var(--ahti-warning)');
  arrow('M601 110 V160', 'iOutDown'); html += text(611, 139, 'Io', 'var(--ahti-success)');
  html += text(636, 78, inverted ? '−' : '+', 'var(--ahti-warning)', 16) + text(636, 203, inverted ? '+' : '−', 'var(--ahti-warning)', 16);
  html += text(575, 233, (inverted ? '−' : '+') + config.params.Vo + ' V', 'var(--ahti-warning)');
  [[j,70],[j,200],[460,70],[460,200]].forEach(function (xy) {
    html += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="4" fill="var(--ahti-text)"/>';
  });
  html += path('M' + j + ' 200 V214 m-12 0 h24 m-20 5 h16 m-12 5 h8');
  html += text(j + 18, 221, '0 V', 'var(--ahti-subtle)', 10);
  html += '<text x="24" y="249" data-circuit-status fill="var(--ahti-text)" font-size="12" font-family="sans-serif"></text></svg>';
  return html;
}

function updateCircuitSvg(box, state, flowPhase) {
  box.querySelectorAll('[data-flow]').forEach(function (path) {
    var current = state[path.dataset.flow];
    path.style.visibility = Math.abs(current) < 1e-9 ? 'hidden' : 'visible';
    path.setAttribute('stroke-dashoffset', -flowPhase * Math.sign(current));
  });
  box.querySelectorAll('[data-arrow]').forEach(function (path) {
    var current = state[path.dataset.arrow];
    path.style.visibility = Math.abs(current) < 1e-9 ? 'hidden' : 'visible';
    path.setAttribute('marker-end', current > 0 ? 'url(#' + path.dataset.marker + ')' : 'none');
    path.setAttribute('marker-start', current < 0 ? 'url(#' + path.dataset.marker + ')' : 'none');
  });
  box.querySelector('[data-switch="closed"]').style.display = state.stageIdx === 0 ? '' : 'none';
  box.querySelector('[data-switch="open"]').style.display = state.stageIdx === 0 ? 'none' : '';
  box.querySelector('[data-diode]').style.color = state.stageIdx === 1 ? 'var(--ahti-success)' : 'var(--ahti-danger)';
  box.querySelector('[data-circuit-status]').textContent = 'vL = ' + state.vL.toFixed(1) + ' V  •  iL = ' + state.iL.toFixed(2) + ' A  •  vC = ' + state.vC.toFixed(3) + ' V  •  iC = ' + state.iC.toFixed(2) + ' A';
}

function waveformSegments(config) {
  var ends = [0, config.params.D, config.params.D + config.params.D2];
  if (config.mode === 'DCM') ends.push(1);
  return ends.slice(0, -1).map(function (start, i) {
    var end = ends[i + 1];
    return { start: start, end: end,
      left: calculateInstantState(config, start + 1e-12),
      right: calculateInstantState(config, end - 1e-12) };
  });
}

function generateOscilloscopeSvgContent(config, state, channel) {
  var x = function (t) { return 62 + 588 * t; };
  var segments = waveformSegments(config);
  var voltages = channel === 'semicondutores' ? ['vS', 'vD'] : channel === 'filtro' ? ['vC'] : ['vL'];
  var currents = channel === 'filtro' ? ['iC'] : channel === 'semicondutores' ? ['iL', 'iS', 'iD'] : ['iL'];
  var colors = {
    vL: 'var(--ahti-info)', vS: 'var(--ahti-warning)', vD: 'var(--ahti-capacitor)',
    vC: 'var(--ahti-capacitor)', iL: 'var(--ahti-success)', iS: 'var(--ahti-warning)',
    iD: 'var(--ahti-capacitor)', iC: 'var(--ahti-capacitor)'
  };
  var html = '<svg viewBox="0 0 680 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Formas de onda sincronizadas: ' + voltages.concat(currents).join(', ') + '">';
  function text(xp, yp, label, color, anchor) {
    return '<text x="' + xp + '" y="' + yp + '" fill="' + (color || 'var(--ahti-subtle)') + '" font-size="11" font-family="sans-serif" text-anchor="' + (anchor || 'start') + '">' + label + '</text>';
  }
  function line(x1, y1, x2, y2, color, extra) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" ' + (extra || '') + '/>';
  }
  function valueAt(key, tau, fallbackState) {
    return key === 'vC' ? capacitorVoltageAt(config, tau) : fallbackState[key];
  }
  converterEvents(config).forEach(function (event) {
    html += line(x(event.tau), 26, x(event.tau), 267, 'var(--ahti-border)', 'stroke-dasharray="3 5"');
  });
  function panel(keys, top, bottom, unit) {
    var values = [0];
    keys.forEach(function (key) {
      if (key === 'vC') {
        for (var sample = 0; sample <= 96; sample++) values.push(capacitorVoltageAt(config, sample / 96));
      } else {
        segments.forEach(function (s) { values.push(s.left[key], s.right[key]); });
      }
    });
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (keys.length === 1 && keys[0] === 'vC') {
      values = values.filter(function (v) { return v !== 0; });
      lo = Math.min.apply(null, values);
      hi = Math.max.apply(null, values);
    }
    var margin = Math.max((hi - lo) * 0.15, keys[0] === 'vC' ? 0.002 : 0.05);
    var scale = (bottom - top) / (hi - lo + 2 * margin);
    var zero = top + (hi + margin) * scale;
    var y = function (v) { return zero - v * scale; };
    html += text(62, top - 7, keys.join(' / ') + ' [' + unit + ']', 'var(--ahti-text)');
    if (lo <= 0 && hi >= 0) html += line(62, zero, 650, zero, 'var(--ahti-control)', 'stroke-dasharray="3 3"');
    [lo, hi].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (v) {
      html += text(54, y(v) + 4, v.toFixed(keys[0] === 'vC' ? 3 : 2), 'var(--ahti-subtle)', 'end');
    });
    if (lo !== 0 && hi !== 0 && lo < 0 && hi > 0) html += text(54, zero + 4, '0', 'var(--ahti-subtle)', 'end');
    keys.forEach(function (key, index) {
      var d = '';
      if (key === 'vC') {
        for (var sample = 0; sample <= 96; sample++) {
          var tauSample = sample / 96;
          d += (sample ? ' L' : 'M') + x(tauSample) + ' ' + y(capacitorVoltageAt(config, tauSample));
        }
      } else {
        segments.forEach(function (s, i) {
          d += (i ? ' L' : 'M') + x(s.start) + ' ' + y(s.left[key]) + ' L' + x(s.end) + ' ' + y(s.right[key]);
        });
      }
      html += '<path data-trace="' + key + '" d="' + d + '" fill="none" stroke="' + colors[key] + '" stroke-width="2.3"' + (index ? ' stroke-dasharray="' + (index === 1 ? '7 4' : '2 4') + '"' : '') + '/>';
      html += text(460 + index * 62, top - 7, key, colors[key]);
      html += '<circle data-scope-dot="' + key + '" data-zero="' + zero + '" data-scale="' + scale + '" r="4" fill="' + colors[key] + '" stroke="#fff"/>';
    });
  }
  panel(voltages, 30, 119, 'V');
  panel(currents, 167, 263, 'A');
  html += text(62, 143, channel === 'filtro'
    ? 'dvC/dt = iC/C • iC > 0: vC sobe • iC < 0: vC desce • iC = 0: extremo de vC'
    : 'iL é contínua na comutação; vL muda de sinal e altera a inclinação de iL.', 'var(--ahti-muted)');
  if (channel === 'filtro') {
    html += text(650, 143, 'ΔvC ≈ ' + (capacitorRipple(config) * 1000).toFixed(1) + ' mV', 'var(--ahti-capacitor)', 'end');
  }
  html += text(62, 283, '0');
  html += text(x(config.params.D), 283, 'D·Ts', 'var(--ahti-subtle)', 'middle');
  if (config.mode === 'DCM') html += text(x(config.params.D + config.params.D2), 283, '(D+D₂)·Ts', 'var(--ahti-capacitor)', 'middle');
  html += text(650, 283, 'Ts', 'var(--ahti-subtle)', 'end');
  html += line(62, 23, 62, 268, 'var(--ahti-info)', 'data-scope-cursor stroke-width="1.5" stroke-dasharray="2 2"');
  return html + '</svg>';
}

function updateOscilloscopeSvg(box, state) {
  var x = 62 + 588 * state.tau;
  var cursor = box.querySelector('[data-scope-cursor]');
  cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
  box.querySelectorAll('[data-scope-dot]').forEach(function (dot) {
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', Number(dot.dataset.zero) - state[dot.dataset.scopeDot] * Number(dot.dataset.scale));
  });
}



/* ==========================================================================
   4. MODO DE PROVA: formulário flutuante, impressão e PDF via navegador
   ========================================================================== */

function examWaveSvg(def) {
  var W=720,left=72,right=20,top=28,panelH=96,gap=16,signals=def.signals||[];
  var H=top+signals.length*(panelH+gap)+40,h=[];
  function x(t){return left+(W-left-right)*t;}
  function txt(xp,yp,t,cls,anchor){h.push('<text x="'+xp+'" y="'+yp+'" class="'+(cls||'exam-svg-text')+'" text-anchor="'+(anchor||'start')+'">'+t+'</text>');}
  function line(x1,y1,x2,y2,cls){h.push('<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" class="'+(cls||'exam-grid')+'"/>');}
  h.push('<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Formas de onda '+def.title+'">');
  (def.markers||[]).forEach(function(m){line(x(m.t),16,x(m.t),H-28,'exam-marker-line');txt(x(m.t),H-10,m.label,'exam-svg-subtle','middle');});
  signals.forEach(function(sig,idx){
    var yTop=top+idx*(panelH+gap),yBottom=yTop+panelH;
    var vals=sig.points.map(function(p){return p[1];});
    var lo=sig.min!=null?sig.min:Math.min.apply(null,vals.concat([0]));
    var hi=sig.max!=null?sig.max:Math.max.apply(null,vals.concat([0]));
    if(Math.abs(hi-lo)<1e-9){hi+=1;lo-=1;}
    var pad=(hi-lo)*0.14||1;hi+=pad;lo-=pad;
    function y(v){return yTop+(hi-v)/(hi-lo)*panelH;}
    line(left,yBottom,W-right,yBottom,'exam-grid');line(left,yTop,left,yBottom,'exam-grid');
    if(lo<=0&&hi>=0)line(left,y(0),W-right,y(0),'exam-zero-line');
    txt(12,yTop+20,sig.label,'exam-svg-title');txt(12,yTop+38,'['+sig.unit+']','exam-svg-subtle');
    var d='';sig.points.forEach(function(p,i){d+=(i?' L':'M')+x(p[0])+' '+y(p[1]);});
    h.push('<path d="'+d+'" class="exam-trace" fill="none"/>');
    (sig.annotations||[]).forEach(function(a){var ax=x(a.t),ay=y(a.v);h.push('<circle cx="'+ax+'" cy="'+ay+'" r="3.5" class="exam-point"/>');txt(ax+(a.dx||7),ay+(a.dy||-8),a.text,'exam-svg-value',a.anchor||'start');});
    (sig.brackets||[]).forEach(function(b){var bx=x(b.t),y1=y(b.v1),y2=y(b.v2);line(bx,y1,bx,y2,'exam-bracket');line(bx-6,y1,bx+6,y1,'exam-bracket');line(bx-6,y2,bx+6,y2,'exam-bracket');txt(bx+10,(y1+y2)/2+4,b.label,'exam-svg-value');});
  });
  txt(left,H-10,'0','exam-svg-subtle','middle');txt(W-right,H-10,def.periodLabel||'Tₛ','exam-svg-subtle','end');
  h.push('</svg>');return h.join('');
}

function examStaticCircuit(def) {
  if(def.topology==='capacitor') return '<div class="exam-cap-symbol"><div class="exam-cap-symbol-plates"></div><strong>C</strong><span>iC = C·dvC/dt</span><span>vC = vC(t₀) + (1/C)∫iC dt</span></div>';
  var cfg={id:'exam-'+def.topology,title:def.topology==='buck'?'Buck':def.topology==='boost'?'Boost':'Buck-Boost',topology:def.topology,mode:def.mode||'CCM',params:{Vin:def.Vin||100,Vo:def.Vo||60,D:def.D==null?.6:def.D,D2:def.D2==null?.4:def.D2}};
  var wrap=document.createElement('div');wrap.innerHTML=generateCircuitSvgContent(cfg);
  var svg=wrap.firstElementChild;
  var closed=svg.querySelector('[data-switch="closed"]'),open=svg.querySelector('[data-switch="open"]');
  if(closed)closed.style.display='';if(open)open.style.display='none';
  var status=svg.querySelector('[data-circuit-status]');if(status)status.textContent='Topologia e referências de corrente/tensão';
  svg.querySelectorAll('[data-flow],[data-arrow]').forEach(function(el){el.style.visibility='visible';});
  return wrap.innerHTML;
}

function getExamFigureDefinitions() {
  return {
    "solHist2024Q1":{title:"2024 Q1 — Buck-Boost DCM / crítica",topology:"buckboost",Vin:100,Vo:66.67,D:.4,audit:"Dados impressos: E=100 V, Ts=20 µs, D=0,4 e L=0,3 mH. O gráfico abaixo mostra a fronteira crítica, em que D₃=0.",markers:[{t:.4,label:"8 µs"},{t:1,label:"20 µs"}],signals:[
      {label:"vL",unit:"V",points:[[0,100],[.4,100],[.4,-66.67],[1,-66.67]],annotations:[{t:.18,v:100,text:"+100 V"},{t:.72,v:-66.67,text:"−66,7 V"}]},
      {label:"iL",unit:"A",points:[[0,0],[.4,2.667],[1,0]],annotations:[{t:.4,v:2.667,text:"Ipk=2,667 A"}]}
    ]},
    "solHist2024Q2":{title:"2024 Q2 — Boost: iD, iC e vC",topology:"boost",Vin:1,Vo:1.667,D:.4,audit:"O gráfico impresso é iD. Preservados 6 A → 2 A de 4 a 10 µs; iC e vC são derivados de iC=iD−Io e dvC/dt=iC/C.",markers:[{t:.4,label:"4 µs"},{t:1,label:"10 µs"}],signals:[
      {label:"iD",unit:"A",points:[[0,0],[.4,0],[.4,6],[1,2]],annotations:[{t:.4,v:6,text:"6 A"},{t:1,v:2,text:"2 A",dx:-7,anchor:"end"}]},
      {label:"iC",unit:"A",points:[[0,-2.4],[.4,-2.4],[.4,3.6],[1,-.4]],annotations:[{t:.18,v:-2.4,text:"−2,4 A"},{t:.4,v:3.6,text:"+3,6 A"}]},
      {label:"vC",unit:"qual.",points:[[0,1.04],[.4,.88],[.55,.94],[.9,1.10],[1,1.09]],min:.8,max:1.14,annotations:[{t:.4,v:.88,text:"mín."},{t:.9,v:1.10,text:"máx."}]}
    ]},
    "solHist2024Q3":{title:"2024 Q3 — Buck: S, vL e iL",topology:"buck",Vin:60,Vo:48,D:.8,audit:"Leitura conferida: tON=80 µs, Ts=100 µs, vL,on=+12 V, IL,médio=4 A e ΔIL=2 A.",markers:[{t:.8,label:"80 µs"},{t:1,label:"100 µs"}],signals:[
      {label:"S",unit:"0/1",points:[[0,1],[.8,1],[.8,0],[1,0]],min:0,max:1},
      {label:"vL",unit:"V",points:[[0,12],[.8,12],[.8,-48],[1,-48]]},
      {label:"iL",unit:"A",points:[[0,3],[.8,5],[1,3]],brackets:[{t:.93,v1:3,v2:5,label:"ΔI=2 A"}]}
    ]},
    "solHistMay25Q1":{title:"2025-05 Q1 — Buck-Boost crítica",topology:"buckboost",Vin:200,Vo:200,D:.5,audit:"E=200 V, Ts=10 µs, D=0,5 e L=100 µH. Na fronteira crítica, |Vo|=200 V e iL toca zero ao fim do período.",markers:[{t:.5,label:"5 µs"},{t:1,label:"10 µs"}],signals:[
      {label:"vL",unit:"V",points:[[0,200],[.5,200],[.5,-200],[1,-200]]},{label:"iL",unit:"A",points:[[0,0],[.5,10],[1,0]],annotations:[{t:.5,v:10,text:"10 A"}]}
    ]},
    "solHistMay25Q2":{title:"2025-05 Q2 — Boost: S, vL e iC",topology:"boost",Vin:42.857,Vo:142.857,D:.7,audit:"Usados apenas níveis legíveis da prova: 70/30 µs, vL,off=−100 V, iC=−1 A e ΔiC=2 A. Os níveis absolutos no OFF são derivados pelo balanço de carga.",markers:[{t:.7,label:"70 µs"},{t:1,label:"100 µs"}],signals:[
      {label:"S",unit:"0/1",points:[[0,1],[.7,1],[.7,0],[1,0]],min:0,max:1},
      {label:"vL",unit:"V",points:[[0,42.857],[.7,42.857],[.7,-100],[1,-100]]},
      {label:"iC",unit:"A",points:[[0,-1],[.7,-1],[.7,3.333],[1,1.333]],brackets:[{t:.94,v1:1.333,v2:3.333,label:"Δi=2 A"}]}
    ]},
    "solHistMay25Q3":{title:"2025-05 Q3 — Buck por iS",topology:"buck",Vin:100,Vo:30,D:.3,audit:"iS existe de 70 a 100 µs; por ser corrente da chave do Buck, esse trecho é ON. O deslocamento horizontal não altera D=0,30.",markers:[{t:.7,label:"70 µs"},{t:1,label:"100 µs"}],signals:[
      {label:"iS",unit:"A",points:[[0,0],[.7,0],[.7,6],[1,8],[1,0]]},{label:"vL",unit:"V",points:[[0,-30],[.7,-30],[.7,70],[1,70]]},{label:"iL",unit:"A",points:[[0,8],[.7,6],[1,8]]}
    ]},
    "solHistSep25Q1":{title:"2025-09 Q1 — Boost crítica",topology:"boost",Vin:200,Vo:400,D:.5,audit:"A topologia da foto é Boost. Com D=0,5, E=200 V e L=100 µH, a fronteira crítica tem Vo=400 V e iL 0→10→0 A.",markers:[{t:.5,label:"5 µs"},{t:1,label:"10 µs"}],signals:[
      {label:"vL",unit:"V",points:[[0,200],[.5,200],[.5,-200],[1,-200]]},{label:"iL",unit:"A",points:[[0,0],[.5,10],[1,0]]},{label:"iD",unit:"A",points:[[0,0],[.5,0],[.5,10],[1,0]]}
    ]},
    "solHistSep25Q2":{title:"2025-09 Q2 — Buck-Boost inversor",topology:"buckboost",Vin:60,Vo:100,D:.625,audit:"Orientação do diodo e polaridade de saída confirmam Buck-Boost inversor. |Vo|=100 V; E=60 V pelo balanço volt-segundo.",markers:[{t:.625,label:"50 µs"},{t:1,label:"80 µs"}],signals:[
      {label:"S",unit:"0/1",points:[[0,1],[.625,1],[.625,0],[1,0]],min:0,max:1},{label:"vL",unit:"V",points:[[0,60],[.625,60],[.625,-100],[1,-100]]},
      {label:"iC",unit:"A",points:[[0,-1],[.625,-1],[.625,2.667],[1,.667]],brackets:[{t:.94,v1:.667,v2:2.667,label:"Δi=2 A"}]}
    ]},
    "solHistSep25Q3":{title:"2025-09 Q3 — Buck por iD",topology:"buck",Vin:100,Vo:70,D:.7,audit:"iD não nula nos últimos 30 µs significa OFF do Buck. Assim, 1−D=0,30 e D=0,70.",markers:[{t:.7,label:"70 µs"},{t:1,label:"100 µs"}],signals:[
      {label:"iD",unit:"A",points:[[0,0],[.7,0],[.7,8],[1,6],[1,0]]},{label:"vL",unit:"V",points:[[0,30],[.7,30],[.7,-70],[1,-70]]},{label:"iL",unit:"A",points:[[0,6],[.7,8],[1,6]]}
    ]},
    "solHistApr26Q1":{title:"2026 Q1 — Buck-Boost: Δi=5 A",topology:"buckboost",Vin:80.77,Vo:150,D:.65,audit:"Correção crítica da foto: 5 A é a ALTURA da ondulação entre 11 A e 6 A, não a corrente final. No OFF, iD/iL cai 11→6 A.",markers:[{t:.65,label:"65 µs"},{t:1,label:"100 µs"}],signals:[
      {label:"S",unit:"0/1",points:[[0,1],[.65,1],[.65,0],[1,0]],min:0,max:1},
      {label:"vL",unit:"V",points:[[0,80.77],[.65,80.77],[.65,-150],[1,-150]]},
      {label:"iL",unit:"A",points:[[0,6],[.65,11],[1,6]],annotations:[{t:.65,v:11,text:"11 A"},{t:1,v:6,text:"6 A",dx:-7,anchor:"end"}],brackets:[{t:.94,v1:6,v2:11,label:"Δi=5 A"}]},
      {label:"iD",unit:"A",points:[[0,0],[.65,0],[.65,11],[1,6],[1,0]],brackets:[{t:.94,v1:6,v2:11,label:"5 A"}]}
    ]},
    "solHistApr26Q2":{title:"2026 Q2 — Boost DCM",topology:"boost",mode:"DCM",Vin:100,Vo:250,D:.3,D2:.2,audit:"O gráfico inferior é iD, não iC. São 30 µs ON, 20 µs de diodo e 50 µs com iL=0: DCM inequívoco.",markers:[{t:.3,label:"30 µs"},{t:.5,label:"50 µs"},{t:1,label:"100 µs"}],signals:[
      {label:"S",unit:"0/1",points:[[0,1],[.3,1],[.3,0],[1,0]],min:0,max:1},
      {label:"vL",unit:"V",points:[[0,100],[.3,100],[.3,-150],[.5,-150],[.5,0],[1,0]]},
      {label:"iL",unit:"A",points:[[0,0],[.3,4],[.5,0],[1,0]]},{label:"iD",unit:"A",points:[[0,0],[.3,0],[.3,4],[.5,0],[1,0]]},{label:"iC",unit:"A",points:[[0,-.4],[.3,-.4],[.3,3.6],[.5,-.4],[1,-.4]]}
    ]},
    "solHistApr26Q3":{title:"2026 Q3 — Buck: iS, iC e vC",topology:"buck",Vin:100,Vo:60,D:.6,audit:"Imin=2 A é dado no texto; 2 A no gráfico é ΔIL. Logo Imax=4 A e Io=3 A. A forma de vC vem do sinal de iC.",markers:[{t:.6,label:"60 µs"},{t:1,label:"100 µs"}],signals:[
      {label:"iS",unit:"A",points:[[0,2],[.6,4],[.6,0],[1,0]],brackets:[{t:.55,v1:2,v2:4,label:"ΔI=2 A"}]},
      {label:"vL",unit:"V",points:[[0,40],[.6,40],[.6,-60],[1,-60]]},
      {label:"iC",unit:"A",points:[[0,-1],[.6,1],[1,-1]],annotations:[{t:.3,v:0,text:"vC mín."},{t:.8,v:0,text:"vC máx."}]},
      {label:"vC",unit:"qual.",points:[[0,1.04],[.3,.92],[.6,1.02],[.8,1.10],[1,1.04]],min:.88,max:1.13}
    ]},
    "solMockA1":{title:"Simulado A1 — Buck-Boost crítica",topology:"buckboost",Vin:120,Vo:80,D:.4,audit:"Conjunto consistente: D=0,40, |Vo|=80 V e Ipk=4,8 A na fronteira.",markers:[{t:.4,label:"8 µs"},{t:1,label:"20 µs"}],signals:[{label:"vL",unit:"V",points:[[0,120],[.4,120],[.4,-80],[1,-80]]},{label:"iL",unit:"A",points:[[0,0],[.4,4.8],[1,0]]}]},
    "solMockA2":{title:"Simulado A2 — Buck-Boost / capacitor",topology:"buckboost",Vin:45,Vo:90,D:.667,audit:"Balanço de carga fecha: −1,5 A por 40 µs; OFF 4,5→1,5 A por 20 µs.",markers:[{t:.667,label:"40 µs"},{t:1,label:"60 µs"}],signals:[{label:"S",unit:"0/1",points:[[0,1],[.667,1],[.667,0],[1,0]],min:0,max:1},{label:"vL",unit:"V",points:[[0,45],[.667,45],[.667,-90],[1,-90]]},{label:"iC",unit:"A",points:[[0,-1.5],[.667,-1.5],[.667,4.5],[1,1.5]],brackets:[{t:.95,v1:1.5,v2:4.5,label:"Δi=3 A"}]},{label:"vC",unit:"qual.",points:[[0,1.05],[.667,.9],[.82,1],[1,1.05]],min:.86,max:1.09}]},
    "solMockA3":{title:"Simulado A3 — Buck por iD",topology:"buck",Vin:120,Vo:84,D:.7,audit:"iD nos 30 µs finais é OFF; iL é 7→9 A em ON e 9→7 A em OFF.",markers:[{t:.7,label:"70 µs"},{t:1,label:"100 µs"}],signals:[{label:"iD",unit:"A",points:[[0,0],[.7,0],[.7,9],[1,7],[1,0]]},{label:"vL",unit:"V",points:[[0,36],[.7,36],[.7,-84],[1,-84]]},{label:"iL",unit:"A",points:[[0,7],[.7,9],[1,7]]}]},
    "solMockB1":{title:"Simulado B1 — Boost DCM",topology:"boost",mode:"DCM",Vin:80,Vo:213.33,D:.25,D2:.15,audit:"Conjunto consistente: D=0,25, D₂=0,15, D₃=0,60 e Vo=213,33 V.",markers:[{t:.25,label:"25 µs"},{t:.4,label:"40 µs"},{t:1,label:"100 µs"}],signals:[{label:"vL",unit:"V",points:[[0,80],[.25,80],[.25,-133.33],[.4,-133.33],[.4,0],[1,0]]},{label:"iL",unit:"A",points:[[0,0],[.25,5],[.4,0],[1,0]]},{label:"iD",unit:"A",points:[[0,0],[.25,0],[.25,5],[.4,0],[1,0]]},{label:"iC",unit:"A",points:[[0,-.375],[.25,-.375],[.25,4.625],[.4,-.375],[1,-.375]]}]},
    "solMockB2":{title:"Simulado B2 — iC ↔ vC",topology:"capacitor",audit:"O enunciado é propositalmente incompatível com RPP: área líquida de iC = +10 A·µs, então vC(Ts)≠vC(0).",markers:[{t:.3,label:"30 µs"},{t:.767,label:"iC=0"},{t:1,label:"100 µs"}],signals:[{label:"iC",unit:"A",points:[[0,-2],[.3,-2],[.3,4],[1,-2]]},{label:"vC",unit:"qual.",points:[[0,1.02],[.3,.88],[.767,1.10],[1,1.04]],min:.84,max:1.14}]},
    "solMockB3":{title:"Simulado B3 — Buck / pulso deslocado",topology:"buck",Vin:90,Vo:45,D:.5,audit:"iS dura 40 de 80 µs: D=0,50. A origem temporal do desenho não muda o duty.",markers:[{t:.5,label:"40 µs"},{t:1,label:"80 µs"}],signals:[{label:"iS",unit:"A",points:[[0,0],[.5,0],[.5,3],[1,7],[1,0]]},{label:"vL",unit:"V",points:[[0,-45],[.5,-45],[.5,45],[1,45]]},{label:"iL",unit:"A",points:[[0,7],[.5,3],[1,7]]}]},
    "solP1_1":{title:"Simulado resolvido 1 — Buck CCM",topology:"buck",Vin:60,Vo:24,D:.4,audit:"Vin=60 V, Vo=24 V, D=0,40, Io=5 A e ΔIL=1 A.",markers:[{t:.4,label:"D·Tₛ"},{t:1,label:"Tₛ"}],signals:[{label:"vL",unit:"V",points:[[0,36],[.4,36],[.4,-24],[1,-24]]},{label:"iL",unit:"A",points:[[0,4.5],[.4,5.5],[1,4.5]],brackets:[{t:.92,v1:4.5,v2:5.5,label:"ΔI=1 A"}]},{label:"iC",unit:"A",points:[[0,-.5],[.4,.5],[1,-.5]]}]},
    "solP1_2":{title:"Simulado resolvido 2 — Boost DCM",topology:"boost",mode:"DCM",Vin:12,Vo:57.26,D:.6,D2:.159,audit:"Para R=100 Ω: K=0,020, M≈4,772, D₂≈0,159, D₃≈0,241 e Ipk=7,2 A.",markers:[{t:.6,label:"D"},{t:.759,label:"D+D₂"},{t:1,label:"Tₛ"}],signals:[{label:"vL",unit:"V",points:[[0,12],[.6,12],[.6,-45.26],[.759,-45.26],[.759,0],[1,0]]},{label:"iL",unit:"A",points:[[0,0],[.6,7.2],[.759,0],[1,0]]},{label:"iD",unit:"A",points:[[0,0],[.6,0],[.6,7.2],[.759,0],[1,0]]}]},
    "solP1_3":{title:"Simulado resolvido 3 — Buck-Boost DCM",topology:"buckboost",mode:"DCM",Vin:30,Vo:15,D:.258,D2:.516,audit:"D≈0,258, D₂≈0,516, D₃≈0,225 e Ipk≈3,87 A.",markers:[{t:.258,label:"D"},{t:.774,label:"D+D₂"},{t:1,label:"Tₛ"}],signals:[{label:"vL",unit:"V",points:[[0,30],[.258,30],[.258,-15],[.774,-15],[.774,0],[1,0]]},{label:"iL",unit:"A",points:[[0,0],[.258,3.87],[.774,0],[1,0]]},{label:"iD",unit:"A",points:[[0,0],[.258,0],[.258,3.87],[.774,0],[1,0]]}]}
  };
}

function examFigureMarkup(def) {
  return '<div class="exam-visual-block"><div class="exam-visual-title"><strong>'+def.title+'</strong><span>SVG vetorial • reconstrução auditada</span></div><div class="exam-visual-grid"><div class="exam-circuit-pane">'+examStaticCircuit(def)+'</div><div class="exam-wave-pane">'+examWaveSvg(def)+'</div></div><div class="exam-audit-note"><strong>Revisão crítica:</strong> '+def.audit+'</div></div>';
}

function formulaOverviewMarkup() {
  var defs=[
    {title:"Buck — referência",topology:"buck",Vin:100,Vo:60,D:.6,audit:"S conduz em D·Ts; diodo no OFF. vL=E−Vo em ON e −Vo em OFF.",markers:[{t:.6,label:"D·Tₛ"},{t:1,label:"Tₛ"}],signals:[{label:"vL",unit:"norm.",points:[[0,.4],[.6,.4],[.6,-.6],[1,-.6]]},{label:"iL",unit:"norm.",points:[[0,2],[.6,4],[1,2]]},{label:"iC",unit:"norm.",points:[[0,-1],[.6,1],[1,-1]]},{label:"vC",unit:"qual.",points:[[0,1.02],[.3,.94],[.6,1.01],[.8,1.07],[1,1.02]],min:.9,max:1.1}]},
    {title:"Boost — referência",topology:"boost",Vin:100,Vo:200,D:.5,audit:"ON: D bloqueado e C alimenta R. OFF: fonte + L alimentam a saída.",markers:[{t:.5,label:"D·Tₛ"},{t:1,label:"Tₛ"}],signals:[{label:"vL",unit:"norm.",points:[[0,1],[.5,1],[.5,-1],[1,-1]]},{label:"iL",unit:"norm.",points:[[0,2],[.5,4],[1,2]]},{label:"iD",unit:"norm.",points:[[0,0],[.5,0],[.5,4],[1,2],[1,0]]},{label:"iC",unit:"norm.",points:[[0,-1],[.5,-1],[.5,3],[1,1]]}]},
    {title:"Buck-Boost — referência",topology:"buckboost",Vin:100,Vo:66.7,D:.4,audit:"Saída invertida. ON armazena energia em L; OFF transfere energia por D para C/R.",markers:[{t:.4,label:"D·Tₛ"},{t:1,label:"Tₛ"}],signals:[{label:"vL",unit:"norm.",points:[[0,1],[.4,1],[.4,-.667],[1,-.667]]},{label:"iL",unit:"norm.",points:[[0,2],[.4,4],[1,2]]},{label:"iD",unit:"norm.",points:[[0,0],[.4,0],[.4,4],[1,2],[1,0]]},{label:"iC",unit:"norm.",points:[[0,-1],[.4,-1],[.4,3],[1,1]]}]},
    {title:"DCM — 3 intervalos",topology:"boost",mode:"DCM",Vin:100,Vo:220,D:.3,D2:.25,audit:"D + D₂ + D₃ = 1. Em D₃: iL=0 e vL=0 no modelo ideal.",markers:[{t:.3,label:"D"},{t:.55,label:"D+D₂"},{t:1,label:"Tₛ"}],signals:[{label:"vL",unit:"norm.",points:[[0,1],[.3,1],[.3,-1.2],[.55,-1.2],[.55,0],[1,0]]},{label:"iL",unit:"norm.",points:[[0,0],[.3,4],[.55,0],[1,0]]},{label:"iD",unit:"norm.",points:[[0,0],[.3,0],[.3,4],[.55,0],[1,0]]}]}
  ];
  return '<div class="formula-visual-overview"><h4>Topologias e formas de onda essenciais</h4><p class="formula-visual-lead">Identifique ON/OFF, chave, diodo, polaridades e o sinal de vL/iC antes de escolher a fórmula.</p>'+defs.map(examFigureMarkup).join('')+'</div>';
}

function initExamFigures() {
  var defs=getExamFigureDefinitions();
  Object.keys(defs).forEach(function(targetId){
    var button=document.querySelector('.solution-toggle[data-target="'+targetId+'"]');
    if(!button)return;
    var body=button.closest('.exercise-body');
    if(!body||body.querySelector('[data-exam-visual="'+targetId+'"]'))return;
    var host=document.createElement('div');host.setAttribute('data-exam-visual',targetId);host.innerHTML=examFigureMarkup(defs[targetId]);button.parentNode.insertBefore(host,button);
  });
  var formula=document.getElementById('examFormulaSource');
  if(formula&&!formula.querySelector('.formula-visual-overview')){
    var head=formula.querySelector('.formula-sheet-head'),tmp=document.createElement('div');tmp.innerHTML=formulaOverviewMarkup(),overview=tmp.firstElementChild;
    if(head&&head.nextSibling)formula.insertBefore(overview,head.nextSibling);else formula.appendChild(overview);
  }
}

function initExamMode() {
  var modal = document.getElementById('examFormulaModal');
  var source = document.getElementById('examFormulaSource');
  var fab = document.getElementById('examFormulaFab');
  var closeBtn = document.getElementById('examFormulaClose');
  var printBtn = document.getElementById('examFormulaPrint');
  var pdfBtn = document.getElementById('examFormulaPdf');
  var content = document.getElementById('examFormulaModalContent');
  if (!modal || !source || !content || modal.dataset.initialized === 'true') return;

  modal.dataset.initialized = 'true';
  var lastFocus = null;
  var originalTitle = document.title;

  function hydrateFormulaCopy() {
    content.innerHTML = '';
    var clone = source.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.add('exam-formula-sheet-modal');
    clone.querySelectorAll('[data-open-exam-formula]').forEach(function (button) {
      button.remove();
    });
    content.appendChild(clone);

    if (window.UiIcons) window.UiIcons.hydrate(content);
    if (typeof window.renderMathInElement === 'function') {
      window.renderMathInElement(content, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  }

  function openFormula(trigger) {
    lastFocus = trigger || document.activeElement;
    hydrateFormulaCopy();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('exam-formula-open');
    if (fab) fab.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () {
      if (closeBtn) closeBtn.focus();
    });
  }

  function closeFormula() {
    if (document.body.classList.contains('print-formula-only')) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('exam-formula-open');
    if (fab) fab.setAttribute('aria-expanded', 'false');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function printFormula(asPdf) {
    if (modal.hidden) openFormula(pdfBtn || printBtn);
    document.body.classList.add('print-formula-only');
    document.title = asPdf ? 'Formulario-P1-Eletronica-de-Potencia' : originalTitle;

    var cleanup = function () {
      document.body.classList.remove('print-formula-only');
      document.title = originalTitle;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();

    // Alguns navegadores/WebViews não disparam afterprint.
    window.setTimeout(function () {
      if (document.body.classList.contains('print-formula-only')) cleanup();
    }, 1500);
  }

  document.querySelectorAll('[data-open-exam-formula]').forEach(function (button) {
    button.addEventListener('click', function () { openFormula(button); });
  });
  if (fab) fab.addEventListener('click', function () { openFormula(fab); });
  if (closeBtn) closeBtn.addEventListener('click', closeFormula);
  if (printBtn) printBtn.addEventListener('click', function () { printFormula(false); });
  if (pdfBtn) pdfBtn.addEventListener('click', function () { printFormula(true); });

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeFormula();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) closeFormula();
  });
}


window.initSubjectTools = function () {
  initCalculator();
  initConverterDashboards();
  initExamFigures();
  initExamMode();
};
