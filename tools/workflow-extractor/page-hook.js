// Runs in MAIN world (page context). Wraps fetch and XHR to capture
// workflow API responses and forward them to the content script via
// CustomEvent('ghl-export:capture').
(function () {
  if (window.__ghlExporterHookInstalled) return;
  window.__ghlExporterHookInstalled = true;

  const PATTERNS = [
    { name: 'list',    re: /^https:\/\/backend\.leadconnectorhq\.com\/workflow\/([^/]+)\/list\?/ },
    { name: 'detail',  re: /^https:\/\/backend\.leadconnectorhq\.com\/workflow\/([^/]+)\/([a-f0-9-]{36})(\?|$)/ },
    { name: 'trigger', re: /^https:\/\/backend\.leadconnectorhq\.com\/workflow\/([^/]+)\/trigger\?workflowId=([a-f0-9-]{36})/ }
  ];

  function matchPattern(url) {
    for (const p of PATTERNS) {
      const m = url.match(p.re);
      if (m) return { kind: p.name, match: m };
    }
    return null;
  }

  function dispatch(detail) {
    try {
      window.dispatchEvent(new CustomEvent('ghl-export:capture', { detail }));
      // Also expose the live token globally so console scripts and debug
      // tools can read it without setting up their own fetch hook.
      if (detail && detail.token) {
        try {
          window.__ghlExporterToken = detail.token;
          const payload = JSON.parse(atob(detail.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          window.__ghlExporterCompanyId = payload.company_id || null;
          window.__ghlExporterUserId = payload.user_id || payload.sub || null;
        } catch (_) {}
      }
    } catch (e) {
      // Cloning failure (rare); ignore.
    }
  }

  // --- fetch wrap ---
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const headers = (init && init.headers) || (input && input.headers) || null;
    let token = null;
    if (headers) {
      try {
        if (typeof headers.get === 'function') {
          token = headers.get('token-id');
        } else if (typeof headers === 'object') {
          token = headers['token-id'] || headers['Token-Id'] || headers['token-Id'];
        }
      } catch (_) {}
    }
    const p = origFetch.apply(this, arguments);
    const m = matchPattern(url);
    if (!m) return p;
    return p.then(async (resp) => {
      try {
        const clone = resp.clone();
        const text = await clone.text();
        let body = null;
        try { body = JSON.parse(text); } catch (_) { body = text; }
        dispatch({ url, kind: m.kind, match: m.match, body, token, status: resp.status });
      } catch (_) {}
      return resp;
    });
  };

  // --- XHR wrap ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ghl_url = url;
    this.__ghl_headers = {};
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.__ghl_headers) this.__ghl_headers[name.toLowerCase()] = value;
    return origSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    const xhr = this;
    const url = xhr.__ghl_url || '';
    const m = matchPattern(url);
    if (m) {
      xhr.addEventListener('load', function () {
        try {
          const text = xhr.responseText;
          let body = null;
          try { body = JSON.parse(text); } catch (_) { body = text; }
          const token = (xhr.__ghl_headers && xhr.__ghl_headers['token-id']) || null;
          dispatch({ url, kind: m.kind, match: m.match, body, token, status: xhr.status });
        } catch (_) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  // Also expose the token from localStorage proactively (fallback if we
  // miss a request).
  try {
    const t = localStorage.getItem('refreshedToken');
    if (t) {
      const parsed = t.startsWith('"') ? JSON.parse(t) : t;
      dispatch({ url: 'storage:refreshedToken', kind: 'token-bootstrap', match: null, body: null, token: parsed, status: 0 });
    }
  } catch (_) {}
})();
