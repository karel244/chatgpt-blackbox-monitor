import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

export async function verifyCleanup(page, output, name) {
  const evidence = {
    scope: "official Tampermonkey; actual synthetic requests; UI display only",
    steps: [],
  };
  const dir = `${output}/cleanup-screenshots/${name}`;
  await mkdir(dir, { recursive: true });
  const save = () =>
    writeFile(
      `${output}/${name}-ux-cleanup.json`,
      JSON.stringify(evidence, null, 2),
    );
  const root = page.locator("#chatgpt-blackbox-monitor"),
    cards = root.locator(".cards");
  const t = (key) =>
    page.evaluate((k) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(k), key);
  const click = async (key) =>
    root.getByRole("button", { name: await t(key), exact: true }).click();
  const tab = async (key) =>
    root.getByRole("tab", { name: await t(key), exact: true }).click();
  const shot = (file) => page.screenshot({ path: `${dir}/${file}.png` });
  // Match the summary through the current locale, not a hard-coded translation.
  const fold = async (key) =>
    cards
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: await t(key) }) });
  const current = async () =>
    root.getByLabel(await t("Current capture"), { exact: true });
  const send = async (kind) => {
    const id = await page.evaluate(async (kind) => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        before = new Set(h.monitor.journal.ids());
      const r = await fetch(`/backend-api/f/conversation?case=${kind}`, {
        method: "POST",
        body: JSON.stringify({
          model: "gpt-5-6-thinking",
          thinking_effort: "high",
        }),
      });
      await r.text();
      return h.monitor.journal
        .ids()
        .find(
          (id) =>
            !before.has(id) &&
            h.monitor.journal.snapshot(id).start.mode === "live",
        );
    }, kind);
    assert.ok(id, "fresh conversation capture exists");
    await page.waitForFunction(
      (id) =>
        window.__BLACKBOX_SYNTHETIC__.monitor.journal
          .snapshot(id)
          ?.events.some((e) => e.field_namespace === "network.verdict"),
      id,
    );
    await (await current()).selectOption(id);
    return id;
  };
  const inspectFold = async (key) => {
    const node = await fold(key);
    assert.equal(await node.evaluate((el) => el.open), false);
    const summary = node.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    assert.equal(await node.evaluate((el) => el.open), true);
    const text = await node.textContent();
    // Cross a real refresh tick and prove this same disclosure stays connected/open.
    const stable = await node.evaluate(async (el) => {
      const start = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 1100));
      return {
        connected: el.isConnected,
        open: el.open,
        duration_ms: performance.now() - start,
      };
    });
    assert.ok(stable.connected && stable.open);
    await summary.click();
    return { text, stable };
  };
  try {
    await page.goto("http://127.0.0.1:43997/");
    await page.waitForFunction(
      () => !!window.__BLACKBOX_SYNTHETIC__?.ui?.host.isConnected,
    );
    await click("View details");
    await click("More options");
    const settings = root.locator(".settings-popover");
    if (!(await settings.evaluate((el) => el.open)))
      await settings.locator("summary").first().click();
    await root
      .getByLabel(await t("Language"), { exact: true })
      .selectOption("zh-CN");
    await click("More options");
    const normal = await send("ui-locale");
    assert.equal(
      await root
        .getByRole("tab", { name: await t("Overview"), exact: true })
        .count(),
      0,
    );
    assert.equal(
      await root.locator('.tabs [aria-selected="true"]').innerText(),
      await t("Route"),
    );
    await tab("Route");
    assert.equal(await cards.locator(":scope > .card").count(), 5);
    assert.match(await cards.locator(".conclusion").innerText(), /路由一致/);
    assert.equal(
      await (await fold("Evidence details")).evaluate((el) => el.open),
      false,
    );
    await shot("route-cleanup");
    evidence.steps.push({
      label: "Route verdict first and technical evidence accessible",
      detail: await inspectFold("Evidence details"),
    });
    await tab("Network");
    assert.equal(await cards.locator(":scope > .card").count(), 2);
    assert.match(await cards.locator(".conclusion").innerText(), /正常/);
    assert.match(await cards.innerText(), /200/);
    await shot("network-normal-cleanup");
    evidence.steps.push({
      label: "Healthy 200 disclosure",
      detail: await inspectFold("Detailed diagnostics"),
    });
    await tab("Environment");
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow
        .querySelector(".cards")
        ?.textContent.includes(" × "),
    );
    assert.equal(await cards.locator(":scope > .card").count(), 6);
    const viewport = await cards
      .locator(":scope > .card")
      .filter({ hasText: await t("viewport") })
      .innerText();
    assert.match(viewport, /\d+ × \d+/);
    assert.doesNotMatch(viewport, /[{}]/);
    await shot("environment-cleanup");
    evidence.steps.push({
      label: "Human viewport and collapsed technical metadata",
      viewport,
      detail: await inspectFold("Technical details"),
    });
    await tab("History");
    await cards.locator(".history-row").first().waitFor();
    assert.ok((await cards.locator(".history-row").count()) <= 20);
    const row = cards
      .locator(".history-row")
      .filter({ hasText: `#${normal.slice(0, 8)}` });
    await row.waitFor();
    assert.match(
      await row.locator("strong").innerText(),
      /\d{2}:\d{2}.*gpt-5-6-thinking/,
    );
    assert.match(
      await row.locator(".history-caption > span").innerText(),
      /路由一致.*高.*秒/,
    );
    assert.match(await row.locator("small").innerText(), /服务器路由/);
    assert.equal(await row.locator("button").innerText(), "↗");
    assert.match(
      await row.locator("button").getAttribute("aria-label"),
      /导出该轮历史/,
    );
    await shot("history-cleanup");
    const download = page.waitForEvent("download");
    await row.locator("button").click();
    await (await download).saveAs(`${output}/${name}-cleanup-history.zip`);
    evidence.steps.push({
      label:
        "History time/model/source/verdict/effort/duration and real compact export",
      text: await row.innerText(),
    });
    await send("p5-429-seconds");
    await tab("Network");
    assert.match(await cards.locator(".conclusion").innerText(), /请求受限/);
    const retry = cards
      .locator(":scope > .card")
      .filter({ hasText: "Retry-After" });
    assert.match(await retry.innerText(), /42/);
    await shot("network-abnormal-cleanup");
    evidence.steps.push({
      label: "429 auto-surfaces Retry-After without opening diagnosis",
      text: await cards.innerText(),
    });
    await send("p5-403-confirmed");
    await page.waitForFunction(() =>
      window.__BLACKBOX_SYNTHETIC__.ui.shadow
        .querySelector(".cards .conclusion")
        ?.textContent.includes("已确认挑战"),
    );
    assert.match(
      await cards
        .locator(":scope > .card")
        .filter({ hasText: "Cloudflare" })
        .innerText(),
      /challenge/,
    );
    await shot("network-challenge-cleanup");
    evidence.steps.push({
      label: "403 confirmed challenge auto-surface",
      text: await cards.innerText(),
    });
    const before = await page.evaluate(() =>
      JSON.stringify(
        window.__BLACKBOX_SYNTHETIC__.monitor.journal.snapshot(
          window.__BLACKBOX_SYNTHETIC__.ui.selected,
        ),
      ),
    );
    await click("More options");
    if (!(await settings.evaluate((el) => el.open)))
      await settings.locator("summary").first().click();
    await root
      .getByLabel(await t("Language"), { exact: true })
      .selectOption("en-US");
    await click("More options");
    await tab("Network");
    assert.match(
      await cards.locator(".conclusion").innerText(),
      /Challenge Confirmed/,
    );
    await inspectFold("Detailed diagnostics");
    await tab("Route");
    await inspectFold("Evidence details");
    await tab("Environment");
    await inspectFold("Technical details");
    const after = await page.evaluate(() =>
      JSON.stringify(
        window.__BLACKBOX_SYNTHETIC__.monitor.journal.snapshot(
          window.__BLACKBOX_SYNTHETIC__.ui.selected,
        ),
      ),
    );
    assert.equal(after, before);
    evidence.steps.push({
      label:
        "Unified English labels, keyboard disclosure, capture byte equality",
      equal: true,
    });
    evidence.status = "PASS";
    await save();
    return evidence;
  } catch (error) {
    evidence.status = "FAIL";
    evidence.error = String(error);
    await shot("first-failure");
    await save();
    throw error;
  }
}
