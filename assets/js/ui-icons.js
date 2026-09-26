(function (window, document) {
  "use strict";

  var paths = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/>',
    bolt: '<path d="M13 2 4 13h6l-1 9 9-12h-6z"/>',
    chart: '<path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    warning: '<path d="m12 3 9 17H3z"/><path d="M12 9v4M12 17h.01"/>',
    ruler: '<path d="m4 16 12-12 4 4L8 20H4z"/><path d="m13 7 4 4M9 11l2 2M6 14l2 2"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2"/>' ,
    check: '<path d="m5 12 4 4L19 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronUp: '<path d="m6 15 6-6 6 6"/>',
    rotate: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>'
  };

  function markup(name, className, label) {
    var svg = '<svg class="ui-icon' + (className ? ' ' + className : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="' + (label ? 'false' : 'true') + '"' + (label ? ' role="img" aria-label="' + label.replace(/"/g, '&quot;') + '"' : '') + '>' + (paths[name] || paths.book) + '</svg>';
    return svg;
  }

  function create(name, className, label) {
    var holder = document.createElement("span");
    holder.innerHTML = markup(name, className, label);
    return holder.firstElementChild;
  }

  function hydrate(root) {
    (root || document).querySelectorAll("[data-icon]").forEach(function (node) {
      var name = node.getAttribute("data-icon") || "book";
      var label = node.getAttribute("aria-label") || "";
      node.innerHTML = markup(name, "", label);
      node.classList.add("icon-holder");
    });
  }

  window.UiIcons = { create: create, hydrate: hydrate, markup: markup };
})(window, document);
