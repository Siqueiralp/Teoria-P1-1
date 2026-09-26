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
   3. DASHBOARDS INTERATIVOS — ETAPAS DOS CONVERSORES
   ========================================================================== */
function initConverterDashboards() {
  var configs = {
    mod4: { title: 'Buck em CCM', topology: 'buck', mode: 'CCM', formula: 'Vo = D · Vin',
      stages: [
        {label:'Etapa 1 · Chave ON', interval:'0 → D·Ts', kind:'on', sw:'conduz', diode:'bloqueado', current:'iL cresce', note:'A fonte alimenta a carga e magnetiza o indutor.'},
        {label:'Etapa 2 · Chave OFF', interval:'D·Ts → Ts', kind:'off', sw:'bloqueada', diode:'conduz', current:'iL decresce', note:'O indutor mantém a corrente pela malha de roda livre.'}
      ]},
    mod5: { title: 'Boost em CCM', topology: 'boost', mode: 'CCM', formula: 'Vo = Vin / (1 − D)',
      stages: [
        {label:'Etapa 1 · Chave ON', interval:'0 → D·Ts', kind:'on', sw:'conduz', diode:'bloqueado', current:'iL cresce', note:'O indutor armazena energia; o capacitor sustenta a carga.'},
        {label:'Etapa 2 · Chave OFF', interval:'D·Ts → Ts', kind:'off', sw:'bloqueada', diode:'conduz', current:'iL decresce', note:'Fonte e indutor transferem energia para a saída.'}
      ]},
    mod6: { title: 'Buck-Boost inversor em CCM', topology: 'buckboost', mode: 'CCM', formula: 'vo / Vin = −D / (1 − D)',
      stages: [
        {label:'Etapa 1 · Chave ON', interval:'0 → D·Ts', kind:'on', sw:'conduz', diode:'bloqueado', current:'iL cresce', note:'A fonte magnetiza o indutor; o capacitor mantém a carga.'},
        {label:'Etapa 2 · Chave OFF', interval:'D·Ts → Ts', kind:'off', sw:'bloqueada', diode:'conduz', current:'iL decresce', note:'O indutor entrega energia à saída com polaridade invertida.'}
      ]},
    mod7: { title: 'Buck em DCM', topology: 'buck', mode: 'DCM', formula: 'M = 2 / [1 + √(1 + 4K/D²)]',
      stages: [
        {label:'Etapa 1 · Chave ON', interval:'0 → D·Ts', kind:'on', sw:'conduz', diode:'bloqueado', current:'0 → Ipk', note:'A corrente do indutor parte de zero e cresce linearmente.'},
        {label:'Etapa 2 · Diodo conduz', interval:'D·Ts → (D + D2)·Ts', kind:'off', sw:'bloqueada', diode:'conduz', current:'Ipk → 0', note:'O indutor descarrega completamente pela carga.'},
        {label:'Etapa 3 · Corrente nula', interval:'(D + D2)·Ts → Ts', kind:'idle', sw:'bloqueada', diode:'bloqueado', current:'iL = 0', note:'O capacitor sozinho sustenta a tensão de saída.'}
      ]},
    mod8: { title: 'Boost em DCM', topology: 'boost', mode: 'DCM', formula: 'M = [1 + √(1 + 4D²/K)] / 2',
      stages: [
        {label:'Etapa 1 · Chave ON', interval:'0 → D·Ts', kind:'on', sw:'conduz', diode:'bloqueado', current:'0 → Ipk', note:'A fonte magnetiza o indutor; o capacitor alimenta a carga.'},
        {label:'Etapa 2 · Diodo conduz', interval:'D·Ts → (D + D2)·Ts', kind:'off', sw:'bloqueada', diode:'conduz', current:'Ipk → 0', note:'Fonte e indutor entregam energia à saída até iL zerar.'},
        {label:'Etapa 3 · Corrente nula', interval:'(D + D2)·Ts → Ts', kind:'idle', sw:'bloqueada', diode:'bloqueado', current:'iL = 0', note:'O indutor fica sem energia e o capacitor mantém a carga.'}
      ]},
    mod9: { title: 'Buck-Boost inversor em DCM', topology: 'buckboost', mode: 'DCM', formula: '|Vo| / Vin = D / √K',
      stages: [
        {label:'Etapa 1 · Chave ON', interval:'0 → D·Ts', kind:'on', sw:'conduz', diode:'bloqueado', current:'0 → Ipk', note:'A fonte magnetiza o indutor; o capacitor sustenta a carga.'},
        {label:'Etapa 2 · Diodo conduz', interval:'D·Ts → (D + D2)·Ts', kind:'off', sw:'bloqueada', diode:'conduz', current:'Ipk → 0', note:'O indutor transfere energia à saída invertida.'},
        {label:'Etapa 3 · Corrente nula', interval:'(D + D2)·Ts → Ts', kind:'idle', sw:'bloqueada', diode:'bloqueado', current:'iL = 0', note:'Chave e diodo ficam bloqueados; o capacitor alimenta a carga.'}
      ]}
  };

  Object.keys(configs).forEach(function(moduleId) {
    var section = document.getElementById(moduleId);
    if (!section || section.querySelector('.converter-dashboard')) return;
    var body = section.querySelector('.module-body');
    if (!body) return;
    var heading = body.querySelector('h3');
    var host = document.createElement('section');
    host.className = 'converter-dashboard';
    host.setAttribute('aria-label', 'Circuito interativo de ' + configs[moduleId].title);
    if (heading) heading.insertAdjacentElement('afterend', host);
    else body.insertBefore(host, body.firstChild);
    createConverterDashboard(host, configs[moduleId]);
  });
}

function createConverterDashboard(host, config) {
  var activeStage = 0;
  var timer = null;

  host.innerHTML =
    '<div class="converter-dashboard-head">' +
      '<div><span class="converter-dashboard-kicker">Circuito interativo</span><h4></h4>' +
      '<p>Selecione uma etapa ou use a animação automática para acompanhar o caminho de energia.</p></div>' +
      '<div class="converter-dashboard-tags"><span>' + config.mode + '</span><span>' +
      (config.topology === 'buckboost' ? 'Buck-Boost' : config.topology.charAt(0).toUpperCase() + config.topology.slice(1)) +
      '</span></div></div>' +
    '<div class="converter-dashboard-layout">' +
      '<div class="converter-dashboard-visual"><div class="converter-dashboard-svg"></div>' +
      '<div class="converter-dashboard-legend"><span><i class="legend-current"></i>Caminho ativo</span>' +
      '<span><i class="legend-blocked"></i>Bloqueado</span><span><i class="legend-il"></i>iL</span></div></div>' +
      '<div class="converter-dashboard-panel"><div class="converter-stage-buttons"></div>' +
      '<div class="converter-stage-card"></div><div class="converter-stage-timeline"></div>' +
      '<div class="converter-dashboard-formula"><span>Relação-chave</span><strong>' + config.formula + '</strong></div></div>' +
    '</div>';

  host.querySelector('h4').textContent = config.title;
  var visual = host.querySelector('.converter-dashboard-svg');
  var buttons = host.querySelector('.converter-stage-buttons');
  var card = host.querySelector('.converter-stage-card');
  var timeline = host.querySelector('.converter-stage-timeline');

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function render() {
    var stage = config.stages[activeStage];
    visual.innerHTML = buildConverterSvg(config, activeStage);

    buttons.innerHTML = '';
    config.stages.forEach(function(item, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(index + 1);
      if (index === activeStage) btn.className = 'active';
      btn.addEventListener('click', function() {
        stop();
        activeStage = index;
        render();
      });
      buttons.appendChild(btn);
    });

    var auto = document.createElement('button');
    auto.type = 'button';
    auto.className = 'dashboard-auto';
    auto.textContent = timer ? 'Parar ■' : 'Auto ▶';
    auto.addEventListener('click', function() {
      if (timer) {
        stop();
        render();
        return;
      }
      timer = setInterval(function() {
        activeStage = (activeStage + 1) % config.stages.length;
        render();
      }, 1650);
      render();
    });
    buttons.appendChild(auto);

    var swClass = stage.sw === 'conduz' ? 'state-on' : 'state-off';
    var diodeClass = stage.diode === 'conduz' ? 'state-on' : 'state-off';
    var currentClass = stage.kind === 'idle' ? 'state-idle' : 'state-current';

    card.innerHTML =
      '<span class="stage-number">Etapa ' + (activeStage + 1) + ' de ' + config.stages.length + '</span>' +
      '<h5>' + stage.label + '</h5><p class="stage-interval">' + stage.interval + '</p>' +
      '<div class="stage-status-grid">' +
        '<div class="' + swClass + '"><b>Chave S</b><span>' + stage.sw + '</span></div>' +
        '<div class="' + diodeClass + '"><b>Diodo D</b><span>' + stage.diode + '</span></div>' +
        '<div class="' + currentClass + '"><b>Corrente iL</b><span>' + stage.current + '</span></div>' +
      '</div><p class="stage-note">' + stage.note + '</p>';

    timeline.innerHTML = '';
    config.stages.forEach(function(item, index) {
      var cell = document.createElement('div');
      cell.className = 'timeline-stage ' + item.kind + (index === activeStage ? ' active' : '');
      cell.innerHTML = '<b>' + (index + 1) + '</b><span>' + item.interval + '</span>';
      timeline.appendChild(cell);
    });
    timeline.style.gridTemplateColumns = 'repeat(' + config.stages.length + ', minmax(0, 1fr))';
  }

  render();
}

function buildConverterSvg(config, activeStage) {
  var stage = config.stages[activeStage];
  var green = '#3fb950', red = '#f85149', blue = '#58a6ff', violet = '#bc8cff';
  var white = '#c9d1d9', muted = '#8b949e';
  var swOn = stage.sw === 'conduz';
  var diodeOn = stage.diode === 'conduz';

  function ln(x1,y1,x2,y2,color,width,dash) {
    var s = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (color || white) +
      '" stroke-width="' + (width || 3) + '" stroke-linecap="round"';
    if (dash) s += ' stroke-dasharray="' + dash + '"';
    return s + '/>';
  }
  function txt(x,y,value,color,size,anchor,weight) {
    return '<text x="' + x + '" y="' + y + '" fill="' + (color || white) + '" font-size="' + (size || 16) +
      '" text-anchor="' + (anchor || 'middle') + '" font-family="system-ui,Segoe UI,sans-serif" font-weight="' +
      (weight || 600) + '">' + value + '</text>';
  }
  function nd(x,y,color) {
    return '<circle cx="' + x + '" cy="' + y + '" r="4.5" fill="' + (color || white) + '"/>';
  }
  function ar(x1,y1,x2,y2,color) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (color || green) +
      '" stroke-width="5" stroke-linecap="round" marker-end="url(#flowArrow)"/>';
  }
  function src(cx,cy) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="25" fill="none" stroke="' + white + '" stroke-width="3"/>' +
      ln(cx,cy-43,cx,cy-25) + ln(cx,cy+25,cx,cy+43) + ln(cx-6,cy-9,cx+6,cy-9) + ln(cx,cy-15,cx,cy-3) +
      ln(cx-6,cy+10,cx+6,cy+10) + txt(cx-34,cy+5,'Vin',white,15,'end');
  }
  function ind(x,y,length) {
    var d = '', pitch = length / 4;
    for (var i=0;i<4;i++) {
      var sx=x+i*pitch, mx=sx+pitch/2, ex=sx+pitch;
      d += 'M ' + sx + ' ' + y + ' Q ' + mx + ' ' + (y-22) + ' ' + ex + ' ' + y + ' ';
    }
    return '<path d="' + d + '" fill="none" stroke="' + white + '" stroke-width="3.5" stroke-linecap="round"/>';
  }
  function cap(x,y1,y2) {
    return ln(x,y1,x,y1+22) + ln(x-16,y1+22,x+16,y1+22) + ln(x-16,y1+36,x+16,y1+36) + ln(x,y1+36,x,y2);
  }
  function res(x,y1,y2) {
    var step=(y2-y1-16)/6, y=y1+8, side=-1;
    var d='M '+x+' '+y1+' L '+x+' '+(y1+8);
    for(var i=0;i<6;i++){ y+=step; d+=' L '+(x+side*10)+' '+y; side*=-1; }
    d+=' L '+x+' '+y2;
    return '<path d="' + d + '" fill="none" stroke="' + white + '" stroke-width="3" stroke-linejoin="round"/>';
  }
  function swH(x1,x2,y) {
    var c=swOn?green:red;
    return '<circle cx="'+x1+'" cy="'+y+'" r="5" fill="'+c+'"/><circle cx="'+x2+'" cy="'+y+'" r="5" fill="'+c+'"/>' +
      '<line x1="'+x1+'" y1="'+y+'" x2="'+(swOn?x2:x2-5)+'" y2="'+(swOn?y:y-17)+'" stroke="'+c+'" stroke-width="4" stroke-linecap="round"/>';
  }
  function swV(x,y1,y2) {
    var c=swOn?green:red;
    return '<circle cx="'+x+'" cy="'+y1+'" r="5" fill="'+c+'"/><circle cx="'+x+'" cy="'+y2+'" r="5" fill="'+c+'"/>' +
      '<line x1="'+x+'" y1="'+y1+'" x2="'+(swOn?x:x-17)+'" y2="'+(swOn?y2:y2-5)+'" stroke="'+c+'" stroke-width="4" stroke-linecap="round"/>';
  }
  function diodeH(x,y) {
    var c=diodeOn?green:red;
    return ln(x-30,y,x-10,y) + '<path d="M '+(x-10)+' '+(y-16)+' L '+(x-10)+' '+(y+16)+' L '+(x+10)+' '+y+' Z" fill="none" stroke="'+c+'" stroke-width="3.5"/>' +
      ln(x+16,y-16,x+16,y+16,c,3.5) + ln(x+16,y,x+34,y);
  }
  function diodeV(x,y1,y2) {
    var c=diodeOn?green:red, mid=(y1+y2)/2;
    return ln(x,y1,x,mid-22) + '<path d="M '+(x-16)+' '+(mid+6)+' L '+(x+16)+' '+(mid+6)+' L '+x+' '+(mid-14)+' Z" fill="none" stroke="'+c+'" stroke-width="3.5"/>' +
      ln(x-16,mid+14,x+16,mid+14,c,3.5) + ln(x,mid+14,x,y2);
  }

  var top=111, bottom=214, circuit='';

  if(config.topology==='buck'){
    circuit += src(62,154) + ln(62,111,120,111) + ln(62,197,62,bottom) + ln(62,bottom,612,bottom);
    circuit += swH(132,182,111) + txt(157,82,'S',swOn?green:red);
    circuit += ln(182,111,204,111) + nd(204,111) + ind(226,111,104) + txt(278,80,'L') + txt(295,99,'iL',blue,14);
    circuit += ln(330,111,452,111) + nd(452,111) + cap(492,111,bottom) + txt(492,153,'C') + res(574,111,bottom) + txt(591,153,'R',white,15,'start');
    circuit += ln(452,111,595,111) + ln(452,bottom,595,bottom) + diodeV(204,111,bottom) + txt(229,171,'D',diodeOn?green:red,15,'start');
    if(stage.kind==='on') circuit += ar(76,111,118,111)+ar(139,111,178,111)+ar(209,111,326,111)+ar(338,111,445,111);
    else if(stage.kind==='off') circuit += ar(204,202,204,132)+ar(226,111,326,111)+ar(338,111,445,111)+ar(590,bottom,505,bottom);
    else circuit += ar(590,bottom,505,bottom,violet)+ar(505,bottom,505,163,violet);
  }

  if(config.topology==='boost'){
    circuit += src(62,154) + ln(62,111,132,111) + ln(62,197,62,bottom) + ln(62,bottom,620,bottom);
    circuit += ind(132,111,104)+txt(184,80,'L')+txt(201,99,'iL',blue,14)+ln(236,111,295,111)+nd(295,111);
    circuit += swV(295,145,202)+txt(321,182,'S',swOn?green:red,15,'start')+diodeH(355,111)+txt(355,80,'D',diodeOn?green:red);
    circuit += ln(389,111,505,111)+nd(505,111)+cap(505,111,bottom)+txt(505,153,'C')+res(586,111,bottom)+txt(602,153,'R',white,15,'start');
    if(stage.kind==='on') circuit += ar(76,111,128,111)+ar(240,111,289,111)+ar(295,152,295,198)+ar(590,bottom,518,bottom,violet);
    else if(stage.kind==='off') circuit += ar(76,111,128,111)+ar(240,111,291,111)+ar(399,111,497,111)+ar(512,111,580,111);
    else circuit += ar(590,bottom,518,bottom,violet)+ar(518,bottom,518,162,violet);
  }

  if(config.topology==='buckboost'){
    circuit += src(62,154) + ln(62,111,132,111) + ln(62,197,62,bottom) + ln(62,bottom,620,bottom);
    circuit += ind(132,111,104)+txt(184,80,'L')+txt(201,99,'iL',blue,14)+ln(236,111,295,111)+nd(295,111);
    circuit += swV(295,145,202)+txt(321,182,'S',swOn?green:red,15,'start')+diodeH(355,111)+txt(355,80,'D',diodeOn?green:red);
    circuit += ln(389,111,505,111)+nd(505,111)+cap(505,111,bottom)+txt(505,153,'C')+res(586,111,bottom)+txt(602,153,'R',white,15,'start')+txt(625,128,'−Vo',white,14,'start');
    if(stage.kind==='on') circuit += ar(76,111,128,111)+ar(240,111,291,111)+ar(295,152,295,198)+ar(590,115,590,199,violet);
    else if(stage.kind==='off') circuit += ar(240,111,291,111)+ar(399,111,497,111)+ar(512,111,580,111)+ar(590,115,590,199);
    else circuit += ar(590,115,590,199,violet);
  }

  var wave = buildDashboardCurrentWaveform(config, activeStage, blue, white, muted, green, violet);
  var arrowColor = stage.kind==='idle' ? violet : green;

  return '<svg viewBox="0 0 700 350" role="img" aria-label="'+config.title+' — '+stage.label+'">' +
    '<defs><marker id="flowArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
    '<path d="M 0 0 L 10 5 L 0 10 z" fill="'+arrowColor+'"/></marker></defs>' +
    '<rect x="0" y="0" width="700" height="350" rx="16" fill="#0d1117"/>' +
    txt(24,32,stage.label,white,18,'start',700)+txt(676,32,stage.interval,muted,13,'end',600)+circuit+wave+'</svg>';
}

function buildDashboardCurrentWaveform(config, activeStage, blue, white, muted, green, violet) {
  var x0=78, y0=318, width=540, top=256, n=config.stages.length, segment=width/n;
  var path = config.mode==='CCM'
    ? 'M '+x0+' '+(y0-18)+' L '+(x0+segment)+' '+(top+8)+' L '+(x0+width)+' '+(y0-18)
    : 'M '+x0+' '+y0+' L '+(x0+segment)+' '+(top+8)+' L '+(x0+segment*2)+' '+y0+' L '+(x0+width)+' '+y0;
  var markers='';
  config.stages.forEach(function(stage,index){
    var start=x0+index*segment;
    var color=stage.kind==='on'?green:(stage.kind==='off'?blue:violet);
    markers += '<rect x="'+(start+2)+'" y="228" width="'+(segment-4)+'" height="18" rx="6" fill="'+(index===activeStage?color:'#161b22')+'" opacity="'+(index===activeStage?0.55:1)+'" stroke="#30363d"/>';
    markers += '<text x="'+(start+segment/2)+'" y="241" fill="'+white+'" font-size="10" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif">'+(index+1)+'</text>';
    if(index>0) markers += '<line x1="'+start+'" y1="224" x2="'+start+'" y2="'+(y0+4)+'" stroke="#30363d" stroke-dasharray="4,4"/>';
  });
  var zeroNote=config.mode==='DCM'
    ? '<text x="'+(x0+width-4)+'" y="'+(y0-8)+'" fill="'+muted+'" font-size="11" text-anchor="end" font-family="system-ui,Segoe UI,sans-serif">iL = 0</text>'
    : '';
  return '<text x="28" y="275" fill="'+blue+'" font-size="14" text-anchor="start" font-family="system-ui,Segoe UI,sans-serif" font-weight="700">iL(t)</text>' +
    '<line x1="'+x0+'" y1="'+y0+'" x2="'+(x0+width+10)+'" y2="'+y0+'" stroke="#484f58" stroke-width="1.5"/>' +
    markers + '<path d="'+path+'" fill="none" stroke="'+blue+'" stroke-width="3.5" stroke-linejoin="round"/>' + zeroNote;
}

window.initSubjectTools = function () {
  initCalculator();
  initConverterDashboards();
};
