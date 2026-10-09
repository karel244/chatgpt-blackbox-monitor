import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

export async function verifyGitHubUX(page, output, name) {
  const evidence = {
    status: "RUNNING",
    scope: "synthetic-only / official Tampermonkey",
    steps: [],
    contrasts: [],
    confirmations: [],
  };
  const started = performance.now();
  const root = page.locator("#chatgpt-blackbox-monitor");
  const t = (key) =>
    page.evaluate((k) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(k), key);
  const click = async (key) =>
    root.getByRole("button", { name: await t(key), exact: true }).click();
  const save = () =>
    writeFile(
      `${output}/${name}-github-ux.json`,
      JSON.stringify(evidence, null, 2),
    );
  const shots = `${output}/github-screenshots/${name}`;
  await mkdir(shots, { recursive: true });
  const shot = (file) => page.screenshot({ path: `${shots}/${file}.png` });
  const ready = () =>
    page.waitForFunction(
      () => !!window.__BLACKBOX_SYNTHETIC__?.ui?.host.isConnected,
    );
  const openSettings = async () => {
    if (await root.locator(".launcher").isVisible())
      await click("View details");
    if (await root.locator(".panel").isVisible())
      await click("Back to controls");
    if (!(await root.locator(".settings-popover").isVisible()))
      await click("More options");
    const settings = root.locator(".settings-popover");
    if (!(await settings.evaluate((e) => e.open)))
      await settings.locator("summary").first().click();
    return settings;
  };
  const locale = async (value) => {
    await openSettings();
    await root
      .getByLabel(await t("Language"), { exact: true })
      .selectOption(value);
    await click("More options");
  };
  const send = async (kind, model = "gpt-5-6-thinking") => {
    const id = await page.evaluate(
      async ({ kind, model }) => {
        const h = window.__BLACKBOX_SYNTHETIC__,
          before = new Set(h.monitor.journal.ids());
        await (
          await fetch(`/backend-api/f/conversation?case=${kind}`, {
            method: "POST",
            body: JSON.stringify({ model, thinking_effort: "high" }),
          })
        ).text();
        return h.monitor.journal
          .ids()
          .find(
            (id) =>
              !before.has(id) &&
              h.monitor.journal.snapshot(id)?.start.mode === "live",
          );
      },
      { kind, model },
    );
    assert.ok(id, "fresh native conversation capture");
    await page.waitForFunction(
      (id) =>
        window.__BLACKBOX_SYNTHETIC__.monitor.journal
          .snapshot(id)
          ?.events.some((e) => e.field_namespace === "network.verdict"),
      id,
    );
    return id;
  };
  const selector = async () =>
    root.getByLabel(await t("Current capture"), { exact: true });
  const firstKey =
    "No conversation evidence yet. Send a new message to inspect it. Click the capsule to open the panel.";
  const recentKey =
    "Showing a recent conversation summary. Export ZIP uses Current capture above; export older rounds from History.";
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("http://127.0.0.1:43997/");
    await ready();
    assert.equal(await root.locator(".quick").isVisible(), false);
    assert.equal(await root.locator(".panel").isVisible(), false);
    assert.match(
      await root.locator(".launcher").innerText(),
      /^● 未知 · 未知 · 未知 · 未知$/,
    );
    assert.ok(
      (await root.locator(".launcher").getAttribute("title")).includes(
        await t(firstKey),
      ),
    );
    assert.ok(
      (
        await root.locator(".launcher").getAttribute("aria-description")
      ).includes(await t(firstKey)),
    );
    await click("View details");
    const helper = root.locator(".display-context");
    for (const language of ["en-US", "zh-CN"]) {
      await locale(language);
      assert.ok((await helper.innerText()).includes(await t(firstKey)));
      const text = await root.locator(".launcher").textContent();
      assert.ok(
        text.includes(language === "zh-CN" ? " · 未知 · " : " · Unknown · "),
      );
      evidence.steps.push({
        label: "first-run/no-conversation",
        language,
        launcher: text,
        helper: await helper.innerText(),
      });
    }
    const missingA = await send("p4-identity", "gpt-future-raw-9");
    await (await selector()).selectOption(missingA);
    assert.equal(await helper.isVisible(), false);
    assert.ok(
      !(await root.locator(".launcher").getAttribute("title")).includes(
        await t(firstKey),
      ),
    );
    assert.ok(
      (await root.locator(".launcher").getAttribute("title")).includes(
        "gpt-future-raw-9",
      ),
    );
    assert.match(
      await root.locator(".cards > .conclusion").innerText(),
      /未知/,
    );
    evidence.steps.push({
      label:
        "captured request missing A is not onboarding; raw future model unchanged",
      capture_id: missingA,
      title: await root.locator(".launcher").getAttribute("title"),
    });
    const known = await send("ui-locale");
    await (await selector()).selectOption(known);
    assert.equal(await helper.isVisible(), false);
    assert.equal(
      await root.locator('.tabs [aria-selected="true"]').innerText(),
      "路由",
    );
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(
      () => window.__BLACKBOX_SYNTHETIC__.ui.host.dataset.theme === "light",
    );
    await shot("github-route");
    await click("Close");
    await shot("github-launcher");
    await click("View details");
    const luminance = (rgb) => {
      const values = rgb
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      await page.waitForFunction(
        (value) =>
          window.__BLACKBOX_SYNTHETIC__.ui.host.dataset.theme === value,
        theme,
      );
      const css = await root
        .locator(".cards > .conclusion small")
        .evaluate((small) => ({
          foreground: window.getComputedStyle(small).color,
          background: window.getComputedStyle(small.parentElement)
            .backgroundColor,
          font: window.getComputedStyle(small).fontSize,
        }));
      const a = luminance(css.foreground),
        b = luminance(css.background);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(ratio >= 4.5, `${theme}: ${ratio}`);
      assert.equal(css.font, "11px");
      assert.equal(
        css.foreground,
        theme === "light" ? "rgb(25, 36, 46)" : "rgb(156, 174, 185)",
      );
      evidence.contrasts.push({ theme, ...css, ratio });
    }
    await page.emulateMedia({ colorScheme: "light" });
    await root
      .getByRole("tab", { name: await t("Network"), exact: true })
      .click();
    assert.match(
      await root.locator(".cards > .conclusion").innerText(),
      /正常/,
    );
    const abnormal = await send("p5-429-seconds");
    await (await selector()).selectOption(abnormal);
    assert.match(await root.locator(".cards").innerText(), /429/);
    await shot("github-network-abnormal");
    evidence.steps.push({
      label: "known launcher / Route default / healthy 200 / abnormal 429",
      known,
      abnormal,
    });
    for (const language of ["zh-CN", "en-US"]) {
      await locale(language);
      for (const key of ["Clear current", "Clear history", "Clear all"]) {
        const menu = await openSettings();
        const details = menu
          .getByText(await t("Data management"), { exact: true })
          .locator("..");
        if (!(await details.evaluate((e) => e.open)))
          await details.locator("summary").click();
        const before = await page.evaluate(() =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal.ids(),
        );
        const expected = await t(`Confirm ${key.toLowerCase()}`);
        const dialogEvent = page.waitForEvent("dialog");
        const clicked = click(key);
        const dialog = await dialogEvent;
        assert.equal(dialog.message(), expected);
        await dialog.dismiss();
        await clicked;
        const after = await page.evaluate(() =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal.ids(),
        );
        assert.ok(
          before.every((id) => after.includes(id)),
          "cancel cannot delete captures",
        );
        evidence.confirmations.push({
          language,
          key,
          text: expected,
          cancel_preserved: true,
        });
      }
      await click("More options");
    }
    await locale("zh-CN");
    await page.goto("http://127.0.0.1:43997/");
    await ready();
    const anchor = await send("ui-locale");
    await page.waitForFunction(
      (id) => window.__BLACKBOX_SYNTHETIC__.ui.selected === id,
      anchor,
    );
    await page.evaluate(() => history.replaceState({}, "", location.href));
    await page.waitForFunction(
      () =>
        window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(".launcher")
          .dataset.displaySource === "recent" &&
        window.__BLACKBOX_SYNTHETIC__.ui.selected === null,
    );
    await click("View details");
    assert.ok((await helper.innerText()).includes(await t(recentKey)));
    assert.equal(await (await selector()).locator("option").count(), 0);
    const source = await page.evaluate(() => ({
      selected: window.__BLACKBOX_SYNTHETIC__.ui.selected,
      display:
        window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(".launcher")
          .dataset.captureId,
    }));
    assert.deepEqual(source, { selected: null, display: anchor });
    for (const language of ["en-US", "zh-CN"]) {
      await locale(language);
      assert.ok((await helper.innerText()).includes(await t(recentKey)));
      evidence.steps.push({
        label: "recent summary explains strict export scope",
        language,
        helper: await helper.innerText(),
        ...source,
      });
    }
    const current = await send("ui-locale");
    await (await selector()).selectOption(current);
    assert.equal(await helper.isVisible(), false);
    evidence.steps.push({
      label:
        "selected current capture has no misleading recent or first-run helper",
      current,
    });
    assert.equal(await root.locator("style").count(), 0);
    assert.equal(
      await root
        .getByRole("button", { name: /^(移动|重置位置|Move|Reset position)$/ })
        .count(),
      0,
    );
    evidence.status = "PASS";
  } catch (error) {
    evidence.status = "FAIL";
    evidence.error = String(error);
    evidence.stack = error.stack;
    await shot("first-failure").catch(() => {});
    throw error;
  } finally {
    evidence.duration_ms = performance.now() - started;
    await save();
  }
  return evidence;
}
