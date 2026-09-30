// Export the same physical model used and tested by the study app.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {}, document: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'subjects/eletronica-potencia/subject.js'), 'utf8'), context);
const output = Object.values(context.CONVERTER_CONFIGS).map(original => {
  const config = JSON.parse(JSON.stringify(original));
  // Also illustrate the CCM capacitor zero crossing from Nov/2024 Q2.
  if (config.topology === 'boost' && config.mode === 'CCM') {
    const p = config.params;
    p.Imin = 0.5; p.Imax = p.Ipk = 3.5; p.deltaIL = 3;
    p.ILavg = 2; p.Io = 1; p.R = p.Vo / p.Io;
    p.L = p.Vin * p.D / (p.deltaIL * p.fs);
  }
  const points = new Set(Array.from({ length: 1001 }, (_, i) => i / 1000));
  for (const boundary of [config.params.D, config.params.D + config.params.D2]) {
    if (boundary < 1) { points.add(boundary - 1e-8); points.add(boundary); }
  }
  return { topology: config.topology, mode: config.mode, params: config.params,
    samples: [...points].sort((a, b) => a - b).map(t => {
      const s = context.calculateInstantState(config, t);
      return { t, vL: s.vL, iL: s.iL, iS: s.iS, iD: s.iD, iC: s.iC,
        vC: context.capacitorVoltageAt(config, t) };
    }) };
});
process.stdout.write(JSON.stringify(output));
