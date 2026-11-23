// plain service worker until the loader exists; paths relative so it works at root or under a subpath
importScripts("controller/controller.sw.js", "sw-glue.js");
