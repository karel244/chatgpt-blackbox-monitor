import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { inspectHitTest } from "./ui-csp-diagnostic.mjs";

export async function verifyLocalization(page, output, name) {
  const evidence = {
    scope: "actual official Tampermonkey; localhost synthetic only",
    steps: [],
  };
  const save = () =>
    writeFile(
      `${output}/${name}-localization.json`,
      JSON.stringify(evidence, null, 2),
    );
  const step = (label, value) => evidence.steps.push({ label, value });
  const root = () => page.locator("#chatgpt-blackbox-monitor");
  const waitUI = () =>
    page.waitForFunction(
      () => !!window.__BLACKBOX_SYNTHETIC__?.ui?.host.isConnected,
    );
  const language = (label) => root().getByLabel(label, { exact: true });
  let httpRequests = 0;
  const countRequest = (req) => {
    if (/^https?:/.test(req.url())) httpRequests++;
  };
  page.on("request", countRequest);
  try {
    await page.goto("http://127.0.0.1:43997/");
    await waitUI();
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.i18n.locale),
      "zh-CN",
    );
    assert.deepEqual(await root().locator("dl dt").allTextContents(), [
      "请求模型",
      "服务器路由",
      "解析路由",
      "思考强度",
      "捕获状态",
      "总耗时",
      "网络状态",
    ]);
    const menus = await page.evaluate(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.menuSnapshot(),
    );
    assert.equal(menus.length, 8);
    assert.ok(menus.every((x) => x.label.startsWith("黑盒监控：")));
    assert.equal(new Set(menus.map((x) => x.id)).size, 8);
    step("default_zh_CN_capsule_and_actual_GM_menu_registrations", menus);

    const id = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const before = new Set(h.monitor.journal.ids());
      const response = await fetch(
        "/backend-api/f/conversation?case=ui-locale",
        {
          method: "POST",
          body: JSON.stringify({
            model: "gpt-5-6-thinking",
            thinking_effort: "high",
            messages: [{ content: "SECRET_UI_LOCALE_PROMPT" }],
          }),
        },
      );
      await response.text();
      return h.monitor.journal
        .ids()
        .find(
          (id) =>
            !before.has(id) &&
            h.monitor.journal.snapshot(id).start.mode === "live",
        );
    });
    assert.ok(id);
    await page.waitForFunction(
      (id) =>
        window.__BLACKBOX_SYNTHETIC__.monitor.journal.state(id).lifecycle ===
        "Closed",
      id,
      { timeout: 35000 },
    );
    await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.render());
    const values = await root().locator("dl dd").allTextContents();
    assert.equal(values[0], "gpt-5-6-thinking");
    assert.equal(values[1], "gpt-5-6-thinking");
    assert.equal(values[2], "gpt-5-6-thinking");
    assert.equal(values[3], "高");
    assert.match(values[4], /路由一致/);
    assert.match(values[5], /^\d+\.\d+ 秒$/);
    assert.equal(values[6], "正常");
    const raw = await page.evaluate((id) => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      return {
        snapshot: h.monitor.journal.snapshot(id),
        context: h.context,
        active: h.active,
        selected: h.ui.selected,
      };
    }, id);
    const rawBytes = JSON.stringify(raw);
    assert.ok(!rawBytes.includes("SECRET_UI_LOCALE_PROMPT"));
    const downloaded = page.waitForEvent("download");
    await root()
      .getByRole("button", { name: "打开取证面板", exact: true })
      .click();
    await root().getByRole("button", { name: "导出 ZIP", exact: true }).click();
    const zipPath = `${output}/${name}-localized-capture.zip`;
    await (await downloaded).saveAs(zipPath);
    const imported = await page.evaluate(async (id) => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const b = await h.bundle.import((await h.bundle.export(id)).bytes);
      return {
        route: b.summary.route_verdict,
        effort: b.snapshot.events.find((e) => e.field === "thinking_effort")
          ?.value,
        schema: b.manifest.schema_version,
        no_locale: !JSON.stringify(b).includes("blackbox.ui.locale"),
        secret_absent: !JSON.stringify(b).includes("SECRET_UI_LOCALE_PROMPT"),
      };
    }, id);
    assert.equal(imported.route.actual_route, "gpt-5-6-thinking");
    assert.equal(imported.route.verdict, "Route Match");
    assert.equal(imported.effort, "high");
    assert.equal(imported.schema, "bundle-1");
    assert.ok(imported.no_locale && imported.secret_absent);
    step("native_capture_smoke_raw_model_route_effort_schema_export", {
      values,
      imported,
      zipPath,
    });

    const section = root().getByLabel("证据分类", { exact: true });
    assert.deepEqual(await section.locator("option").allTextContents(), [
      "时间线",
      "A/B/C/D 证据",
      "传输 / 时序",
      "网络 / Cloudflare / PoW / IP",
      "环境 / 前端构建",
      "捕获状态 / 存储",
      "历史",
      "脱敏预览",
      "实验",
      "对比",
    ]);
    await section.selectOption("History");
    await root()
      .getByRole("button", { name: /^导出历史 / })
      .first()
      .waitFor();
    await section.selectOption("Experiment");
    assert.equal(
      await root()
        .getByRole("button", { name: "创建实验", exact: true })
        .isVisible(),
      true,
    );
    assert.equal(
      await root().getByLabel("本地实验描述 JSON", { exact: true }).isVisible(),
      true,
    );
    await section.selectOption("Compare");
    assert.match(
      await root().getByLabel("证据内容", { exact: true }).textContent(),
      /请导入两份本地证据 ZIP/,
    );
    step("zh_CN_History_AB_panel_aria_and_empty_state", true);

    const beforeRequests = httpRequests;
    await language("语言").selectOption("en-US");
    assert.equal(
      await root()
        .getByRole("button", { name: "Open evidence", exact: true })
        .isVisible(),
      true,
    );
    assert.deepEqual(await root().locator("dl dt").allTextContents(), [
      "Requested",
      "Server Route",
      "Resolved Route",
      "Thinking Effort",
      "Capture Health",
      "Duration",
      "Network Status",
    ]);
    assert.equal(
      await root()
        .getByRole("button", { name: "Hide", exact: true })
        .getAttribute("title"),
      "Hide",
    );
    const after = await page.evaluate((id) => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      return {
        snapshot: h.monitor.journal.snapshot(id),
        context: h.context,
        active: h.active,
        selected: h.ui.selected,
      };
    }, id);
    assert.deepEqual(
      after,
      raw,
      "locale must not reset capture/context or add Journal events",
    );
    assert.equal(
      httpRequests,
      beforeRequests,
      "locale switch performs no network requests",
    );
    const enMenus = await page.evaluate(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.menuSnapshot(),
    );
    assert.deepEqual(
      enMenus.map((x) => x.id),
      menus.map((x) => x.id),
    );
    assert.ok(enMenus.every((x) => x.label.startsWith("Blackbox: ")));
    const enValues = await root().locator("dl dd").allTextContents();
    assert.deepEqual(enValues.slice(0, 3), values.slice(0, 3));
    assert.equal(enValues[3], "high");
    assert.match(enValues[4], /Route Match/);
    assert.match(enValues[5], /^\d+\.\d+s total$/);
    assert.equal(enValues[6], "OK");
    step("instant_English_raw_capture_journal_network_and_menu_ID_invariance", {
      raw_event_count: raw.snapshot.events.length,
      requests_before: beforeRequests,
      requests_after: httpRequests,
      enValues,
      enMenus,
    });
    await page.reload();
    await waitUI();
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.i18n.locale),
      "en-US",
    );
    await root()
      .getByRole("button", { name: "Open evidence", exact: true })
      .click();
    await language("Language").selectOption("zh-CN");
    await page.reload();
    await waitUI();
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.i18n.locale),
      "zh-CN",
    );
    step("both_locale_preferences_survive_real_reload", true);
    await root()
      .getByRole("button", { name: "打开取证面板", exact: true })
      .click();
    const previousEpoch = await page.evaluate(
      () => window.__BLACKBOX_SYNTHETIC__.history.epoch,
    );
    await root()
      .getByRole("button", { name: "清除全部证据", exact: true })
      .click();
    await page.waitForFunction(
      async ({ previousEpoch, id }) => {
        const h = window.__BLACKBOX_SYNTHETIC__;
        return (
          h.history.epoch !== previousEpoch &&
          (await h.history.store.get("blackbox.ui.locale")) === "zh-CN" &&
          (await h.history.list()).every((r) => r.manifest.capture_id !== id)
        );
      },
      { previousEpoch, id },
    );
    step("actual_clear_all_keeps_UI_preference", true);

    // Keep the inherited strict fixture untouched. Added isolated normal/no-CSP
    // UI fixtures are tested separately, never used to replace strict assertions.
    for (const path of ["/", "/ui-locale-normal", "/ui-locale-no-csp"]) {
      const response = await page.goto(`http://127.0.0.1:43997${path}`);
      await waitUI();
      const csp = response.headers()["content-security-policy"] ?? null;
      if (path === "/") assert.ok(csp && !csp.includes("unsafe-inline"));
      if (path === "/ui-locale-normal") assert.ok(csp?.includes("style-src"));
      if (path === "/ui-locale-no-csp") assert.equal(csp, null);
      const hit = await inspectHitTest(page);
      assert.equal(hit.shadow_hit_test.target?.relationship, "Hide");
      assert.equal(hit.inline_shadow_style_count, 0);
      assert.equal(hit.host.computed.position, "fixed");
      await root().getByRole("button", { name: "隐藏", exact: true }).click();
      assert.equal(
        await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.host.hidden),
        true,
      );
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.show());
      await root()
        .getByRole("button", { name: "暂停监测", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.active),
        false,
      );
      await root()
        .getByRole("button", { name: "继续监测", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.active),
        true,
      );
      await root().getByRole("button", { name: "移动", exact: true }).focus();
      await page.keyboard.press("ArrowLeft");
      await root()
        .getByRole("button", { name: "重置位置", exact: true })
        .click();
      await root()
        .getByRole("button", { name: "打开取证面板", exact: true })
        .click();
      assert.equal(
        await root().getByLabel("取证面板", { exact: true }).isVisible(),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await root().getByLabel("取证面板", { exact: true }).isVisible(),
        false,
      );
      step("zh_CN_real_controls_CSP", { path, csp, hit });
    }
    await root()
      .getByRole("button", { name: "打开取证面板", exact: true })
      .click();
    await language("语言").selectOption("en-US");
    evidence.status = "PASS";
    await save();
    return evidence;
  } catch (error) {
    evidence.status = "FAIL";
    evidence.failure = String(error).slice(0, 2000);
    await save();
    throw error;
  } finally {
    page.off("request", countRequest);
  }
}
