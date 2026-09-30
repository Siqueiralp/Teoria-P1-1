(function () {
  'use strict';
  const consentKey = 'study-analytics-consent-v1';
  let accepted = false, session = null, queue = [], lastTick = performance.now(), seconds = 0;
  let page = route(), lastInteraction = performance.now();
  const privateSignal = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  function saved() { try { return localStorage.getItem(consentKey); } catch (_) { return null; } }
  function route() {
    const study = window.StudyGuide;
    if (location.pathname.endsWith('/guide.html') && !study) return null;
    const params = new URLSearchParams(location.search);
    const safe = value => /^[a-z0-9-]{1,80}$/.test(value || '') ? value : 'inicio';
    return { subject: safe(study ? study.manifest.id : params.get('subject') || 'central'), page: safe(study && study.page ? study.page.id : params.get('page')) };
  }
  function record(type, extra) {
    if (!accepted || !page) return;
    queue.push(Object.assign({ id: crypto.randomUUID(), type }, page, extra || {}));
    if (queue.length >= 10) flush();
  }
  function flush() {
    if (!accepted || !queue.length) return;
    const batch = queue.splice(0, 20);
    fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: 'accepted-v1', session, language: navigator.language,
        viewport: innerWidth < 600 ? 'small' : innerWidth < 1100 ? 'medium' : 'large', events: batch }), keepalive: true, credentials: 'omit' }).catch(function () {});
    // No persistent queue: refusing later cannot release previously buffered data.
  }
  function tick() {
    const now = performance.now();
    const delta = Math.min(5, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;
    if (accepted && !document.hidden && document.hasFocus() && now - lastInteraction < 60000) seconds += delta;
    if (seconds >= 30) time();
  }
  function time() {
    if (Math.floor(seconds) > 0) record('active_time', { seconds: Math.min(60, Math.floor(seconds)) });
    seconds = 0;
  }
  function choose(value) {
    accepted = value === 'accepted' && !privateSignal;
    queue = []; seconds = 0; lastTick = lastInteraction = performance.now();
    try { localStorage.setItem(consentKey, accepted ? 'accepted' : 'declined'); } catch (_) {}
    document.getElementById('analytics-consent').hidden = true;
    if (accepted) {
      try { session = sessionStorage.getItem('study-analytics-session'); } catch (_) {}
      if (!/^[a-f0-9-]{36}$/.test(session || '')) session = crypto.randomUUID();
      try { sessionStorage.setItem('study-analytics-session', session); } catch (_) {}
      page = route(); record('page_view'); flush();
    } else {
      session = null;
      try { sessionStorage.removeItem('study-analytics-session'); } catch (_) {}
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    const box = document.createElement('section');
    box.id = 'analytics-consent'; box.className = 'analytics-consent';
    box.setAttribute('aria-label', 'Preferências de métricas de uso');
    box.innerHTML = '<p>Podemos registrar IP, navegador, sistema, páginas, ações nos gráficos e tempo ativo para melhorar o guia? Os eventos vão ao HiveMQ e ao histórico privado do site. Sem nomes, buscas ou respostas digitadas.</p><div><button type="button" data-choice="accepted">Permitir métricas</button><button type="button" data-choice="declined">Recusar</button></div>';
    const preferences = document.createElement('button');
    preferences.type = 'button'; preferences.className = 'analytics-preferences'; preferences.textContent = 'Privacidade';
    preferences.addEventListener('click', function () {
      if (accepted) choose('declined');
      box.hidden = false;
    });
    box.addEventListener('click', function (event) {
      const button = event.target.closest('[data-choice]');
      if (button) choose(button.dataset.choice);
    });
    document.body.append(box, preferences);
    if (privateSignal) {
      box.querySelector('p').textContent = 'Seu navegador pediu para não ser rastreado. As métricas de uso estão desativadas.';
      box.querySelector('[data-choice="accepted"]').hidden = true;
      box.querySelector('[data-choice="declined"]').textContent = 'Fechar';
    }
    const value = saved();
    box.hidden = privateSignal || value === 'declined' || value === 'accepted';
    if (value === 'accepted' && !privateSignal) choose('accepted');
    setInterval(function () { tick(); flush(); }, 5000);
  });
  window.addEventListener('storage', function (event) {
    if (event.key === consentKey && event.newValue !== 'accepted') choose('declined');
  });
  document.addEventListener('study:page-view', function () {
    const next = route();
    if (!next || (page && next.subject === page.subject && next.page === page.page)) return;
    tick(); time(); page = next; record('page_view');
  });
  ['pointerdown', 'keydown', 'scroll'].forEach(function (name) {
    document.addEventListener(name, function () { lastInteraction = performance.now(); }, { passive: true });
  });
  document.addEventListener('visibilitychange', function () { tick(); if (document.hidden) { time(); flush(); } });
  window.addEventListener('pagehide', function () { tick(); time(); flush(); });
  document.addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (!button || button.closest('[hidden]')) return;
    if (button.matches('[data-role="simPlayBtn"]')) record('graph_play', { value: button.getAttribute('aria-pressed') === 'true' ? 'play' : 'pause' });
    else if (button.matches('[data-chan]')) record('graph_channel', { value: button.dataset.chan });
    else if (button.matches('[data-speed]')) record('graph_speed', { value: button.dataset.speed });
    else if (button.matches('.solution-toggle')) record('solution_toggle', { value: button.getAttribute('aria-expanded') === 'true' ? 'open' : 'close' });
    else if (button.id === 'examFormulaFab') record('formula_open');
  });
  document.addEventListener('change', function (event) {
    if (event.target.matches('[data-role="simScrubber"]')) record('graph_seek');
    else if (event.target.matches('.checklist-item input[type="checkbox"]')) record('goal_change', { value: event.target.checked ? 'checked' : 'unchecked' });
  });
}());
