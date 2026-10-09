import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

export async function diagnoseUnknownDrift(
  page,
  output,
  name,
  { after = false } = {},
) {
  const evidence = {
    scope: "synthetic-only / official Tampermonkey",
    stage: after ? "P2 after" : "P1 before",
    samples: [],
    actions: [],
    root_cause: "Unproven",
  };
  await mkdir(`${output}/screenshots/${name}`, { recursive: true });
  const save = () =>
    writeFile(
      `${output}/${name}-unknown-drift.json`,
      JSON.stringify(evidence, null, 2),
    );
  const root = page.locator("#chatgpt-blackbox-monitor");
  const t = (key) =>
    page.evaluate((key) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(key), key);
  const click = async (key) =>
    root.getByRole("button", { name: await t(key), exact: true }).click();
  const select = async () =>
    root.getByLabel(await t("Current capture"), { exact: true });
  try {
    await page.evaluate(() => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        d = {
          counts: {
            snapshot_calls: 0,
            history_list_calls: 0,
            option_drafts: 0,
            elements_created: 0,
            mutations: 0,
            selector_mutations: 0,
            main_mutations: 0,
            long_tasks: 0,
            long_task_ms: 0,
          },
          requests: [],
          started: performance.now(),
        };
      const originalSnapshot = h.monitor.journal.snapshot.bind(
        h.monitor.journal,
      );
      d.snapshot = originalSnapshot;
      h.monitor.journal.snapshot = (...args) => {
        d.counts.snapshot_calls++;
        return originalSnapshot(...args);
      };
      const originalList = h.history.list.bind(h.history);
      d.list = originalList;
      h.history.list = (...args) => {
        d.counts.history_list_calls++;
        return originalList(...args);
      };
      const create = document.createElement.bind(document);
      document.createElement = (...args) => {
        d.counts.elements_created++;
        if (args[0] === "option") d.counts.option_drafts++;
        return create(...args);
      };
      const observer = new window.MutationObserver((records) => {
        d.counts.mutations += records.length;
        for (const record of records) {
          if (
            record.target.closest?.("select") ||
            record.target.parentElement?.closest("select")
          )
            d.counts.selector_mutations++;
          if (
            record.target.closest?.(".quick") ||
            record.target.parentElement?.closest(".quick")
          )
            d.counts.main_mutations++;
        }
      });
      observer.observe(h.ui.shadow, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
      d.observer = observer;
      try {
        d.longObserver = new window.PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            d.counts.long_tasks++;
            d.counts.long_task_ms += entry.duration;
          }
        });
        d.longObserver.observe({ type: "longtask", buffered: true });
        d.long_task_available = true;
      } catch {
        d.long_task_available = false;
      }
      window.__UNKNOWN_DIAGNOSTIC__ = d;
    });
    const send = async () => {
      const id = await page.evaluate(async () => {
        const h = window.__BLACKBOX_SYNTHETIC__,
          before = new Set(h.monitor.journal.ids());
        const response = await fetch(
          "/backend-api/f/conversation?case=ui-locale",
          {
            method: "POST",
            body: JSON.stringify({
              model: "gpt-5-6-thinking",
              thinking_effort: "high",
            }),
          },
        );
        await response.text();
        return h.monitor.journal
          .ids()
          .find(
            (id) =>
              !before.has(id) &&
              h.monitor.journal.snapshot(id)?.start.mode === "live",
          );
      });
      assert.ok(id);
      await page.waitForFunction(
        (id) =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal
            .snapshot(id)
            ?.events.some(
              (e) => e.level === "A" && e.value === "gpt-5-6-thinking",
            ),
        id,
      );
      return id;
    };
    const original = await send();
    evidence.original_capture = original;
    await click("View details");
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow
        .querySelector(".cards")
        ?.textContent.includes("gpt-5-6-thinking"),
    );
    const sample = async (label) => {
      const sample = await page.evaluate(
        async ({ original, label }) => {
          const history = await window.__UNKNOWN_DIAGNOSTIC__.list();
          const h = window.__BLACKBOX_SYNTHETIC__,
            d = window.__UNKNOWN_DIAGNOSTIC__,
            ids = h.monitor.journal.ids(),
            snapshots = ids.map(d.snapshot),
            selected = d.snapshot(h.ui.selected),
            originalSnapshot = d.snapshot(original),
            selectorLabel = h.ui.i18n.t("Current capture"),
            matches = [
              ...h.ui.shadow.querySelectorAll("select[aria-label]"),
            ].filter((el) => el.getAttribute("aria-label") === selectorLabel);
          if (matches.length !== 1)
            throw Error(`current_capture_selector_count_${matches.length}`);
          const options = matches[0];
          if (options.getAttribute("aria-label") !== selectorLabel)
            throw Error("current_capture_selector_label_mismatch");
          const optionInventory = [...options.options].map((o) => ({
            id: o.value,
            label: o.textContent,
          }));
          const selectorRect = options.getBoundingClientRect();
          const projection = (s) => {
            const last = (ns, field) =>
              s?.events
                .filter((e) => e.field_namespace === ns && e.field === field)
                .at(-1)?.value ?? "Unknown";
            return {
              requested_model: last("request", "model"),
              server_route: last("server_ste_metadata", "model_slug"),
              resolved_route: last("resolved", "resolved_model_slug"),
              thinking_effort: last("request", "thinking_effort"),
              route_verdict: s
                ? h.monitor.journal.route(s.start.capture_id, "answer").verdict
                : "Unknown",
              network_status: last("network.verdict", "status"),
              completeness: s
                ? h.monitor.journal.state(s.start.capture_id)
                : null,
            };
          };
          return {
            label,
            timestamp: new Date().toISOString(),
            monotonic_ms: performance.now(),
            current_scope: { ...h.context },
            selected: selected
              ? {
                  ...selected.start,
                  lifecycle: h.monitor.journal.state(selected.start.capture_id)
                    .lifecycle,
                }
              : null,
            projection: projection(selected),
            launcher: h.ui.shadow.querySelector(".launcher")?.textContent,
            main_projection: h.ui.shadow.querySelector(".cards")?.textContent,
            duration_state: h.ui.shadow.querySelector(".launcher")?.textContent,
            ui_selected: h.ui.selected,
            display: { ...h.ui.shadow.querySelector(".launcher").dataset },
            launcher_title: h.ui.shadow.querySelector(".launcher").title,
            main_capture: h.ui.shadow.querySelector(".quick").dataset.captureId,
            display_notice:
              h.ui.shadow.querySelector(".display-context")?.textContent,
            selector_aria_label: options.getAttribute("aria-label"),
            selector_match_count: matches.length,
            selector_visible: selectorRect.width > 0 && selectorRect.height > 0,
            selector_enabled: !options.disabled,
            selector_options: optionInventory,
            selected_option: options.value,
            selection_crosscheck: {
              selected_equals_value: (h.ui.selected ?? "") === options.value,
              selected_exists_in_options:
                h.ui.selected === null
                  ? null
                  : optionInventory.some((o) => o.id === h.ui.selected),
              null_selection_has_empty_inventory:
                h.ui.selected === null
                  ? options.value === "" && optionInventory.length === 0
                  : null,
              all_options_current_scope: optionInventory.every((o) => {
                const capture = d.snapshot(o.id);
                return (
                  capture &&
                  ["live", "reload"].includes(capture.start.mode) &&
                  capture.start.context.document_id === h.context.document_id &&
                  capture.start.context.visit_id === h.context.visit_id &&
                  capture.start.context.epoch === h.context.epoch
                );
              }),
            },
            newest_capture_id: ids.at(-1),
            newest_conversation_id: snapshots
              .filter((s) => s.start.mode === "live")
              .at(-1)?.start.capture_id,
            original: {
              in_journal: !!originalSnapshot,
              in_history: history.some(
                (r) => r.manifest.capture_id === original,
              ),
              projection: projection(originalSnapshot),
            },
            performance: {
              ...d.counts,
              journal_size: ids.length,
              history_size: history.length,
              dom_nodes: h.ui.shadow.querySelectorAll("*").length,
              long_task_available: d.long_task_available,
            },
            captures: snapshots.map((s) => ({
              id: s.start.capture_id,
              mode: s.start.mode,
              context: s.start.context,
              lifecycle: h.monitor.journal.state(s.start.capture_id).lifecycle,
              has_route: s.events.some((e) => e.level === "A"),
            })),
          };
        },
        { original, label },
      );
      evidence.samples.push(sample);
      await save();
      assert.equal(sample.selection_crosscheck.selected_equals_value, true);
      assert.equal(sample.selection_crosscheck.all_options_current_scope, true);
      if (sample.ui_selected === null)
        assert.equal(
          sample.selection_crosscheck.null_selection_has_empty_inventory,
          true,
        );
      else
        assert.equal(
          sample.selection_crosscheck.selected_exists_in_options,
          true,
        );
      return sample;
    };
    assert.equal((await sample("known-start")).selected.capture_id, original);
    await page.screenshot({
      path: `${output}/screenshots/${name}/baseline-known.png`,
    });
    let longRunReload;
    if (after) {
      await page.waitForFunction(
        (id) =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal.state(id).lifecycle ===
          "Closed",
        original,
        { timeout: 35000 }, // Production settling is 30s; allow its boundary scheduling.
      );
      evidence.closed_ready = await sample("after-closed-ready");
      await page.evaluate(() => history.replaceState({}, "", location.href));
      await page.waitForFunction(
        () => window.__BLACKBOX_SYNTHETIC__.ui.selected === null,
      );
      const scoped = await sample("after-scope-anchor");
      assert.equal(scoped.display.captureId, original);
      assert.equal(scoped.display.displaySource, "recent");
      assert.match(scoped.display_notice, /当前范围暂无捕获/);
      await page.evaluate(async () => {
        await (
          await fetch(
            "/backend-api/conversation/diagnostic-record?case=diagnostic-reload",
          )
        ).text();
      });
      await page.waitForFunction(
        () =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal.snapshot(
            window.__BLACKBOX_SYNTHETIC__.ui.selected,
          )?.start.mode === "reload",
      );
      const reloaded = await sample("after-empty-reload-anchor");
      longRunReload = reloaded.ui_selected;
      assert.equal(reloaded.display.captureId, original);
      assert.equal(reloaded.main_capture, original);
      assert.match(reloaded.launcher_title, /最近有效对话/);
      assert.equal(reloaded.projection.server_route, "Unknown");
    }
    // Keep the actual page alive for three minutes. Sampling waits are not settlement substitutes.
    const started = Date.now();
    for (let step = 0; step < 36; step++) {
      const requests = await page.evaluate(async () => {
        const h = window.__BLACKBOX_SYNTHETIC__,
          before = new Set(h.monitor.journal.ids()),
          prior = h.ui.selected;
        await (await fetch("/background-poll?case=synthetic-only")).text();
        await (
          await fetch(
            "/backend-api/sentinel/chat-requirements?case=p5-pow-confirmed",
            { method: "POST", body: "{}" },
          )
        ).text();
        return {
          timestamp: new Date().toISOString(),
          monotonic_ms: performance.now(),
          requests: [
            { category: "background", conversation: false, captured: false },
            { category: "requirements", conversation: false },
          ],
          new_captures: h.monitor.journal
            .ids()
            .filter((id) => !before.has(id))
            .map((id) => ({
              id,
              mode: h.monitor.journal.snapshot(id).start.mode,
            })),
          before_selected: prior,
        };
      });
      evidence.actions.push(requests);
      if (step === 12 && !after) {
        await (await select()).selectOption(original);
        evidence.actions.push({ category: "manual-select", id: original });
      }
      if (step === 18) await click("Close");
      if (step === 24) await click("View details");
      await page.waitForTimeout(5000);
      const s = await sample(`steady-${step}`);
      assert.equal(
        s.selected?.capture_id,
        after ? longRunReload : original,
        "normal background/requirements must not steal selected conversation",
      );
      if (after) {
        assert.equal(s.display.captureId, original);
        assert.equal(s.main_capture, original);
        assert.match(s.launcher, /5-6-thinking/);
      }
      assert.equal(
        s.original.projection.server_route,
        "gpt-5-6-thinking",
        "close must retain route fact",
      );
    }
    evidence.long_run_ms = Date.now() - started;
    const closed = await sample("closed-after-longrun");
    assert.equal(closed.original.projection.completeness.lifecycle, "Closed");
    assert.equal(closed.original.in_history, true);
    // Test reload autoselection in the same scope, without writing monitor state.
    const fresh = await send();
    await click("Close");
    await page.evaluate(() => history.replaceState({}, "", location.href));
    await page.waitForTimeout(1100);
    const scope = await sample("same-url-replaceState");
    assert.equal(scope.selected, null);
    if (after) {
      assert.equal(scope.display.captureId, fresh);
      assert.equal(scope.display.displaySource, "recent");
    }
    assert.equal(scope.original.in_journal, true);
    assert.equal(scope.original.in_history, true);
    await page.screenshot({
      path: `${output}/screenshots/${name}/scope-unknown.png`,
    });
    const newCurrent = await send();
    await page.waitForFunction(
      (id) => window.__BLACKBOX_SYNTHETIC__.ui.selected === id,
      newCurrent,
    );
    await page.evaluate(async () => {
      await (
        await fetch(
          "/backend-api/conversation/diagnostic-record?case=diagnostic-reload",
        )
      ).text();
    });
    await page.waitForTimeout(1100);
    const reload = await sample("supported-reload-autoselection");
    assert.equal(reload.selected.mode, "reload");
    assert.equal(reload.projection.server_route, "Unknown");
    if (after) {
      assert.equal(reload.display.captureId, newCurrent);
      assert.equal(reload.main_capture, newCurrent);
    }
    await click("View details");
    if (after) {
      await (await select()).selectOption(reload.ui_selected);
      const explicitEmpty = await sample("manual-empty-reload-honest");
      assert.equal(explicitEmpty.main_capture, reload.ui_selected);
      assert.equal(explicitEmpty.projection.server_route, "Unknown");
      assert.equal(explicitEmpty.display.displaySource, "current");
      assert.doesNotMatch(explicitEmpty.main_projection, /gpt-5-6-thinking/);
    }
    await (await select()).selectOption(newCurrent);
    await page.evaluate(async () => {
      await (
        await fetch(
          "/backend-api/conversation/diagnostic-record?case=diagnostic-reload",
        )
      ).text();
    });
    await page.waitForTimeout(1100);
    const manual = await sample("manual-selection-reload-protected");
    assert.equal(manual.selected.capture_id, newCurrent);
    evidence.controls = {
      normal_auxiliary: "does not steal",
      closed_projection: "preserved",
      persisted_history: "preserved",
      same_url_scope_change: "reproduces Unknown",
      supported_reload: "reproduces auto-selection Unknown",
      manual_selection: "protected",
      fresh,
      newCurrent,
    };
    evidence.root_cause =
      "Combination A (supported route-empty reload only) + C (scope transition); B/D excluded in sampled scenario";
    evidence.status = after ? "P2_LONGRUN_PASS" : "DIAGNOSTIC_COMPLETED";
    await save();
    return {
      status: evidence.status,
      root_cause: evidence.root_cause,
      long_run_ms: evidence.long_run_ms,
      samples: evidence.samples.length,
      file: `${name}-unknown-drift.json`,
    };
  } catch (error) {
    evidence.status = "DIAGNOSTIC_FAIL";
    evidence.error = String(error);
    await save();
    throw error;
  }
}
