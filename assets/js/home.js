document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  var grid = document.getElementById("subjectsGrid");

  fetch("subjects/registry.json")
    .then(function (response) {
      if (!response.ok) throw new Error("Falha ao carregar registro de matérias.");
      return response.json();
    })
    .then(function (registry) {
      var entries = Array.isArray(registry.subjects) ? registry.subjects : [];
      return Promise.all(entries.map(function (entry) {
        return fetch(entry.path + "/subject.json")
          .then(function (response) {
            if (!response.ok) throw new Error("Falha ao carregar " + entry.id);
            return response.json();
          })
          .then(function (manifest) {
            return { entry: entry, manifest: manifest };
          });
      }));
    })
    .then(function (subjects) {
      grid.innerHTML = "";
      var aggregateCompleted = 0;
      var aggregateTotal = 0;

      subjects.forEach(function (item) {
        var manifest = item.manifest;
        var progress = StudyProgress.compute(manifest, StudyProgress.read(manifest));
        aggregateCompleted += progress.completed;
        aggregateTotal += progress.total;

        var article = document.createElement("article");
        article.className = "subject-card";

        var top = document.createElement("div");
        top.className = "subject-card-top";

        var icon = document.createElement("div");
        icon.className = "subject-card-icon";
        icon.textContent = manifest.icon || "📘";

        var meta = document.createElement("div");
        meta.className = "subject-card-meta";

        var badge = document.createElement("span");
        badge.className = "subject-card-badge";
        badge.textContent = manifest.badge || manifest.institution || "Guia";

        var title = document.createElement("h3");
        title.textContent = manifest.name;

        var description = document.createElement("p");
        description.textContent = manifest.description || "Guia de aprendizado";

        meta.appendChild(badge);
        meta.appendChild(title);
        meta.appendChild(description);
        top.appendChild(icon);
        top.appendChild(meta);

        var stats = document.createElement("div");
        stats.className = "subject-card-progress";
        stats.innerHTML =
          '<div class="progress-label-row"><span>Progresso</span><strong>' + progress.percent + '%</strong></div>' +
          '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + progress.percent + '%"></div></div>' +
          '<span class="progress-count">' + progress.completed + '/' + progress.total +
          ' metas • ' + progress.modulesCompleted + '/' + progress.modulesTotal + ' módulos</span>';

        var link = document.createElement("a");
        link.className = "subject-card-link";
        link.href = "guide.html?subject=" + encodeURIComponent(manifest.id);
        link.textContent = progress.completed ? "Continuar estudando →" : "Começar guia →";

        article.appendChild(top);
        article.appendChild(stats);
        article.appendChild(link);
        grid.appendChild(article);
      });

      if (!subjects.length) {
        grid.innerHTML = '<div class="home-empty">Nenhuma matéria cadastrada ainda.</div>';
      }

      var percent = aggregateTotal ? Math.round((aggregateCompleted / aggregateTotal) * 100) : 0;
      document.getElementById("overallProgressPercent").textContent = percent + "%";
      document.getElementById("overallProgressBar").style.width = percent + "%";
      document.getElementById("overallProgressCount").textContent =
        aggregateCompleted + "/" + aggregateTotal + " metas concluídas";
    })
    .catch(function (error) {
      console.error(error);
      grid.innerHTML = '<div class="home-error">Não foi possível carregar as matérias. Recarregue a página ou verifique o registro.</div>';
    });
});
