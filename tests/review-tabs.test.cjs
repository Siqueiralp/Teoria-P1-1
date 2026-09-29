const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCache } = require('../assets/js/review-tabs.js');
const manifest = require('../subjects/eletronica-potencia/subject.json');

test('Pré-carregamento reutiliza a mesma instância e conserva o estado ao alternar', async () => {
  const loads = [];
  const original = { playing: false, time: .63, speed: 2, channel: 'filtro' };
  const cache = createCache(id => { loads.push(id); return { playing: true, time: .15 }; }, [['buck-ccm', original]]);
  await cache.preload(['buck-ccm', 'buck-dcm', 'boost-ccm', 'boost-dcm']);
  const buck = await cache.get('buck-ccm');
  const boost = await cache.get('boost-dcm');
  boost.playing = false;
  boost.time = .42;
  assert.equal(await cache.get('buck-ccm'), original);
  assert.deepEqual(buck, { playing: false, time: .63, speed: 2, channel: 'filtro' });
  assert.equal(await cache.get('boost-dcm'), boost);
  assert.deepEqual(boost, { playing: false, time: .42 });
  assert.equal(loads.length, 3);
});

test('Clique durante pré-carregamento compartilha o pedido em andamento', async () => {
  let complete;
  let loads = 0;
  const cache = createCache(() => { loads++; return new Promise(resolve => { complete = resolve; }); });
  const preload = cache.preload(['buck-dcm']);
  const click = cache.get('buck-dcm');
  await Promise.resolve();
  complete({ state: 'retido' });
  const results = await preload;
  assert.equal(results[0].value, await click);
  assert.equal(await cache.get('buck-dcm'), await click);
  assert.equal(loads, 1);
});

test('Falha isolada no pré-carregamento permite tentar a aba novamente', async () => {
  let attempts = 0;
  const cache = createCache(id => {
    if (id === 'buck-dcm' && attempts++ === 0) throw new Error('Falha transitória');
    return { id };
  });
  const results = await cache.preload(['buck-ccm', 'buck-dcm']);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.deepEqual(await cache.get('buck-dcm'), { id: 'buck-dcm' });
  assert.equal(attempts, 2);
});

test('Somente as seis revisões e o roteiro pertencem ao grupo pré-carregado', () => {
  const group = manifest.pages.filter(page => page.preloadGroup === 'review');
  assert.equal(group.length, 7);
  assert.equal(group.filter(page => page.id !== 'revisao-roteiro').length, 6);
  assert.ok(group.every(page => page.navAnchor === 'waveformReviewSection'));
  assert.ok(manifest.pages.filter(page => !page.id.startsWith('revisao')).every(page => !page.preloadGroup));
});
