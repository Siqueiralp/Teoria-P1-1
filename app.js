/* ==========================================================================
   ELETRÔNICA DE POTÊNCIA (TEORIA P1) - ENGINE INTERATIVO
   Gerenciamento de Checklist, Persistência Local, Simulador de Conversores,
   Geração Procedural de Formas de Onda SVG e Interações de Estudo
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initTracker();
  initCalculator();
  initNavigation();
  initExerciseAccordions();
  renderKaTeXIfAvailable();
});

/* ==========================================================================
   1. SISTEMA DE CHECKLIST & MEDIÇÃO DE PROGRESSO PERSISTENTE (localStorage)
   ========================================================================== */
const STORAGE_KEY = 'ep_p1_utfpr_progress_v1';

function getProgressData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { completedModules: [], checkedItems: [] };
  } catch (e) {
    console.warn('Erro ao acessar localStorage:', e);
    return { completedModules: [], checkedItems: [] };
  }
}

function saveProgressData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }
}

function initTracker() {
  const data = getProgressData();
  const allCheckboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
  const allModButtons = document.querySelectorAll('.btn-complete-module');
  const allNavItems = document.querySelectorAll('.nav-item');

  // Restaurar checkboxes
  allCheckboxes.forEach(cb => {
    const itemId = cb.getAttribute('data-check-id');
    if (itemId && data.checkedItems.includes(itemId)) {
      cb.checked = true;
      cb.closest('.checklist-item')?.classList.add('checked');
    }

    cb.addEventListener('change', (e) => {
      const parent = cb.closest('.checklist-item');
      if (cb.checked) {
        parent?.classList.add('checked');
        if (!data.checkedItems.includes(itemId)) data.checkedItems.push(itemId);
      } else {
        parent?.classList.remove('checked');
        data.checkedItems = data.checkedItems.filter(id => id !== itemId);
      }
      saveProgressData(data);
      updateOverallProgress();
    });
  });

  // Restaurar e vincular botões de "Marcar Módulo como Concluído"
  allModButtons.forEach(btn => {
    const modId = btn.getAttribute('data-mod-id');
    if (modId && data.completedModules.includes(modId)) {
      btn.classList.add('completed');
      btn.innerHTML = '✓ Módulo Concluído';
      updateNavModuleState(modId, true);
    }

    btn.addEventListener('click', () => {
      const isCompleted = btn.classList.contains('completed');
      if (!isCompleted) {
        btn.classList.add('completed');
        btn.innerHTML = '✓ Módulo Concluído';
        if (!data.completedModules.includes(modId)) data.completedModules.push(modId);
        // Também marcar todos os sub-itens do módulo
        const modSection = btn.closest('.module-section');
        if (modSection) {
          modSection.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(subCb => {
            const sId = subCb.getAttribute('data-check-id');
            if (!subCb.checked) {
              subCb.checked = true;
              subCb.closest('.checklist-item')?.classList.add('checked');
              if (sId && !data.checkedItems.includes(sId)) data.checkedItems.push(sId);
            }
          });
        }
        updateNavModuleState(modId, true);
      } else {
        btn.classList.remove('completed');
        btn.innerHTML = 'Marcar como Concluído';
        data.completedModules = data.completedModules.filter(id => id !== modId);
        updateNavModuleState(modId, false);
      }
      saveProgressData(data);
      updateOverallProgress();
    });
  });

  // Botão de Reset
  const resetBtn = document.getElementById('btnResetProgress');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Deseja realmente resetar todo o seu histórico de estudos e checklist?')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    });
  }

  updateOverallProgress();
}

function updateNavModuleState(modId, completed) {
  const navItem = document.querySelector(`.nav-item[data-nav-mod="${modId}"]`);
  if (navItem) {
    if (completed) {
      navItem.classList.add('completed');
    } else {
      navItem.classList.remove('completed');
    }
  }
}

function updateOverallProgress() {
  const allCheckboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
  const allModButtons = document.querySelectorAll('.btn-complete-module');
  
  const totalItems = allCheckboxes.length + allModButtons.length;
  if (totalItems === 0) return;

  const data = getProgressData();
  const checkedCount = data.checkedItems.length;
  const modCount = data.completedModules.length;
  const completedTotal = checkedCount + modCount;

  const percent = Math.min(100, Math.round((completedTotal / totalItems) * 100));

  const percentEl = document.getElementById('globalProgressPercent');
  const countEl = document.getElementById('globalProgressCount');
  const barEl = document.getElementById('globalProgressBar');

  if (percentEl) percentEl.textContent = `${percent}%`;
  if (countEl) countEl.textContent = `${completedTotal}/${totalItems} metas atingidas (${modCount}/9 módulos)`;
  if (barEl) barEl.style.width = `${percent}%`;
}

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
   3. NAVEGAÇÃO, FILTRO & INTERSEÇÃO DE SEÇÕES
   ========================================================================== */
function initNavigation() {
  const searchInput = document.getElementById('sidebarSearch');
  const navItems = document.querySelectorAll('.nav-item');
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      navItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (!q || text.includes(q)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Highlight ativo com IntersectionObserver
  const sections = document.querySelectorAll('.module-section, .calculator-section, #cheatSheetSection, #quizSection');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach(link => {
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }, { threshold: 0.25 });

  sections.forEach(sec => observer.observe(sec));
}

/* ==========================================================================
   4. ACORDEÕES DE EXERCÍCIOS RESOLVIDOS
   ========================================================================== */
function initExerciseAccordions() {
  document.querySelectorAll('.solution-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const content = document.getElementById(targetId);
      if (content) {
        content.classList.toggle('open');
        btn.textContent = content.classList.contains('open') ? '▲ Ocultar Resolução' : '▼ Ver Resolução Completa Passo a Passo';
        // Re-renderizar KaTeX caso necessário
        renderKaTeXIfAvailable();
      }
    });
  });
}

/* ==========================================================================
   5. RENDERIZAÇÃO DO KATEX (SUPORTE MATEMÁTICO)
   ========================================================================== */
function renderKaTeXIfAvailable() {
  if (typeof renderMathInElement === 'function') {
    try {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn('Erro na renderização KaTeX:', e);
    }
  }
}
