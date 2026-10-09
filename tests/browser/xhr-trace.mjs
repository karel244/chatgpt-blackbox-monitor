// Test-only tracing. No raw payload, headers or exception text is retained.
export async function installXhrTrace(page) {
  await page.evaluate(() => {
    const h = window.__BLACKBOX_SYNTHETIC__,
      j = h.monitor.journal,
      n = h.network;
    const trace = [],
      requests = [],
      info = new WeakMap();
    let host,
      inFlight = 0,
      lag = 0;
    const mark = (stage, detail = {}) => {
      if (trace.length < 20000)
        trace.push({
          order: trace.length + 1,
          stage,
          monotonic_ms: performance.now(),
          in_flight_flushes: inFlight,
          queued_bytes: h.history.health.queued_bytes,
          observer_health: h.health.observer ?? "Unknown",
          event_loop_lag_ms: lag,
          ...detail,
        });
    };
    const original = {
      open: XMLHttpRequest.prototype.open,
      send: XMLHttpRequest.prototype.send,
      add: XMLHttpRequest.prototype.addEventListener,
      remove: XMLHttpRequest.prototype.removeEventListener,
      emit: h.emit,
      sink: h.sink.xhr,
      xhr: n.xhr,
      append: j.append,
      flush: h.history.flush,
    };
    const wraps = new WeakMap();
    XMLHttpRequest.prototype.open = function (...args) {
      const r = original.open.apply(this, args);
      const url = new URL(String(args[1]), location.href);
      const metadata = {
        capture_id: null,
        endpoint: url.pathname,
        fixture: url.searchParams.get("case"),
        native_terminal: null,
      };
      info.set(this, metadata);
      requests.push(metadata);
      for (const kind of [
        "readystatechange",
        "error",
        "timeout",
        "abort",
        "loadend",
      ])
        original.add.call(
          this,
          kind,
          () => {
            if (["error", "timeout", "abort"].includes(kind))
              metadata.native_terminal = kind;
            mark("native_event", {
              kind,
              capture_id: metadata.capture_id,
              ready_state: this.readyState,
              fixture: metadata.fixture,
            });
          },
          true,
        );
      return r;
    };
    XMLHttpRequest.prototype.addEventListener = function (
      kind,
      listener,
      options,
    ) {
      const wrapped = (event) => {
        mark("Host_listener", {
          kind,
          capture_id: info.get(this)?.capture_id ?? null,
        });
        return typeof listener === "function"
          ? listener.call(this, event)
          : listener.handleEvent(event);
      };
      let m = wraps.get(this);
      if (!m) {
        m = new Map();
        wraps.set(this, m);
      }
      m.set(listener, wrapped);
      return original.add.call(this, kind, wrapped, options);
    };
    XMLHttpRequest.prototype.removeEventListener = function (
      kind,
      listener,
      options,
    ) {
      return original.remove.call(
        this,
        kind,
        wraps.get(this)?.get(listener) ?? listener,
        options,
      );
    };
    XMLHttpRequest.prototype.send = function (...args) {
      host = this;
      mark("XHR_send", {
        endpoint: info.get(this)?.endpoint,
        fixture: info.get(this)?.fixture,
      });
      try {
        return original.send.apply(this, args);
      } finally {
        host = null;
      }
    };
    h.emit = function (kind, transport, capture, extra) {
      if (transport === "xhr") {
        if (kind === "request_start" && host)
          info.get(host).capture_id = capture?.capture_id ?? null;
        mark("Host_emit", { kind, capture_id: capture?.capture_id ?? null });
      }
      return original.emit.call(this, kind, transport, capture, extra);
    };
    h.sink.xhr = function (capture, xhr, kind) {
      mark("sink_xhr", { kind, capture_id: capture.capture_id });
      try {
        return original.sink.call(this, capture, xhr, kind);
      } catch (e) {
        mark("sink_exception", { error_name: e.name });
        throw e;
      }
    };
    n.xhr = function (capture, xhr, kind) {
      mark("NetworkMonitor_xhr", { kind, capture_id: capture.capture_id });
      return original.xhr.call(this, capture, xhr, kind);
    };
    j.append = function (e, obs) {
      const r = original.append.call(this, e, obs);
      if (
        (e.field_namespace === "network.failure" && e.field === "category") ||
        e.field_namespace === "network.verdict"
      )
        mark("journal_append", {
          capture_id: e.capture_id,
          field_namespace: e.field_namespace,
          field: e.field,
          category_or_verdict: e.value,
          event_index: r?.event_index ?? null,
          count: j.snapshot(e.capture_id)?.events.length ?? 0,
        });
      return r;
    };
    h.history.flush = async function (...args) {
      inFlight++;
      mark("history_flush_start");
      const start = performance.now();
      setTimeout(() => {
        lag = Math.max(0, performance.now() - start);
      }, 0);
      try {
        return await original.flush.apply(this, args);
      } finally {
        inFlight--;
        mark("history_flush_end");
      }
    };
    window.__BLACKBOX_XHR_TRACE__ = { trace, requests, mark };
  });
}
