export async function diagnoseHistory(page, context) {
  const second = await context.newPage();
  try {
    await Promise.all([
      page.goto("http://127.0.0.1:43997/"),
      second.goto("http://127.0.0.1:43997/"),
    ]);
    for (const tab of [page, second])
      await tab.waitForFunction(
        () => window.__BLACKBOX_SYNTHETIC__?.history?.health.status === "Ready",
        {},
        { timeout: 10000 },
      );
    return await Promise.all(
      [page, second].map((tab) =>
        tab.evaluate(async () => {
          const h = window.__BLACKBOX_SYNTHETIC__,
            store = h.history;
          const trace = [];
          let id;
          let dropped = 0;
          const state = () => {
            const s = id && h.monitor.journal.snapshot(id);
            return {
              capture_id: id ?? null,
              writer_id: store.writer_id,
              document_id: h.context.document_id,
              journal_count: s?.events.length ?? 0,
              journal_A: s?.events.filter((e) => e.level === "A").length ?? 0,
              busy: h.historyDiagnostic().busy,
              health: { ...store.health },
              epoch: store.epoch,
              position: id ? (store.positions.get(id) ?? 0) : 0,
              pending_count: store.pending.size,
              failed_current: id ? store.failed.has(id) : false,
            };
          };
          const log = (kind, detail = {}) => {
            if (trace.length < 12000)
              trace.push({
                order: trace.length + 1,
                monotonic_ms: performance.now(),
                kind,
                ...detail,
                ...state(),
              });
            else dropped++;
          };
          const errorInfo = (e) => ({
            error_name: e?.name ?? "Unknown",
            error_code: [
              "persistent_storage_failed",
              "writer_or_schema_conflict",
              "invalid_manifest",
              "migration_validation_failed",
            ].includes(e?.message)
              ? e.message
              : "unclassified",
          });
          window.__BLACKBOX_HISTORY_TRACE__ = log;
          const originalAppend = h.monitor.journal.append;
          h.monitor.journal.append = function (...args) {
            const r = originalAppend.apply(this, args);
            if (r && ["A", "B"].includes(r.level))
              log("journal_" + r.level, {
                event_capture_id: r.capture_id,
                event_index: r.event_index,
              });
            return r;
          };
          for (const name of ["flush", "queue", "persist", "list", "recover"]) {
            const original = store[name];
            store[name] = function (...args) {
              log("HistoryStore_" + name + "_start", {
                target_capture_id: args[0]?.start?.capture_id ?? null,
              });
              let promise;
              try {
                promise = original.apply(this, args);
              } catch (e) {
                log("HistoryStore_" + name + "_error", errorInfo(e));
                throw e;
              }
              return promise.then(
                (result) => {
                  log(
                    "HistoryStore_" + name + "_end",
                    name === "recover"
                      ? {
                          recovered_A: result.snapshot.events.filter(
                            (e) => e.level === "A",
                          ).length,
                          recovered_count: result.snapshot.events.length,
                          notes: result.notes,
                          committed_sequence:
                            result.manifest.committed_sequence,
                        }
                      : {},
                  );
                  return result;
                },
                (e) => {
                  log("HistoryStore_" + name + "_error", errorInfo(e));
                  throw e;
                },
              );
            };
          }
          for (const name of ["set", "get", "keys"]) {
            const original = store.store[name];
            store.store[name] = function (...args) {
              const key = args[0],
                kind =
                  typeof key === "string" && key.endsWith(":manifest")
                    ? "manifest"
                    : typeof key === "string" && key.includes(":chunk:")
                      ? "chunk"
                      : "epoch_or_other";
              if (name === "set")
                log(kind + "_write_start", {
                  committed_sequence: args[1]?.committed_sequence ?? null,
                  chunk_count: args[1]?.chunks?.length ?? null,
                });
              return original.apply(this, args).then(
                (result) => {
                  if (name === "set") log(kind + "_write_end");
                  if (name === "keys")
                    log("GM_keys", { key_count: result.length });
                  if (name === "get" && kind === "manifest")
                    log("manifest_read", {
                      exists: !!result,
                      committed_sequence: result?.committed_sequence ?? null,
                      chunk_count: result?.chunks?.length ?? null,
                      count: result?.count ?? null,
                      status: result?.status ?? null,
                      notes: result?.notes ?? [],
                    });
                  return result;
                },
                (e) => {
                  log("GM_" + name + "_error", errorInfo(e));
                  throw e;
                },
              );
            };
          }
          log("conversation_start");
          const response = await fetch(
            "/backend-api/f/conversation?case=first",
            {
              method: "POST",
              body: JSON.stringify({
                model: "synthetic-route",
                thinking_effort: "high",
                messages: [{ content: "PRIVATE_HISTORY_PROMPT_CANARY" }],
              }),
            },
          );
          await response.text();
          id = h.monitor.journal
            .ids()
            .filter((x) => h.monitor.journal.snapshot(x).start.mode === "live")
            .at(-1);
          log("response_consumed");
          const deadline = performance.now() + 10000;
          let recovered;
          let polls = 0;
          while (performance.now() < deadline) {
            log("explicit_flush_request");
            await h.historyActions.flush();
            log("explicit_flush_await_return");
            recovered = (await store.list()).find(
              (x) => x.manifest.capture_id === id,
            );
            if (recovered?.snapshot.events.some((e) => e.level === "A")) {
              log("first_recovered_A");
              break;
            }
            polls++;
            // Bounded polling avoids an unbounded trace; this is diagnostic, not a Gate.
            await new Promise((r) => setTimeout(r, 100));
          }
          log(
            recovered?.snapshot.events.some((e) => e.level === "A")
              ? "diagnostic_success"
              : "diagnostic_deadline",
          );
          const final = state();
          await store.store.keys();
          delete window.__BLACKBOX_HISTORY_TRACE__;
          return {
            scope: "synthetic-only real Tampermonkey GM; no formal Gate",
            final,
            polls,
            dropped_trace: dropped,
            recovered_A:
              recovered?.snapshot.events.filter((e) => e.level === "A")
                .length ?? 0,
            trace,
          };
        }),
      ),
    );
  } finally {
    await second.close();
  }
}
