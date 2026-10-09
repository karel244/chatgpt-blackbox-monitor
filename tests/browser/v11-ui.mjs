import { verifyClearAll } from "./clear-all-diagnostic.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
export async function verifyV11UI(page, output, name) {
  const evidence = { status: "RUNNING", steps: [], geometry: [] },
    dir = `${output}/v1-1-screenshots/${name}`;
  await mkdir(dir, { recursive: true });
  const save = () =>
    writeFile(
      `${output}/${name}-v1-1-ui.json`,
      JSON.stringify(evidence, null, 2),
    );
  const root = page.locator("#chatgpt-blackbox-monitor");
  const t = (key) =>
    page.evaluate((k) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(k), key);
  const click = async (key) =>
    root.getByRole("button", { name: await t(key), exact: true }).click();
  const ready = () =>
    page.waitForFunction(
      () => !!window.__BLACKBOX_SYNTHETIC__?.ui?.host.isConnected,
    );
  const shot = (file) => page.screenshot({ path: `${dir}/${file}.png` });
  const send = async (kind) => {
    const id = await page.evaluate(async (kind) => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        before = new Set(h.monitor.journal.ids());
      await (
        await fetch(`/backend-api/f/conversation?case=${kind}`, {
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
    }, kind);
    assert.ok(id);
    await page.waitForFunction(
      (id) =>
        window.__BLACKBOX_SYNTHETIC__.monitor.journal
          .snapshot(id)
          ?.events.some((e) => e.field_namespace === "network.verdict"),
      id,
    );
    return id;
  };
  const grip = (surface) => root.locator(surface + " .scale-handle");
  const dragScale = async (surface, target) => {
    const el = root.locator(surface),
      before = await el.evaluate((e) => ({
        effective: Number(e.dataset.effectiveScale),
        baseWidth: Number(e.dataset.baseWidth),
        baseHeight: Number(e.dataset.baseHeight),
      }));
    const b = await grip(surface).boundingBox();
    assert.ok(b && b.width > 0);
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(
      x + (target - before.effective) * before.baseWidth,
      y + (target - before.effective) * before.baseHeight,
      { steps: 12 },
    );
    await page.mouse.up();
    const actual = Number(await el.getAttribute("data-scale"));
    assert.ok(
      Math.abs(actual - target) < 0.005,
      `real drag ${surface} ${target} got ${actual}`,
    );
    return actual;
  };
  const inspect = async (surface) =>
    root.locator(surface).evaluate((e) => {
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const title = e.querySelector(".surface-header>strong"),
        range = document.createRange();
      range.selectNodeContents(title);
      const font = range.getBoundingClientRect();
      return {
        window: rect(e),
        button: rect(e.querySelector(".surface-header .icon")),
        text: { width: font.width, height: font.height },
        scale: Number(e.dataset.scale),
        effective: Number(e.dataset.effectiveScale),
        baseWidth: Number(e.dataset.baseWidth),
        baseHeight: Number(e.dataset.baseHeight),
        resize: window.getComputedStyle(e).resize,
      };
    });
  const bounded = async (surface, width, height) => {
    const initial = await inspect(surface);
    const sample = { surface, width, height, initial };
    (evidence.viewport ??= []).push(sample);
    // setViewportSize acknowledgement can precede the native resize listener.
    // Await the same mandatory geometry predicate, without sleeping or changing
    // production state. Save both observations so a settling race is auditable.
    await page.waitForFunction(
      ({ surface, width, height }) => {
        const r = window.__BLACKBOX_SYNTHETIC__.ui.shadow
          .querySelector(surface)
          .getBoundingClientRect();
        return (
          r.x >= -1 &&
          r.y >= -1 &&
          r.right <= width + 1 &&
          r.bottom <= height + 1
        );
      },
      { surface, width, height },
    );
    sample.ready = await inspect(surface);
    sample.resize_events = await page.evaluate(
      () => window.__V11_RESIZE_DIAGNOSTIC__ ?? [],
    );
    const r = sample.ready.window;
    assert.ok(
      r.x >= -1 &&
        r.y >= -1 &&
        r.x + r.width <= width + 1 &&
        r.y + r.height <= height + 1,
    );
    return r;
  };
  const visibleLauncher = async (width, height) => {
    await page.waitForFunction(
      ({ width, height }) => {
        const e =
          window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(".launcher");
        const r = e.getBoundingClientRect();
        return (
          window.innerWidth === width &&
          window.innerHeight === height &&
          !e.hidden &&
          r.width > 0 &&
          r.height > 0 &&
          r.x >= -1 &&
          r.y >= -1 &&
          r.right <= width + 1 &&
          r.bottom <= height + 1
        );
      },
      { width, height },
    );
    // Observe consecutive rendering frames, rather than measuring a hidden node
    // or substituting a fixed sleep for resize/clamp readiness.
    const result = await root.locator(".launcher").evaluate(async (e) => {
      const samples = [];
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        const r = e.getBoundingClientRect(),
          css = window.getComputedStyle(e);
        samples.push({
          viewport: { width: window.innerWidth, height: window.innerHeight },
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          visible: !e.hidden && r.width > 0 && r.height > 0,
          transform: css.transform,
          computed_style: {
            display: css.display,
            visibility: css.visibility,
            width: css.width,
            height: css.height,
            font_size: css.fontSize,
            line_height: css.lineHeight,
          },
          data_scale: e.getAttribute("data-scale"),
          scale_handle_count: e.querySelectorAll(".scale-handle").length,
          monotonic_ms: performance.now(),
        });
      }
      return { ...samples.at(-1), samples };
    });
    assert.ok(
      result.samples.every(
        (s) =>
          s.visible &&
          s.viewport.width === width &&
          s.viewport.height === height &&
          Math.abs(s.rect.width - result.rect.width) <= 0.01 &&
          Math.abs(s.rect.height - result.rect.height) <= 0.01 &&
          Math.abs(s.rect.x - result.rect.x) <= 0.01 &&
          Math.abs(s.rect.y - result.rect.y) <= 0.01,
      ),
      "visible launcher must be settled across rendering frames",
    );
    return result;
  };
  const saveLauncherProof = () =>
    writeFile(
      `${output}/launcher-independence-proof.json`,
      JSON.stringify(evidence.launcher_independence, null, 2),
    );
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("http://127.0.0.1:43997/");
    await ready();
    await click("View details");
    await click("More options");
    const settings = root.locator(".settings-popover");
    if (!(await settings.evaluate((e) => e.open)))
      await settings.locator("summary").first().click();
    await root
      .getByLabel(await t("Language"), { exact: true })
      .selectOption("zh-CN");
    await click("More options");
    assert.deepEqual(
      await root.locator('.tabs [role="tab"]').allTextContents(),
      ["路由", "网络", "环境", "历史"],
    );
    assert.equal(
      await root.locator('.tabs [aria-selected="true"]').innerText(),
      "路由",
    );
    assert.equal(
      await root.locator('.work-nav [data-category="Overview"]').count(),
      0,
    );
    const known = await send("ui-locale");
    await page.waitForFunction(
      (id) =>
        window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(".launcher")
          .dataset.captureId === id,
      known,
    );
    await shot("main-route-default");
    await click("Close");
    await shot("launcher-known");
    const launcherText = await root.locator(".launcher").innerText();
    assert.match(launcherText, /路由一致.*5-6-thinking.*高.*秒/);
    assert.equal(
      await root.locator(".launcher").getAttribute("data-model-source"),
      "server_ste_metadata.model_slug",
    );
    const launcherBox = await root.locator(".launcher").boundingBox();
    assert.ok(launcherBox.width >= 260 && launcherBox.width <= 420);
    const launcherBefore = await visibleLauncher(1920, 1080);
    evidence.launcher_independence = {
      status: "RUNNING",
      before: launcherBefore,
    };
    await saveLauncherProof();
    assert.equal(launcherBefore.scale_handle_count, 0);
    await send("p5-429-seconds");
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow
        .querySelector(".launcher")
        .textContent.includes("HTTP 429"),
    );
    await shot("launcher-network-abnormal");
    const abnormal = await root.locator(".launcher").innerText();
    assert.match(abnormal, /^⚠ HTTP 429/);
    await click("View details");
    const selector = root.getByLabel(await t("Current capture"), {
      exact: true,
    });
    await selector.selectOption(known);
    await page.waitForFunction(
      (id) =>
        window.__BLACKBOX_SYNTHETIC__.monitor.journal.state(id).lifecycle ===
        "Closed",
      known,
      { timeout: 35000 },
    );
    const facts = () =>
      page.evaluate(
        (id) =>
          JSON.stringify(
            window.__BLACKBOX_SYNTHETIC__.monitor.journal.snapshot(id),
          ),
        known,
      );
    const beforeEvidence = await facts();
    for (const surface of [".quick", ".panel"]) {
      if (surface === ".panel") await click("Advanced evidence");
      const records = [];
      for (const scale of [0.75, 1, 1.4]) {
        await dragScale(surface, scale);
        const state = await inspect(surface);
        records.push(state);
        assert.ok(
          Math.abs(state.window.width / state.baseWidth - scale) < 0.005 &&
            Math.abs(state.window.height / state.baseHeight - scale) < 0.005,
        );
        assert.equal(state.resize, "none");
        await bounded(surface, 1920, 1080);
        await selector.selectOption(known);
        assert.equal(await selector.inputValue(), known);
        const file =
          (surface === ".quick" ? "main" : "workbench") +
          "-scale-" +
          String(Math.round(scale * 100)).padStart(3, "0");
        await shot(file);
        if (surface === ".panel") {
          const controls = root.locator(
            '.work-nav button[data-category="Experiment"]',
          );
          if (!(await controls.isVisible()))
            await root.locator(".work-nav details summary").click();
          await controls.click();
          const input = root.getByLabel(
            await t("Local experiment descriptor JSON"),
            { exact: true },
          );
          await input.fill("synthetic scale input");
          assert.equal(await input.inputValue(), "synthetic scale input");
          await root
            .locator('.work-nav button[data-category="Timeline"]')
            .click();
          const scroll = root.locator(".evidence-content"),
            box = await scroll.boundingBox();
          await page.mouse.move(box.x + 40, box.y + box.height / 2);
          await page.mouse.wheel(0, 800);
          await page.waitForFunction(
            () =>
              window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(
                ".evidence-content",
              ).scrollTop > 0,
          );
        } else {
          const scroll = root.locator(".cards"),
            box = await scroll.boundingBox();
          await scroll
            .getByText(await t("Raw fields"), { exact: true })
            .click();
          await page.mouse.move(box.x + 30, box.y + box.height / 2);
          await page.mouse.wheel(0, 800);
          await page.waitForFunction(
            () =>
              window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(".cards")
                .scrollTop > 0,
          );
          await scroll
            .getByText(await t("Raw fields"), { exact: true })
            .click();
        }
      }
      const baseline = records[1];
      for (const row of records) {
        assert.ok(
          Math.abs(row.button.height / baseline.button.height - row.scale) <
            0.015,
        );
        assert.ok(
          Math.abs(row.text.height / baseline.text.height - row.scale) < 0.03,
        );
      }
      const header = root.locator(surface + " .surface-header"),
        h = await header.boundingBox(),
        prior = (await inspect(surface)).window;
      await page.mouse.move(h.x + h.width / 2, h.y + 15);
      await page.mouse.down();
      await page.mouse.move(h.x + h.width / 2 - 50, h.y + 45, { steps: 8 });
      await page.mouse.up();
      const moved = (await inspect(surface)).window;
      assert.ok(Math.abs(moved.x - prior.x) > 20);
      assert.ok(
        Math.abs(
          Number(await root.locator(surface).getAttribute("data-scale")) - 1.4,
        ) < 0.005,
      );
      evidence.geometry.push({ surface, records, drag: { prior, moved } });
    }
    await dragScale(".panel", 0.75);
    assert.ok(
      Math.abs(
        Number(await root.locator(".quick").getAttribute("data-scale")) - 1.4,
      ) < 0.005,
    );
    assert.equal(await facts(), beforeEvidence);
    const preferences = await page.evaluate(async () => {
      const s = window.__BLACKBOX_SYNTHETIC__.history.store;
      return {
        main: await s.get("blackbox.ui.mainScale"),
        workbench: await s.get("blackbox.ui.workbenchScale"),
      };
    });
    assert.ok(
      Math.abs(preferences.main - 1.4) < 0.005 &&
        Math.abs(preferences.workbench - 0.75) < 0.005,
    );
    await page.reload();
    await ready();
    await click("View details");
    assert.ok(
      Math.abs(
        Number(await root.locator(".quick").getAttribute("data-scale")) - 1.4,
      ) < 0.005,
    );
    await click("Advanced evidence");
    assert.ok(
      Math.abs(
        Number(await root.locator(".panel").getAttribute("data-scale")) - 0.75,
      ) < 0.005,
    );
    await click("Back to controls");
    evidence.clear_all = await verifyClearAll(page, output, name);
    const kept = await page.evaluate(async () => {
      const s = window.__BLACKBOX_SYNTHETIC__.history.store;
      return {
        main: await s.get("blackbox.ui.mainScale"),
        workbench: await s.get("blackbox.ui.workbenchScale"),
      };
    });
    assert.deepEqual(kept, preferences);
    await page.reload();
    await ready();
    await click("View details");
    await page.evaluate(() => {
      window.__V11_RESIZE_DIAGNOSTIC__ = [];
      const record = (event) => {
        const h = window.__BLACKBOX_SYNTHETIC__;
        const rect = h.ui.shadow
          .querySelector(".quick")
          .getBoundingClientRect();
        window.__V11_RESIZE_DIAGNOSTIC__.push({
          type: event.type,
          monotonic_ms: performance.now(),
          viewport: { width: window.innerWidth, height: window.innerHeight },
          main: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        });
      };
      window.addEventListener("resize", record);
      window.visualViewport?.addEventListener("resize", record);
    });
    for (const [width, height] of [
      [1366, 768],
      [420, 620],
    ]) {
      await page.setViewportSize({ width, height });
      await bounded(".quick", width, height);
      await click("Advanced evidence");
      await bounded(".panel", width, height);
      await click("Back to controls");
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForFunction(() => {
      const main =
        window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(".quick");
      return (
        window.innerWidth === 1920 &&
        window.innerHeight === 1080 &&
        Number(main.dataset.baseWidth) === 460 &&
        Number(main.dataset.baseHeight) === 560 &&
        Math.abs(
          Number(main.dataset.effectiveScale) - Number(main.dataset.scale),
        ) < 1e-6
      );
    });
    await bounded(".quick", 1920, 1080);
    await click("Close");
    const launcherAfter = await visibleLauncher(1920, 1080);
    Object.assign(evidence.launcher_independence, {
      after: launcherAfter,
      width_delta: launcherAfter.rect.width - launcherBefore.rect.width,
      height_delta: launcherAfter.rect.height - launcherBefore.rect.height,
      transform_equal: launcherAfter.transform === launcherBefore.transform,
      data_scale_equal: launcherAfter.data_scale === launcherBefore.data_scale,
      scale_handle_count: launcherAfter.scale_handle_count,
    });
    await saveLauncherProof();
    assert.deepEqual(launcherAfter.viewport, launcherBefore.viewport);
    assert.equal(launcherAfter.visible, true);
    assert.equal(launcherAfter.transform, launcherBefore.transform);
    assert.ok(Math.abs(evidence.launcher_independence.width_delta) <= 0.5);
    assert.ok(Math.abs(evidence.launcher_independence.height_delta) <= 0.5);
    assert.equal(launcherAfter.data_scale, launcherBefore.data_scale);
    assert.equal(launcherAfter.scale_handle_count, 0);
    evidence.launcher_independence.status = "PASS";
    await saveLauncherProof();
    await click("View details");
    await click("More options");
    const hideMenu = root.locator(".settings-popover");
    if (!(await hideMenu.evaluate((e) => e.open)))
      await hideMenu.locator("summary").first().click();
    await click("Hide");
    assert.equal(await root.locator(".restore .scale-handle").count(), 0);
    const restore = await root.locator(".restore").boundingBox();
    assert.ok(restore.width <= 20 && restore.height <= 32);
    await root.locator(".restore").click();
    await page.evaluate(async () => {
      const s = window.__BLACKBOX_SYNTHETIC__.history.store;
      await s.set("blackbox.ui.mainScale", "invalid");
      await s.set("blackbox.ui.workbenchScale", 99);
    });
    await page.reload();
    await ready();
    await click("View details");
    assert.equal(await root.locator(".quick").getAttribute("data-scale"), "1");
    await click("Advanced evidence");
    assert.equal(await root.locator(".panel").getAttribute("data-scale"), "1");
    assert.equal(await root.locator("style").count(), 0);
    assert.equal(await root.locator(".launcher .scale-handle").count(), 0);
    evidence.steps.push(
      {
        label:
          "four tabs/default Route, launcher model source + abnormal priority",
        launcherText,
        abnormal,
      },
      {
        label:
          "uniform transform native pointer/select/input/scroll/font/button/drag/clamp",
        pass: true,
      },
      {
        label:
          "independent GM prefs + reload + Clear all preservation + invalid fallback",
        preferences,
        kept,
      },
      {
        label: "evidence byte equality; strict CSP; launcher/restore unscaled",
        equal: true,
      },
    );
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("http://127.0.0.1:43997/");
    await ready();
    await send("ui-locale");
    await click("View details");
    await root
      .getByRole("tab", { name: await t("History"), exact: true })
      .click();
    await root.locator(".history-row").first().waitFor();
    await shot("history-after-longrun");
    await page.goto("http://127.0.0.1:43997/");
    await ready();
    evidence.status = "PASS";
    await save();
    return evidence;
  } catch (error) {
    evidence.status = "FAIL";
    evidence.error = String(error);
    evidence.stack = error.stack;
    if (evidence.launcher_independence) {
      evidence.launcher_independence.final_gate_error = String(error);
      if (evidence.launcher_independence.status !== "PASS")
        evidence.launcher_independence.status = "FAIL";
      await saveLauncherProof();
    }
    await shot("first-failure").catch(() => {});
    await save();
    throw error;
  }
}
