import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
export async function diagnoseSelector(page, output, name) {
  const result = { status: "RUNNING", steps: [] };
  const start = performance.now();
  const root = page.locator("#chatgpt-blackbox-monitor"),
    t = (key) =>
      page.evaluate((k) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(k), key);
  const click = async (key) =>
    root.getByRole("button", { name: await t(key), exact: true }).click();
  const inspect = () =>
    page.evaluate(() => {
      const s =
        window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(
          "select[aria-label]",
        );
      const selector = window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelector(
        ".capture-context select",
      );
      const el = selector ?? s,
        r = el.getBoundingClientRect();
      return {
        parent: el.parentElement.className,
        quick_ancestor: !!el.closest(".quick"),
        panel_ancestor: !!el.closest(".panel"),
        visible:
          r.width > 0 &&
          r.height > 0 &&
          window.getComputedStyle(el).visibility !== "hidden",
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        selected: window.__BLACKBOX_SYNTHETIC__.ui.selected,
        value: el.value,
        selector_count:
          window.__BLACKBOX_SYNTHETIC__.ui.shadow.querySelectorAll(
            ".capture-context select",
          ).length,
      };
    });
  try {
    assert.equal(await root.locator(".capture-context select").count(), 1);
    assert.equal(
      await root.locator(".capture-context select").isVisible(),
      false,
    );
    const ids = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        before = new Set(h.monitor.journal.ids());
      for (let i = 0; i < 2; i++) {
        const r = await fetch("/backend-api/f/conversation?case=ui-locale", {
          method: "POST",
          body: JSON.stringify({
            model: "gpt-5-6-thinking",
            thinking_effort: "high",
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
    });
    await page.waitForFunction(
      (ids) =>
        ids.every((id) =>
          window.__BLACKBOX_SYNTHETIC__.monitor.journal
            .snapshot(id)
            .events.some((e) => e.level === "A"),
        ),
      ids,
    );
    await click("View details");
    const select = root.getByLabel(await t("Current capture"), { exact: true });
    await select.selectOption(ids[0]);
    const quick = await inspect();
    assert.ok(quick.visible && !quick.quick_ancestor && !quick.panel_ancestor);
    assert.equal(quick.selected, ids[0]);
    await click("Advanced evidence");
    const advanced = await inspect();
    assert.ok(advanced.visible);
    assert.equal(advanced.selected, ids[0]);
    assert.notEqual(await select.boundingBox(), null);
    assert.equal(await root.locator(".quick").isVisible(), false);
    const position = await root.locator(".shell").boundingBox();
    await select.click();
    await page.keyboard.press("Escape");
    const after = await root.locator(".shell").boundingBox();
    assert.ok(
      Math.abs(position.x - after.x) < 1 && Math.abs(position.y - after.y) < 1,
    );
    await select.selectOption(ids[1]);
    assert.equal(
      await page.evaluate(() => window.__BLACKBOX_SYNTHETIC__.ui.selected),
      ids[1],
    );
    await click("Close");
    await click("View details");
    const returned = await inspect();
    assert.equal(returned.value, ids[1]);
    assert.equal(returned.selected, ids[1]);
    assert.ok(returned.visible);
    result.steps.push({
      quick,
      advanced,
      returned,
      selector_drag_no_conflict: { position, after },
    });
    result.status = "PASS";
    return result;
  } catch (error) {
    result.status = "FAIL";
    result.failure = String(error);
    await page
      .screenshot({ path: `${output}/${name}-selector-first-failure.png` })
      .catch(() => {});
    throw error;
  } finally {
    result.duration_ms = performance.now() - start;
    await writeFile(
      `${output}/${name}-selector-diagnostic.json`,
      JSON.stringify(result, null, 2),
    );
  }
}
