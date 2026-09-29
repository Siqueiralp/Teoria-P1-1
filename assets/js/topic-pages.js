(function (root) {
  "use strict";
  function owner(manifest, anchor) {
    return (manifest.pages || []).find(function (page) { return page.anchors.indexOf(anchor) >= 0; });
  }
  function resolve(manifest, pageId, anchor) {
    var pages = manifest.pages || [];
    return pages.find(function (page) { return page.id === pageId; }) || owner(manifest, anchor) || pages[0];
  }
  function href(manifest, page, anchor) {
    return "guide.html?subject=" + encodeURIComponent(manifest.id) + "&page=" + encodeURIComponent(page.id) +
      (anchor ? "#" + encodeURIComponent(anchor) : "");
  }
  var api = { owner: owner, resolve: resolve, href: href };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TopicPages = api;
}(typeof window === "undefined" ? globalThis : window));
