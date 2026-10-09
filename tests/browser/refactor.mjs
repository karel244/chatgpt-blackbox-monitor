import { optionInventory } from "./option-inventory.mjs";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
export async function verifyUI(
  page,
  context,
  output,
  name,
  { optionDiagnostic = false } = {},
) {
  const evidence = {
    scope: "official TM, synthetic only, full refactored UI Gate",
    steps: [],
  };
  const save = () =>
    writeFile(
      `${output}/${name}-refactor.json`,
      JSON.stringify(evidence, null, 2),
    );
  const step = (label, value = true) => evidence.steps.push({ label, value });
  const root = page.locator("#chatgpt-blackbox-monitor");
  const ready = () =>
    page.waitForFunction(
      () => !!window.__BLACKBOX_SYNTHETIC__?.ui?.host.isConnected,
    );
  const t = (key) =>
    page.evaluate((key) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(key), key);
  const button = async (key) =>
    root.getByRole("button", { name: await t(key), exact: true });
  const screenshotDir = `${output}/screenshots/${name}`;
  await mkdir(screenshotDir, { recursive: true });
  const shot = async (file) =>
    page.screenshot({ path: `${screenshotDir}/${file}.png` });
  const openSettings = async () => {
    if (await root.locator(".launcher").isVisible())
      await (await button("View details")).click();
    if (await root.locator(".panel").isVisible())
      await (await button("Back to controls")).click();
    if (!(await root.locator(".settings-popover").isVisible()))
      await (await button("More options")).click();
    const menu = root.locator(".settings-popover");
    if (!(await menu.evaluate((el) => el.open === true)))
      await menu.locator("summary").first().click();
  };
  const verifyHeader = async (locale) => {
    const icons = root.locator(".main-title .icon");
    assert.deepEqual(await icons.allTextContents(), ["···", "×"]);
    const accessibleNames = await icons.evaluateAll((buttons) =>
      buttons.map((el) => ({
        name: el.getAttribute("aria-label"),
        title: el.title,
        icon_count: el.querySelectorAll('span[aria-hidden="true"]').length,
        pseudo_content: window.getComputedStyle(el, "::after").content,
      })),
    );
    const labels = [await t("More options"), await t("Close")];
    assert.deepEqual(
      accessibleNames.map((b) => b.name),
      labels,
    );
    assert.deepEqual(
      accessibleNames.map((b) => b.title),
      labels,
    );
    assert.ok(accessibleNames.every((b) => b.icon_count === 1));
    assert.ok(
      accessibleNames.every((b) =>
        ["none", "normal"].includes(b.pseudo_content),
      ),
    );
    const focus = await root.locator(".cards").evaluate((el) => ({
      style: window.getComputedStyle(el).outlineStyle,
      width: window.getComputedStyle(el).outlineWidth,
      focused: el.getRootNode().activeElement === el,
    }));
    // Chrome retains medium=3px in CSSOM even when outline-style:none paints none.
    assert.equal(focus.style, "none");
    if (locale === "zh-CN") assert.equal(focus.focused, true);
    step("icon_only_accessibility_and_cards_focus", {
      locale,
      accessibleNames,
      focus,
    });
  };
  const click = async (key) => {
    if (key === "Hide") await openSettings();
    if (
      ["Pause", "Resume"].includes(key) &&
      (await root.locator(".launcher").isVisible())
    )
      await (await button("View details")).click();
    await (await button(key)).click();
  };
  const advanced = async () => {
    await click("View details");
    await click("Advanced evidence");
  };
  const category = async (value) => {
    const nav = root.locator(`.work-nav button[data-category="${value}"]`);
    if (!(await nav.isVisible()))
      await root.locator(".work-nav details summary").click();
    await nav.click();
  };
  const send = async (count = 1) =>
    page.evaluate(async (count) => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        before = new Set(h.monitor.journal.ids());
      for (let i = 0; i < count; i++) {
        const r = await fetch("/backend-api/f/conversation?case=ui-locale", {
          method: "POST",
          body: JSON.stringify({
            model: "gpt-5-6-thinking",
            thinking_effort: "high",
            messages: [{ content: "SECRET_UI_REFACTOR_PROMPT" }],
          }),
        });
        await r.text();
      }
      return h.monitor.journal
        .ids()
        .filter(
          (id) =>
            !before.has(id) &&
            h.monitor.journal.snapshot(id).start.mode === "live",
        );
    }, count);
  try {
    await page.goto("http://127.0.0.1:43997/");
    await ready();
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.i18n.locale),
      "zh-CN",
    );
    const initial = {
      launcher: await root.locator(".launcher").isVisible(),
      main: await root.locator(".quick").isVisible(),
      workbench: await root.locator(".panel").isVisible(),
      restore: await root.locator(".restore").isVisible(),
      select: await root
        .getByLabel(await t("Current capture"), { exact: true })
        .isVisible(),
    };
    assert.deepEqual(initial, {
      launcher: true,
      main: false,
      workbench: false,
      restore: false,
      select: false,
    });
    const launcherBox = await root.locator(".launcher").boundingBox();
    assert.ok(
      launcherBox.width >= 260 &&
        launcherBox.width <= 420 &&
        launcherBox.height >= 34 &&
        launcherBox.height <= 44,
    );
    await shot("initial-launcher");
    step("initial_launcher_only_default_gate", { initial, launcherBox });
    assert.equal(
      await root
        .getByRole("button", { name: /^(移动|重置位置|Move|Reset position)$/ })
        .count(),
      0,
    );
    assert.equal(await root.locator(".quick").isVisible(), false);
    const original = await root.locator(".launcher").boundingBox(),
      title = root.locator(".title");
    const box = await title.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(240, 100, { steps: 8 });
    await page.mouse.up();
    const moved = await root.locator(".launcher").boundingBox();
    assert.ok(Math.abs(moved.x - original.x) > 50);
    assert.equal(await root.locator(".quick").isVisible(), false);
    const stored = await page.evaluate(async () =>
      window.__BLACKBOX_SYNTHETIC__.history.store.get("blackbox.ui.position"),
    );
    assert.ok(
      Math.abs(stored.x - moved.x) < 2 && Math.abs(stored.y - moved.y) < 2,
    );
    assert.equal(
      await page.evaluate(() => window.getSelection().toString()),
      "",
    );
    await page.reload();
    await ready();
    const reloaded = await root.locator(".launcher").boundingBox();
    assert.ok(
      Math.abs(reloaded.x - moved.x) < 2 && Math.abs(reloaded.y - moved.y) < 2,
    );
    step("daily_title_pointer_drag_persistence_no_selection_no_move_reset", {
      original,
      moved,
      stored,
      reloaded,
    });

    const initialContext = await page.evaluate(() => ({
      ...window.__BLACKBOX_SYNTHETIC__.context,
    }));
    const ids = await send(22);
    assert.equal(ids.length, 22);
    await page.waitForFunction(
      (ids) =>
        ids.every(
          (id) =>
            window.__BLACKBOX_SYNTHETIC__.monitor.journal.state(id)
              .lifecycle === "Closed",
        ),
      ids,
      { timeout: 35000 },
    );
    await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
    const raw = await page.evaluate(async (id) => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      return {
        snapshot: h.monitor.journal.snapshot(id),
        summary: (await h.bundle.export(id)).summary,
      };
    }, ids.at(-1));
    // The machine snapshot is compared separately from live DOM/UI state.
    let captureBefore = await page.evaluate(
      (id) => window.__BLACKBOX_SYNTHETIC__.monitor.journal.snapshot(id),
      ids.at(-1),
    );
    await click("View details");
    assert.equal(
      await root
        .getByLabel(await t("Quick controls"), { exact: true })
        .isVisible(),
      true,
    );
    const mainBox = await root.locator(".quick").boundingBox();
    assert.ok(
      Math.abs(mainBox.width - 460) < 2 && Math.abs(mainBox.height - 560) < 2,
    );
    assert.equal(await root.locator(".launcher").isVisible(), false);
    assert.equal(await root.locator(".panel").isVisible(), false);
    await verifyHeader("zh-CN");
    await shot("main-panel-overview");
    step("independent_main_size_mutual_exclusion", mainBox);
    const menu = root.locator(".settings-popover");
    const menuState = () =>
      menu.evaluate((el) => ({
        open: el.open,
        attribute: el.getAttribute("open"),
      }));
    const helperCases = [];
    assert.equal((await menuState()).open, false);
    await openSettings();
    assert.equal((await menuState()).open, true);
    helperCases.push({ case: "A_closed", after: await menuState() });
    await openSettings();
    assert.equal((await menuState()).open, true);
    helperCases.push({ case: "B_already_open", after: await menuState() });
    await shot("main-panel-settings");
    await click("Close");
    assert.equal(await root.locator(".launcher").isVisible(), true);
    await openSettings();
    assert.equal(await root.locator(".quick").isVisible(), true);
    assert.equal((await menuState()).open, true);
    helperCases.push({ case: "C_from_launcher", after: await menuState() });
    await click("Advanced evidence");
    assert.equal(await root.locator(".panel").isVisible(), true);
    await openSettings();
    assert.equal(await root.locator(".panel").isVisible(), false);
    assert.equal(await root.locator(".quick").isVisible(), true);
    assert.equal((await menuState()).open, true);
    helperCases.push({ case: "D_from_workbench", after: await menuState() });
    await click("More options");
    assert.equal(await menu.isVisible(), false);
    await (await button("More options")).focus();
    await page.keyboard.press("Tab");
    const controlFocus = await (
      await button("Close")
    ).evaluate((el) => ({
      focused: el.getRootNode().activeElement === el,
      outline: window.getComputedStyle(el).outlineStyle,
      width: window.getComputedStyle(el).outlineWidth,
    }));
    assert.equal(controlFocus.focused, true);
    assert.equal(controlFocus.outline, "solid");
    assert.equal(controlFocus.width, "2px");
    step("openSettings_closed_already_open_launcher_workbench_regression", {
      helperCases,
      controlFocus,
    });
    assert.deepEqual(
      await root.locator('.tabs [role="tab"]').allTextContents(),
      ["路由", "网络", "环境", "历史"],
    );
    for (const key of ["Route", "Network", "Environment"]) {
      await root.getByRole("tab", { name: await t(key), exact: true }).click();
      assert.ok((await root.locator(".card").count()) > 0);
      if (key === "Route") await shot("main-panel-route");
    }
    await root
      .getByRole("tab", { name: await t("History"), exact: true })
      .click();
    await root.locator(".history-row").first().waitFor();
    assert.equal(await root.locator(".history-row").count(), 20);
    await shot("main-panel-history");
    const oldWait = page.waitForEvent("download");
    await root.locator(".history-row button").first().click();
    await (await oldWait).saveAs(`${output}/${name}-recent-history.zip`);
    step("four_quick_tabs_twenty_recent_history_real_export", true);
    await click("Pause");
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.active),
      false,
    );
    assert.match(
      await root.locator(".launcher").getAttribute("data-capture-health"),
      /已暂停/,
    );
    await click("Hide");
    assert.equal(await root.locator(".launcher").isVisible(), false);
    assert.equal(await root.locator(".quick").isVisible(), false);
    assert.equal(await root.locator(".panel").isVisible(), false);
    await shot("edge-restore");
    const handle = root.locator(".restore"),
      handleBox = await handle.boundingBox();
    assert.ok(handleBox.width <= 20 && handleBox.height <= 32);
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.active),
      false,
    );
    await handle.click();
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.active),
      false,
    );
    await click("Resume");
    await click("Close");
    const beforeHide = await root.locator(".launcher").boundingBox();
    await click("View details");
    await click("Hide");
    const hiddenIds = await send();
    assert.equal(hiddenIds.length, 1);
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.active),
      true,
    );
    const transparency = await page.evaluate(() => {
      const ui = window.__BLACKBOX_SYNTHETIC__.ui,
        el = document.createElement("button");
      el.id = "fixture-underlay";
      el.textContent = "underlay";
      Object.assign(el.style, {
        position: "fixed",
        left: "150px",
        top: "450px",
        width: "100px",
        height: "35px",
      });
      document.body.append(el);
      el.onclick = () => (el.dataset.clicked = "yes");
      const b = ui.shadow.querySelector(".restore").getBoundingClientRect();
      return {
        host_pointer: window.getComputedStyle(ui.host).pointerEvents,
        handle_hit:
          document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) ===
          ui.host,
        adjacent_hit_not_monitor:
          document.elementFromPoint(
            b.x < 20 ? b.right + 20 : b.left - 20,
            b.y + 10,
          ) !== ui.host,
      };
    });
    await page.locator("#fixture-underlay").click();
    assert.equal(
      await page.locator("#fixture-underlay").getAttribute("data-clicked"),
      "yes",
    );
    assert.equal(transparency.host_pointer, "none");
    assert.ok(transparency.handle_hit && transparency.adjacent_hit_not_monitor);
    await handle.click();
    const restored = await root.locator(".launcher").boundingBox();
    assert.ok(
      Math.abs(beforeHide.x - restored.x) < 2 &&
        Math.abs(beforeHide.y - restored.y) < 2,
    );
    step(
      "Hide_not_Pause_capture_continues_tiny_edge_restore_exact_position_noninterference",
      { handleBox, beforeHide, restored, transparency },
    );

    await openSettings();
    const settings = root.locator(".settings-popover");
    captureBefore = await page.evaluate(
      (id) => window.__BLACKBOX_SYNTHETIC__.monitor.journal.snapshot(id),
      ids.at(-1),
    );
    let http = 0;
    const listener = (r) => {
      if (r.url().startsWith("http")) http++;
    };
    page.on("request", listener);
    await root
      .getByLabel(await t("Language"), { exact: true })
      .selectOption("en-US");
    assert.equal(
      await root.locator(".tabs").textContent(),
      "RouteNetworkEnvironmentHistory",
    );
    await verifyHeader("en-US");
    assert.equal(http, 0);
    page.off("request", listener);
    const captureAfter = await page.evaluate(
      (id) => window.__BLACKBOX_SYNTHETIC__.monitor.journal.snapshot(id),
      ids.at(-1),
    );
    assert.deepEqual(captureAfter, captureBefore);
    await root.getByText("Data management", { exact: true }).click();
    const epoch = await page.evaluate(
      () => window.__BLACKBOX_SYNTHETIC__.history.epoch,
    );
    page.once("dialog", async (d) => {
      assert.equal(d.type(), "confirm");
      await d.dismiss();
    });
    await click("Clear all");
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.history.epoch),
      epoch,
    );
    page.once("dialog", async (d) => {
      assert.equal(d.type(), "confirm");
      await d.dismiss();
    });
    await click("Clear history");
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.history.epoch),
      epoch,
    );
    const storeKeys = await page.evaluate(async () =>
      window.__BLACKBOX_SYNTHETIC__.history.store.keys(),
    );
    assert.ok(
      storeKeys.includes("blackbox.ui.locale") &&
        storeKeys.includes("blackbox.ui.position"),
    );
    const diagnostics = settings.locator("details").nth(1);
    await diagnostics.locator("summary").click();
    await click("Check hook health");
    const downloadWait = page.waitForEvent("download");
    await click("Export ZIP");
    const zip = `${output}/${name}-refactor-current.zip`;
    await (await downloadWait).saveAs(zip);
    step(
      "i18n_exact_capture_invariance_zero_HTTP_confirm_cancel_preferences_diagnostics_export",
      { events: captureAfter.events.length, storeKeys, zip },
    );

    const optionRecord = await optionInventory(page, output, name, {
      ids,
      hiddenIds,
      initialContext,
    });
    if (optionDiagnostic) {
      evidence.status = "DIAGNOSTIC_COMPLETED";
      evidence.option_inventory = optionRecord;
      await save();
      return { evidence };
    }
    assert.equal(optionRecord.classification, "C");
    assert.equal(optionRecord.projection_equals_options, true);
    assert.equal(optionRecord.targets[0].recovered_record_exists, true);
    assert.equal(optionRecord.targets[0].projected_current, false);
    const selectorIds = await send(2);
    assert.equal(selectorIds.length, 2);
    await page.waitForFunction(
      (ids) =>
        ids.every((id) =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal
            .snapshot(id)
            ?.events.some((e) => e.level === "A"),
        ),
      selectorIds,
    );
    await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
    const freshRecord = await optionInventory(page, output, name + "-fresh", {
      ids: selectorIds,
      hiddenIds,
      initialContext: optionRecord.current_context,
    });
    assert.equal(freshRecord.projection_equals_options, true);
    for (const target of freshRecord.targets) {
      assert.equal(target.snapshot_exists, true);
      assert.equal(target.mode, "live");
      assert.deepEqual(target.context, freshRecord.current_context);
      assert.equal(target.projected_current, true);
      assert.equal(target.selector_has_option, true);
    }
    const shared = root.getByLabel("Current capture", { exact: true });
    assert.equal(await shared.count(), 1);
    assert.equal(await shared.isVisible(), true);
    await shared.selectOption(selectorIds[0]);
    await click("Advanced evidence");
    assert.equal(await shared.isVisible(), true);
    assert.equal(await root.locator(".quick").isVisible(), false);
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.selected),
      selectorIds[0],
    );
    await shared.selectOption(selectorIds[1]);
    await click("Close");
    await click("View details");
    assert.equal(await shared.inputValue(), selectorIds[1]);
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.selected),
      selectorIds[1],
    );
    await click("Advanced evidence");
    step(
      "shared_context_single_node_Quick_to_Advanced_to_Quick_selection_preserved",
      true,
    );
    assert.equal(
      await root.getByLabel("Forensic evidence", { exact: true }).isVisible(),
      true,
    );
    await category("Timeline");
    const workbenchBox = await root.locator(".panel").boundingBox();
    assert.ok(
      Math.abs(workbenchBox.width - 960) < 2 &&
        Math.abs(workbenchBox.height - 680) < 2,
    );
    assert.equal(await root.locator(".quick").isVisible(), false);
    assert.equal(await root.locator(".launcher").isVisible(), false);
    assert.equal(await root.locator(".work-nav > button").count(), 8);
    await shot("workbench-timeline");
    step("independent_nonmodal_workbench_size_navigation", workbenchBox);
    const manual = await send(2);
    await page.waitForFunction(
      (ids) =>
        ids.every((id) =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal
            .snapshot(id)
            .events.some((e) => e.level === "A"),
        ),
      manual,
    );
    await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
    await root
      .getByLabel("Current capture", { exact: true })
      .selectOption(manual[0]);
    await page.evaluate((id) => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        e = h.monitor.journal.snapshot(id).events.find((e) => e.level === "A");
      h.monitor.journal.append({ ...e, value: "late-route" });
      h.ui.render();
    }, manual[1]);
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.selected),
      manual[0],
    );
    await page.evaluate((id) => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        e = h.monitor.journal.snapshot(id).events.find((e) => e.level === "A");
      for (let i = 0; i < 120; i++)
        h.monitor.journal.append({ ...e, value: i % 2 ? "one" : "two" });
      h.ui.render();
    }, manual[0]);
    await click("Next page");
    assert.match(
      await root.getByLabel("Evidence content", { exact: true }).textContent(),
      /2/,
    );
    step(
      "manual_capture_late_event_no_focus_steal_timeline_pagination",
      manual,
    );

    assert.ok((await root.locator("article[data-event-id]").count()) <= 50);
    assert.equal(await root.locator("article details[open]").count(), 0);
    await root.locator("article summary").first().click();
    assert.equal(await root.locator("article details[open]").count(), 1);
    for (const value of [
      "A/B/C/D",
      "Network / Cloudflare / PoW / IP",
      "Environment / Frontend Build",
      "Capture Health / Storage",
      "Redaction preview",
    ]) {
      await category(value);
      if (value === "A/B/C/D") await shot("workbench-route");
      assert.equal(
        await root
          .locator('[aria-label="Evidence content"] details[open]')
          .count(),
        0,
      );
    }
    await category("History");
    const staleExport = root.getByRole("button", {
      name: "Export history " + ids[0].slice(0, 8),
      exact: true,
    });
    await staleExport.waitFor();
    await shot("workbench-history");
    assert.equal(await shared.locator(`option[value="${ids[0]}"]`).count(), 0);
    const staleDownload = page.waitForEvent("download");
    await staleExport.click();
    await (await staleDownload).saveAs(`${output}/${name}-stale-history.zip`);
    step(
      "stale_old_scope_not_current_but_History_UI_and_export_available",
      ids[0],
    );
    await root
      .getByRole("button", { name: /^Export history / })
      .first()
      .waitFor();
    await category("Experiment");
    await click("Create experiment");
    const descriptor = root.getByLabel("Local experiment descriptor JSON", {
      exact: true,
    });
    const valid = JSON.parse(await descriptor.inputValue());
    valid.browser_label = "<img src=x onerror=alert(1)>";
    await descriptor.fill(JSON.stringify(valid));
    await click("Save descriptor");
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Operation failed",
      ),
    );
    assert.equal(await root.locator("img,script").count(), 0);
    valid.browser_label = name;
    await descriptor.fill(JSON.stringify(valid));
    await click("Save descriptor");
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Descriptor saved locally",
      ),
    );
    const descWait = page.waitForEvent("download");
    await click("Export descriptor");
    const descFile = `${output}/${name}-descriptor.json`;
    await (await descWait).saveAs(descFile);
    await root
      .getByLabel("Import local experiment descriptor", { exact: true })
      .setInputFiles(descFile);
    const key = root.getByLabel("Optional shared local experiment key", {
      exact: true,
    });
    await key.fill("ab".repeat(32));
    await click("Save local key");
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Shared key stored",
      ),
    );
    assert.equal(await key.inputValue(), "");
    const pairs = [];
    for (let i = 0; i < 2; i++) {
      if (i) {
        const [id] = await send();
        await page.waitForFunction(
          (id) =>
            window.__BLACKBOX_SYNTHETIC__.monitor.journal
              .snapshot(id)
              .events.some((e) => e.level === "A"),
          id,
        );
        await shared.selectOption(id);
      }
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
      const prompt = root.getByLabel(
        "Optional transient user content for HMAC association",
        { exact: true },
      );
      await prompt.fill("TRANSIENT_UI_HMAC_CANARY");
      await click("Bind current run");
      await page.waitForFunction(() =>
        window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
          "Independent run bound",
        ),
      );
      assert.equal(await prompt.inputValue(), "");
      await click("Close");
      await click("View details");
      const w = page.waitForEvent("download");
      await click("Export ZIP");
      const p = `${output}/${name}-paired-${i}.zip`;
      await (await w).saveAs(p);
      pairs.push(p);
      await click("Advanced evidence");
      await category("Experiment");
    }
    await root
      .getByLabel("Import evidence ZIPs for local comparison", { exact: true })
      .setInputFiles(pairs);
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Local import validated",
      ),
    );
    await click("Compare / add pair");
    await root
      .getByLabel("Import evidence ZIPs for local comparison", { exact: true })
      .setInputFiles([zip, zip]);
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Not comparable",
      ),
    );
    const privacy = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      for (const k of await h.history.store.keys())
        if (
          JSON.stringify(await h.history.store.get(k)).includes(
            "TRANSIENT_UI_HMAC_CANARY",
          )
        )
          return false;
      return !JSON.stringify(
        h.monitor.journal.ids().map((id) => h.monitor.journal.snapshot(id)),
      ).includes("SECRET_UI_REFACTOR_PROMPT");
    });
    assert.ok(privacy);
    step(
      "workbench_timeline_raw_collapsed_route_network_env_history_bundle_descriptor_HMAC_AB_import_privacy",
      { raw, pairs, privacy },
    );
    await page.keyboard.press("Escape");
    assert.equal(await root.locator(".panel").isVisible(), false);
    await click("View details");
    await page.keyboard.press("Escape");
    assert.equal(await root.locator(".quick").isVisible(), false);

    await advanced();
    const forensic = root.locator(".panel"),
      resizeBefore = await forensic.boundingBox();
    const resizeGrip = await forensic.locator(".scale-handle").boundingBox();
    assert.ok(resizeGrip);
    const hit = await forensic.evaluate((el, grip) => {
      const r = el.getBoundingClientRect(),
        root = el.getRootNode();
      const target = (x, y) => {
        const n = root.elementFromPoint(x, y);
        return {
          tag: n?.tagName,
          class: n?.className,
          grip: !!n?.closest(".scale-handle"),
        };
      };
      return {
        old_corner: target(r.right - 3, r.bottom - 3),
        grip_center: target(grip.x + grip.width / 2, grip.y + grip.height / 2),
      };
    }, resizeGrip);
    step("proportional_resize_handle_hit_test", hit);
    await save();
    assert.equal(hit.grip_center.grip, true);
    const gripX = resizeGrip.x + resizeGrip.width / 2,
      gripY = resizeGrip.y + resizeGrip.height / 2;
    await page.mouse.move(gripX, gripY);
    await page.mouse.down();
    await page.mouse.move(gripX - 30, gripY - 40, { steps: 8 });
    await page.mouse.up();
    const resizeAfter = await forensic.boundingBox();
    step("resize_geometries_before_assert", { resizeBefore, resizeAfter });
    await save();
    assert.ok(
      Math.abs(
        resizeAfter.width / resizeBefore.width -
          resizeAfter.height / resizeBefore.height,
      ) < 0.01,
    );
    assert.ok(
      Math.abs(resizeAfter.width - resizeBefore.width) > 5 ||
        Math.abs(resizeAfter.height - resizeBefore.height) > 5,
    );
    await page.keyboard.press("Escape");
    step("real_workbench_proportional_resize", { resizeBefore, resizeAfter });
    const sizes = [
      [1366, 768],
      [1920, 1080],
      [420, 620],
    ];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
      const b = await root.locator(".launcher").boundingBox();
      assert.ok(
        b.x >= 0 &&
          b.y >= 0 &&
          b.x + b.width <= width + 1 &&
          b.y + b.height <= height + 1,
      );
    }
    await page.evaluate(() => {
      const input = document.createElement("textarea");
      input.id = "fixture-chat-input";
      Object.assign(input.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        width: "100%",
        height: "80px",
      });
      document.body.append(input);
    });
    await page.locator("#fixture-chat-input").click();
    await page.keyboard.type("normal input");
    await page.keyboard.press("Escape");
    await page.keyboard.type(" still works");
    assert.equal(
      await page.locator("#fixture-chat-input").inputValue(),
      "normal input still works",
    );
    assert.equal(await page.locator("head style").count(), 0);
    const cdp = await context.newCDPSession(page);
    for (const scale of [1.25, 1.5]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 420,
        height: 620,
        deviceScaleFactor: 2,
        mobile: false,
      });
      await cdp.send("Emulation.setPageScaleFactor", {
        pageScaleFactor: scale,
      });
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
      const visible = await title.boundingBox();
      assert.ok(visible.width > 0 && visible.x >= 0);
      assert.equal(await page.evaluate(() => window.devicePixelRatio), 2);
    }
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.detach();
    await page.screenshot({ path: `${output}/${name}-summary.png` });
    step(
      "responsive_1366_1920_small_zoom_125_150_DPR2_input_keyboard_noninterference",
      true,
    );
    await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      await h.history.store.set("blackbox.ui.position", { x: "bad", y: null });
    });
    await page.reload();
    await ready();
    let prefBox = await root.locator(".launcher").boundingBox();
    assert.ok(prefBox.x >= 0 && prefBox.y >= 0);
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.i18n.locale),
      "en-US",
    );
    await page.evaluate(async () => {
      await window.__BLACKBOX_SYNTHETIC__.history.store.set(
        "blackbox.ui.position",
        { x: 999999, y: 999999 },
      );
    });
    await page.reload();
    await ready();
    prefBox = await root.locator(".launcher").boundingBox();
    assert.ok(
      prefBox.x >= 0 &&
        prefBox.y >= 0 &&
        prefBox.x + prefBox.width <= 421 &&
        prefBox.y + prefBox.height <= 621,
    );
    await click("View details");
    await openSettings();
    await root.getByLabel("Language", { exact: true }).selectOption("zh-CN");
    await page.reload();
    await ready();
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.i18n.locale),
      "zh-CN",
    );
    await page.screenshot({ path: `${output}/${name}-zh-summary.png` });
    await click("View details");
    await openSettings();
    await root
      .getByLabel(await t("Language"), { exact: true })
      .selectOption("en-US");
    step(
      "invalid_position_default_out_of_bounds_clamp_bilingual_reload_persistence",
      prefBox,
    );
    for (const path of ["/", "/ui-locale-normal", "/ui-locale-no-csp"]) {
      await page.goto("http://127.0.0.1:43997" + path);
      await ready();
      await click("View details");
      await click("Hide");
      await root.locator(".restore").click();
      assert.equal(await root.locator(".quick").isVisible(), false);
      await click("Pause");
      await click("Resume");
      await click("Advanced evidence");
      assert.equal(await root.locator("style").count(), 0);
      step("real_CSP_controls", path);
    }
    const fallback = await context.newPage();
    try {
      await fallback.addInitScript(() =>
        Object.defineProperty(window, "CSSStyleSheet", {
          value: class {
            constructor() {
              throw Error("fixture_missing_stylesheet");
            }
          },
          configurable: true,
        }),
      );
      await fallback.goto("http://127.0.0.1:43997/");
      await fallback.waitForFunction(() => !!window.__BLACKBOX_SYNTHETIC__?.ui);
      const fr = fallback.locator("#chatgpt-blackbox-monitor");
      assert.equal(
        await fallback.evaluate(
          () => window.__BLACKBOX_SYNTHETIC__.ui.styleHealth.method,
        ),
        "property-fallback",
      );
      await fr
        .getByRole("button", { name: "View details", exact: true })
        .click();
      await fr
        .getByRole("button", { name: "More options", exact: true })
        .click();
      await fr.locator(".settings-popover > summary").click();
      await fr.getByRole("button", { name: "Hide", exact: true }).click();
      await fr.locator(".restore").click();
      step("strict_CSP_property_fallback_restore", true);
    } finally {
      await fallback.close();
    }
    evidence.status = "PASS";
    await save();
    return {
      evidence,
      privacy: true,
      position: true,
      edge_restore: true,
      i18n: true,
      core_smoke: true,
    };
  } catch (error) {
    evidence.status = "FAIL";
    evidence.failure = String(error).slice(0, 2000);
    await page
      .screenshot({ path: `${output}/${name}-first-failure.png` })
      .catch(() => {});
    await save();
    throw error;
  }
}
