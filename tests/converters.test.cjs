const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
const context = vm.createContext({ window: {}, document: {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', setAttribute() {} });
    return elements.get(id);
  }
} });
vm.runInContext(fs.readFileSync('subjects/eletronica-potencia/subject.js', 'utf8'), context);
const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

for (const config of Object.values(context.CONVERTER_CONFIGS)) {
  test(`${config.title}: Kirchhoff, potência, carga e continuidade`, () => {
    const p = config.params;
    const segments = context.waveformSegments(config);
    const mean = key => segments.reduce((sum, s) => sum + (s.left[key] + s.right[key]) / 2 * (s.end - s.start), 0);
    close(mean('vL'), 0);
    close(mean('iC'), 0);
    close(context.capacitorVoltageAt(config, 0), context.capacitorVoltageAt(config, 1), 1e-7);
    assert.ok(context.capacitorRipple(config) > 0);
    close(p.Vin * mean('iIn'), p.Vo * p.Io);
    close(p.D + p.D2 + p.D3, 1);
    for (const s of segments) {
      close((s.right.iL - s.left.iL) / ((s.end - s.start) / p.fs), s.left.vL / p.L, 1e-3);
      for (let i = 0; i < 20; i++) {
        const tau = s.start + (i + 0.5) / 20 * (s.end - s.start);
        const state = context.calculateInstantState(config, tau);
        const h = Math.min(1e-5, (s.end - s.start) / 1000);
        const dvDtau = (context.capacitorVoltageAt(config, tau + h) - context.capacitorVoltageAt(config, tau - h)) / (2 * h);
        close(dvDtau, state.iC / (p.C * p.fs), 2e-4);
        close(state.iS + state.iD, state.iL);
        close(state.iC + p.Io, config.topology === 'buck' ? state.iL : state.iD);
        assert.ok(state.iL >= 0 && state.iD >= 0 && state.vD <= 1e-10);
        close(state.iD * state.vD, 0);
        close(state.iS * state.vS, 0);
        close(state.iCDown, state.iC * (config.topology === 'buckboost' ? -1 : 1));
        close(state.iOutDown, p.Io * (config.topology === 'buckboost' ? -1 : 1));
      }
    }
    for (const boundary of [p.D, p.D + p.D2].filter(t => t < 1)) {
      close(context.calculateInstantState(config, boundary - 1e-10).iL,
        context.calculateInstantState(config, boundary + 1e-10).iL);
    }
    close(context.calculateInstantState(config, 0).iL, context.calculateInstantState(config, 1).iL);
    for (const event of context.converterEvents(config).filter(e => e.title.startsWith('iC'))) {
      close(context.calculateInstantState(config, event.tau).iC, 0);
    }
    if (config.mode === 'DCM') {
      const idle = context.calculateInstantState(config, p.D + p.D2);
      assert.equal(idle.stageIdx, 2);
      close(idle.iL, 0); close(idle.iD, 0); close(idle.iS, 0); close(idle.vL, 0);
      close(idle.iC, -p.Io);
    }
  });
}

function calculate(topology, overrides = {}) {
  const values = { calcTopology: topology, calcVin: 24, calcVo: topology === 'boost' ? 48 : 12,
    calcPo: 48, calcFs: 50, calcL: 100, calcC: 47, ...overrides };
  for (const [id, value] of Object.entries(values)) context.document.getElementById(id).value = String(value);
  let waveform;
  context.drawWaveformsSVG = p => { waveform = p; };
  context.runConverterCalculations();
  return { waveform, values, text: id => context.document.getElementById(id).textContent };
}

test('Calculadora: integração independente do ripple, CCM/DCM e fronteira', () => {
  for (const topology of ['buck', 'boost', 'buck-boost']) {
    for (const calcL of [1, 5, 15, 25, 50, 100, 1000]) {
      for (const calcPo of [1, 20, 48, 200]) {
        const r = calculate(topology, { calcL, calcPo });
        const w = r.waveform;
        assert.ok(w && w.D > 0 && w.D < 1 && w.D + w.D2 <= 1 + 1e-10);
        const Io = calcPo / r.values.calcVo, steps = 20000;
        let charge = 0, min = 0, max = 0, inMean = 0;
        for (let i = 0; i < steps; i++) {
          const t = (i + 0.5) / steps;
          const on = t < w.D, off = t >= w.D && t < w.D + w.D2;
          const il = on ? w.IL_min + (w.IL_max - w.IL_min) * t / w.D
            : off ? w.IL_max - (w.IL_max - w.IL_min) * (t - w.D) / w.D2 : 0;
          charge += ((topology === 'buck' ? il : off ? il : 0) - Io) / steps / 50000;
          inMean += (topology === 'boost' ? il : on ? il : 0) / steps;
          min = Math.min(min, charge); max = Math.max(max, charge);
        }
        close(inMean * r.values.calcVin, calcPo, Math.max(0.04, calcPo * 0.001));
        close(charge * 50000, 0, 0.002);
        const expectedMv = (max - min) / (47e-6) * 1000;
        close(parseFloat(r.text('resDeltaVo')), expectedMv, Math.max(0.11, expectedMv * 0.002));
      }
    }
  }
  assert.match(calculate('buck', { calcL: 15 }).text('resConductionMode'), /crítica/);
  close(calculate('boost', { calcVo: 24.1 }).waveform.D, 1 - 24 / 24.1);
});

test('Calculadora rejeita entradas vazias, não finitas e topologias incompatíveis', () => {
  for (const topology of ['buck', 'boost', 'buck-boost']) {
    for (const id of ['calcVin', 'calcVo', 'calcPo', 'calcFs', 'calcL', 'calcC']) {
      for (const value of ['', 'NaN', 'Infinity', 0, -1]) {
        const r = calculate(topology, { [id]: value });
        assert.equal(r.waveform, undefined);
        assert.ok(r.text('calcError'));
        assert.equal(r.text('resDutyCycle'), '—');
      }
    }
  }
  assert.equal(calculate('buck', { calcVo: 25 }).waveform, undefined);
  assert.equal(calculate('boost', { calcVo: 24 }).waveform, undefined);
});

test('Valores numéricos dos exercícios de Controle 1', () => {
  const Kcrit = 455 / 3;
  close(65 - 3 * Kcrit / 7, 0);
  close(Math.sqrt(75 + Kcrit), 15.055453053, 1e-8);
  const breakaway = (-5 + Math.sqrt(13)) / 3;
  close(-breakaway * (breakaway + 1) * (breakaway + 4), 0.879419747, 1e-8);
  close(3780 * (1 / 0.07 - 1), 50220);
  assert.ok(151 * 2188 > 3780 + 50220);
});

test('Tensão de C: periodicidade, média, continuidade e C dv/dt = iC nos seis diagramas', () => {
  for (const config of Object.values(context.CONVERTER_CONFIGS)) {
    const p = config.params, n = 2000;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += context.capacitorRippleAt(config, (i + 0.5) / n) / n;
    close(mean, 0, 1e-7);
    close(context.capacitorRippleAt(config, 0), context.capacitorRippleAt(config, 1));
    for (const segment of context.waveformSegments(config)) {
      for (let i = 1; i < 10; i++) {
        const t = segment.start + (segment.end - segment.start) * i / 10, eps = 1e-7;
        const derivative = (context.capacitorRippleAt(config, t + eps) -
          context.capacitorRippleAt(config, t - eps)) / (2 * eps) * p.fs;
        close(p.C * derivative, context.calculateInstantState(config, t).iC, 1e-7);
      }
    }
    for (const t of [p.D, p.D + p.D2].filter(t => t < 1)) {
      close(context.capacitorRippleAt(config, t - 1e-10), context.capacitorRippleAt(config, t + 1e-10));
    }
    const samples = Array.from({ length: n + 1 }, (_, i) => context.capacitorRippleAt(config, i / n));
    const expected = config.mode === 'DCM'
      ? p.Io / (p.fs * p.C) * (1 - (config.topology === 'buck' ? p.D + p.D2 : p.D2) / 2) ** 2
      : config.topology === 'buck' ? p.deltaIL / (8 * p.fs * p.C) : p.Io * p.D / (p.fs * p.C);
    close(Math.max(...samples) - Math.min(...samples), expected, 1e-6);
    const svg = context.generateOscilloscopeSvgContent(config, context.calculateInstantState(config, 0.2), 'filtro');
    assert.match(svg, /data-trace="vC"/);
    assert.match(svg, /data-trace="iC"/);
    assert.doesNotMatch(svg, /NaN|Infinity/);
  }
});

const area = points => points.slice(1).reduce((sum, [t, v], i) =>
  sum + (t - points[i][0]) * (v + points[i][1]) / 2, 0);

test('Gráficos históricos: áreas, intervalos, médias e equilíbrio físico', () => {
  const plots = context.HISTORY_PLOTS;
  close(area(plots['2024-q2'].traces[0].points) / 10, 2.4);
  close(area(plots['2025a-q3'].traces[0].points) / 100, 2.1);
  close(area(plots['2025b-q3'].traces[0].points) / 100, 2.1);
  close(area(plots['2026-q1'].traces[1].points) / 100, 2.975);
  close(area(plots['2026-q2'].traces[1].points) / 100, 0.4);
  close(area(plots['2026-q3'].traces[0].points) / 100, 1.8);
  for (const id of ['2024-q3','2025a-q2','2025b-q2','2026-q1','2026-q2']) {
    close(area(plots[id].traces[0].points), 0);
  }
  for (const id of ['2025a-q2','2025b-q2']) close(area(plots[id].traces[1].points), 0);
  for (const plot of Object.values(plots)) {
    assert.doesNotMatch(context.historyPlotSvg(plot), /NaN|Infinity/);
    for (const trace of plot.traces) {
      assert.equal(trace.points[0][0], 0);
      assert.equal(trace.points.at(-1)[0], plot.end);
      trace.points.slice(1).forEach(([t], i) => assert.ok(t >= trace.points[i][0]));
    }
  }
});

test('Provas 2024/2026: integrar o diodo reproduz carga de C e extremos de tensão', () => {
  for (const [id, on, off, min, max, charge] of [
    ['2024-q2', 4, 6, 2, 6, 9.72e-6],
    ['2026-q2', 30, 20, 0, 4, 32.4e-6]
  ]) {
    const plot = context.HISTORY_PLOTS[id], T = plot.end;
    const Io = area(plot.traces.at(-1).points) / T;
    const V = id === '2024-q2' ? 100 : 250; // 2024: tensão arbitrada só para testar a forma, sem alegar dado da foto.
    const config = { topology: 'boost', mode: min ? 'CCM' : 'DCM',
      params: { D: on/T, D2: off/T, Imin: min, Imax: max, deltaIL: max-min,
        Io, Vo: V, fs: 1/(T*1e-6), C: 100e-6 } };
    const zero = on + (max-Io)/(max-min)*off;
    close(zero, id === '2024-q2' ? 9.4 : 48);
    const excursion = context.capacitorRippleAt(config, zero/T) - context.capacitorRippleAt(config, on/T);
    close(excursion * config.params.C, charge);
    close(context.capacitorRippleAt(config, 0), context.capacitorRippleAt(config, 1));
  }
});

test('Provas: calculadora resolve os pontos de operação obtidos dos gráficos', () => {
  const cases = [
    ['buck', {calcVin:60,calcVo:48,calcPo:192,calcFs:10,calcL:480}, .8, 3, 5, 120],
    ['buck', {calcVin:100,calcVo:30,calcPo:210,calcFs:10,calcL:1050}, .3, 6, 8, 150],
    ['buck', {calcVin:100,calcVo:70,calcPo:490,calcFs:10,calcL:1050}, .7, 6, 8, 150],
    ['buck', {calcVin:100,calcVo:60,calcPo:180,calcFs:10,calcL:1200}, .6, 2, 4, 400],
    ['boost', {calcVin:300/7,calcVo:1000/7,calcPo:1000/7,calcFs:10,calcL:1500}, .7, 7/3, 13/3],
    ['buck-boost', {calcVin:60,calcVo:100,calcPo:100,calcFs:12.5,calcL:1500}, .625, 5/3, 11/3],
    ['buck-boost', {calcVin:150*35/65,calcVo:150,calcPo:446.25,calcFs:10,calcL:1050}, .65, 6, 11],
    ['boost', {calcVin:100,calcVo:250,calcPo:100,calcFs:10,calcL:750}, .3, 0, 4]
  ];
  for (const [topology, input, D, min, max, Lcrit] of cases) {
    const result = calculate(topology, input);
    close(result.waveform.D, D);
    close(result.waveform.IL_min, min);
    close(result.waveform.IL_max, max);
    if (Lcrit) close(parseFloat(result.text('resLcrit')), Lcrit, .1);
  }
});

test('Curvas históricas de vC: extremos coincidem com as trocas de sinal de iC', () => {
  for (const [id, tmin, tmax] of [['2024-q2',4,9.4],['2026-q2',30,48],['2026-q3',30,80]]) {
    const plot = context.historyCapacitorPlot(id), voltage = plot.traces[0].points;
    close(voltage.find(([t]) => Math.abs(t-tmin) < 1e-9)[1], 0);
    close(voltage.find(([t]) => Math.abs(t-tmax) < 1e-9)[1], 1);
    assert.ok(voltage[1][1] < voltage[0][1], 'iC inicialmente negativa exige tensão decrescente');
    close(voltage[0][1], voltage.at(-1)[1]);
    close(area(plot.traces[1].points), 0);
    assert.doesNotMatch(context.historyPlotSvg(plot), /NaN|Infinity/);
  }
});
