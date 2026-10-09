// Diagnostic instrumentation exists only in the synthetic test page, never in dist.
export async function diagnoseXhr(page) {
  return page.evaluate(async () => {
    const h = window.__BLACKBOX_SYNTHETIC__;
    h.resume();
    h.clear();
    const n = h.network,
      j = h.monitor.journal;
    const records = [],
      trace = [];
    let current = null;
    const mark = (stage, detail = null) =>
      trace.push({
        index: trace.length + 1,
        kind: current,
        stage,
        detail,
        monotonic_ms: performance.now(),
      });
    const original = {
      add: window.XMLHttpRequest.prototype.addEventListener,
      push: h.events.push,
      xhr: n.xhr,
      failure: n.failure,
      append: j.append,
    };
    window.XMLHttpRequest.prototype.addEventListener = function (
      kind,
      listener,
      options,
    ) {
      if (["error", "timeout", "abort", "loadend"].includes(kind)) {
        const wrapped = function (event) {
          mark("host_xhr_listener", kind);
          return Reflect.apply(listener, this, [event]);
        };
        // Restore/removal must still use the actual wrapper registered here.
        const remove = this.removeEventListener;
        this.removeEventListener = function (type, fn, opts) {
          return Reflect.apply(remove, this, [
            type,
            fn === listener ? wrapped : fn,
            opts,
          ]);
        };
        return Reflect.apply(original.add, this, [kind, wrapped, options]);
      }
      return Reflect.apply(original.add, this, [kind, listener, options]);
    };
    h.events.push = function (event) {
      if (event.transport === "xhr") mark("hook_event_emitted", event.kind);
      return Reflect.apply(original.push, this, [event]);
    };
    n.xhr = function (cap, xhr, kind) {
      mark("network_xhr_entered", kind);
      return Reflect.apply(original.xhr, this, [cap, xhr, kind]);
    };
    n.failure = function (cap, kind) {
      mark("network_failure_entered", kind);
      return Reflect.apply(original.failure, this, [cap, kind]);
    };
    j.append = function (e, observation) {
      const result = Reflect.apply(original.append, this, [e, observation]);
      if (e.field_namespace === "network.failure" && e.field === "category")
        mark("journal_failure_category", e.value);
      if (e.field_namespace === "network.verdict")
        mark("journal_verdict", e.value);
      return result;
    };
    try {
      for (const kind of ["timeout", "xhr-error", "abort"]) {
        current = kind;
        const before = new Set(j.ids());
        const native = await new Promise((resolve) => {
          const x = new XMLHttpRequest();
          x.open("POST", "/backend-api/f/conversation?case=" + kind);
          x.timeout = 30;
          for (const event of ["timeout", "error", "abort", "load"])
            x["on" + event] = () => {
              mark("page_native_handler", event);
              resolve(event);
            };
          x.send();
          if (kind === "abort") x.abort();
        });
        const id = j.ids().find((id) => !before.has(id));
        mark("browser_snapshot_read_initial", n.verdict(id));
        const initial = j.snapshot(id);
        const deadline = performance.now() + 1000;
        let settled = false;
        while (performance.now() <= deadline) {
          const events = j.snapshot(id)?.events ?? [];
          settled =
            events.some(
              (e) =>
                e.field_namespace === "network.failure" &&
                e.field === "category",
            ) &&
            n.verdict(id) ===
              (kind === "abort" ? "Aborted" : "Transport Failure");
          if (settled) break;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        mark("browser_snapshot_read_settled", n.verdict(id));
        records.push({
          kind,
          native,
          capture_id: id,
          initial,
          settled,
          final: j.snapshot(id),
          verdict: n.verdict(id),
        });
      }
    } finally {
      window.XMLHttpRequest.prototype.addEventListener = original.add;
      h.events.push = original.push;
      n.xhr = original.xhr;
      n.failure = original.failure;
      j.append = original.append;
    }
    return { trace, records };
  });
}
