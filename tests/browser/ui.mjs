import { inspectHitTest } from "./ui-csp-diagnostic.mjs";
import assert from "node:assert/strict";
export async function verifyUI(page, context, output, name) {
  const evidence = {
    steps: [],
    scope: "Full P9 strict-CSP official Tampermonkey",
  };
  const step = (name, value = true) => {
    evidence.steps.push({ name, value });
    return value;
  };
  try {
    await page.goto("http://127.0.0.1:43997/");
    await page.waitForFunction(
      () => !!window.__BLACKBOX_SYNTHETIC__?.ui?.host.isConnected,
    );
    const root = page.locator("#chatgpt-blackbox-monitor");
    evidence.before_click = await inspectHitTest(page);
    assert.equal(
      evidence.before_click.host.computed.position,
      "fixed",
      "P9 host_fixed",
    );
    assert.ok(
      Number(evidence.before_click.host.computed["z-index"]) > 1000000,
      "P9 z_index",
    );
    assert.equal(
      evidence.before_click.shell.computed["pointer-events"],
      "auto",
      "P9 shell_pointer_auto",
    );
    assert.equal(
      evidence.before_click.shadow_hit_test.target?.relationship,
      "Hide",
      "P9 real_Hide_hit_test",
    );
    assert.equal(
      evidence.before_click.document_hit_test[0]?.relationship,
      "monitor_host",
      "P9 host_hit_test",
    );
    assert.equal(
      evidence.before_click.inline_shadow_style_count,
      0,
      "P9 no_inline_style",
    );
    step("strict_CSP_initial_hit_test");
    const fields = await root.locator("dl dt").allTextContents();
    assert.deepEqual(fields, [
      "Requested",
      "Server Route",
      "Resolved Route",
      "Thinking Effort",
      "Capture Health",
      "Duration",
      "Network Status",
    ]);
    await root
      .getByRole("button", { name: "Open evidence", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await root.getByLabel("Forensic evidence", { exact: true }).isVisible(),
      true,
      "P9 keyboard_open",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await root.getByLabel("Forensic evidence", { exact: true }).isVisible(),
      false,
      "P9 escape_close",
    );
    const focusReturned = await page.evaluate(
      () =>
        window.__BLACKBOX_SYNTHETIC__.ui.shadow.activeElement?.textContent ===
        "Open evidence",
    );
    assert.equal(focusReturned, true, "P9 focus_return");
    step("keyboard_open_close_focus");
    const snapshot = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      for (let i = 0; i < 2; i++) {
        const r = await fetch("/backend-api/f/conversation?case=p7-sse", {
          method: "POST",
          body: JSON.stringify({ model: "synthetic-route" }),
        });
        await r.text();
      }
      return h.monitor.journal
        .ids()
        .filter((id) => h.monitor.journal.snapshot(id).start.mode === "live");
    });
    await page.waitForFunction(
      (ids) =>
        ids.every((id) =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal
            .snapshot(id)
            .events.some((e) => e.level === "A"),
        ),
      snapshot,
    );
    await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
    const current = await page.evaluate(
      () => window.__BLACKBOX_SYNTHETIC__.ui.selected,
    );
    assert.equal(current, snapshot.at(-1), "P9 latest_request_start");
    await root
      .getByLabel("Current capture", { exact: true })
      .selectOption(snapshot[0]);
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.selected),
      snapshot[0],
      "P9 manual_selection",
    );
    await page.evaluate((id) => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const e = h.monitor.journal
        .snapshot(id)
        .events.find((e) => e.level === "A");
      h.monitor.journal.append({
        ...e,
        value: "late-route",
        new_value: "late-route",
      });
      h.ui.render();
    }, snapshot.at(-1));
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.selected),
      snapshot[0],
      "P9 late_no_focus_steal",
    );
    evidence.before_hide = await inspectHitTest(page);
    assert.equal(
      evidence.before_hide.shadow_hit_test.target?.relationship,
      "Hide",
      "P9 Hide_hit_before_real_click",
    );
    await root.getByRole("button", { name: "Hide", exact: true }).click();
    const hidden = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const active = h.active;
      const r = await fetch("/backend-api/f/conversation?case=p7-sse", {
        method: "POST",
        body: JSON.stringify({ model: "synthetic-route" }),
      });
      await r.text();
      return {
        active,
        hidden: h.ui.host.hidden,
        count: h.monitor.journal
          .ids()
          .filter((id) => h.monitor.journal.snapshot(id).start.mode === "live")
          .length,
      };
    });
    assert.equal(hidden.hidden, true, "P9 Hide_hidden");
    assert.equal(hidden.active, true, "P9 hide_keeps_capture");
    assert.equal(hidden.count, 3, "P9 hidden_request_captured");
    step("Hide_capture_continues", hidden);
    await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.show());
    assert.equal(await root.isVisible(), true, "P9 Show_visible");
    step("Show");
    await root.getByRole("button", { name: "Pause", exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.active),
      false,
      "P9 pause",
    );
    assert.match(
      await root.locator(".launcher").getAttribute("data-capture-health"),
      /Paused/,
    );
    await root.getByRole("button", { name: "Resume", exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.active),
      true,
      "P9 resume_active",
    );
    step("Pause_Resume");
    await root
      .getByRole("button", { name: "Open evidence", exact: true })
      .click();
    await root
      .getByLabel("Evidence section", { exact: true })
      .selectOption({ label: "Timeline" });
    const unknown = await root
      .getByLabel("Evidence content", { exact: true })
      .textContent();
    assert.match(unknown, /Unknown/);
    await page.evaluate(() => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      history.pushState({}, "", "/c/current");
      h.ui.render();
    });
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.selected),
      null,
      "P9 old_visit_excluded",
    );
    await page.evaluate(async () => {
      const r = await fetch("/backend-api/f/conversation?case=p7-sse", {
        method: "POST",
        body: JSON.stringify({ model: "synthetic-route" }),
      });
      await r.text();
    });
    await page.waitForFunction(() => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const id = h.monitor.journal
        .ids()
        .filter((id) => h.monitor.journal.snapshot(id).start.mode === "live")
        .at(-1);
      return h.monitor.journal.snapshot(id).events.some((e) => e.level === "A");
    });
    const pagination = await page.evaluate(() => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const id = h.monitor.journal
        .ids()
        .filter((id) => h.monitor.journal.snapshot(id).start.mode === "live")
        .at(-1);
      const e = h.monitor.journal
        .snapshot(id)
        .events.find((e) => e.level === "A");
      for (let i = 0; i < 120; i++)
        h.monitor.journal.append({ ...e, value: i % 2 ? "one" : "two" });
      h.ui.render();
      return {
        id,
        indexes: [...h.ui.shadow.querySelectorAll("pre[data-event-id]")].length,
      };
    });
    assert.ok(pagination.indexes <= 50, "P9 bounded_page_DOM");
    await root.getByRole("button", { name: "Next page", exact: true }).click();
    assert.match(
      await root.getByLabel("Evidence content", { exact: true }).textContent(),
      /"page": 2/,
    );
    step("SPA_selection_late_and_paging");
    const downloadWait = page.waitForEvent("download");
    await root.getByRole("button", { name: "Export ZIP", exact: true }).click();
    const download = await downloadWait;
    const path = `${output}/${name}-ui-evidence.zip`;
    await download.saveAs(path);
    const imports = root.getByLabel(
      "Import evidence ZIPs for local comparison",
      {
        exact: true,
      },
    );
    await imports.setInputFiles([path, path]);
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Local import validated",
      ),
    );
    const comparison = await root
      .getByLabel("Evidence content", { exact: true })
      .textContent();
    assert.match(comparison, /Not comparable/);
    await root
      .getByLabel("Evidence section", { exact: true })
      .selectOption({ label: "History" });
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Export history",
      ),
    );
    await root
      .getByLabel("Evidence section", { exact: true })
      .selectOption({ label: "Experiment" });
    await root
      .getByRole("button", { name: "Create experiment", exact: true })
      .click();
    const textarea = root.getByLabel("Local experiment descriptor JSON", {
      exact: true,
    });
    const valid = JSON.parse(await textarea.inputValue());
    valid.browser_label = "<img src=x onerror=alert(1)>";
    await textarea.fill(JSON.stringify(valid));
    await root
      .getByRole("button", { name: "Save descriptor", exact: true })
      .click();
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Operation failed",
      ),
    );
    assert.equal(
      await root.locator("img,script").count(),
      0,
      "P9 no_executable_import_markup",
    );
    step("Export_Import_History_malicious_descriptor");
    valid.browser_label = name;
    await textarea.fill(JSON.stringify(valid));
    await root
      .getByRole("button", { name: "Save descriptor", exact: true })
      .click();
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Descriptor saved locally",
      ),
    );
    const descDownload = page.waitForEvent("download");
    await root
      .getByRole("button", { name: "Export descriptor", exact: true })
      .click();
    const descriptorPath = `${output}/${name}-ui-descriptor.json`;
    await (await descDownload).saveAs(descriptorPath);
    await root
      .getByLabel("Import local experiment descriptor", { exact: true })
      .setInputFiles(descriptorPath);
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Descriptor imported locally",
      ),
    );
    const keyInput = root.getByLabel("Optional shared local experiment key", {
      exact: true,
    });
    await keyInput.fill("ab".repeat(32));
    await root
      .getByRole("button", { name: "Save local key", exact: true })
      .click();
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Shared key stored only locally",
      ),
    );
    assert.equal(await keyInput.inputValue(), "", "P9 key_input_cleared");
    const pairPaths = [];
    for (let run = 0; run < 2; run++) {
      if (run) {
        await page.evaluate(async () => {
          const r = await fetch("/backend-api/f/conversation?case=p7-sse", {
            method: "POST",
            body: JSON.stringify({ model: "synthetic-route" }),
          });
          await r.text();
        });
        await page.waitForFunction(() => {
          const h = window.__BLACKBOX_SYNTHETIC__;
          const id = h.monitor.journal
            .ids()
            .filter(
              (id) => h.monitor.journal.snapshot(id).start.mode === "live",
            )
            .at(-1);
          return h.monitor.journal
            .snapshot(id)
            .events.some((e) => e.level === "A");
        });
        await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
      }
      const promptInput = root.getByLabel(
        "Optional transient user content for HMAC association",
        { exact: true },
      );
      await promptInput.fill("TRANSIENT_UI_HMAC_CANARY");
      await root
        .getByRole("button", { name: "Bind current run", exact: true })
        .click();
      await page.waitForFunction(() =>
        window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
          "Independent run bound",
        ),
      );
      assert.equal(
        await promptInput.inputValue(),
        "",
        "P9 transient_content_cleared",
      );
      const wait = page.waitForEvent("download");
      await root
        .getByRole("button", { name: "Export ZIP", exact: true })
        .click();
      const file = `${output}/${name}-ui-paired-${run}.zip`;
      await (await wait).saveAs(file);
      pairPaths.push(file);
    }
    await imports.setInputFiles(pairPaths);
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow.textContent.includes(
        "Local import validated",
      ),
    );
    assert.match(
      await root.getByLabel("Evidence content", { exact: true }).textContent(),
      /"state": "compared"/,
      "P9 paired_UI_compare",
    );
    await root
      .getByRole("button", { name: "Compare / add pair", exact: true })
      .click();
    const privacy = await page.evaluate(async () => {
      const store = window.__BLACKBOX_SYNTHETIC__.history.store;
      for (const k of await store.keys())
        if (
          JSON.stringify(await store.get(k)).includes(
            "TRANSIENT_UI_HMAC_CANARY",
          )
        )
          return false;
      return true;
    });
    assert.equal(privacy, true, "P9 no_transient_GM_content");
    step("descriptor_HMAC_bind_export_import_paired_UI", {
      descriptorPath,
      pairPaths,
      privacy,
    });
    await root.getByRole("button", { name: "Move", exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    const moved = await root.boundingBox();
    await root
      .getByRole("button", { name: "Reset position", exact: true })
      .click();
    const reset = await root.boundingBox();
    assert.notEqual(moved.x, reset.x, "P9 keyboard_move_reset");
    const move = root.getByRole("button", { name: "Move", exact: true });
    const box = await move.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, 20, { steps: 5 });
    await page.mouse.up();
    const dragged = await root.boundingBox();
    assert.ok(Math.abs(dragged.x - reset.x) > 5, "P9 real_pointer_drag_moved");
    step("keyboard_pointer_drag_reset", { moved, reset, dragged });
    const forensic = root.getByLabel("Forensic evidence", { exact: true });
    await forensic.scrollIntoViewIfNeeded();
    const resizeBefore = await forensic.boundingBox();
    await page.mouse.move(
      resizeBefore.x + resizeBefore.width - 3,
      resizeBefore.y + resizeBefore.height - 3,
    );
    await page.mouse.down();
    await page.mouse.move(
      resizeBefore.x + resizeBefore.width - 33,
      resizeBefore.y + resizeBefore.height - 43,
      { steps: 5 },
    );
    await page.mouse.up();
    const resizeAfter = await forensic.boundingBox();
    assert.ok(
      Math.abs(resizeAfter.width - resizeBefore.width) > 5 ||
        Math.abs(resizeAfter.height - resizeBefore.height) > 5,
      "P9 real_panel_resize",
    );
    step("real_panel_resize", { resizeBefore, resizeAfter });
    await page.setViewportSize({ width: 420, height: 620 });
    await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
    const bounds = await root.boundingBox();
    assert.ok(
      bounds.x >= 0 &&
        bounds.x + bounds.width <= 420 &&
        bounds.y + bounds.height < 400,
      "P9 small_viewport_non_interference",
    );
    const nonInterference = await page.evaluate(() => {
      const input = document.createElement("textarea");
      input.id = "fixture-chat-input";
      input.style.position = "fixed";
      input.style.bottom = "0";
      input.style.left = "0";
      input.style.width = "100%";
      input.style.height = "80px";
      document.body.append(input);
      input.focus();
      return {
        focused: document.activeElement === input,
        styles: document.querySelectorAll("head style").length,
        globalObservers:
          window.__BLACKBOX_SYNTHETIC__.ui.host.querySelectorAll("*").length,
      };
    });
    await page.keyboard.type("normal chat input");
    assert.equal(
      await page.locator("#fixture-chat-input").inputValue(),
      "normal chat input",
    );
    assert.equal(nonInterference.focused, true);
    const input = page.locator("#fixture-chat-input");
    await input.click();
    await page.keyboard.press("Escape");
    await page.keyboard.type(" more");
    assert.equal(
      await input.inputValue(),
      "normal chat input more",
      "P9 normal_input_shortcuts",
    );
    assert.equal(nonInterference.styles, 0, "P9 no_global_head_styles");
    const inputHit = await input.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el
      );
    });
    assert.equal(inputHit, true, "P9 real_input_hit_test");
    const screenshot = `${output}/${name}-ui-small.png`;
    await page.screenshot({ path: screenshot });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 420,
      height: 620,
      deviceScaleFactor: 2,
      mobile: false,
    });
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    assert.equal(dpr, 2, "P9 high_DPR");
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1.5 });
    const zoom = await page.evaluate(() => window.visualViewport.scale);
    assert.ok(zoom >= 1.5, "P9 zoom");
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.detach();
    await page.setViewportSize({ width: 1280, height: 720 });
    step("drag_reset_small_viewport_zoom_DPR_input");
    const fallbackPage = await context.newPage();
    try {
      await fallbackPage.addInitScript(() =>
        Object.defineProperty(window, "CSSStyleSheet", {
          value: class {
            constructor() {
              throw Error("test_unavailable_constructed_sheet");
            }
          },
          configurable: true,
        }),
      );
      await fallbackPage.goto("http://127.0.0.1:43997/");
      await fallbackPage.waitForFunction(
        () => !!window.__BLACKBOX_SYNTHETIC__?.ui,
      );
      const fallback = await inspectHitTest(fallbackPage);
      assert.equal(
        fallback.style_health.method,
        "property-fallback",
        "P9 production_fallback_selected",
      );
      assert.equal(
        fallback.style_health.status,
        "Partial",
        "P9 fallback_health",
      );
      assert.equal(
        fallback.shadow_hit_test.target?.relationship,
        "Hide",
        "P9 fallback_hit_test",
      );
      const fallbackRoot = fallbackPage.locator("#chatgpt-blackbox-monitor");
      await fallbackRoot
        .getByRole("button", { name: "Hide", exact: true })
        .click();
      assert.equal(
        await fallbackPage.evaluate(
          () => window.__BLACKBOX_SYNTHETIC__.ui.host.hidden,
        ),
        true,
        "P9 fallback_real_Hide",
      );
      await fallbackPage.evaluate(() =>
        window.__BLACKBOX_SYNTHETIC__.ui.show(),
      );
      await fallbackRoot
        .getByRole("button", { name: "Pause", exact: true })
        .click();
      await fallbackRoot
        .getByRole("button", { name: "Resume", exact: true })
        .click();
      step("production_property_fallback", fallback);
    } finally {
      await fallbackPage.close();
    }
    return {
      evidence,
      fields,
      dpr,
      zoom,
      keyboard_open_close: true,
      focus_returned: focusReturned,
      current_visit: true,
      latest_request_start: true,
      manual_selection: true,
      late_no_focus_steal: true,
      hide_vs_pause: true,
      pagination,
      export_download: path,
      local_import_compare: true,
      history: true,
      malicious_descriptor_rejected: true,
      drag: true,
      reset: true,
      small_viewport: bounds,
      nonInterference,
      screenshot,
      scope:
        "fresh actual official Tampermonkey synthetic fixture UI; authenticated Chat/Work Not validated",
    };
  } catch (error) {
    evidence.at_failure = await inspectHitTest(page).catch(() => null);
    error.diagnostic = { P9: evidence };
    throw error;
  }
}
