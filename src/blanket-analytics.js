/* Blanket analytics v1: load synchronously before every analytics SDK/script. */
(function (w) {
  'use strict';
  if (w.blanketAnalytics) return;
  var PARAM = 'blanket_traffic', OWNER = 'blanket.analytics.owner.v1', TEST = 'blanket.analytics.test.v1';
  var owner = false, test = false, storageAvailable = true;
  try { owner = w.localStorage.getItem(OWNER) === '1'; } catch (_) { storageAvailable = false; }
  try { test = w.sessionStorage.getItem(TEST) === '1'; } catch (_) { storageAvailable = false; }
  function persist(storage, key, value) { try { if (value) storage.setItem(key, '1'); else storage.removeItem(key); } catch (_) { storageAvailable = false; } }
  function clean(value) { try { var url = new URL(value, w.location.href); url.searchParams.delete(PARAM); return url.toString(); } catch (_) { return value; } }
  function consumeMarker(value) {
    try {
      var marker = new URL(value, w.location.href).searchParams.get(PARAM);
      if (marker === 'owner') { owner = true; persist(w.localStorage, OWNER, true); }
      if (marker === 'test') { test = true; persist(w.sessionStorage, TEST, true); }
      if (marker === 'external') { owner = false; test = false; persist(w.localStorage, OWNER, false); persist(w.sessionStorage, TEST, false); }
    } catch (_) { /* In-memory exclusion remains active when storage is unavailable. */ }
  }
  consumeMarker(w.location.href);
  try { if (clean(w.location.href) !== w.location.href) w.history.replaceState(w.history.state, '', clean(w.location.href)); } catch (_) {}
  function mode() {
    if (w.__BLANKET_AUTOMATION__ === true || w.navigator.webdriver === true || test) return 'test';
    return owner ? 'owner' : 'external';
  }
  function excluded(type) {
    // Local verification only; never log URLs, event payloads or visitor identifiers.
    try { w.console.info('[Blanket analytics] excluded ' + type + ' (' + mode() + ')'); } catch (_) {}
  }
  w.va = w.va || function () { (w.vaq = w.vaq || []).push(arguments); };
  function track(name, data) {
    consumeMarker(w.location.href);
    if (mode() !== 'external') { excluded(name === 'core_action' ? 'core_action' : 'custom event'); return; }
    w.va('event', { name: name, data: Object.assign({}, data || {}, { blanket_version: '1', blanket_traffic: 'external' }) });
  }
  function beforeSend(event) {
    consumeMarker(event.url);
    if (mode() !== 'external') { excluded(event.type === 'pageview' ? 'pageview' : 'event'); return null; }
    return Object.assign({}, event, { url: clean(event.url) });
  }
  w.blanketAnalytics = {
    version: '1', beforeSend: beforeSend, track: track, mode: mode,
    storageAvailable: function () { return storageAvailable; },
    setMode: function (value) {
      if (['owner', 'test', 'external'].indexOf(value) === -1) return;
      owner = value === 'owner'; test = value === 'test';
      try { persist(w.localStorage, OWNER, owner); } catch (_) { storageAvailable = false; }
      try { persist(w.sessionStorage, TEST, test); } catch (_) { storageAvailable = false; }
      w.dispatchEvent(new Event('blanket-traffic-change'));
    },
    link: function (href) { var url = new URL(href, w.location.href); url.searchParams.set(PARAM, mode()); return url.toString(); }
  };
  w.addEventListener('storage', function (event) {
    if (event.key === OWNER || event.key === null) {
      try { owner = w.localStorage.getItem(OWNER) === '1'; } catch (_) {}
      w.dispatchEvent(new Event('blanket-traffic-change'));
    }
  });
  w.va('beforeSend', beforeSend);
})(window);
