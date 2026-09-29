(function (root) {
  "use strict";

  // Keep the actual panel nodes and their event handlers, rather than serializing HTML again.
  function createCache(load, initial) {
    var entries = new Map(initial || []);
    function get(id) {
      if (!entries.has(id)) {
        var request = Promise.resolve().then(function () { return load(id); }).catch(function (error) {
          entries.delete(id);
          throw error;
        });
        entries.set(id, request);
      }
      return Promise.resolve(entries.get(id));
    }
    return { get: get, preload: function (ids) { return Promise.allSettled(ids.map(get)); } };
  }

  function mount(options) {
    var manifest = options.manifest;
    var currentPage = options.page;
    var host = options.host;
    var group = (manifest.pages || []).filter(function (page) { return page.preloadGroup === currentPage.preloadGroup; });
    var topTabs = host.querySelector('[role="tablist"][aria-label="Topologia"]');
    var modeTabs = host.querySelector('#modeTabs');
    var initialPanel = host.querySelector('#topicPanel');
    if (!topTabs || !initialPanel) return;
    if (!modeTabs) {
      modeTabs = document.createElement('nav');
      modeTabs.id = 'modeTabs';
      modeTabs.className = 'topic-tabs topic-subtabs';
      modeTabs.setAttribute('role', 'tablist');
      modeTabs.setAttribute('aria-label', 'Regime de condução');
      modeTabs.hidden = true;
      topTabs.insertAdjacentElement('afterend', modeTabs);
    }
    var toolbar = document.createElement('div');
    toolbar.className = 'review-tab-toolbar';
    topTabs.insertAdjacentElement('beforebegin', toolbar);
    toolbar.appendChild(topTabs);
    toolbar.appendChild(modeTabs);
    var formulaButton = host.querySelector('#examFormulaFab');
    if (formulaButton) toolbar.appendChild(formulaButton);
    var panels = document.createElement('div');
    panels.className = 'review-panels';
    initialPanel.insertAdjacentElement('beforebegin', panels);
    initialPanel.id = 'review-panel-' + currentPage.id;
    panels.appendChild(initialPanel);
    var active = { page: currentPage, panel: initialPanel, top: topTabs.innerHTML, modes: modeTabs.innerHTML };
    var serial = 0;

    function visibility(record, shown) {
      record.panel.hidden = !shown;
      if (shown) record.panel.setAttribute('aria-labelledby', 'tab-' + record.page.id);
      else record.panel.removeAttribute('aria-labelledby');
      record.panel.querySelectorAll('.converter-dashboard').forEach(function (dashboard) {
        dashboard.dispatchEvent(new CustomEvent('study-panel-visibility', { detail: { active: shown } }));
      });
    }

    var cache = createCache(function (id) {
      var page = group.find(function (item) { return item.id === id; });
      return fetch(options.base + page.file).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' ao carregar ' + page.title);
        return response.text();
      }).then(function (html) {
        var template = document.createElement('template');
        template.innerHTML = html;
        var panel = template.content.querySelector('#topicPanel');
        var top = template.content.querySelector('[role="tablist"][aria-label="Topologia"]');
        var modes = template.content.querySelector('#modeTabs');
        if (!panel || !top) throw new Error('Conteúdo da aba inválido: ' + id);
        panel.id = 'review-panel-' + id;
        panel.hidden = true;
        panel.removeAttribute('aria-labelledby');
        panels.appendChild(panel);
        try { options.initPanel(panel); }
        catch (error) { panel.remove(); throw error; }
        return { page: page, panel: panel, top: top.innerHTML, modes: modes ? modes.innerHTML : '' };
      });
    }, [[currentPage.id, active]]);

    async function activate(page, push, hash, focusGroup) {
      var ticket = ++serial;
      topTabs.setAttribute('aria-busy', 'true');
      try {
        var record = await cache.get(page.id);
        if (ticket !== serial) return;
        visibility(active, false);
        active = record;
        currentPage = page;
        topTabs.innerHTML = record.top;
        modeTabs.innerHTML = record.modes;
        modeTabs.hidden = !record.modes;
        // Each tab controls the retained panel that is currently visible.
        topTabs.querySelectorAll('[role="tab"]').forEach(function (tab) {
          tab.setAttribute('aria-controls', record.modes ? 'modeTabs' : record.panel.id);
        });
        modeTabs.querySelectorAll('[role="tab"]').forEach(function (tab) { tab.setAttribute('aria-controls', record.panel.id); });
        visibility(record, true);
        options.onActivate(page);
        if (push) window.history.pushState(null, '', root.TopicPages.href(manifest, page, hash));
        if (focusGroup) {
          var selected = (focusGroup === 'Topologia' ? topTabs : modeTabs).querySelector('[aria-selected="true"]');
          if (selected) selected.focus({ preventScroll: true });
        }
        if (hash) {
          var target = document.getElementById(hash);
          if (target && record.panel.contains(target)) target.scrollIntoView();
        }
      } catch (error) {
        console.error(error);
        if (ticket === serial) window.alert('Não foi possível carregar esta aba. Tente selecioná-la novamente.');
      } finally {
        if (ticket === serial) topTabs.removeAttribute('aria-busy');
      }
    }

    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href]');
      if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
      var url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.searchParams.get('subject') !== manifest.id) return;
      var page = group.find(function (item) { return item.id === url.searchParams.get('page'); });
      if (!page) return;
      event.preventDefault();
      var list = link.closest('[role="tablist"]');
      activate(page, page.id !== currentPage.id || url.hash !== window.location.hash,
        decodeURIComponent(url.hash.slice(1)), list ? list.getAttribute('aria-label') : null);
    });
    window.addEventListener('popstate', function () {
      var params = new URLSearchParams(window.location.search);
      var page = root.TopicPages.resolve(manifest, params.get('page'), decodeURIComponent(window.location.hash.slice(1)));
      if (group.some(function (item) { return item.id === page.id; })) activate(page, false, decodeURIComponent(window.location.hash.slice(1)));
      else window.location.reload();
    });
    // Correct the initial aria-controls before any tab has been switched.
    topTabs.querySelectorAll('[role="tab"]').forEach(function (tab) { tab.setAttribute('aria-controls', active.modes ? 'modeTabs' : active.panel.id); });
    modeTabs.querySelectorAll('[role="tab"]').forEach(function (tab) { tab.setAttribute('aria-controls', active.panel.id); });
    cache.preload(group.map(function (page) { return page.id; })).then(function (results) {
      results.forEach(function (result) { if (result.status === 'rejected') console.warn('Pré-carregamento da revisão:', result.reason); });
    });
  }

  var api = { createCache: createCache, mount: mount };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReviewTabs = api;
}(typeof window === 'undefined' ? globalThis : window));
