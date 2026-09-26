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
  const Vin = parseFloat(document.getElementById('calcVin')?.value) || 24;
  const Vo = parseFloat(document.getElementById('calcVo')?.value) || 12;
  const Po = parseFloat(document.getElementById('calcPo')?.value) || 48;
  const fsKhz = parseFloat(document.getElementById('calcFs')?.value) || 50; // kHz
  const L_uH = parseFloat(document.getElementById('calcL')?.value) || 100; // uH
  const C_uF = parseFloat(document.getElementById('calcC')?.value) || 47; // uF

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

    if (K >= Kcrit) {
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
      D = M * Math.sqrt(K / Math.max(0.0001, 1 - M));
      D2 = D * ((Vin - Vo) / Vo);
      deltaIL = ((Vin - Vo) * D) / (L * fs);
      IL_avg = Io;
      IL_max = deltaIL;
      IL_min = 0;
      deltaVo = (Io / (C * fs)) * Math.pow(1 - (D + D2) / 2, 2);
    }
  } else if (topology === 'boost') {
    // Topologia Boost (Elevador)
    const D_ideal = Math.max(0.01, 1 - (Vin / Vo));
    const Kcrit = D_ideal * Math.pow(1 - D_ideal, 2);
    Lcrit = (D_ideal * Math.pow(1 - D_ideal, 2) * R) / (2 * fs);
    Vs_max = Vo;
    Vd_max = Vo;

    if (K >= Kcrit) {
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
      D2 = D / Math.max(0.001, M - 1);
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

    if (K >= Kcrit) {
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

  // Atualizar os elementos da UI com os resultados
  const modeBadge = document.getElementById('resConductionMode');
  if (modeBadge) {
    if (mode === 'CCM') {
      modeBadge.className = 'results-status-badge status-ccm';
      modeBadge.innerHTML = '⚡ Modo de Condução Contínua (CCM)';
    } else {
      modeBadge.className = 'results-status-badge status-dcm';
      modeBadge.innerHTML = '⚠️ Modo de Condução Descontínua (DCM)';
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
    D: Math.min(0.999, Math.max(0.001, D)),
    D2: Math.min(0.999, Math.max(0.001, D2)),
    IL_min: Math.max(0, IL_min),
    IL_max: Math.max(0.01, IL_max),
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
          <stop offset="0%" stop-color="#3fb950" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#3fb950" stop-opacity="0.02"/>
        </linearGradient>
      </defs>

      <!-- Linhas de Grade e Eixos -->
      <!-- Eixo Zero vL -->
      <line x1="${padLeft}" y1="${yVL_mid}" x2="${xEnd + 15}" y2="${yVL_mid}" stroke="#30363d" stroke-dasharray="3,3" stroke-width="1.2"/>
      <text x="${padLeft - 8}" y="${yVL_mid + 4}" fill="#8b949e" font-size="11" font-family="monospace" text-anchor="end">0V</text>

      <!-- Rótulo Tensão vL(t) -->
      <text x="${padLeft}" y="${padTop - 8}" fill="#58a6ff" font-size="12" font-weight="bold" font-family="sans-serif">v_L(t) [Tensão no Indutor]</text>
      
      <!-- Linhas verticais de fase -->
      <line x1="${x1}" y1="${padTop - 5}" x2="${x1}" y2="${yIL_bottom + 15}" stroke="#484f58" stroke-dasharray="4,4" stroke-width="1"/>
      <text x="${x1}" y="${yIL_bottom + 16}" fill="#8b949e" font-size="10" font-family="monospace" text-anchor="middle">DTs</text>
  `;

  if (mode === 'DCM') {
    svgContent += `
      <line x1="${x2}" y1="${padTop - 5}" x2="${x2}" y2="${yIL_bottom + 15}" stroke="#d29922" stroke-dasharray="4,4" stroke-width="1"/>
      <text x="${x2}" y="${yIL_bottom + 16}" fill="#d29922" font-size="10" font-family="monospace" text-anchor="middle">(D+D2)Ts</text>
    `;
  }

  svgContent += `
      <line x1="${xEnd}" y1="${padTop - 5}" x2="${xEnd}" y2="${yIL_bottom + 15}" stroke="#484f58" stroke-dasharray="4,4" stroke-width="1"/>
      <text x="${xEnd}" y="${yIL_bottom + 16}" fill="#8b949e" font-size="10" font-family="monospace" text-anchor="middle">Ts</text>

      <!-- Traçado de vL(t) -->
  `;

  // Path de vL
  let vL_path = `M ${x0} ${yVL_mid} L ${x0} ${yVL_on} L ${x1} ${yVL_on} L ${x1} ${yVL_off} L ${x2} ${yVL_off}`;
  if (mode === 'DCM') {
    vL_path += ` L ${x2} ${yVL_mid} L ${xEnd} ${yVL_mid}`;
  }
  svgContent += `
      <path d="${vL_path}" fill="none" stroke="#58a6ff" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="${padLeft - 8}" y="${yVL_on + 4}" fill="#58a6ff" font-size="10" font-family="monospace" text-anchor="end">${vL_on > 0 ? '+' : ''}${vL_on.toFixed(0)}V</text>
      <text x="${padLeft - 8}" y="${yVL_off + 4}" fill="#58a6ff" font-size="10" font-family="monospace" text-anchor="end">${vL_off.toFixed(0)}V</text>

      <!-- Rótulo Corrente iL(t) -->
      <text x="${padLeft}" y="${yIL_top - 12}" fill="#3fb950" font-size="12" font-weight="bold" font-family="sans-serif">i_L(t) [Corrente no Indutor]</text>
      <!-- Eixo Zero iL -->
      <line x1="${padLeft}" y1="${yIL_bottom}" x2="${xEnd + 15}" y2="${yIL_bottom}" stroke="#30363d" stroke-width="1.5"/>
      <text x="${padLeft - 8}" y="${yIL_bottom + 4}" fill="#8b949e" font-size="11" font-family="monospace" text-anchor="end">0A</text>
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
      <path d="${iL_path}" fill="none" stroke="#3fb950" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="${padLeft - 8}" y="${yIL_valMax + 4}" fill="#3fb950" font-size="10" font-family="monospace" text-anchor="end">${IL_max.toFixed(1)}A</text>
  `;

  if (mode === 'CCM' && IL_min > 0.05) {
    svgContent += `
      <text x="${padLeft - 8}" y="${yIL_valMin + 4}" fill="#3fb950" font-size="10" font-family="monospace" text-anchor="end">${IL_min.toFixed(1)}A</text>
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

var CONVERTER_CONFIGS = {
  mod4: {
    id: 'mod4',
    title: 'Buck em CCM',
    topology: 'buck',
    mode: 'CCM',
    formula: 'Vo = D · Vin = 0,50 · 24V = 12V',
    params: { Vin: 24, Vo: 12, D: 0.5, Io: 2.0, deltaIL: 1.2, Imin: 1.4, Imax: 2.6 },
    stages: [
      {
        name: 'Etapa 1 · Chave ON',
        interval: '0 → D·Ts (0% a 50%)',
        kind: 'on',
        sw: 'FECHADA (Conduz)',
        diode: 'BLOQUEADO (Reverso)',
        vL: '+12.0 V (Vin − Vo)',
        iL: 'Cresce linearmente (1.4A → 2.6A)',
        vS: '0.0 V (Condução)',
        iS: 'Conduz iL (1.4A → 2.6A)',
        vD: '−24.0 V (−Vin)',
        iD: '0.0 A (Bloqueado)',
        iC: 'iL − Io (−0.6A → +0.6A)',
        note: 'A chave S conecta a fonte à malha indutor-carga. O indutor magnetiza armazenando energia magnética com vL = Vin − Vo > 0. O diodo D fica sob tensão reversa −Vin e o capacitor auxilia na filtragem.'
      },
      {
        name: 'Etapa 2 · Roda-Livre (Chave OFF)',
        interval: 'D·Ts → Ts (50% a 100%)',
        kind: 'off',
        sw: 'ABERTA (Bloqueada)',
        diode: 'CONDUZ (Roda-Livre)',
        vL: '−12.0 V (−Vo)',
        iL: 'Decresce linearmente (2.6A → 1.4A)',
        vS: '+24.0 V (Vin)',
        iS: '0.0 A (Aberto)',
        vD: '0.0 V (Condução)',
        iD: 'Conduz iL (2.6A → 1.4A)',
        iC: 'iL − Io (+0.6A → −0.6A)',
        note: 'A chave abre e o indutor inverte sua tensão para vL = −Vo para manter a corrente contínua, forçando o diodo de roda-livre a conduzir. A fonte é desconectada e a energia do indutor alimenta a carga.'
      }
    ]
  },
  mod5: {
    id: 'mod5',
    title: 'Boost em CCM',
    topology: 'boost',
    mode: 'CCM',
    formula: 'Vo = Vin / (1 − D) = 12V / 0,50 = 24V',
    params: { Vin: 12, Vo: 24, D: 0.5, Io: 1.5, ILavg: 3.0, deltaIL: 1.2, Imin: 2.4, Imax: 3.6 },
    stages: [
      {
        name: 'Etapa 1 · Chave ON',
        interval: '0 → D·Ts (0% a 50%)',
        kind: 'on',
        sw: 'FECHADA (Conduz)',
        diode: 'BLOQUEADO (Reverso)',
        vL: '+12.0 V (+Vin)',
        iL: 'Cresce linearmente (2.4A → 3.6A)',
        vS: '0.0 V (Condução)',
        iS: 'Conduz iL (2.4A → 3.6A)',
        vD: '−24.0 V (−Vo)',
        iD: '0.0 A (Bloqueado)',
        iC: '−1.5 A (−Io)',
        note: 'A chave S fecha para o terra, aplicando toda a tensão Vin sobre o indutor (vL = +Vin). O diodo bloqueia com tensão reversa −Vo. O capacitor sustenta a corrente da carga sozinho.'
      },
      {
        name: 'Etapa 2 · Transferência (Chave OFF)',
        interval: 'D·Ts → Ts (50% a 100%)',
        kind: 'off',
        sw: 'ABERTA (Bloqueada)',
        diode: 'CONDUZ',
        vL: '−12.0 V (Vin − Vo)',
        iL: 'Decresce linearmente (3.6A → 2.4A)',
        vS: '+24.0 V (Vo)',
        iS: '0.0 A',
        vD: '0.0 V (Condução)',
        iD: 'Conduz iL (3.6A → 2.4A)',
        iC: 'iL − Io (+2.1A → +0.9A)',
        note: 'A chave abre. A tensão no indutor inverte para (Vin − Vo = −12V), somando-se à tensão da fonte para vencer Vo e conduzir pelo diodo, descarregando energia magnética para a saída.'
      }
    ]
  },
  mod6: {
    id: 'mod6',
    title: 'Buck-Boost Inversor em CCM',
    topology: 'buckboost',
    mode: 'CCM',
    formula: '|Vo| / Vin = D / (1 − D) = 0,5 / 0,5 = 1,0 (Vo = −24V)',
    params: { Vin: 24, Vo: 24, D: 0.5, Io: 1.5, ILavg: 3.0, deltaIL: 1.2, Imin: 2.4, Imax: 3.6 },
    stages: [
      {
        name: 'Etapa 1 · Chave ON',
        interval: '0 → D·Ts (0% a 50%)',
        kind: 'on',
        sw: 'FECHADA (Conduz)',
        diode: 'BLOQUEADO (Reverso)',
        vL: '+24.0 V (+Vin)',
        iL: 'Cresce linearmente (2.4A → 3.6A)',
        vS: '0.0 V',
        iS: 'Conduz iL (2.4A → 3.6A)',
        vD: '−48.0 V (−(Vin + |Vo|))',
        iD: '0.0 A',
        iC: '−1.5 A (−Io)',
        note: 'A chave S conecta Vin diretamente ao indutor shunt para o terra. O diodo bloqueia com o esforço total -(Vin + |Vo|). O capacitor alimenta a saída invertida durante este intervalo.'
      },
      {
        name: 'Etapa 2 · Descarga Invertida',
        interval: 'D·Ts → Ts (50% a 100%)',
        kind: 'off',
        sw: 'ABERTA (Bloqueada)',
        diode: 'CONDUZ',
        vL: '−24.0 V (−|Vo|)',
        iL: 'Decresce linearmente (3.6A → 2.4A)',
        vS: '+48.0 V (Vin + |Vo|)',
        iS: '0.0 A',
        vD: '0.0 V',
        iD: 'Conduz iL (3.6A → 2.4A)',
        iC: 'iL − Io (+2.1A → +0.9A)',
        note: 'A chave abre. A corrente do indutor continua descendo em direção ao terra, retornando pelo terra através da carga e do diodo, gerando tensão de saída negativa −Vo.'
      }
    ]
  },
  mod7: {
    id: 'mod7',
    title: 'Buck em DCM',
    topology: 'buck',
    mode: 'DCM',
    formula: 'M = 2 / [1 + √(1 + 4K/D²)]',
    params: { Vin: 24, Vo: 12, D: 0.35, D2: 0.35, D3: 0.30, Io: 1.0, Ipk: 2.8 },
    stages: [
      {
        name: 'Etapa 1 · Magnetização',
        interval: '0 → D·Ts (0% a 35%)',
        kind: 'on',
        sw: 'FECHADA (Conduz)',
        diode: 'BLOQUEADO',
        vL: '+12.0 V (Vin − Vo)',
        iL: 'Rampa de 0.0A a 2.8A (Ipk)',
        vS: '0.0 V',
        iS: '0.0A → 2.8A',
        vD: '−24.0 V',
        iD: '0.0 A',
        iC: 'iL − Io (−1.0A → +1.8A)',
        note: 'A corrente do indutor parte de ZERO e cresce linearmente até o pico Ipk. S conduz e D bloqueado.'
      },
      {
        name: 'Etapa 2 · Desmagnetização',
        interval: 'D·Ts → (D+D2)·Ts (35% a 70%)',
        kind: 'off',
        sw: 'ABERTA',
        diode: 'CONDUZ',
        vL: '−12.0 V (−Vo)',
        iL: 'Rampa de 2.8A a 0.0A (Zera!)',
        vS: '+24.0 V',
        iS: '0.0 A',
        vD: '0.0 V',
        iD: '2.8A → 0.0A',
        iC: 'iL − Io (+1.8A → −1.0A)',
        note: 'S abre e D conduz. O indutor entrega toda sua energia e sua corrente atinge rigorosamente ZERO em (D+D2)Ts.'
      },
      {
        name: 'Etapa 3 · Corrente Nula',
        interval: '(D+D2)·Ts → Ts (70% a 100%)',
        kind: 'idle',
        sw: 'ABERTA',
        diode: 'BLOQUEADO (Corte)',
        vL: '0.0 V (Nula)',
        iL: '0.0 A (Nula)',
        vS: '+12.0 V (Vin − Vo)',
        iS: '0.0 A',
        vD: '−12.0 V (−Vo)',
        iD: '0.0 A',
        iC: '−1.0 A (−Io)',
        note: 'Com iL = 0, o diodo despolariza espontaneamente. Ambos os semicondutores ficam abertos! O capacitor sozinho sustenta a carga até o próximo ciclo.'
      }
    ]
  },
  mod8: {
    id: 'mod8',
    title: 'Boost em DCM',
    topology: 'boost',
    mode: 'DCM',
    formula: 'M = [1 + √(1 + 4D²/K)] / 2',
    params: { Vin: 12, Vo: 24, D: 0.35, D2: 0.35, D3: 0.30, Io: 1.0, Ipk: 3.2 },
    stages: [
      {
        name: 'Etapa 1 · Magnetização',
        interval: '0 → D·Ts (0% a 35%)',
        kind: 'on',
        sw: 'FECHADA',
        diode: 'BLOQUEADO',
        vL: '+12.0 V (+Vin)',
        iL: 'Rampa de 0.0A a 3.2A (Ipk)',
        vS: '0.0 V',
        iS: '0.0A → 3.2A',
        vD: '−24.0 V (−Vo)',
        iD: '0.0 A',
        iC: '−1.0 A (−Io)',
        note: 'A chave S conduz para o terra; a corrente no indutor parte de zero e atinge Ipk. O capacitor sustenta a saída sozinho.'
      },
      {
        name: 'Etapa 2 · Descarga Rápida',
        interval: 'D·Ts → (D+D2)·Ts (35% a 70%)',
        kind: 'off',
        sw: 'ABERTA',
        diode: 'CONDUZ',
        vL: '−12.0 V (Vin − Vo)',
        iL: 'Rampa de 3.2A a 0.0A',
        vS: '+24.0 V',
        iS: '0.0 A',
        vD: '0.0 V',
        iD: '3.2A → 0.0A',
        iC: '+2.2A → −1.0A',
        note: 'S abre, D conduz. Toda a energia do indutor é transferida para a saída até a corrente iL anular-se completamente.'
      },
      {
        name: 'Etapa 3 · Corrente Nula',
        interval: '(D+D2)·Ts → Ts (70% a 100%)',
        kind: 'idle',
        sw: 'ABERTA',
        diode: 'BLOQUEADO',
        vL: '0.0 V (Nula)',
        iL: '0.0 A (Nula)',
        vS: '+12.0 V (+Vin)',
        iS: '0.0 A',
        vD: '−12.0 V (Vin − Vo)',
        iD: '0.0 A',
        iC: '−1.0 A (−Io)',
        note: 'O indutor esgotou sua energia. S e D estão em corte simultâneo. A tensão no nó central flutua em Vin e o capacitor mantém a carga.'
      }
    ]
  },
  mod9: {
    id: 'mod9',
    title: 'Buck-Boost Inversor em DCM',
    topology: 'buckboost',
    mode: 'DCM',
    formula: '|Vo| / Vin = D / √K',
    params: { Vin: 24, Vo: 24, D: 0.35, D2: 0.35, D3: 0.30, Io: 1.0, Ipk: 3.2 },
    stages: [
      {
        name: 'Etapa 1 · Magnetização',
        interval: '0 → D·Ts (0% a 35%)',
        kind: 'on',
        sw: 'FECHADA',
        diode: 'BLOQUEADO',
        vL: '+24.0 V (+Vin)',
        iL: 'Rampa de 0.0A a 3.2A (Ipk)',
        vS: '0.0 V',
        iS: '0.0A → 3.2A',
        vD: '−48.0 V',
        iD: '0.0 A',
        iC: '−1.0 A (−Io)',
        note: 'S fecha, L magnetiza a partir de zero até Ipk sob tensão constante Vin. D bloqueado e C alimenta a carga invertida.'
      },
      {
        name: 'Etapa 2 · Desmagnetização',
        interval: 'D·Ts → (D+D2)·Ts (35% a 70%)',
        kind: 'off',
        sw: 'ABERTA',
        diode: 'CONDUZ',
        vL: '−24.0 V (−|Vo|)',
        iL: 'Rampa de 3.2A a 0.0A',
        vS: '+48.0 V',
        iS: '0.0 A',
        vD: '0.0 V',
        iD: '3.2A → 0.0A',
        iC: '+2.2A → −1.0A',
        note: 'S abre, D conduz. O indutor descarrega sua corrente pela malha invertida da carga até zerar no instante (D+D2)Ts.'
      },
      {
        name: 'Etapa 3 · Corrente Nula',
        interval: '(D+D2)·Ts → Ts (70% a 100%)',
        kind: 'idle',
        sw: 'ABERTA',
        diode: 'BLOQUEADO',
        vL: '0.0 V (Nula)',
        iL: '0.0 A (Nula)',
        vS: '+24.0 V (+Vin)',
        iS: '0.0 A',
        vD: '−24.0 V (−|Vo|)',
        iD: '0.0 A',
        iC: '−1.0 A (−Io)',
        note: 'Corrente nula no indutor. S e D bloqueados. A tensão de saída é mantida unicamente pela carga residual do capacitor.'
      }
    ]
  }
};

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
  var isCCM = config.mode === 'CCM';
  var D = p.D;
  var D2 = isCCM ? 1 - D : p.D2;
  var D3 = isCCM ? 0 : p.D3;

  var stageIdx = 0;
  var stageProgress = 0;

  if (isCCM) {
    if (tau < D) {
      stageIdx = 0;
      stageProgress = tau / Math.max(0.001, D);
    } else {
      stageIdx = 1;
      stageProgress = (tau - D) / Math.max(0.001, 1 - D);
    }
  } else {
    if (tau < D) {
      stageIdx = 0;
      stageProgress = tau / Math.max(0.001, D);
    } else if (tau < D + D2) {
      stageIdx = 1;
      stageProgress = (tau - D) / Math.max(0.001, D2);
    } else {
      stageIdx = 2;
      stageProgress = (tau - D - D2) / Math.max(0.001, D3);
    }
  }

  var vL = 0, iL = 0, vS = 0, iS = 0, vD = 0, iD = 0, iC = 0;
  var polLeft = '+', polRight = '−';

  if (config.topology === 'buck') {
    if (isCCM) {
      if (stageIdx === 0) {
        vL = p.Vin - p.Vo;
        iL = p.Imin + p.deltaIL * stageProgress;
        vS = 0; iS = iL;
        vD = -p.Vin; iD = 0;
        iC = iL - p.Io;
        polLeft = '+'; polRight = '−';
      } else {
        vL = -p.Vo;
        iL = p.Imax - p.deltaIL * stageProgress;
        vS = p.Vin; iS = 0;
        vD = 0; iD = iL;
        iC = iL - p.Io;
        polLeft = '−'; polRight = '+';
      }
    } else {
      if (stageIdx === 0) {
        vL = p.Vin - p.Vo;
        iL = p.Ipk * stageProgress;
        vS = 0; iS = iL;
        vD = -p.Vin; iD = 0;
        iC = iL - p.Io;
        polLeft = '+'; polRight = '−';
      } else if (stageIdx === 1) {
        vL = -p.Vo;
        iL = p.Ipk * (1 - stageProgress);
        vS = p.Vin; iS = 0;
        vD = 0; iD = iL;
        iC = iL - p.Io;
        polLeft = '−'; polRight = '+';
      } else {
        vL = 0; iL = 0;
        vS = p.Vin - p.Vo; iS = 0;
        vD = -p.Vo; iD = 0;
        iC = -p.Io;
        polLeft = '0'; polRight = '0';
      }
    }
  } else if (config.topology === 'boost') {
    if (isCCM) {
      if (stageIdx === 0) {
        vL = p.Vin;
        iL = p.Imin + p.deltaIL * stageProgress;
        vS = 0; iS = iL;
        vD = -p.Vo; iD = 0;
        iC = -p.Io;
        polLeft = '+'; polRight = '−';
      } else {
        vL = p.Vin - p.Vo;
        iL = p.Imax - p.deltaIL * stageProgress;
        vS = p.Vo; iS = 0;
        vD = 0; iD = iL;
        iC = iL - p.Io;
        polLeft = '−'; polRight = '+';
      }
    } else {
      if (stageIdx === 0) {
        vL = p.Vin;
        iL = p.Ipk * stageProgress;
        vS = 0; iS = iL;
        vD = -p.Vo; iD = 0;
        iC = -p.Io;
        polLeft = '+'; polRight = '−';
      } else if (stageIdx === 1) {
        vL = p.Vin - p.Vo;
        iL = p.Ipk * (1 - stageProgress);
        vS = p.Vo; iS = 0;
        vD = 0; iD = iL;
        iC = iL - p.Io;
        polLeft = '−'; polRight = '+';
      } else {
        vL = 0; iL = 0;
        vS = p.Vin; iS = 0;
        vD = p.Vin - p.Vo; iD = 0;
        iC = -p.Io;
        polLeft = '0'; polRight = '0';
      }
    }
  } else if (config.topology === 'buckboost') {
    if (isCCM) {
      if (stageIdx === 0) {
        vL = p.Vin;
        iL = p.Imin + p.deltaIL * stageProgress;
        vS = 0; iS = iL;
        vD = -(p.Vin + p.Vo); iD = 0;
        iC = -p.Io;
        polLeft = '+'; polRight = '−';
      } else {
        vL = -p.Vo;
        iL = p.Imax - p.deltaIL * stageProgress;
        vS = p.Vin + p.Vo; iS = 0;
        vD = 0; iD = iL;
        iC = iL - p.Io;
        polLeft = '−'; polRight = '+';
      }
    } else {
      if (stageIdx === 0) {
        vL = p.Vin;
        iL = p.Ipk * stageProgress;
        vS = 0; iS = iL;
        vD = -(p.Vin + p.Vo); iD = 0;
        iC = -p.Io;
        polLeft = '+'; polRight = '−';
      } else if (stageIdx === 1) {
        vL = -p.Vo;
        iL = p.Ipk * (1 - stageProgress);
        vS = p.Vin + p.Vo; iS = 0;
        vD = 0; iD = iL;
        iC = iL - p.Io;
        polLeft = '−'; polRight = '+';
      } else {
        vL = 0; iL = 0;
        vS = p.Vin; iS = 0;
        vD = -p.Vo; iD = 0;
        iC = -p.Io;
        polLeft = '0'; polRight = '0';
      }
    }
  }

  return {
    tau: tau,
    stageIdx: stageIdx,
    stage: config.stages[stageIdx],
    vL: vL,
    iL: Math.max(0, iL),
    vS: vS,
    iS: Math.max(0, iS),
    vD: vD,
    iD: Math.max(0, iD),
    iC: iC,
    polLeft: polLeft,
    polRight: polRight
  };
}

function createAnimatedConverterSimulator(host, config) {
  var tau = 0.15;
  var isPlaying = true;
  var speed = 1.0;
  var activeChannel = 'indutor';
  var lastTimestamp = null;
  var animId = null;

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
            '<span>Esquemático Dinâmico com Fluxo de Carga</span>' +
            '<span class="active-indicator" id="simStageIndicator">● Etapa 1</span>' +
          '</div>' +
          '<div class="converter-dashboard-svg" id="simCircuitSvg"></div>' +
          '<div class="converter-dashboard-legend">' +
            '<span><i class="legend-current"></i> Corrente Ativa</span>' +
            '<span><i class="legend-blocked"></i> Ramo Bloqueado</span>' +
            '<span><i class="legend-vl"></i> Tensão (vL)</span>' +
            '<span><i class="legend-idle"></i> Descarga C</span>' +
          '</div>' +
        '</div>' +
        '<div class="converter-scope-box">' +
          '<div class="converter-box-title">' +
            '<span>Osciloscópio de Formas de Onda (v e i)</span>' +
            '<div class="converter-channel-tabs" id="simChannelTabs">' +
              '<button type="button" data-chan="indutor" class="active">Indutor (vL, iL)</button>' +
              '<button type="button" data-chan="semicondutores">Semicondutores (S, D)</button>' +
              '<button type="button" data-chan="filtro">Capacitor (iC)</button>' +
            '</div>' +
          '</div>' +
          '<div class="converter-scope-svg" id="simScopeSvg"></div>' +
        '</div>' +
      '</div>' +
      '<div class="converter-dashboard-panel">' +
        '<div class="dashboard-controls-bar">' +
          '<div class="dashboard-controls-main">' +
            '<button type="button" class="btn-ctrl-play" id="simPlayBtn">⏸ Pausar</button>' +
            '<div class="btn-ctrl-speed-group">' +
              '<button type="button" class="btn-ctrl-speed" data-speed="0.5">0.5x</button>' +
              '<button type="button" class="btn-ctrl-speed active" data-speed="1.0">1.0x</button>' +
              '<button type="button" class="btn-ctrl-speed" data-speed="2.0">2.0x</button>' +
            '</div>' +
          '</div>' +
          '<div class="dashboard-scrubber-row">' +
            '<input type="range" class="timeline-scrubber" id="simScrubber" min="0" max="1000" value="150" aria-label="Tempo normalizado t / Ts">' +
            '<span class="scrubber-time-badge" id="simTimeBadge">15% Ts</span>' +
          '</div>' +
        '</div>' +
        '<div class="converter-stage-buttons" id="simStageButtons"></div>' +
        '<div class="converter-stage-card" id="simStageCard"></div>' +
        '<div class="stage-telemetry-grid" id="simTelemetryGrid">' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>vL (Indutor)</span><span>L</span></div><div class="telemetry-cell-val highlight-v" id="telVL">+12.0 V</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>iL (Indutor)</span><span>L</span></div><div class="telemetry-cell-val highlight-i" id="telIL">2.10 A</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>vS (Chave)</span><span>S</span></div><div class="telemetry-cell-val" id="telVS">0.0 V</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>iS (Chave)</span><span>S</span></div><div class="telemetry-cell-val" id="telIS">2.10 A</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>vD (Diodo)</span><span>D</span></div><div class="telemetry-cell-val highlight-warn" id="telVD">-24.0 V</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>iD (Diodo)</span><span>D</span></div><div class="telemetry-cell-val" id="telID">0.0 A</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>iC (Capacitor)</span><span>C</span></div><div class="telemetry-cell-val" id="telIC">+0.10 A</div></div>' +
          '<div class="telemetry-cell"><div class="telemetry-cell-label"><span>Saída (Vo, Io)</span><span>R</span></div><div class="telemetry-cell-val" id="telVo">' + config.params.Vo + 'V / ' + config.params.Io + 'A</div></div>' +
        '</div>' +
        '<div class="converter-dashboard-formula">' +
          '<span>Relação Teórica de Ganho</span>' +
          '<strong>' + config.formula + '</strong>' +
        '</div>' +
      '</div>' +
    '</div>';

  host.innerHTML = '';
  host.appendChild(container);

  var circuitSvgBox = container.querySelector('#simCircuitSvg');
  var scopeSvgBox = container.querySelector('#simScopeSvg');
  var stageIndicator = container.querySelector('#simStageIndicator');
  var playBtn = container.querySelector('#simPlayBtn');
  var scrubber = container.querySelector('#simScrubber');
  var timeBadge = container.querySelector('#simTimeBadge');
  var stageButtons = container.querySelector('#simStageButtons');
  var stageCard = container.querySelector('#simStageCard');
  var channelTabs = container.querySelectorAll('#simChannelTabs button');
  var speedButtons = container.querySelectorAll('.btn-ctrl-speed');

  var telVL = container.querySelector('#telVL');
  var telIL = container.querySelector('#telIL');
  var telVS = container.querySelector('#telVS');
  var telIS = container.querySelector('#telIS');
  var telVD = container.querySelector('#telVD');
  var telID = container.querySelector('#telID');
  var telIC = container.querySelector('#telIC');

  config.stages.forEach(function (stg, idx) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<strong>' + (idx + 1) + '</strong> ' + stg.name.split('·')[0];
    btn.addEventListener('click', function () {
      isPlaying = false;
      updatePlayBtnUI();
      if (idx === 0) tau = 0.05;
      else if (idx === 1) tau = config.params.D + 0.05;
      else tau = config.params.D + config.params.D2 + 0.05;
      tau = Math.min(0.999, Math.max(0.001, tau));
      scrubber.value = Math.round(tau * 1000);
      render();
    });
    stageButtons.appendChild(btn);
  });

  playBtn.addEventListener('click', function () {
    isPlaying = !isPlaying;
    updatePlayBtnUI();
    if (isPlaying) {
      lastTimestamp = null;
      animId = requestAnimationFrame(animLoop);
    }
  });

  function updatePlayBtnUI() {
    playBtn.textContent = isPlaying ? '⏸ Pausar' : '▶ Reproduzir';
    playBtn.style.borderColor = isPlaying ? '#388bfd' : '#3fb950';
    playBtn.style.color = isPlaying ? '#58a6ff' : '#3fb950';
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

    timeBadge.textContent = (tau * 100).toFixed(0) + '% Ts';
    stageIndicator.textContent = '● ' + state.stage.name;
    stageIndicator.style.color = state.stage.kind === 'on' ? '#3fb950' : (state.stage.kind === 'off' ? '#58a6ff' : '#bc8cff');

    var stageBtns = stageButtons.querySelectorAll('button');
    stageBtns.forEach(function (btn, i) {
      if (i === state.stageIdx) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    stageCard.innerHTML =
      '<div class="stage-number"><span>Etapa ' + (state.stageIdx + 1) + ' de ' + config.stages.length + '</span><span>' + state.stage.interval + '</span></div>' +
      '<h5>' + state.stage.name + '</h5>' +
      '<div class="stage-interval">Chave: ' + state.stage.sw + ' • Diodo: ' + state.stage.diode + '</div>' +
      '<p class="stage-note">' + state.stage.note + '</p>';

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

    telIC.textContent = (state.iC > 0 ? '+' : '') + state.iC.toFixed(2) + ' A';
    telIC.className = 'telemetry-cell-val ' + (state.iC >= 0 ? 'highlight-i' : 'highlight-v');

    circuitSvgBox.innerHTML = generateCircuitSvgContent(config, state);
    scopeSvgBox.innerHTML = generateOscilloscopeSvgContent(config, state, activeChannel);
  }

  function animLoop(timestamp) {
    if (!isPlaying) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    var dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    var cycleDuration = 3.6 / speed;
    tau = (tau + (dt / cycleDuration)) % 1.0;
    scrubber.value = Math.round(tau * 1000);

    render();
    animId = requestAnimationFrame(animLoop);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        if (isPlaying && !animId) {
          lastTimestamp = null;
          animId = requestAnimationFrame(animLoop);
        }
      } else {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      }
    });
  }, { threshold: 0.1 });

  observer.observe(container);

  render();
  animId = requestAnimationFrame(animLoop);
}

function generateCircuitSvgContent(config, state) {
  var W = 680, H = 220;
  var topY = 66, botY = 175;
  var stageKind = state.stage.kind;
  var swOn = stageKind === 'on';
  var diodeOn = stageKind === 'off';
  var isIdle = stageKind === 'idle';

  var top = config.topology;
  var defs =
    '<defs>' +
      '<marker id="arrG" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
        '<path d="M 0 1 L 9 5 L 0 9 z" fill="#3fb950"/>' +
      '</marker>' +
      '<marker id="arrV" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">' +
        '<path d="M 0 1 L 9 5 L 0 9 z" fill="#bc8cff"/>' +
      '</marker>' +
    '</defs>';

  function wire(x1, y1, x2, y2, cls) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#21262d" stroke-width="3" stroke-linecap="round"/>' +
      (cls ? '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" class="' + cls + '" stroke-width="3" stroke-linecap="round"/>' : '');
  }

  function node(x, y) {
    return '<circle cx="' + x + '" cy="' + y + '" r="4.5" fill="#c9d1d9"/>';
  }

  function src(x, y, label) {
    return '<circle cx="' + x + '" cy="' + y + '" r="22" fill="#161b22" stroke="#58a6ff" stroke-width="2.5"/>' +
      '<text x="' + x + '" y="' + (y - 3) + '" fill="#58a6ff" font-size="12" font-weight="bold" text-anchor="middle" font-family="sans-serif">' + label + '</text>' +
      '<text x="' + x + '" y="' + (y + 11) + '" fill="#8b949e" font-size="10" font-weight="bold" text-anchor="middle" font-family="sans-serif">+  −</text>';
  }

  function indH(x, y, len, isMag) {
    var d = '', n = 4, pitch = len / n;
    for (var i = 0; i < n; i++) {
      var sx = x + i * pitch, mx = sx + pitch / 2, ex = sx + pitch;
      d += 'M ' + sx + ' ' + y + ' Q ' + mx + ' ' + (y - 20) + ' ' + ex + ' ' + y + ' ';
    }
    var col = isMag ? '#58a6ff' : (state.iL > 0 ? '#3fb950' : '#8b949e');
    return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="3.5" stroke-linecap="round"/>';
  }

  function indV(x, y1, y2, isMag) {
    var len = y2 - y1, n = 4, pitch = len / n, d = '';
    for (var i = 0; i < n; i++) {
      var sy = y1 + i * pitch, my = sy + pitch / 2, ey = sy + pitch;
      d += 'M ' + x + ' ' + sy + ' Q ' + (x - 20) + ' ' + my + ' ' + x + ' ' + ey + ' ';
    }
    var col = isMag ? '#58a6ff' : (state.iL > 0 ? '#3fb950' : '#8b949e');
    return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="3.5" stroke-linecap="round"/>';
  }

  function capV(x, y1, y2) {
    var mid = (y1 + y2) / 2;
    return wire(x, y1, x, mid - 7) +
      '<line x1="' + (x - 16) + '" y1="' + (mid - 7) + '" x2="' + (x + 16) + '" y2="' + (mid - 7) + '" stroke="#bc8cff" stroke-width="3"/>' +
      '<line x1="' + (x - 16) + '" y1="' + (mid + 7) + '" x2="' + (x + 16) + '" y2="' + (mid + 7) + '" stroke="#bc8cff" stroke-width="3"/>' +
      wire(x, mid + 7, x, y2);
  }

  function resV(x, y1, y2, label) {
    var mid = (y1 + y2) / 2;
    return wire(x, y1, x, mid - 20) +
      '<rect x="' + (x - 10) + '" y="' + (mid - 20) + '" width="20" height="40" rx="3" fill="#161b22" stroke="#d29922" stroke-width="2.5"/>' +
      '<text x="' + (x + 16) + '" y="' + (mid + 4) + '" fill="#d29922" font-size="12" font-weight="bold" font-family="sans-serif">' + label + '</text>' +
      wire(x, mid + 20, x, y2);
  }

  function swH(x1, x2, y, on) {
    var col = on ? '#3fb950' : '#f85149';
    var arm = on
      ? '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/>'
      : '<line x1="' + x1 + '" y1="' + y + '" x2="' + (x2 - 6) + '" y2="' + (y - 18) + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/>';
    return '<circle cx="' + x1 + '" cy="' + y + '" r="5" fill="' + col + '"/>' +
      '<circle cx="' + x2 + '" cy="' + y + '" r="5" fill="' + col + '"/>' + arm;
  }

  function swV(x, y1, y2, on) {
    var col = on ? '#3fb950' : '#f85149';
    var arm = on
      ? '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/>'
      : '<line x1="' + x + '" y1="' + y1 + '" x2="' + (x - 18) + '" y2="' + (y2 - 8) + '" stroke="' + col + '" stroke-width="4" stroke-linecap="round"/>';
    return '<circle cx="' + x + '" cy="' + y1 + '" r="5" fill="' + col + '"/>' +
      '<circle cx="' + x + '" cy="' + y2 + '" r="5" fill="' + col + '"/>' + arm;
  }

  function diodeV(x, y1, y2, on, pointingUp) {
    var mid = (y1 + y2) / 2;
    var col = on ? '#3fb950' : '#f85149';
    var tri = pointingUp
      ? 'M ' + (x - 14) + ' ' + (mid + 8) + ' L ' + (x + 14) + ' ' + (mid + 8) + ' L ' + x + ' ' + (mid - 12) + ' Z'
      : 'M ' + (x - 14) + ' ' + (mid - 8) + ' L ' + (x + 14) + ' ' + (mid - 8) + ' L ' + x + ' ' + (mid + 12) + ' Z';
    var barY = pointingUp ? mid - 12 : mid + 12;
    return wire(x, y1, x, pointingUp ? mid + 8 : mid - 8) +
      '<path d="' + tri + '" fill="' + (on ? '#238636' : '#21262d') + '" stroke="' + col + '" stroke-width="2.5"/>' +
      '<line x1="' + (x - 14) + '" y1="' + barY + '" x2="' + (x + 14) + '" y2="' + barY + '" stroke="' + col + '" stroke-width="3"/>' +
      wire(x, barY, x, y2);
  }

  function diodeH(x1, x2, y, on, pointingRight) {
    var mid = (x1 + x2) / 2;
    var col = on ? '#3fb950' : '#f85149';
    var tri = pointingRight
      ? 'M ' + (mid - 8) + ' ' + (y - 14) + ' L ' + (mid - 8) + ' ' + (y + 14) + ' L ' + (mid + 12) + ' ' + y + ' Z'
      : 'M ' + (mid + 8) + ' ' + (y - 14) + ' L ' + (mid + 8) + ' ' + (y + 14) + ' L ' + (mid - 12) + ' ' + y + ' Z';
    var barX = pointingRight ? mid + 12 : mid - 12;
    return wire(x1, y, pointingRight ? mid - 8 : mid + 8, y) +
      '<path d="' + tri + '" fill="' + (on ? '#238636' : '#21262d') + '" stroke="' + col + '" stroke-width="2.5"/>' +
      '<line x1="' + barX + '" y1="' + (y - 14) + '" x2="' + barX + '" y2="' + (y + 14) + '" stroke="' + col + '" stroke-width="3"/>' +
      wire(barX, y, x2, y);
  }

  function hudBadge(x, y, text1, text2, color) {
    var w = 84, h = 22;
    return '<g transform="translate(' + (x - w / 2) + ',' + (y - h / 2) + ')">' +
      '<rect width="' + w + '" height="' + h + '" rx="5" fill="#161b22" stroke="#30363d" stroke-width="1.2"/>' +
      '<text x="5" y="15" fill="' + (color || '#c9d1d9') + '" font-size="10" font-family="ui-monospace,monospace" font-weight="700">' + text1 + '</text>' +
      '<text x="' + (w - 5) + '" y="15" fill="#8b949e" font-size="9" font-family="ui-monospace,monospace" text-anchor="end">' + (text2 || '') + '</text>' +
    '</g>';
  }

  function polBadge(x, y, sym) {
    var col = sym === '+' ? '#3fb950' : (sym === '−' ? '#f85149' : '#8b949e');
    return '<circle cx="' + x + '" cy="' + y + '" r="8" fill="#161b22" stroke="' + col + '" stroke-width="1.5"/>' +
      '<text x="' + x + '" y="' + (y + 3.5) + '" fill="' + col + '" font-size="10" font-weight="bold" text-anchor="middle" font-family="sans-serif">' + sym + '</text>';
  }

  var cHtml = '';

  if (top === 'buck') {
    var pActive = swOn ? 'flow-active' : null;
    var pFree = diodeOn ? 'flow-active' : null;
    var pCap = isIdle ? 'flow-active-violet' : null;

    cHtml += src(65, 122, 'Vin');
    cHtml += wire(65, 100, 65, topY, pActive);
    cHtml += wire(65, topY, 120, topY, pActive);
    cHtml += swH(120, 180, topY, swOn);
    cHtml += wire(180, topY, 215, topY, pActive);
    cHtml += node(215, topY);

    cHtml += diodeV(215, topY, botY, diodeOn, true);
    cHtml += node(215, botY);

    cHtml += wire(215, topY, 240, topY, (pActive || pFree));
    cHtml += indH(240, topY, 110, swOn);
    cHtml += wire(350, topY, 410, topY, (pActive || pFree));
    cHtml += node(410, topY);

    cHtml += capV(450, topY, botY);
    cHtml += wire(410, topY, 450, topY, (pActive || pFree || pCap));
    cHtml += wire(450, topY, 560, topY, (pActive || pFree || pCap));
    cHtml += node(450, topY);
    cHtml += node(450, botY);

    cHtml += resV(560, topY, botY, 'R');
    cHtml += node(560, topY);
    cHtml += node(560, botY);

    cHtml += wire(65, 144, 65, botY, pActive);
    cHtml += wire(65, botY, 215, botY, pActive);
    cHtml += wire(215, botY, 450, botY, (pActive || pFree || pCap));
    cHtml += wire(450, botY, 560, botY, (pActive || pFree || pCap));

    cHtml += polBadge(235, topY - 14, state.polLeft);
    cHtml += polBadge(355, topY - 14, state.polRight);

    cHtml += hudBadge(150, topY - 26, 'S: ' + (swOn ? 'ON' : 'OFF'), state.vS.toFixed(0) + 'V', swOn ? '#3fb950' : '#f85149');
    cHtml += hudBadge(295, topY - 26, 'vL ' + (state.vL > 0 ? '+' : '') + state.vL.toFixed(0) + 'V', state.iL.toFixed(1) + 'A', '#58a6ff');
    cHtml += hudBadge(215, 122, 'D: ' + (diodeOn ? 'ON' : 'OFF'), state.vD.toFixed(0) + 'V', diodeOn ? '#3fb950' : '#f85149');
    cHtml += hudBadge(450, 122, 'iC', (state.iC > 0 ? '+' : '') + state.iC.toFixed(1) + 'A', '#bc8cff');
    cHtml += hudBadge(610, 122, '+Vo−', config.params.Vo + 'V', '#d29922');
  } else if (top === 'boost') {
    var pOn = swOn ? 'flow-active' : null;
    var pOff = diodeOn ? 'flow-active' : null;
    var pCapB = (swOn || isIdle) ? 'flow-active-violet' : null;

    cHtml += src(65, 122, 'Vin');
    cHtml += wire(65, 100, 65, topY, (pOn || pOff));
    cHtml += wire(65, topY, 115, topY, (pOn || pOff));
    cHtml += indH(115, topY, 110, swOn);
    cHtml += wire(225, topY, 260, topY, (pOn || pOff));
    cHtml += node(260, topY);

    cHtml += swV(260, topY, botY, swOn);
    cHtml += node(260, botY);

    cHtml += diodeH(260, 360, topY, diodeOn, true);
    cHtml += wire(360, topY, 440, topY, pOff);
    cHtml += node(440, topY);

    cHtml += capV(460, topY, botY);
    cHtml += wire(440, topY, 460, topY, (pOff || pCapB));
    cHtml += wire(460, topY, 560, topY, (pOff || pCapB));
    cHtml += node(460, topY);
    cHtml += node(460, botY);

    cHtml += resV(560, topY, botY, 'R');
    cHtml += node(560, topY);
    cHtml += node(560, botY);

    cHtml += wire(65, 144, 65, botY, (pOn || pOff));
    cHtml += wire(65, botY, 260, botY, (pOn || pOff));
    cHtml += wire(260, botY, 460, botY, (pOff || pCapB));
    cHtml += wire(460, botY, 560, botY, (pOff || pCapB));

    cHtml += polBadge(110, topY - 14, state.polLeft);
    cHtml += polBadge(230, topY - 14, state.polRight);

    cHtml += hudBadge(170, topY - 26, 'vL ' + (state.vL > 0 ? '+' : '') + state.vL.toFixed(0) + 'V', state.iL.toFixed(1) + 'A', '#58a6ff');
    cHtml += hudBadge(295, 122, 'S: ' + (swOn ? 'ON' : 'OFF'), state.vS.toFixed(0) + 'V', swOn ? '#3fb950' : '#f85149');
    cHtml += hudBadge(335, topY - 26, 'D: ' + (diodeOn ? 'ON' : 'OFF'), state.vD.toFixed(0) + 'V', diodeOn ? '#3fb950' : '#f85149');
    cHtml += hudBadge(460, 122, 'iC', (state.iC > 0 ? '+' : '') + state.iC.toFixed(1) + 'A', '#bc8cff');
    cHtml += hudBadge(610, 122, '+Vo−', config.params.Vo + 'V', '#d29922');
  } else if (top === 'buckboost') {
    var pOnBB = swOn ? 'flow-active' : null;
    var pOffBB = diodeOn ? 'flow-active-reverse' : null;
    var pCapBB = (swOn || isIdle) ? 'flow-active-violet' : null;

    cHtml += src(65, 122, 'Vin');
    cHtml += wire(65, 100, 65, topY, pOnBB);
    cHtml += wire(65, topY, 115, topY, pOnBB);
    cHtml += swH(115, 185, topY, swOn);
    cHtml += wire(185, topY, 230, topY, pOnBB);
    cHtml += node(230, topY);

    cHtml += indV(230, topY, botY, swOn);
    cHtml += node(230, botY);

    cHtml += diodeH(230, 360, topY, diodeOn, false);
    cHtml += wire(360, topY, 440, topY, pOffBB);
    cHtml += node(440, topY);

    cHtml += capV(460, topY, botY);
    cHtml += wire(440, topY, 460, topY, (pOffBB || pCapBB));
    cHtml += wire(460, topY, 560, topY, (pOffBB || pCapBB));
    cHtml += node(460, topY);
    cHtml += node(460, botY);

    cHtml += resV(560, topY, botY, 'R');
    cHtml += node(560, topY);
    cHtml += node(560, botY);

    cHtml += wire(65, 144, 65, botY, pOnBB);
    cHtml += wire(65, botY, 230, botY, pOnBB);
    cHtml += wire(230, botY, 460, botY, (pOffBB || pCapBB));
    cHtml += wire(460, botY, 560, botY, (pOffBB || pCapBB));

    cHtml += polBadge(230 + 16, topY + 14, state.polLeft);
    cHtml += polBadge(230 + 16, botY - 14, state.polRight);

    cHtml += hudBadge(150, topY - 26, 'S: ' + (swOn ? 'ON' : 'OFF'), state.vS.toFixed(0) + 'V', swOn ? '#3fb950' : '#f85149');
    cHtml += hudBadge(290, 122, 'vL ' + (state.vL > 0 ? '+' : '') + state.vL.toFixed(0) + 'V', state.iL.toFixed(1) + 'A', '#58a6ff');
    cHtml += hudBadge(335, topY - 26, 'D: ' + (diodeOn ? 'ON' : 'OFF'), state.vD.toFixed(0) + 'V', diodeOn ? '#3fb950' : '#f85149');
    cHtml += hudBadge(460, 122, 'iC', (state.iC > 0 ? '+' : '') + state.iC.toFixed(1) + 'A', '#bc8cff');
    cHtml += hudBadge(610, 122, '−Vo+', '−' + config.params.Vo + 'V', '#f85149');
  }

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagrama do circuito">' +
    defs + '<rect width="' + W + '" height="' + H + '" rx="10" fill="#080c12"/>' + cHtml + '</svg>';
}

function generateOscilloscopeSvgContent(config, state, channel) {
  var W = 680, H = 220;
  var padLeft = 60, padRight = 24, padTop = 16;
  var plotW = W - padLeft - padRight;
  var p = config.params;
  var isCCM = config.mode === 'CCM';
  var D = p.D;
  var D2 = isCCM ? 1 - D : p.D2;

  var x0 = padLeft;
  var x1 = padLeft + D * plotW;
  var x2 = isCCM ? padLeft + plotW : padLeft + (D + D2) * plotW;
  var xEnd = padLeft + plotW;

  var yV_mid = padTop + 42;
  var scaleV = 1.35;

  var vL_on = (config.topology === 'buck') ? (p.Vin - p.Vo) : p.Vin;
  var vL_off = (config.topology === 'buck') ? (-p.Vo) : ((config.topology === 'boost') ? (p.Vin - p.Vo) : (-p.Vo));
  var yV_on = yV_mid - vL_on * scaleV;
  var yV_off = yV_mid - vL_off * scaleV;

  var yI_bot = padTop + 85 + 24 + 75;
  var maxI = isCCM ? (p.Imax * 1.25) : (p.Ipk * 1.25);
  var scaleI = 68 / maxI;

  var yI_min = isCCM ? (yI_bot - p.Imin * scaleI) : yI_bot;
  var yI_max = isCCM ? (yI_bot - p.Imax * scaleI) : (yI_bot - p.Ipk * scaleI);

  var xCursor = padLeft + state.tau * plotW;
  var yCurV = yV_mid - state.vL * scaleV;
  var yCurI = yI_bot - state.iL * scaleI;

  var defs =
    '<defs>' +
      '<linearGradient id="gVpos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#388bfd" stop-opacity="0.35"/><stop offset="100%" stop-color="#388bfd" stop-opacity="0.05"/></linearGradient>' +
      '<linearGradient id="gVneg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f85149" stop-opacity="0.05"/><stop offset="100%" stop-color="#f85149" stop-opacity="0.30"/></linearGradient>' +
      '<linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3fb950" stop-opacity="0.32"/><stop offset="100%" stop-color="#3fb950" stop-opacity="0.02"/></linearGradient>' +
    '</defs>';

  var grid =
    '<line x1="' + x0 + '" y1="' + yV_mid + '" x2="' + (xEnd + 8) + '" y2="' + yV_mid + '" stroke="#30363d" stroke-dasharray="3,3" stroke-width="1.2"/>' +
    '<text x="' + (x0 - 8) + '" y="' + (yV_mid + 4) + '" fill="#8b949e" font-size="10" font-family="monospace" text-anchor="end">0V</text>' +
    '<text x="' + x0 + '" y="' + (padTop - 3) + '" fill="#58a6ff" font-size="11" font-weight="bold" font-family="sans-serif">v_L(t) [Tensão no Indutor] • Balanço Volts-Segundo: ∫v_L dt = 0</text>' +

    '<line x1="' + x1 + '" y1="' + (padTop - 4) + '" x2="' + x1 + '" y2="' + (yI_bot + 12) + '" stroke="#484f58" stroke-dasharray="4,4" stroke-width="1"/>' +
    '<text x="' + x1 + '" y="' + (yI_bot + 14) + '" fill="#8b949e" font-size="10" font-family="monospace" text-anchor="middle">DTs</text>';

  if (!isCCM) {
    grid +=
      '<line x1="' + x2 + '" y1="' + (padTop - 4) + '" x2="' + x2 + '" y2="' + (yI_bot + 12) + '" stroke="#d29922" stroke-dasharray="4,4" stroke-width="1"/>' +
      '<text x="' + x2 + '" y="' + (yI_bot + 14) + '" fill="#d29922" font-size="10" font-family="monospace" text-anchor="middle">(D+D2)Ts</text>';
  }

  grid +=
    '<line x1="' + xEnd + '" y1="' + (padTop - 4) + '" x2="' + xEnd + '" y2="' + (yI_bot + 12) + '" stroke="#484f58" stroke-dasharray="4,4" stroke-width="1"/>' +
    '<text x="' + xEnd + '" y="' + (yI_bot + 14) + '" fill="#8b949e" font-size="10" font-family="monospace" text-anchor="middle">Ts</text>' +

    '<line x1="' + x0 + '" y1="' + yI_bot + '" x2="' + (xEnd + 8) + '" y2="' + yI_bot + '" stroke="#30363d" stroke-width="1.4"/>' +
    '<text x="' + (x0 - 8) + '" y="' + (yI_bot + 4) + '" fill="#8b949e" font-size="10" font-family="monospace" text-anchor="end">0A</text>' +
    '<text x="' + x0 + '" y="' + (padTop + 85 + 16) + '" fill="#3fb950" font-size="11" font-weight="bold" font-family="sans-serif">i_L(t) [Corrente no Indutor]' + (isCCM ? ' • CCM (Sobe e desce)' : ' • DCM (Zera em D2Ts!)') + '</text>';

  var areaVpos = '<path d="M ' + x0 + ' ' + yV_mid + ' L ' + x0 + ' ' + yV_on + ' L ' + x1 + ' ' + yV_on + ' L ' + x1 + ' ' + yV_mid + ' Z" fill="url(#gVpos)"/>';
  var areaVneg = '<path d="M ' + x1 + ' ' + yV_mid + ' L ' + x1 + ' ' + yV_off + ' L ' + x2 + ' ' + yV_off + ' L ' + x2 + ' ' + yV_mid + ' Z" fill="url(#gVneg)"/>';

  var pathVL = 'M ' + x0 + ' ' + yV_mid + ' L ' + x0 + ' ' + yV_on + ' L ' + x1 + ' ' + yV_on + ' L ' + x1 + ' ' + yV_off + ' L ' + x2 + ' ' + yV_off;
  if (!isCCM) {
    pathVL += ' L ' + x2 + ' ' + yV_mid + ' L ' + xEnd + ' ' + yV_mid;
  }
  var vLTrace = '<path d="' + pathVL + '" fill="none" stroke="#58a6ff" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<text x="' + (x0 - 8) + '" y="' + (yV_on + 4) + '" fill="#58a6ff" font-size="10" font-family="monospace" text-anchor="end">+' + vL_on.toFixed(0) + 'V</text>' +
    '<text x="' + (x0 - 8) + '" y="' + (yV_off + 4) + '" fill="#f85149" font-size="10" font-family="monospace" text-anchor="end">' + vL_off.toFixed(0) + 'V</text>' +
    '<text x="' + ((x0 + x1) / 2) + '" y="' + ((yV_mid + yV_on) / 2 + 4) + '" fill="#58a6ff" font-size="10" font-family="monospace" text-anchor="middle">+A1</text>' +
    '<text x="' + ((x1 + x2) / 2) + '" y="' + ((yV_mid + yV_off) / 2 + 4) + '" fill="#f85149" font-size="10" font-family="monospace" text-anchor="middle">−A2</text>';

  var pathIL = '', areaIL = '';
  if (isCCM) {
    pathIL = 'M ' + x0 + ' ' + yI_min + ' L ' + x1 + ' ' + yI_max + ' L ' + xEnd + ' ' + yI_min;
    areaIL = 'M ' + x0 + ' ' + yI_bot + ' L ' + x0 + ' ' + yI_min + ' L ' + x1 + ' ' + yI_max + ' L ' + xEnd + ' ' + yI_min + ' L ' + xEnd + ' ' + yI_bot + ' Z';
  } else {
    pathIL = 'M ' + x0 + ' ' + yI_bot + ' L ' + x1 + ' ' + yI_max + ' L ' + x2 + ' ' + yI_bot + ' L ' + xEnd + ' ' + yI_bot;
    areaIL = 'M ' + x0 + ' ' + yI_bot + ' L ' + x1 + ' ' + yI_max + ' L ' + x2 + ' ' + yI_bot + ' Z';
  }

  var iLTrace =
    '<path d="' + areaIL + '" fill="url(#gI)"/>' +
    '<path d="' + pathIL + '" fill="none" stroke="#3fb950" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<text x="' + (x0 - 8) + '" y="' + (yI_max + 4) + '" fill="#3fb950" font-size="10" font-family="monospace" text-anchor="end">' + (isCCM ? p.Imax.toFixed(1) : p.Ipk.toFixed(1)) + 'A</text>';

  if (isCCM) {
    iLTrace += '<text x="' + (x0 - 8) + '" y="' + (yI_min + 4) + '" fill="#3fb950" font-size="10" font-family="monospace" text-anchor="end">' + p.Imin.toFixed(1) + 'A</text>';
  }

  var extraTraces = '';
  if (channel === 'semicondutores') {
    var pIS = 'M ' + x0 + ' ' + yI_min + ' L ' + x1 + ' ' + yI_max + ' L ' + x1 + ' ' + yI_bot + ' L ' + xEnd + ' ' + yI_bot;
    var pID = 'M ' + x0 + ' ' + yI_bot + ' L ' + x1 + ' ' + yI_bot + ' L ' + x1 + ' ' + yI_max + ' L ' + x2 + ' ' + (isCCM ? yI_min : yI_bot) + (isCCM ? '' : ' L ' + xEnd + ' ' + yI_bot);
    extraTraces =
      '<path d="' + pIS + '" fill="none" stroke="#e3b341" stroke-width="1.8" stroke-dasharray="3,3"/>' +
      '<text x="' + ((x0 + x1) / 2) + '" y="' + (yI_bot - 10) + '" fill="#e3b341" font-size="10" font-family="monospace" text-anchor="middle">iS(t)</text>' +
      '<path d="' + pID + '" fill="none" stroke="#bc8cff" stroke-width="1.8" stroke-dasharray="3,3"/>' +
      '<text x="' + ((x1 + x2) / 2) + '" y="' + (yI_bot - 10) + '" fill="#bc8cff" font-size="10" font-family="monospace" text-anchor="middle">iD(t)</text>';
  } else if (channel === 'filtro') {
    var yC_mid = yI_bot - 24;
    extraTraces =
      '<line x1="' + x0 + '" y1="' + yC_mid + '" x2="' + xEnd + '" y2="' + yC_mid + '" stroke="#bc8cff" stroke-width="1" stroke-dasharray="2,2"/>' +
      '<text x="' + (xEnd - 5) + '" y="' + (yC_mid - 4) + '" fill="#bc8cff" font-size="10" font-family="monospace" text-anchor="end">iC média = 0A</text>';
  }

  var playhead =
    '<line x1="' + xCursor + '" y1="' + (padTop - 6) + '" x2="' + xCursor + '" y2="' + (yI_bot + 6) + '" stroke="#58a6ff" stroke-width="1.8" stroke-dasharray="2,2"/>' +
    '<circle cx="' + xCursor + '" cy="' + yCurV + '" r="5" fill="#58a6ff" stroke="#ffffff" stroke-width="1.5"/>' +
    '<circle cx="' + xCursor + '" cy="' + yCurI + '" r="5" fill="#3fb950" stroke="#ffffff" stroke-width="1.5"/>' +
    '<g transform="translate(' + (xCursor - 27) + ',' + (padTop - 12) + ')">' +
      '<rect width="54" height="15" rx="4" fill="#161b22" stroke="#388bfd" stroke-width="1"/>' +
      '<text x="27" y="11" fill="#79c0ff" font-size="9" font-family="monospace" text-anchor="middle" font-weight="bold">' + (state.tau * 100).toFixed(0) + '% Ts</text>' +
    '</g>';

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Osciloscópio de formas de onda">' +
    defs + '<rect width="' + W + '" height="' + H + '" rx="10" fill="#080c12"/>' +
    grid + areaVpos + areaVneg + vLTrace + iLTrace + extraTraces + playhead + '</svg>';
}

window.initSubjectTools = function () {
  initCalculator();
  initConverterDashboards();
};
