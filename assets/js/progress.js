(function () {
  "use strict";

  function storageKey(manifest) {
    return manifest.storageKey || ("study_hub_" + manifest.id + "_v1");
  }

  function normalize(data) {
    data = data && typeof data === "object" ? data : {};
    return {
      completedModules: Array.isArray(data.completedModules) ? Array.from(new Set(data.completedModules)) : [],
      checkedItems: Array.isArray(data.checkedItems) ? Array.from(new Set(data.checkedItems)) : []
    };
  }

  function parse(raw) {
    try {
      return normalize(JSON.parse(raw));
    } catch (error) {
      console.warn("Progresso inválido no armazenamento local:", error);
      return normalize(null);
    }
  }

  function read(manifest) {
    var key = storageKey(manifest);
    var current = localStorage.getItem(key);
    if (current) return parse(current);

    var legacy = Array.isArray(manifest.legacyStorageKeys) ? manifest.legacyStorageKeys : [];
    for (var i = 0; i < legacy.length; i += 1) {
      var raw = localStorage.getItem(legacy[i]);
      if (!raw) continue;
      var migrated = parse(raw);
      localStorage.setItem(key, JSON.stringify(migrated));
      return migrated;
    }
    return normalize(null);
  }

  function write(manifest, data) {
    localStorage.setItem(storageKey(manifest), JSON.stringify(normalize(data)));
  }

  function reset(manifest) {
    localStorage.removeItem(storageKey(manifest));
    var legacy = Array.isArray(manifest.legacyStorageKeys) ? manifest.legacyStorageKeys : [];
    legacy.forEach(function (key) { localStorage.removeItem(key); });
  }

  function compute(manifest, data) {
    var modules = Array.isArray(manifest.modules) ? manifest.modules.length : 0;
    var checklist = Number(manifest.totalChecklistItems || 0);
    var clean = normalize(data);
    var moduleIds = (manifest.modules || []).map(function (mod) { return mod.id; });
    var modulesCompleted = clean.completedModules.filter(function (id) { return moduleIds.indexOf(id) >= 0; }).length;
    var itemsCompleted = Array.isArray(manifest.checklistIds) ? clean.checkedItems.filter(function (id) {
      return manifest.checklistIds.indexOf(id) >= 0;
    }).length : Math.min(checklist, clean.checkedItems.length);
    var completed = modulesCompleted + itemsCompleted;
    var total = modules + checklist;
    return {
      completed: completed,
      total: total,
      percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0,
      modulesCompleted: modulesCompleted,
      modulesTotal: modules
    };
  }

  window.StudyProgress = { read: read, write: write, reset: reset, compute: compute, storageKey: storageKey };
}());
