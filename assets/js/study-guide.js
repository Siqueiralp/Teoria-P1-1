document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var subjectId = params.get("subject") || "";
  var safeId = /^[a-z0-9-]+$/.test(subjectId) ? subjectId : "";

  if (!safeId) {
    showFatal("Matéria inválida ou não informada.");
    return;
  }

  var base = "subjects/" + safeId + "/";
  var manifest;

  Promise.all([
    fetch(base + "subject.json").then(requireOk).then(function (r) { return r.json(); }),
    fetch(base + "content.html").then(requireOk).then(function (r) { return r.text(); })
  ])
    .then(function (loaded) {
      manifest = loaded[0];
      if (manifest.id !== safeId) throw new Error("O identificador da matéria não corresponde à pasta.");

      applyManifest(manifest);
      document.getElementById("subjectContent").innerHTML = loaded[1];
      buildNavigation(manifest);
      initTracker(manifest);
      initNavigation();
      initExerciseAccordions();
      renderKaTeXIfAvailable();

      if (manifest.script) {
        return loadScript(base + manifest.script).then(function () {
          if (typeof window.initSubjectTools === "function") window.initSubjectTools();
        });
      }
    })
    .catch(function (error) {
      console.error(error);
      showFatal("Não foi possível carregar esta matéria.");
    });

  function requireOk(response) {
    if (!response.ok) throw new Error("HTTP " + response.status + " ao carregar " + response.url);
    return response;
  }

  function applyManifest(config) {
    document.title = config.name + (config.badge ? " — " + config.badge : "") + " | Guia de Estudos";
    document.getElementById("subjectTitle").textContent = config.name;
    document.getElementById("subjectBadge").textContent = config.badge || "";
    document.getElementById("subjectIcon").textContent = config.icon || "📚";
    document.getElementById("subjectSubtitle").textContent =
      (config.institution ? config.institution + " • " : "") + (config.description || "Guia didático interativo");
  }

  function buildNavigation(config) {
    var host = document.getElementById("moduleNavigation");
    host.innerHTML = "";

    host.appendChild(sectionTitle("Roteiro de Estudos"));
    (config.modules || []).forEach(function (mod) {
      host.appendChild(navItem(mod.anchor, mod.code, mod.title, mod.id));
    });

    if (config.tools && config.tools.length) {
      var title = sectionTitle("Ferramentas de Apoio");
      title.style.marginTop = "14px";
      host.appendChild(title);
      config.tools.forEach(function (tool) {
        host.appendChild(navItem(tool.anchor, tool.code, tool.title, null));
      });
    }
  }

  function sectionTitle(text) {
    var el = document.createElement("div");
    el.className = "nav-section-title";
    el.textContent = text;
    return el;
  }

  function navItem(anchor, code, title, moduleId) {
    var a = document.createElement("a");
    a.href = "#" + anchor;
    a.className = "nav-item";
    if (moduleId) a.setAttribute("data-nav-mod", moduleId);

    var label = document.createElement("div");
    label.className = "nav-item-title";

    var number = document.createElement("span");
    number.className = "nav-mod-num";
    number.textContent = code || "•";

    var text = document.createElement("span");
    text.textContent = title;

    label.appendChild(number);
    label.appendChild(text);
    a.appendChild(label);

    if (moduleId) {
      var check = document.createElement("div");
      check.className = "nav-item-check";
      check.textContent = "✓";
      a.appendChild(check);
    }
    return a;
  }

  function initTracker(config) {
    var data = StudyProgress.read(config);
    var checkboxes = Array.from(document.querySelectorAll('.checklist-item input[type="checkbox"]'));
    var buttons = Array.from(document.querySelectorAll(".btn-complete-module"));

    checkboxes.forEach(function (cb) {
      var itemId = cb.getAttribute("data-check-id");
      if (itemId && data.checkedItems.indexOf(itemId) >= 0) {
        cb.checked = true;
        var parent = cb.closest(".checklist-item");
        if (parent) parent.classList.add("checked");
      }

      cb.addEventListener("change", function () {
        var row = cb.closest(".checklist-item");
        if (cb.checked) {
          if (row) row.classList.add("checked");
          if (data.checkedItems.indexOf(itemId) < 0) data.checkedItems.push(itemId);
        } else {
          if (row) row.classList.remove("checked");
          data.checkedItems = data.checkedItems.filter(function (id) { return id !== itemId; });
        }
        StudyProgress.write(config, data);
        updateOverallProgress(config);
      });
    });

    buttons.forEach(function (button) {
      var moduleId = button.getAttribute("data-mod-id");
      if (moduleId && data.completedModules.indexOf(moduleId) >= 0) {
        setModuleButton(button, true);
        updateNavModuleState(moduleId, true);
      }

      button.addEventListener("click", function () {
        var completed = button.classList.contains("completed");
        if (!completed) {
          setModuleButton(button, true);
          if (data.completedModules.indexOf(moduleId) < 0) data.completedModules.push(moduleId);

          var section = button.closest(".module-section");
          if (section) {
            section.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(function (subCb) {
              var subId = subCb.getAttribute("data-check-id");
              subCb.checked = true;
              var row = subCb.closest(".checklist-item");
              if (row) row.classList.add("checked");
              if (subId && data.checkedItems.indexOf(subId) < 0) data.checkedItems.push(subId);
            });
          }
          updateNavModuleState(moduleId, true);
        } else {
          setModuleButton(button, false);
          data.completedModules = data.completedModules.filter(function (id) { return id !== moduleId; });
          updateNavModuleState(moduleId, false);
        }

        StudyProgress.write(config, data);
        updateOverallProgress(config);
      });
    });

    var reset = document.getElementById("btnResetProgress");
    reset.addEventListener("click", function () {
      if (window.confirm("Deseja resetar o progresso desta matéria?")) {
        StudyProgress.reset(config);
        window.location.reload();
      }
    });

    updateOverallProgress(config);
  }

  function setModuleButton(button, completed) {
    button.classList.toggle("completed", completed);
    button.textContent = completed ? "✓ Módulo Concluído" : "Marcar como Concluído";
  }

  function updateNavModuleState(moduleId, completed) {
    var item = document.querySelector('.nav-item[data-nav-mod="' + moduleId + '"]');
    if (item) item.classList.toggle("completed", completed);
  }

  function updateOverallProgress(config) {
    var itemIds = Array.from(document.querySelectorAll('.checklist-item input[data-check-id]'))
      .map(function (el) { return el.getAttribute("data-check-id"); });
    var moduleIds = Array.from(document.querySelectorAll(".btn-complete-module[data-mod-id]"))
      .map(function (el) { return el.getAttribute("data-mod-id"); });

    var data = StudyProgress.read(config);
    var checkedCount = data.checkedItems.filter(function (id) { return itemIds.indexOf(id) >= 0; }).length;
    var moduleCount = data.completedModules.filter(function (id) { return moduleIds.indexOf(id) >= 0; }).length;
    var total = itemIds.length + moduleIds.length;
    var completed = checkedCount + moduleCount;
    var percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;

    document.getElementById("globalProgressPercent").textContent = percent + "%";
    document.getElementById("globalProgressCount").textContent =
      completed + "/" + total + " metas atingidas (" + moduleCount + "/" + moduleIds.length + " módulos)";
    document.getElementById("globalProgressBar").style.width = percent + "%";
  }

  function initNavigation() {
    var searchInput = document.getElementById("sidebarSearch");
    var navItems = Array.from(document.querySelectorAll(".nav-item"));
    var mobileToggle = document.getElementById("mobileMenuToggle");
    var sidebar = document.querySelector(".sidebar");

    searchInput.addEventListener("input", function (event) {
      var query = event.target.value.toLowerCase().trim();
      navItems.forEach(function (item) {
        item.style.display = !query || item.textContent.toLowerCase().indexOf(query) >= 0 ? "flex" : "none";
      });
    });

    mobileToggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });

    navItems.forEach(function (item) {
      item.addEventListener("click", function () {
        if (window.innerWidth <= 980) sidebar.classList.remove("open");
      });
    });

    var sections = document.querySelectorAll(".module-section, .calculator-section, #cheatSheetSection, #quizSection");
    if (!("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.getAttribute("id");
        navItems.forEach(function (link) {
          link.classList.toggle("active", link.getAttribute("href") === "#" + id);
        });
      });
    }, { threshold: 0.25 });

    sections.forEach(function (section) { observer.observe(section); });
  }

  function initExerciseAccordions() {
    document.querySelectorAll(".solution-toggle").forEach(function (button) {
      button.addEventListener("click", function () {
        var content = document.getElementById(button.getAttribute("data-target"));
        if (!content) return;
        content.classList.toggle("open");
        button.textContent = content.classList.contains("open")
          ? "▲ Ocultar Resolução"
          : "▼ Ver Resolução Completa Passo a Passo";
        renderKaTeXIfAvailable();
      });
    });
  }

  function renderKaTeXIfAvailable() {
    if (typeof window.renderMathInElement !== "function") return;
    try {
      window.renderMathInElement(document.getElementById("subjectContent"), {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    } catch (error) {
      console.warn("Erro na renderização KaTeX:", error);
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Falha ao carregar script específico: " + src)); };
      document.body.appendChild(script);
    });
  }

  function showFatal(message) {
    var host = document.getElementById("subjectContent");
    if (host) host.innerHTML = '<div class="loading-state loading-error"><strong>' + message + '</strong><a href="index.html">Voltar para matérias</a></div>';
  }
});
