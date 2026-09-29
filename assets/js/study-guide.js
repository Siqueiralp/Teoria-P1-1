document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var subjectId = params.get("subject") || "";
  var safeId = /^[a-z0-9-]+$/.test(subjectId) ? subjectId : "";

  if (!safeId) {
    showFatal("Matéria inválida ou não informada.");
    return;
  }

  // Header icons live outside #subjectContent, so hydrate the whole shell once.
  // Without this, the mobile menu button exists but its menu icon is invisible.
  if (window.UiIcons) window.UiIcons.hydrate(document);

  var base = "subjects/" + safeId + "/";
  var manifest;
  var currentPage;

  fetch(base + "subject.json").then(requireOk).then(function (r) { return r.json(); })
    .then(function (config) {
      manifest = config;
      if (manifest.id !== safeId) throw new Error("O identificador da matéria não corresponde à pasta.");
      currentPage = window.TopicPages.resolve(manifest, params.get("page"), decodeURIComponent(window.location.hash.slice(1)));
      window.StudyGuide = { manifest: manifest, base: base, page: currentPage };
      return fetch(base + (currentPage ? currentPage.file : "content.html")).then(requireOk).then(function (r) { return r.text(); });
    })
    .then(function (content) {
      applyManifest(manifest);
      document.getElementById("subjectContent").innerHTML = content;
      if (currentPage) {
        document.title = currentPage.title + " | " + manifest.name;
        initTopicPage();
      }
      if (window.UiIcons) window.UiIcons.hydrate(document.getElementById("subjectContent"));
      buildNavigation(manifest);
      initTracker(manifest);
      initNavigation();
      initExerciseAccordions();
      renderKaTeXIfAvailable();

      if (manifest.script) {
        return loadScript(base + manifest.script).then(function () {
          if (typeof window.initSubjectTools === "function") window.initSubjectTools();
          rewriteTopicLinks();
          initPreloadedReview();
          scrollToInitialSection();
        });
      }
      scrollToInitialSection();
    })
    .catch(function (error) {
      console.error(error);
      showFatal("Não foi possível carregar esta matéria.");
    });

  function requireOk(response) {
    if (!response.ok) throw new Error("HTTP " + response.status + " ao carregar " + response.url);
    return response;
  }

  function scrollToInitialSection() {
    var target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (target) target.scrollIntoView();
  }

  function rewriteTopicLinks(root) {
    if (!currentPage) return;
    (root || document.getElementById("subjectContent")).querySelectorAll('a[href^="#"]').forEach(function (link) {
      var anchor = decodeURIComponent(link.getAttribute("href").slice(1));
      var page = window.TopicPages.owner(manifest, anchor);
      if (page && (currentPage.preloadGroup || page.id !== currentPage.id)) link.href = window.TopicPages.href(manifest, page, anchor);
    });
  }

  function initPreloadedReview() {
    if (!currentPage || !currentPage.preloadGroup || !window.ReviewTabs) return;
    window.ReviewTabs.mount({ manifest: manifest, base: base, page: currentPage,
      host: document.getElementById("subjectContent"),
      initPanel: function (panel) {
        if (typeof window.initSubjectPanel === "function") window.initSubjectPanel(panel);
        if (window.UiIcons) window.UiIcons.hydrate(panel);
        renderKaTeXIfAvailable(panel);
        rewriteTopicLinks(panel);
      },
      onActivate: function (page) {
        currentPage = page;
        window.StudyGuide.page = page;
        document.title = page.title + " | " + manifest.name;
        var trail = document.querySelector(".topic-breadcrumb");
        trail.lastChild.textContent = " / " + page.title;
      }
    });
  }

  function initTopicPage() {
    rewriteTopicLinks();
    var printDetails = [];
    window.addEventListener("beforeprint", function () {
      printDetails = Array.from(document.querySelectorAll(".topic-details:not([open]), .converter-description:not([open]), [data-print-expand]:not([open])"))
        .filter(function (detail) { return !detail.closest('[hidden]'); });
      printDetails.forEach(function (detail) { detail.open = true; });
    });
    window.addEventListener("afterprint", function () {
      printDetails.forEach(function (detail) { detail.open = false; });
      printDetails = [];
    });
    var host = document.getElementById("subjectContent");
    var trail = document.createElement("div");
    trail.className = "topic-breadcrumb";
    var home = document.createElement("a");
    home.href = window.TopicPages.href(manifest, manifest.pages[0]);
    home.textContent = "Visão geral";
    trail.appendChild(home);
    trail.appendChild(document.createTextNode(" / " + currentPage.title));
    host.insertBefore(trail, host.firstChild);
    var moduleIndex = manifest.modules.findIndex(function (mod) { return mod.anchor === currentPage.id; });
    if (moduleIndex >= 0) {
      var pager = document.createElement("nav");
      pager.className = "topic-pager";
      pager.setAttribute("aria-label", "Sequência dos módulos");
      [moduleIndex - 1, moduleIndex + 1].forEach(function (index) {
        var mod = manifest.modules[index];
        if (!mod) return;
        var link = document.createElement("a");
        link.href = window.TopicPages.href(manifest, window.TopicPages.owner(manifest, mod.anchor));
        link.textContent = (index < moduleIndex ? "← Anterior: " : "Próximo: ") + mod.title + (index > moduleIndex ? " →" : "");
        pager.appendChild(link);
      });
      var footer = host.querySelector("footer");
      host.insertBefore(pager, footer || null);
    }
    host.addEventListener("keydown", function (event) {
        var list = event.target.closest('[role="tablist"]');
        if (!list) return;
        var tabs = Array.from(list.querySelectorAll('[role="tab"]'));
        var index = tabs.indexOf(document.activeElement);
        if (index < 0) return;
        if (event.key === " ") {
          event.preventDefault();
          tabs[index].click();
          return;
        }
        if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(event.key) < 0) return;
        event.preventDefault();
        var next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
          (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs.forEach(function (tab, i) { tab.tabIndex = i === next ? 0 : -1; });
        tabs[next].focus();
    });
  }

  function applyManifest(config) {
    document.title = config.name + (config.badge ? " — " + config.badge : "") + " | Guia de Estudos";
    document.getElementById("subjectTitle").textContent = config.shortName || config.name;
    var iconHost = document.getElementById("subjectIcon");
    iconHost.innerHTML = "";
    iconHost.appendChild(window.UiIcons ? window.UiIcons.create(config.icon || "book") : document.createTextNode(""));
    document.getElementById("subjectSubtitle").textContent =
      (config.institution ? config.institution + " • " : "") + (config.description || "Guia didático interativo");
  }

  function buildNavigation(config) {
    var host = document.getElementById("moduleNavigation");
    host.innerHTML = "";

    if (currentPage) host.appendChild(navItem("", "IN", "Visão geral", null));

    host.appendChild(sectionTitle("Roteiro de Estudos"));
    (config.modules || []).forEach(function (mod) {
      host.appendChild(navItem(mod.anchor, mod.code, mod.title, mod.id));
    });

    if (config.tools && config.tools.length) {
      var currentGroup = null;
      config.tools.forEach(function (tool) {
        var group = tool.group || "Ferramentas de Apoio";
        if (group !== currentGroup) {
          var title = sectionTitle(group);
          title.style.marginTop = "14px";
          host.appendChild(title);
          currentGroup = group;
        }
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
    a.className = "nav-item";
    a.href = "#" + anchor;
    a.setAttribute("data-nav-anchor", anchor);
    if (currentPage) {
      var page = anchor ? window.TopicPages.owner(manifest, anchor) : manifest.pages[0];
      if (page) a.href = window.TopicPages.href(manifest, page);
      a.classList.toggle("active", currentPage.navAnchor === anchor);
      if (currentPage.navAnchor === anchor) a.setAttribute("aria-current", "page");
    }
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
      if (window.UiIcons) check.appendChild(window.UiIcons.create("check"));
      a.appendChild(check);
    }
    return a;
  }

  function initTracker(config) {
    var data = StudyProgress.read(config);
    (config.modules || []).forEach(function (mod) { updateNavModuleState(mod.id, data.completedModules.indexOf(mod.id) >= 0); });
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
    button.innerHTML = "";
    if (completed && window.UiIcons) button.appendChild(window.UiIcons.create("check"));
    var label = document.createElement("span");
    label.textContent = completed ? "Módulo Concluído" : "Marcar como Concluído";
    button.appendChild(label);
  }

  function updateNavModuleState(moduleId, completed) {
    var item = document.querySelector('.nav-item[data-nav-mod="' + moduleId + '"]');
    if (item) item.classList.toggle("completed", completed);
  }

  function updateOverallProgress(config) {
    var progress = StudyProgress.compute(config, StudyProgress.read(config));
    var percent = progress.percent;

    document.getElementById("globalProgressPercent").textContent = percent + "%";
    document.getElementById("globalProgressCount").textContent =
      progress.completed + "/" + progress.total + " metas atingidas (" + progress.modulesCompleted + "/" + progress.modulesTotal + " módulos)";
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
      document.querySelectorAll(".nav-section-title").forEach(function (title) {
        var item = title.nextElementSibling;
        var hasVisibleItem = false;
        while (item && !item.classList.contains("nav-section-title")) {
          if (item.classList.contains("nav-item") && item.style.display !== "none") hasVisibleItem = true;
          item = item.nextElementSibling;
        }
        title.hidden = !hasVisibleItem;
      });
    });

    mobileToggle.setAttribute("aria-expanded", "false");

    function setMobileSidebar(open) {
      sidebar.classList.toggle("open", open);
      mobileToggle.setAttribute("aria-expanded", open ? "true" : "false");
      mobileToggle.setAttribute("aria-label", open ? "Fechar índice de tópicos" : "Abrir índice de tópicos");
      document.body.classList.toggle("sidebar-open", open && window.innerWidth <= 980);
    }

    mobileToggle.addEventListener("click", function () {
      setMobileSidebar(!sidebar.classList.contains("open"));
    });

    navItems.forEach(function (item) {
      item.addEventListener("click", function () {
        if (window.innerWidth <= 980) setMobileSidebar(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sidebar.classList.contains("open")) setMobileSidebar(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) setMobileSidebar(false);
    });

    if (currentPage) return;
    var sections = navItems.map(function (item) {
      return document.getElementById(item.getAttribute("href").slice(1));
    }).filter(Boolean);
    if (!("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.getAttribute("id");
        navItems.forEach(function (link) {
          link.classList.toggle("active", link.getAttribute("href") === "#" + id);
        });
      });
    }, { threshold: 0, rootMargin: "-12% 0px -70% 0px" });

    sections.forEach(function (section) { observer.observe(section); });
  }

  function initExerciseAccordions() {
    document.querySelectorAll(".solution-toggle").forEach(function (button) {
      button.addEventListener("click", function () {
        var content = document.getElementById(button.getAttribute("data-target"));
        if (!content) return;
        content.classList.toggle("open");
        button.innerHTML = "";
        if (window.UiIcons) button.appendChild(window.UiIcons.create(content.classList.contains("open") ? "chevronUp" : "chevronDown"));
        var label = document.createElement("span");
        label.textContent = content.classList.contains("open") ? "Ocultar Resolução" : "Ver Resolução Completa Passo a Passo";
        button.appendChild(label);
        renderKaTeXIfAvailable();
      });
    });
  }

  function renderKaTeXIfAvailable(root) {
    if (typeof window.renderMathInElement !== "function") return;
    try {
      window.renderMathInElement(root || document.getElementById("subjectContent"), {
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
