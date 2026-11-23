// mirage's sw.js fetch glue without importScripts; runs after controller/controller.sw.js
addEventListener("fetch", (e) => {
  if ($scramjetController.shouldRoute(e)) {
    e.respondWith($scramjetController.route(e));
  }
});
