const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const routing = require('../assets/js/topic-pages.js');
const manifest = JSON.parse(fs.readFileSync('subjects/eletronica-potencia/subject.json', 'utf8'));
const source = fs.readFileSync('subjects/eletronica-potencia/content.html', 'utf8');
const pages = manifest.pages.map(page => ({ ...page, html: fs.readFileSync('subjects/eletronica-potencia/' + page.file, 'utf8') }));

test('Conteúdo preservado: módulos, resoluções e checklists aparecem uma vez nas páginas', () => {
  assert.equal(pages.length, 30);
  const combined = pages.map(page => page.html).join('\n');
  for (const match of source.matchAll(/(?<![\w-])id="(mod[1-9]|hist-[^"]+|sol[^" ]+)"/g)) {
    assert.equal([...combined.matchAll(new RegExp('(?<![\\w-])id="' + match[1] + '"', 'g'))].length, 1, match[1]);
  }
  for (const id of manifest.checklistIds) {
    assert.equal([...combined.matchAll(new RegExp('data-check-id="' + id + '"', 'g'))].length, 1, id);
  }
  assert.equal(new Set(manifest.checklistIds).size, 37);
  for (const page of pages) {
    assert.ok([...page.html.matchAll(/<section id="mod[1-9]"/g)].length <= 1, page.id);
  }
});

test('Links, abas e acordeões resolvem destinos válidos sem IDs duplicados', () => {
  const owners = pages.flatMap(page => page.anchors);
  assert.equal(owners.length, new Set(owners).size, 'Uma âncora pertence a apenas uma página');
  for (const page of pages) {
    const ids = [...page.html.matchAll(/(?<![\w-])id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size, page.id);
    for (const match of page.html.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.includes(match[1]) || routing.owner(manifest, match[1]), `${page.id} #${match[1]}`);
    }
    for (const match of page.html.matchAll(/(?:data-target|aria-controls|aria-labelledby)="([^"]+)"/g)) {
      assert.ok(ids.includes(match[1]), `${page.id} ${match[1]}`);
    }
    for (const match of page.html.matchAll(/href="guide.html\?subject=eletronica-potencia&amp;page=([^"]+)"/g)) {
      assert.ok(pages.some(item => item.id === match[1]), `${page.id} ${match[1]}`);
    }
  }
});

test('Revisão carrega um circuito por combinação e distingue as etapas CCM/DCM', () => {
  const variants = { revisao: 4, 'revisao-boost-ccm': 5, 'revisao-buckboost-ccm': 6,
    'revisao-buck-dcm': 7, 'revisao-boost-dcm': 8, 'revisao-buckboost-dcm': 9 };
  for (const [id, module] of Object.entries(variants)) {
    const page = pages.find(item => item.id === id);
    assert.deepEqual([...page.html.matchAll(/id="dashboard-host-mod(\d)"/g)].map(match => Number(match[1])), [module]);
    assert.equal([...page.html.matchAll(/<tr><td>/g)].length, module >= 7 ? 3 : 2);
    const selected = [...page.html.matchAll(/role="tab" aria-selected="true"[^>]*>([^<]+)</g)].map(match => match[1]);
    assert.equal(selected.length, 2);
    assert.equal(selected[1], module >= 7 ? 'DCM' : 'CCM');
    assert.equal(page.navAnchor, 'waveformReviewSection');
  }
  const history = pages.find(page => page.id === 'historico');
  assert.equal([...history.html.matchAll(/class="exercise-box"/g)].length, 0);
  for (const id of ['p1-2024', 'p1-2025-maio', 'p1-2025-setembro', 'p1-2026', 'simulado-a', 'simulado-b']) {
    assert.equal([...pages.find(page => page.id === id).html.matchAll(/class="solution-toggle"/g)].length, 3, id);
  }
});

test('Rotas mantêm âncoras antigas, favoritos e fallback de matérias sem páginas', () => {
  for (const anchor of ['mod1', 'mod9', 'quizSection', 'historySection', 'hist-2026-q2', 'cheatSheetSection']) {
    const owner = routing.owner(manifest, anchor);
    assert.ok(owner, anchor);
    assert.equal(routing.resolve(manifest, null, anchor), owner);
    const url = new URL(routing.href(manifest, owner, anchor), 'https://example.test/');
    assert.equal(url.searchParams.get('page'), owner.id);
    assert.equal(url.hash, '#' + anchor);
  }
  assert.equal(routing.resolve(manifest, 'revisao-boost-dcm', 'mod1').id, 'revisao-boost-dcm');
  assert.equal(routing.resolve(manifest, 'inexistente', '').id, 'inicio');
  assert.equal(routing.resolve({}, 'mod1', 'mod1'), undefined);
});

test('Progresso considera metas de todas as páginas e ignora IDs obsoletos', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync('assets/js/progress.js', 'utf8'), context);
  const result = context.window.StudyProgress.compute(manifest, {
    completedModules: ['mod-1', 'mod-9', 'obsoleto', 'mod-1'],
    checkedItems: [manifest.checklistIds[0], manifest.checklistIds.at(-1), 'obsoleto']
  });
  assert.equal(result.total, 46);
  assert.equal(result.completed, 4);
  assert.equal(result.modulesCompleted, 2);
  assert.equal(result.percent, 9);
  assert.equal(context.window.StudyProgress.compute(manifest, { completedModules: manifest.modules.map(mod => mod.id), checkedItems: manifest.checklistIds }).percent, 100);
});

test('Carregamento busca apenas o manifesto e a página pedida; preserva fallback legado', async () => {
  for (const [config, query, hash, expected] of [
    [manifest, '?subject=eletronica-potencia&page=revisao-boost-dcm', '', 'pages/revisao-boost-dcm.html'],
    [manifest, '?subject=eletronica-potencia', '#hist-2026-q2', 'pages/p1-2026.html'],
    [{ id: 'controle1' }, '?subject=controle1', '#mod1', 'content.html']
  ]) {
    const requests = [];
    let start;
    const context = vm.createContext({ URLSearchParams, CustomEvent: class { constructor(type) { this.type = type; } }, console: { error() {} }, window: {
      location: { search: query, hash }, TopicPages: routing
    }, document: {
      addEventListener(event, callback) { start = callback; },
      dispatchEvent() {},
      getElementById(id) {
        // Stop before UI mounting: this test inspects the network contract of the loader.
        if (id === 'subjectTitle') throw new Error('Conteúdo carregado');
        return { innerHTML: '' };
      }
    }, fetch(url) {
      requests.push(url);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(config), text: () => Promise.resolve('<section></section>') });
    } });
    vm.runInContext(fs.readFileSync('assets/js/study-guide.js', 'utf8'), context);
    start();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(requests, ['subjects/' + config.id + '/subject.json', 'subjects/' + config.id + '/' + expected]);
  }
});
