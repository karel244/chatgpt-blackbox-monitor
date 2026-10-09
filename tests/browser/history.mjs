import assert from "node:assert/strict";
export async function verifyHistory(page, context, options = {}) {
  const second = await context.newPage();
  let results = [];
  const stages = {};
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
    const capture = async (tab) =>
      tab.evaluate(async ({ diagnosticOnly = false }) => {
        const h = window.__BLACKBOX_SYNTHETIC__;
        const testStarted = performance.now();
        const fingerprint = async (value) =>
          [
            ...new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(JSON.stringify(value)),
              ),
            ),
          ]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
        const persistentFingerprint = async () => {
          const entries = [];
          for (const key of (await h.history.store.keys()).sort())
            entries.push([
              key,
              await fingerprint(await h.history.store.get(key)),
            ]);
          return fingerprint(entries);
        };
        const r = await fetch("/backend-api/f/conversation?case=p7-sse", {
          method: "POST",
          body: JSON.stringify({
            model: "synthetic-route",
            thinking_effort: "high",
            messages: [{ content: "PRIVATE_HISTORY_PROMPT_CANARY" }],
          }),
        });
        await r.text();
        const id = h.monitor.journal
          .ids()
          .filter((id) => h.monitor.journal.snapshot(id).start.mode === "live")
          .at(-1);
        const deadline = performance.now() + 10000;
        let found;
        while (performance.now() < deadline) {
          await h.historyActions.flush();
          found = (await h.history.list()).find(
            (x) => x.manifest.capture_id === id,
          );
          if (found?.snapshot.events.some((e) => e.level === "A")) break;
          await new Promise((r) => setTimeout(r, 0));
        }
        if (!found?.snapshot.events.some((e) => e.level === "A")) {
          const keys = await h.history.store.keys();
          const m = await h.history.store.get(h.history.key(id) + ":manifest");
          const s = h.monitor.journal.snapshot(id);
          return {
            failed: "history_settlement_deadline",
            diagnostic: {
              capture_id: id,
              writer_id: h.history.writer_id,
              document_id: h.context.document_id,
              journal_count: s?.events.length ?? 0,
              journal_A: s?.events.filter((e) => e.level === "A").length ?? 0,
              health: { ...h.history.health },
              queued: [...h.history.pending.values()],
              position: h.history.positions.get(id) ?? 0,
              failed_current: h.history.failed.has(id),
              epoch: h.history.epoch,
              GM_history_key_count: keys.filter((k) =>
                k.startsWith("blackbox:history:"),
              ).length,
              current_capture_key_count: keys.filter((k) => k.includes(id))
                .length,
              manifest: m
                ? {
                    exists: true,
                    committed_sequence: m.committed_sequence,
                    chunks: m.chunks.length,
                    count: m.count,
                    status: m.status,
                    notes: m.notes,
                  }
                : { exists: false },
              recovered_A:
                found?.snapshot.events.filter((e) => e.level === "A").length ??
                0,
              elapsed_deadline_ms: performance.now() - deadline + 10000,
            },
          };
        }
        const exported = await h.bundle.export(id),
          imported = await h.bundle.import(exported.bytes);
        const store = h.history.store;
        const originalSet = store.set,
          originalDelete = store.delete,
          originalFlush = h.history.flush;
        let mutations = 0,
          flushRuns = 0;
        store.set = async (...args) => {
          mutations++;
          return originalSet.apply(store, args);
        };
        store.delete = async (...args) => {
          mutations++;
          return originalDelete.apply(store, args);
        };
        h.history.flush = async (...args) => {
          flushRuns++;
          return originalFlush.apply(h.history, args);
        };
        const beforeRecords = await h.history.list();
        const stored = JSON.stringify(beforeRecords);
        const persistentBefore = await persistentFingerprint();
        const mutationsBeforeImport = mutations;
        let malformedRejected = false;
        try {
          await h.bundle.import(new Uint8Array([1, 2, 3]));
        } catch {
          malformedRejected = true;
        }
        const importMutations = mutations - mutationsBeforeImport;
        const afterRecords = await h.history.list();
        const after = JSON.stringify(afterRecords);
        const persistentAfter = await persistentFingerprint();
        const differences = [];
        const compare = (a, b, path = "history") => {
          if (
            JSON.stringify(a) === JSON.stringify(b) ||
            differences.length >= 128
          )
            return;
          if (a && b && typeof a === "object" && typeof b === "object") {
            for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
              compare(a[key], b[key], path + "." + key);
          } else differences.push(path);
        };
        compare(beforeRecords, afterRecords);
        let quiesced = null;
        if (h.historyTestHooks) {
          h.historyTestHooks.suspend();
          await h.historyActions.flush();
          const settledMutations = mutations;
          const storeBefore = await persistentFingerprint();
          const first = await h.history.list();
          const validBefore = mutations;
          await h.bundle.import(exported.bytes);
          const validMutations = mutations - validBefore;
          let rejected = false;
          try {
            await h.bundle.import(new Uint8Array([1, 2, 3]));
          } catch {
            rejected = true;
          }
          const malicious = exported.bytes.slice();
          malicious[40] ^= 1;
          let maliciousRejected = false;
          try {
            await h.bundle.import(malicious);
          } catch {
            maliciousRejected = true;
          }
          const second = await h.history.list();
          const storeAfter = await persistentFingerprint();
          quiesced = {
            valid_import_mutations: validMutations,
            malicious_import_rejected: maliciousRejected,
            malformed_import_rejected: rejected,
            mutations: mutations - settledMutations,
            store_before: storeBefore,
            store_after: storeAfter,
            store_unchanged: storeBefore === storeAfter,
            list_equal: JSON.stringify(first) === JSON.stringify(second),
            before_controls: first.map((r) => ({
              capture_id: r.manifest.capture_id,
              controls: r.snapshot.controls,
            })),
            after_controls: second.map((r) => ({
              capture_id: r.manifest.capture_id,
              controls: r.snapshot.controls,
            })),
          };
          h.historyTestHooks.resume();
        }
        store.set = originalSet;
        store.delete = originalDelete;
        h.history.flush = originalFlush;
        const environmentRelated = imported.related.filter(
          (s) => s.start.mode === "environment",
        );
        const legacyNoWrite = stored === after;
        return {
          id,
          document: h.context.document_id,
          writer: found.manifest.writer_id,
          manifest: exported.manifest,
          route: imported.summary.route_verdict,
          related: imported.related.map((s) => ({
            mode: s.start.mode,
            levels: [...new Set(s.events.map((e) => e.level))],
          })),
          history_count: (await h.history.list()).length,
          chunk_count: found.manifest.chunks.length,
          committed: found.manifest.committed_sequence,
          route_actual_ok:
            imported.summary.route_verdict.actual_route === "synthetic-route",
          route_verdict_ok:
            imported.summary.route_verdict.verdict === "Route Match",
          writer_matches_document:
            found.manifest.writer_id === h.context.document_id,
          chunk_count_positive: found.manifest.chunks.length > 0,
          committed_equals_chunk_count:
            found.manifest.committed_sequence === found.manifest.chunks.length,
          canary_absent:
            !stored.includes("PRIVATE_HISTORY_PROMPT_CANARY") &&
            !new TextDecoder()
              .decode(exported.bytes)
              .includes("PRIVATE_HISTORY_PROMPT_CANARY"),
          malformed_import_rejected: malformedRejected,
          import_did_not_write: diagnosticOnly
            ? legacyNoWrite
            : !!quiesced &&
              quiesced.malformed_import_rejected &&
              quiesced.malicious_import_rejected &&
              quiesced.valid_import_mutations === 0 &&
              quiesced.mutations === 0 &&
              quiesced.store_unchanged,
          legacy_list_equality: legacyNoWrite,
          stable_recovery: !!quiesced && quiesced.list_equal,
          declared_redaction_not_corruption:
            !found.notes.includes("sequence_gap") &&
            !found.snapshot.controls.some(
              (c) => c.code === "storage_recovery_gap",
            ),
          environment_related_present: environmentRelated.length > 0,
          environment_current_document_epoch:
            environmentRelated.length > 0 &&
            environmentRelated.every(
              (s) =>
                s.start.context.document_id ===
                  imported.snapshot.start.context.document_id &&
                s.start.context.epoch === imported.snapshot.start.context.epoch,
            ),
          environment_related_levels_only_E:
            environmentRelated.length > 0 &&
            environmentRelated.every((s) =>
              s.events.every((e) => e.level === "E"),
            ),
          history_before_fingerprint: await fingerprint(beforeRecords),
          history_after_fingerprint: await fingerprint(afterRecords),
          persistent_store_before_fingerprint: persistentBefore,
          persistent_store_after_fingerprint: persistentAfter,
          history_before_notes: beforeRecords.map((r) => ({
            capture_id: r.manifest.capture_id,
            notes: r.notes,
          })),
          history_after_notes: afterRecords.map((r) => ({
            capture_id: r.manifest.capture_id,
            notes: r.notes,
          })),
          history_before_controls: beforeRecords.map((r) => ({
            capture_id: r.manifest.capture_id,
            controls: r.snapshot.controls,
          })),
          history_after_controls: afterRecords.map((r) => ({
            capture_id: r.manifest.capture_id,
            controls: r.snapshot.controls,
          })),
          history_difference_fields: differences,
          manifest_status: found.manifest.status,
          manifest_notes: found.manifest.notes,
          recovery_notes: found.notes,
          recovered_completeness: found.completeness,
          storage_redaction_drop: found.snapshot.controls.some(
            (c) => c.code === "storage_redaction_drop",
          ),
          storage_recovery_gap: found.snapshot.controls.some(
            (c) => c.code === "storage_recovery_gap",
          ),
          import_storage_mutations: importMutations,
          auto_flush_window_runs: flushRuns,
          quiesced,
          test_elapsed_ms: performance.now() - testStarted,
        };
      }, options);
    results = await Promise.all([capture(page), capture(second)]);
    if (options.diagnosticOnly) return { diagnostic_only: true, results };
    if (results.some((r) => r.failed)) {
      const error = Error("history_settlement_deadline");
      error.diagnostic = results;
      throw error;
    }
    try {
      for (const r of results)
        for (const name of [
          "route_actual_ok",
          "route_verdict_ok",
          "writer_matches_document",
          "chunk_count_positive",
          "committed_equals_chunk_count",
          "canary_absent",
          "malformed_import_rejected",
          "import_did_not_write",
          "environment_related_present",
          "environment_related_levels_only_E",
          "environment_current_document_epoch",
          "stable_recovery",
          "declared_redaction_not_corruption",
        ])
          assert.equal(r[name], true, "P7 " + name);
    } catch (error) {
      error.diagnostic = { results };
      throw error;
    }
    stages.independent_writers = results[0].writer !== results[1].writer;
    assert.equal(stages.independent_writers, true, "P7 independent_writers");
    stages.independent_capture_ids = results[0].id !== results[1].id;
    assert.equal(
      stages.independent_capture_ids,
      true,
      "P7 independent_capture_ids",
    );
    const epoch = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      await h.historyActions.clearAll();
      return h.history.store.get("blackbox:history:clear_epoch");
    });
    const late = await second.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      await h.historyActions.flush();
      const records = await h.history.list();
      return {
        ids: records.map((r) => r.manifest.capture_id),
        epoch: await h.history.store.get("blackbox:history:clear_epoch"),
      };
    });
    stages.clear_epoch_propagated = late.epoch === epoch;
    assert.equal(
      stages.clear_epoch_propagated,
      true,
      "P7 clear_epoch_propagated",
    );
    assert.equal(
      late.ids.includes(results[0].id),
      false,
      "P7 old_tab1_capture_not_restored",
    );
    assert.equal(
      late.ids.includes(results[1].id),
      false,
      "P7 old_tab2_capture_not_restored",
    );
    const resumed = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      h.pause();
      const paused = await h.history.list();
      h.resume();
      const r = await fetch("/backend-api/f/conversation?case=p7-sse", {
        method: "POST",
        body: JSON.stringify({ model: "synthetic-route" }),
      });
      await r.text();
      const id = h.monitor.journal
        .ids()
        .filter(
          (id) =>
            h.monitor.journal.snapshot(id).start.mode === "live" &&
            id !== undefined,
        )
        .at(-1);
      const deadline = performance.now() + 10000;
      let records = [];
      while (performance.now() < deadline) {
        await h.historyActions.flush();
        records = await h.history.list();
        if (
          records.some(
            (r) =>
              r.manifest.capture_id === id &&
              r.snapshot.events.some((e) => e.level === "A"),
          )
        )
          break;
        await new Promise((r) => setTimeout(r, 0));
      }
      return {
        paused_count: paused.length,
        new_saved: records.some((r) => r.manifest.capture_id === id),
        storage: h.history.health,
      };
    });
    stages.resume_saved = resumed.new_saved;
    assert.equal(stages.resume_saved, true, "P7 resume_saved");
    return {
      results,
      stages,
      clear_epoch_same_profile: true,
      late_old_capture_not_restored: true,
      resumed,
      scope:
        "actual GM normal persistence and independent two-tab namespace; quota/interruption/migration are deterministic Store fault fixtures in Node integration",
    };
  } catch (error) {
    error.diagnostic = { ...(error.diagnostic ?? {}), results, stages };
    throw error;
  } finally {
    await second.close();
  }
}
