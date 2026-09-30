const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { validate, clientIp, device } = require('../api/analytics/validate');
const id = '00000000-0000-4000-8000-000000000001';
test('Somente eventos consentidos e campos permitidos chegam ao armazenamento', () => {
  const batch = { consent: 'accepted-v1', session: id, events: [{ id, type: 'page_view', subject: 'eletronica-potencia', page: 'revisao', secret: 'private', ip: 'fake' }] };
  assert.deepEqual(Object.keys(validate(batch)[0]), ['id', 'type', 'subject', 'page']);
  assert.throws(() => validate({ ...batch, consent: 'declined' }));
  assert.throws(() => validate({ ...batch, events: Array(21).fill(batch.events[0]) }));
  assert.throws(() => validate({ ...batch, events: [{ ...batch.events[0], type: 'search_query' }] }));
  assert.throws(() => validate({ ...batch, events: [{ ...batch.events[0], type: 'active_time', seconds: 9999 }] }));
});
test('IP exige header explicitamente confiável; não usa XFF fornecido pelo visitante', () => {
  assert.equal(clientIp({ 'x-forwarded-for': '1.2.3.4' }), null);
  assert.equal(clientIp({ 'client-ip': '203.0.113.1:1234' }, 'client-ip'), '203.0.113.1');
  assert.equal(clientIp({ 'client-ip': '[2001:db8::1]:1234' }, 'client-ip'), '2001:db8::1');
  assert.equal(clientIp({ 'client-ip': 'garbage' }, 'client-ip'), null);
  assert.equal(device('Mozilla Windows Edg/1').browser, 'Edge');
});
function browser(consent, privacy) {
  const handlers = {}, sent = [], memory = new Map(consent ? [['study-analytics-consent-v1', consent]] : []);
  const nodes = {};
  const doc = { hidden: false, hasFocus: () => true,
    addEventListener: (name, fn) => { (handlers[name] ||= []).push(fn); },
    createElement: () => ({ addEventListener() {}, setAttribute() {}, querySelector: () => ({ textContent: '', hidden: false }) }),
    getElementById: id => nodes[id], body: { append: (...items) => items.forEach(item => { if (item.id) nodes[item.id] = item; }) } };
  const win = { addEventListener: doc.addEventListener };
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  const context = { window: win, document: doc, navigator: { globalPrivacyControl: privacy, language: 'pt-BR' }, localStorage: storage, sessionStorage: storage,
    location: { pathname: '/index.html', search: '?subject=eletronica-potencia&page=revisao' }, performance: { now: () => 0 }, URLSearchParams, crypto: { randomUUID: () => id },
    fetch: (url, options) => { sent.push(JSON.parse(options.body)); return Promise.resolve({ ok: true }); }, setInterval() {}, innerWidth: 1200 };
  vm.runInNewContext(fs.readFileSync('assets/js/analytics.js', 'utf8'), context);
  handlers.DOMContentLoaded.forEach(fn => fn());
  return { sent, win, handlers, nodes };
}
test('Ausência de consentimento, recusa e GPC não enviam eventos', () => {
  for (const [consent, privacy] of [[null, false], ['declined', false], ['accepted', true]]) assert.equal(browser(consent, privacy).sent.length, 0);
});
test('Pré-carregamento e aba repetida não contam visitas; só a aba ativa gera evento', () => {
  const app = browser('accepted', false);
  assert.equal(app.sent.length, 1);
  app.win.StudyGuide = { manifest: { id: 'eletronica-potencia' }, page: { id: 'revisao' } };
  app.handlers['study:page-view'].forEach(fn => fn());
  app.handlers.pagehide.forEach(fn => fn());
  assert.equal(app.sent.length, 1);
  app.win.StudyGuide.page.id = 'revisao-buck-dcm';
  app.handlers['study:page-view'].forEach(fn => fn());
  app.handlers.pagehide.forEach(fn => fn());
  assert.equal(app.sent.length, 2);
  assert.equal(app.sent[1].events[0].page, 'revisao-buck-dcm');
});

function backend(env, failPublish = false) {
  const stored = [], published = [];
  const sandbox = { module: { exports: {} }, process: { env }, setTimeout, clearTimeout,
    require(name) {
      if (name === './validate') return require('../api/analytics/validate');
      if (name === '@azure/data-tables') return { TableClient: { fromConnectionString: () => ({ upsertEntity: async entity => stored.push(entity) }) } };
      if (name === 'mqtt') return { connectAsync: async () => ({ publishAsync: async (topic, payload, options) => {
        if (failPublish) throw new Error('Offline');
        published.push({ topic, payload: JSON.parse(payload), options });
      }, endAsync: async () => {} }) };
      throw new Error('Unexpected dependency');
    } };
  vm.runInNewContext(fs.readFileSync('api/analytics/index.js', 'utf8'), sandbox);
  return { call: sandbox.module.exports, stored, published };
}
test('Backend desativado ou origem errada não persiste nem publica', async () => {
  for (const env of [{}, { ANALYTICS_ENABLED: 'true', HIVEMQ_HOST: 'host', HIVEMQ_USERNAME: 'user', HIVEMQ_PASSWORD: 'test', ANALYTICS_STORAGE_CONNECTION: 'test', ANALYTICS_ALLOWED_ORIGIN: 'https://allowed.test' }]) {
    const api = backend(env), context = { log: { warn() {} } };
    await api.call(context, { headers: { origin: 'https://wrong.test', 'content-type': 'application/json' } });
    assert.equal(api.stored.length, 0); assert.equal(api.published.length, 0);
    assert.ok([403, 503].includes(context.res.status));
  }
});
test('Backend grava histórico antes de publicar e o conserva se MQTT falhar', async () => {
  const env = { ANALYTICS_ENABLED: 'true', HIVEMQ_HOST: 'host', HIVEMQ_USERNAME: 'user', HIVEMQ_PASSWORD: 'test', ANALYTICS_STORAGE_CONNECTION: 'test', ANALYTICS_ALLOWED_ORIGIN: 'https://allowed.test' };
  for (const failure of [false, true]) {
    const api = backend(env, failure), context = { log: { warn() {} } };
    await api.call(context, { headers: { origin: env.ANALYTICS_ALLOWED_ORIGIN, 'content-type': 'application/json', 'user-agent': 'Windows Firefox/1', 'x-forwarded-for': 'forged' },
      body: { consent: 'accepted-v1', session: id, events: [{ id, type: 'page_view', subject: 'eletronica-potencia', page: 'revisao' }] } });
    assert.equal(api.stored.length, 1);
    assert.equal(api.stored[0].ip, undefined);
    assert.equal(context.res.status, failure ? 503 : 202);
    if (!failure) {
      assert.equal(api.published[0].topic, 'study-guide/engagement/v1');
      assert.equal(api.published[0].options.retain, false);
      assert.equal(api.published[0].payload.HIVEMQ_PASSWORD, undefined);
    }
  }
});
