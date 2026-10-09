import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Only metadata is sampled. No request body, descriptor value or GM secret is read.
export async function verifyClearAll(
  page,
  output,
  name,
  { seed = false } = {},
) {
  const evidence = {
    status: "RUNNING",
    scope: "synthetic-only / official Tampermonkey",
    stages: [],
  };
  await mkdir(output, { recursive: true });
  const save = () =>
    writeFile(
      `${output}/${name}-clear-all.json`,
      JSON.stringify(evidence, null, 2),
    );
  const root = page.locator("#chatgpt-blackbox-monitor");
  const t = (key) =>
    page.evaluate((k) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(k), key);
  const click = async (key) =>
    root.getByRole("button", { name: await t(key), exact: true }).click();
  const visible = async (locator, error) => {
    assert.equal(await locator.count(), 1, `${error}: missing or ambiguous`);
    assert.equal(await locator.isVisible(), true, error);
    assert.equal(await locator.isEnabled(), true, `${error}: disabled`);
  };
  // Same complete path as refactor.mjs openSettings(), with immediate sanity
  // assertions. A visible popover does not imply that its details is open.
  const openSettings = async () => {
    if (await root.locator(".launcher").isVisible())
      await click("View details");
    if (await root.locator(".panel").isVisible())
      await click("Back to controls");
    if (!(await root.locator(".settings-popover").isVisible()))
      await click("More options");
    const menu = root.locator(".settings-popover");
    await visible(menu, "settings_popover_not_visible");
    if (!(await menu.evaluate((el) => el.open === true)))
      await menu.locator("summary").first().click();
    assert.equal(
      await menu.evaluate((el) => el.open === true),
      true,
      "settings_details_not_open",
    );
    await visible(
      root.getByLabel(await t("Language"), { exact: true }),
      "language_select_not_visible",
    );
    await visible(
      menu.getByText(await t("Data management"), { exact: true }),
      "data_management_not_reachable",
    );
    return menu;
  };
  // Same data-category navigation as refactor.mjs category(), preserving the
  // secondary details open state instead of toggling an already-open section.
  const openCategory = async (value) => {
    const nav = root.locator(`.work-nav button[data-category="${value}"]`);
    if (!(await nav.isVisible())) {
      const more = root.locator(".work-nav details");
      await visible(more, "more_evidence_not_reachable");
      if (!(await more.evaluate((el) => el.open === true)))
        await more.locator("summary").click();
    }
    await visible(nav, `category_not_visible:${value}`);
    await nav.click();
  };
  const openManagement = async () => {
    const menu = await openSettings();
    const summary = menu.getByText(await t("Data management"), { exact: true });
    const details = summary.locator("..");
    assert.equal(
      await details.evaluate((el) => el.tagName),
      "DETAILS",
      "data_management_not_details",
    );
    if (!(await details.evaluate((el) => el.open === true)))
      await summary.click();
    const clear = root.getByRole("button", {
      name: await t("Clear all"),
      exact: true,
    });
    await visible(clear, "clear_all_not_visible");
    return clear;
  };
  const send = async () => {
    const id = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        before = new Set(h.monitor.journal.ids());
      await (
        await fetch("/backend-api/f/conversation?case=p7-sse", {
          method: "POST",
          body: JSON.stringify({
            model: "gpt-5-6-thinking",
            thinking_effort: "high",
          }),
        })
      ).text();
      return h.monitor.journal
        .ids()
        .find(
          (id) =>
            !before.has(id) &&
            h.monitor.journal.snapshot(id)?.start.mode === "live",
        );
    });
    assert.ok(id, "native post creates conversation capture");
    await page.waitForFunction(
      (id) =>
        window.__BLACKBOX_SYNTHETIC__.monitor.journal
          .snapshot(id)
          ?.events.some((e) => e.field_namespace === "network.verdict"),
      id,
    );
    await page.evaluate(() =>
      window.__BLACKBOX_SYNTHETIC__.historyActions.flush(),
    );
    return id;
  };
  try {
    if (seed) {
      await page.setViewportSize({ width: 1920, height: 1080 });
      evidence.preflight = { status: "RUNNING", checks: [] };
      await openSettings();
      evidence.preflight.checks.push(
        "View details / More options / Settings.open / Language / Data management visible",
      );
      await openManagement();
      evidence.preflight.checks.push(
        "Data management.open / Clear all visible; no Clear all click",
      );
      await click("More options");
      await visible(
        root.getByRole("button", {
          name: await t("Advanced evidence"),
          exact: true,
        }),
        "advanced_evidence_not_visible",
      );
      await click("Advanced evidence");
      await visible(root.locator(".panel"), "workbench_not_visible");
      await openCategory("Experiment");
      for (const key of [
        "Create experiment",
        "Save descriptor",
        "Back to controls",
      ])
        await visible(
          root.getByRole("button", { name: await t(key), exact: true }),
          `preflight_not_visible:${key}`,
        );
      evidence.preflight.checks.push(
        "Workbench / More evidence / Experiment / Create / Save / Back visible and enabled",
      );
      await click("Back to controls");
      evidence.preflight.status = "PASS";
      await save();
      await openSettings();
      const language = root.getByLabel(await t("Language"), { exact: true });
      await language.selectOption("en-US");
      // Locale changes the aria-label; resolve the verified control again.
      await visible(
        root.getByLabel(await t("Language"), { exact: true }),
        "language_select_not_visible",
      );
      await root
        .getByLabel(await t("Language"), { exact: true })
        .selectOption("zh-CN");
      await click("More options");
      evidence.seed_capture = await send();
      await click("Advanced evidence");
      await openCategory("Experiment");
      await click("Create experiment");
      await click("Save descriptor");
      await page.waitForFunction(async () =>
        (await window.__BLACKBOX_SYNTHETIC__.history.store.keys()).some((k) =>
          k.startsWith("blackbox:experiment:"),
        ),
      );
      await click("Back to controls");
      // Exercise real UI preferences before testing preservation, without writing GM values.
      for (const surface of [".quick", ".panel"]) {
        if (surface === ".panel") await click("Advanced evidence");
        await root.locator(surface + " .scale-handle").focus();
        await page.keyboard.press(
          surface === ".quick" ? "ArrowRight" : "ArrowLeft",
        );
        const header = await root
          .locator(surface + " .surface-header>strong")
          .boundingBox();
        assert.ok(header);
        await page.mouse.move(header.x + 8, header.y + header.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          header.x - 22,
          header.y + header.height / 2 + 15,
          { steps: 8 },
        );
        await page.mouse.up();
        if (surface === ".panel") await click("Back to controls");
      }
      evidence.seed_proof = await page.evaluate(async (id) => {
        const h = window.__BLACKBOX_SYNTHETIC__,
          records = await h.history.list(),
          keys = await h.history.store.keys();
        const proof = {
          journal_present: h.monitor.journal.ids().includes(id),
          history_present: records.some((r) => r.manifest.capture_id === id),
          experiment_keys: keys.filter((k) =>
            k.startsWith("blackbox:experiment:"),
          ),
          preferences: {},
        };
        for (const key of [
          "blackbox.ui.mainScale",
          "blackbox.ui.workbenchScale",
          "blackbox.ui.main.position",
          "blackbox.ui.workbench.position",
          "blackbox.ui.locale",
        ])
          proof.preferences[key] = (await h.history.store.get(key)) ?? null;
        return proof;
      }, evidence.seed_capture);
      await save();
      assert.equal(
        evidence.seed_proof.journal_present,
        true,
        "seed_journal_missing",
      );
      assert.equal(
        evidence.seed_proof.history_present,
        true,
        "seed_history_missing",
      );
      assert.ok(
        evidence.seed_proof.experiment_keys.length > 0,
        "seed_experiment_missing",
      );
      for (const [key, value] of Object.entries(
        evidence.seed_proof.preferences,
      ))
        assert.notEqual(value, null, `seed_preference_missing:${key}`);
      evidence.seed_proof.status = "PASS";
      await save();
    }
    // Install read-only inventory sampling before the real button click. T+0 is
    // the capture-phase click observation; GM/history reads have separate timings.
    await page.evaluate(() => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const inventory = async (origin = performance.now(), target = null) => {
        const at = performance.now();
        const metadata = (s) => ({
          capture_id: s.start.capture_id,
          mode: s.start.mode,
          transport: s.start.transport,
          context: { ...s.start.context },
          lifecycle: s.controls.some((c) => c.kind === "closed")
            ? "Closed"
            : s.controls.some((c) => c.kind === "complete")
              ? "Settling"
              : "Capturing",
          reasons: s.events
            .filter(
              (e) =>
                e.field === "reason" &&
                e.field_namespace.startsWith("environment."),
            )
            .map((e) => e.value),
        });
        const select = h.ui.shadow.querySelector(
          `select[aria-label="${h.ui.i18n.t("Current capture")}"]`,
        );
        if (!select) throw Error("missing exact Current capture selector");
        const result = {
          target_ms: target,
          journal_sample_ms: at - origin,
          wall_ms: Date.now(),
          runtime: { active: h.active, context: { ...h.context } },
          journal: h.monitor.journal
            .ids()
            .map((id) => metadata(h.monitor.journal.snapshot(id))),
          selector: {
            value: select.value,
            options: [...select.options].map((o) => ({
              value: o.value,
              label: o.textContent,
            })),
            selected: h.ui.selected,
          },
        };
        result.storage_read_start_ms = performance.now() - origin;
        result.clear_epoch =
          (await h.history.store.get("blackbox:history:clear_epoch")) ??
          "initial";
        const records = await h.history.list();
        result.history = records.map((r) => ({
          ...metadata(r.snapshot),
          clear_epoch: r.manifest.clear_epoch,
          created_at: r.manifest.created_at,
        }));
        const keys = await h.history.store.keys();
        result.experiment_keys = keys.filter((k) =>
          k.startsWith("blackbox:experiment:"),
        );
        result.history_keys = keys.filter(
          (k) =>
            k.startsWith("blackbox:history:") &&
            k !== "blackbox:history:clear_epoch",
        );
        result.preferences = {};
        for (const key of [
          "blackbox.ui.mainScale",
          "blackbox.ui.workbenchScale",
          "blackbox.ui.locale",
          "blackbox.ui.position",
          "blackbox.ui.main.position",
          "blackbox.ui.workbench.position",
        ])
          result.preferences[key] = (await h.history.store.get(key)) ?? null;
        result.storage_read_end_ms = performance.now() - origin;
        return result;
      };
      window.__CLEAR_ALL_DIAGNOSTIC__ = { inventory, stages: [] };
    });
    evidence.before = await page.evaluate(() =>
      window.__CLEAR_ALL_DIAGNOSTIC__.inventory(),
    );
    if (seed) {
      assert.ok(
        evidence.before.journal.some(
          (s) => s.capture_id === evidence.seed_capture,
        ),
      );
      assert.ok(
        evidence.before.history.some(
          (s) => s.capture_id === evidence.seed_capture,
        ),
      );
      assert.ok(evidence.before.experiment_keys.length > 0);
      for (const key of [
        "blackbox.ui.mainScale",
        "blackbox.ui.workbenchScale",
        "blackbox.ui.main.position",
        "blackbox.ui.workbench.position",
      ])
        assert.notEqual(evidence.before.preferences[key], null, key);
    }
    const clear = await openManagement();
    await clear.evaluate((button) => {
      button.addEventListener(
        "click",
        () => {
          const d = window.__CLEAR_ALL_DIAGNOSTIC__;
          d.origin = performance.now();
          d.clear_wall_ms = Date.now();
          d.done = (async () => {
            for (const target of [0, 100, 500, 1500, 3000]) {
              const remaining = target - (performance.now() - d.origin);
              if (remaining > 0)
                await new Promise((resolve) => setTimeout(resolve, remaining));
              d.stages.push(await d.inventory(d.origin, target));
            }
          })();
        },
        { capture: true, once: true },
      );
    });
    page.once("dialog", (dialog) => dialog.accept());
    await clear.click();
    const sampled = await page.evaluate(async () => {
      const d = window.__CLEAR_ALL_DIAGNOSTIC__;
      await d.done;
      return { stages: d.stages, clear_wall_ms: d.clear_wall_ms };
    });
    Object.assign(evidence, sampled);
    await save();
    const before = evidence.before,
      after = evidence.stages.at(-1);
    const oldJournal = new Set(before.journal.map((s) => s.capture_id)),
      oldHistory = new Set(before.history.map((s) => s.capture_id));
    const sameContext = (s) =>
      JSON.stringify(s.context) === JSON.stringify(after.runtime.context);
    evidence.operands = {
      old_journal_removed: after.journal.every(
        (s) => !oldJournal.has(s.capture_id),
      ),
      old_history_removed: after.history.every(
        (s) => !oldHistory.has(s.capture_id),
      ),
      old_history_storage_keys_removed: before.history_keys.every(
        (k) => !after.history_keys.includes(k),
      ),
      experiments_removed: after.experiment_keys.length === 0,
      clear_epoch_changed: after.clear_epoch !== before.clear_epoch,
      context_advanced:
        after.runtime.context.epoch > before.runtime.context.epoch &&
        after.runtime.context.visit_id !== before.runtime.context.visit_id,
      new_journal_current_auxiliary:
        after.journal.length > 0 &&
        after.journal.every(
          (s) => sameContext(s) && !["live", "reload"].includes(s.mode),
        ),
      context_clear_observed: after.journal.some(
        (s) => s.mode === "environment" && s.reasons.includes("context_clear"),
      ),
      new_history_epoch_context_time: after.history.every(
        (s) =>
          s.clear_epoch === after.clear_epoch &&
          sameContext(s) &&
          s.created_at >= evidence.clear_wall_ms,
      ),
      preferences_preserved:
        JSON.stringify(after.preferences) ===
        JSON.stringify(before.preferences),
      monitor_active: after.runtime.active === true,
      selector_no_old_ids:
        after.selector.options.every((o) => !oldJournal.has(o.value)) &&
        !oldJournal.has(after.selector.selected),
    };
    evidence.classification = !evidence.operands.old_journal_removed
      ? "C2"
      : !evidence.operands.old_history_removed ||
          !evidence.operands.experiments_removed
        ? "C3"
        : !evidence.operands.preferences_preserved
          ? "C4"
          : Object.values(evidence.operands).every(Boolean)
            ? "C1"
            : "Unproven";
    await save();
    assert.equal(
      evidence.classification,
      "C1",
      JSON.stringify(evidence.operands),
    );
    evidence.post_clear_capture = await send();
    await page.waitForFunction((id) => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        s = h.ui.shadow.querySelector(
          `select[aria-label="${h.ui.i18n.t("Current capture")}"]`,
        );
      return (
        [...s.options].some((o) => o.value === id) &&
        h.ui.shadow.querySelector(".launcher").dataset.captureId === id
      );
    }, evidence.post_clear_capture);
    evidence.continuation = await page.evaluate(async (id) => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        snapshot = h.monitor.journal.snapshot(id),
        records = await h.history.list();
      const facts = snapshot.events
        .filter((e) =>
          [
            "request.model",
            "request.thinking_effort",
            "route.model_slug",
            "route.verdict",
          ].includes(e.field_namespace),
        )
        .map((e) => ({
          namespace: e.field_namespace,
          field: e.field,
          value: e.value,
        }));
      return {
        capture_id: id,
        context: snapshot.start.context,
        active: h.active,
        facts,
        events: snapshot.events
          .filter((e) => /model|thinking|verdict/.test(e.field))
          .map((e) => ({
            namespace: e.field_namespace,
            field: e.field,
            value: e.value,
          })),
        launcher: h.ui.shadow.querySelector(".launcher").textContent,
        history: records
          .filter((r) => r.manifest.capture_id === id)
          .map((r) => ({
            capture_id: r.manifest.capture_id,
            clear_epoch: r.manifest.clear_epoch,
            context: r.snapshot.start.context,
          })),
      };
    }, evidence.post_clear_capture);
    assert.ok(
      evidence.continuation.history.length === 1 &&
        evidence.continuation.history[0].clear_epoch === after.clear_epoch,
    );
    assert.deepEqual(evidence.continuation.context, after.runtime.context);
    assert.equal(evidence.continuation.active, true);
    assert.ok(
      evidence.continuation.events.some((e) => e.value === "gpt-5-6-thinking"),
    );
    assert.ok(evidence.continuation.events.some((e) => e.value === "high"));
    assert.ok(
      evidence.continuation.events.some((e) => e.value === "synthetic-route"),
    );
    assert.match(evidence.continuation.launcher, /synthetic-route/);
    evidence.status = "PASS";
    await page.screenshot({
      path: `${output}/${name}-clear-all-continuation.png`,
    });
    await save();
    return evidence;
  } catch (error) {
    evidence.status = "FAIL";
    evidence.error = String(error);
    evidence.stack = error.stack;
    await save();
    await page
      .screenshot({ path: `${output}/${name}-clear-all-failure.png` })
      .catch(() => {});
    throw error;
  }
}
