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
