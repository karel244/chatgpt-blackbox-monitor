export async function diagnoseSecond(page, browser) {
  await page.goto("http://127.0.0.1:43997/");
  await page.waitForFunction(
    () => window.__BLACKBOX_SYNTHETIC__?.history?.health.status === "Ready",
  );
  if (browser === "chrome")
    return page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        d = h.secondDiagnostic;
      const response = await fetch("/backend-api/f/conversation?case=p7-sse", {
        method: "POST",
        body: JSON.stringify({
          model: "synthetic-route",
          thinking_effort: "high",
        }),
      });
      await response.text();
      const id = h.monitor.journal
        .ids()
        .filter((x) => h.monitor.journal.snapshot(x).start.mode === "live")
        .at(-1);
      const deadline = performance.now() + 10000;
      while (
        !h.monitor.journal.snapshot(id).events.some((e) => e.level === "A") &&
        performance.now() < deadline
      )
        await new Promise((r) => setTimeout(r, 0));
      await h.historyActions.flush();
      const s = h.monitor.journal.snapshot(id),
        safe = d.safeSnapshot(s);
      const summarize = (e) =>
        Object.fromEntries(
          [
            "event_index",
            "field_namespace",
            "field",
            "level",
            "transport",
            "direction",
            "association",
            "value_state",
            "source_path",
          ].map((k) => [
            k,
            typeof e[k] === "string"
              ? (d.safeWord(e[k], 512) ?? "redacted")
              : e[k],
          ]),
        );
      const dropped = s.events
        .filter((e) => !d.safeOccurrence(e))
        .map((e) => ({
          ...summarize(e),
          reason:
            d.registeredLevel(e) === null
              ? "unregistered_field_or_provenance"
              : d.registeredLevel(e) !== e.level
                ? "grade_mismatch"
                : "invalid_identity_or_index",
        }));
      const exported = await h.bundle.export(id);
      const files = await d.unzipFiles(exported.bytes, d.BUNDLE_FILES);
      const summary = JSON.parse(
        new TextDecoder().decode(files.get("evidence/summary.json")),
      );
      const events = new TextDecoder()
        .decode(files.get("evidence/timeline.jsonl"))
        .trimEnd()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse);
      const allowed = [
        summary.start.capture_id,
        ...summary.related_contexts.map((x) => x.start.capture_id),
      ];
      const previous = new Map(),
        ids = new Set();
      let first;
      for (const e of events) {
        const before = previous.get(e.capture_id) ?? 0;
        const reasons = [];
        if (e.event_index !== before + 1) reasons.push("sequence_gap");
        if (ids.has(e.event_id)) reasons.push("duplicate_event_id");
        if (!allowed.includes(e.capture_id))
          reasons.push("capture_id_mismatch");
        if (!Number.isFinite(e.monotonic_ms)) reasons.push("invalid_monotonic");
        for (const [key, values] of [
          ["transport", ["fetch", "xhr", "websocket", "reload", "dom"]],
          ["direction", ["inbound", "outbound", "local"]],
          ["association", ["confirmed", "candidate", "ambiguous", "orphan"]],
          ["value_state", ["value", "invalid", "removed", "explicit_null"]],
        ])
          if (!values.includes(e[key])) reasons.push("invalid_" + key);
        if (reasons.length) {
          first = {
            ...summarize(e),
            capture_pseudonym: e.capture_id,
            event_pseudonym: e.event_id,
            previous_event_index: before,
            current_event_index: e.event_index,
            gap_size: e.event_index - before - 1,
            reasons,
          };
          break;
        }
        previous.set(e.capture_id, e.event_index);
        ids.add(e.event_id);
      }
      let import_error = null;
      try {
        await h.bundle.import(exported.bytes);
      } catch (e) {
        import_error =
          e.message === "invalid_timeline_sequence_or_source"
            ? e.message
            : "other_bundle_failure";
      }
      return {
        scope:
          "Chrome real fixture fresh export inspected before production fix; no values logged",
        source_events: s.events.length,
        safe_events: safe.events.length,
        dropped_count: dropped.length,
        dropped,
        storage_redaction_drop: safe.controls.some(
          (c) => c.code === "storage_redaction_drop",
        ),
        exported_control: summary.controls.filter(
          (c) => c.code === "storage_redaction_drop",
        ),
        first_invalid: first ?? null,
        import_error,
        raw_indices: s.events.map((e) => e.event_index),
        safe_indices: safe.events.map((e) => e.event_index),
      };
    });
  return page.evaluate(async () => {
    const h = window.__BLACKBOX_SYNTHETIC__,
      n = h.network,
      j = h.monitor.journal;
    const trace = [],
      records = [];
    let current = null,
      activeXhr = null,
      historyInFlight = 0;
    const infos = new WeakMap();
    const mark = (stage, detail = {}) =>
      trace.push({
        order: trace.length + 1,
        run: current,
        stage,
        monotonic_ms: performance.now(),
        history_in_flight: historyInFlight,
        GM_queued_bytes: h.history.health.queued_bytes,
        host_observer_health: h.health.observer ?? "Unknown",
        ...detail,
      });
    const originals = {
      add: XMLHttpRequest.prototype.addEventListener,
      remove: XMLHttpRequest.prototype.removeEventListener,
      send: XMLHttpRequest.prototype.send,
      emit: h.emit,
      sink: h.sink.xhr,
      xhr: n.xhr,
      append: j.append,
      flush: h.history.flush,
    };
    const wrappers = new WeakMap();
    XMLHttpRequest.prototype.addEventListener = function (
      kind,
      listener,
      options,
    ) {
      if (
        !["readystatechange", "error", "timeout", "abort", "loadend"].includes(
          kind,
        )
      )
        return Reflect.apply(originals.add, this, [kind, listener, options]);
      const wrapped = (event) => {
        mark("Host_listener", {
          kind,
          capture_id: infos.get(this)?.capture_id ?? null,
        });
        return typeof listener === "function"
          ? Reflect.apply(listener, this, [event])
          : listener.handleEvent(event);
      };
      let map = wrappers.get(this);
      if (!map) {
        map = new Map();
        wrappers.set(this, map);
      }
      map.set(listener, wrapped);
      return Reflect.apply(originals.add, this, [kind, wrapped, options]);
    };
    XMLHttpRequest.prototype.removeEventListener = function (
      kind,
      listener,
      options,
    ) {
      return Reflect.apply(originals.remove, this, [
        kind,
        wrappers.get(this)?.get(listener) ?? listener,
        options,
      ]);
    };
    h.emit = function (kind, transport, capture, extra) {
      if (transport === "xhr" && capture) {
        if (kind === "request_start" && activeXhr)
          infos.get(activeXhr).capture_id = capture.capture_id;
        mark("Host_emit", { kind, capture_id: capture.capture_id });
      }
      return originals.emit.call(this, kind, transport, capture, extra);
    };
    h.sink.xhr = function (capture, xhr, kind) {
      mark("sink_xhr", { kind, capture_id: capture.capture_id });
      return originals.sink.call(this, capture, xhr, kind);
    };
    n.xhr = function (capture, xhr, kind) {
      mark("NetworkMonitor_xhr", { kind, capture_id: capture.capture_id });
      return originals.xhr.call(this, capture, xhr, kind);
    };
    j.append = function (e, observation) {
      const result = originals.append.call(this, e, observation);
      if (
        (e.field_namespace === "network.failure" && e.field === "category") ||
        e.field_namespace === "network.verdict"
      )
        mark("journal_append", {
          namespace: e.field_namespace,
          field: e.field,
          category_or_verdict: e.value,
          capture_id: e.capture_id,
          event_index: result?.event_index ?? null,
          journal_count: j.snapshot(e.capture_id)?.events.length ?? 0,
        });
      return result;
    };
    h.history.flush = async function (...args) {
      historyInFlight++;
      mark("history_flush_start");
      try {
        return await originals.flush.apply(this, args);
      } finally {
        historyInFlight--;
        mark("history_flush_end");
      }
    };
    try {
      for (let run = 0; run < 23; run++) {
        current = run;
        const kind =
          run === 21 ? "timeout" : run === 22 ? "abort" : "xhr-error";
        const x = new XMLHttpRequest(),
          info = { capture_id: null };
        infos.set(x, info);
        const before = new Set(j.ids());
        let native;
        for (const event of [
          "readystatechange",
          "error",
          "loadend",
          "timeout",
          "abort",
        ])
          originals.add.call(
            x,
            event,
            () =>
              mark("native_event", {
                kind: event,
                ready_state: x.readyState,
                capture_id: info.capture_id,
              }),
            true,
          );
        x.open("POST", "/backend-api/f/conversation?case=" + kind);
        x.timeout = 30;
        const nativePromise = new Promise((resolve) => {
          for (const event of ["error", "timeout", "abort", "load"])
            x["on" + event] = () => {
              native = event;
              mark("page_native_handler", {
                kind: event,
                capture_id: info.capture_id,
              });
              resolve();
            };
        });
        activeXhr = x;
        mark("XHR_send", {
          endpoint: "/backend-api/f/conversation",
          category: kind,
        });
        x.send();
        activeXhr = null;
        const concurrent = h.historyActions.flush();
        if (kind === "abort") x.abort();
        await nativePromise;
        await concurrent;
        const selected = j
          .ids()
          .find(
            (id) =>
              !before.has(id) &&
              !["environment", "network"].includes(j.snapshot(id)?.start.mode),
          );
        mark("capture_selection", {
          selected_capture_id: selected,
          actual_capture_id: info.capture_id,
          correct: selected === info.capture_id,
          native_terminal: native,
        });
        const started = performance.now(),
          deadline = started + 1000;
        let predicate = false;
        while (performance.now() < deadline) {
          const category = kind === "xhr-error" ? "generic" : kind;
          predicate =
            j
              .snapshot(selected)
              ?.events.some(
                (e) =>
                  e.field_namespace === "network.failure" &&
                  e.field === "category" &&
                  e.value === category,
              ) &&
            n.verdict(selected) ===
              (kind === "abort" ? "Aborted" : "Transport Failure");
          if (predicate) {
            mark("formal_predicate_first_true");
            break;
          }
          await new Promise((r) => setTimeout(r, 0));
        }
        if (!predicate) mark("deadline");
        records.push({
          run,
          kind,
          native,
          selected_capture_id: selected,
          actual_capture_id: info.capture_id,
          correct_capture: selected === info.capture_id,
          predicate: !!predicate,
          settlement_ms: performance.now() - started,
          verdict: n.verdict(selected),
          categories: j
            .snapshot(selected)
            ?.events.filter(
              (e) =>
                e.field_namespace === "network.failure" &&
                e.field === "category",
            )
            .map((e) => e.value),
          observer_health: h.health.observer ?? "Unknown",
        });
        j.terminate(info.capture_id, "synthetic_diagnostic_ended");
      }
    } finally {
      XMLHttpRequest.prototype.addEventListener = originals.add;
      XMLHttpRequest.prototype.removeEventListener = originals.remove;
      h.emit = originals.emit;
      h.sink.xhr = originals.sink;
      n.xhr = originals.xhr;
      j.append = originals.append;
      h.history.flush = originals.flush;
    }
    return {
      scope:
        "Edge real XHR original 30ms fixture timeout, native/host/sink/network/journal tracing and concurrent actual GM flush; no request/header/body values",
      trace,
      records,
    };
  });
}
