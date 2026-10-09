import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
export async function diagnoseDom(page, output, name, { after = false } = {}) {
  const result = {
    phase: after ? "after" : "before",
    status: "RUNNING",
    views: [],
  };
  const root = page.locator("#chatgpt-blackbox-monitor");
  const click = async (key) =>
    root
      .getByRole("button", {
        name: await page.evaluate(
          (k) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(k),
          key,
        ),
        exact: true,
      })
      .click();
  const sample = async (view) =>
    page.evaluate(async (view) => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const label = h.ui.i18n.t("Evidence content");
      const section =
        view === "Timeline"
          ? [...h.ui.shadow.querySelectorAll("[aria-label]")].find(
              (el) => el.getAttribute("aria-label") === label,
            )
          : h.ui.shadow.querySelector(".cards");
      if (!section) throw Error("evidence_section_not_found");
      const first = () =>
        view === "Timeline"
          ? section.querySelector("article")
          : section.querySelector(".card");
      const node = first();
      if (!node) throw Error("timeline_article_not_found");
      const disclosure = () =>
        [...section.querySelectorAll("details")].find(
          (d) =>
            d.querySelector("summary")?.textContent ===
            h.ui.i18n.t("Raw fields"),
        );
      const details = disclosure();
      if (!details) throw Error("raw_details_not_found");
      const summary = details.querySelector("summary");
      if (!summary) throw Error("raw_summary_not_found");
      const ids = new WeakMap();
      let next = 0;
      const id = (n) =>
        n ? (ids.has(n) ? ids.get(n) : (ids.set(n, ++next), next)) : null;
      const start = performance.now(),
        trace = [],
        samples = [];
      const snapshot = () => {
        const current = first(),
          d = disclosure(),
          s = d?.querySelector("summary");
        const pageText = section.querySelector("p")?.textContent ?? null;
        const totals = pageText?.match(/\d+/g);
        return {
          monotonic_ms: performance.now(),
          selected: h.ui.selected,
          category: view,
          page_text: pageText,
          timeline_total:
            view === "Timeline" && totals ? Number(totals.at(-1)) : null,
          article_count: section.querySelectorAll("article").length,
          first_event_id: current?.dataset.eventId ?? null,
          summary_text: s?.textContent ?? null,
          same_article_node: current === node,
          same_details_node: d === details,
          same_summary_node: s === summary,
          original_summary_connected: summary.isConnected,
          current_summary_connected: !!s?.isConnected,
          details_open: d?.open ?? null,
          node_identity: { row: id(current), details: id(d), summary: id(s) },
          elapsed_display:
            h.ui.shadow.querySelector(".launcher").dataset.duration,
        };
      };
      const observer = new window.MutationObserver((records) => {
        for (const r of records)
          for (const kind of ["removedNodes", "addedNodes"])
            for (const n of r[kind])
              if (n.nodeType === 1)
                trace.push({
                  monotonic_ms: performance.now(),
                  mutation_type: r.type,
                  change: kind,
                  tag: n.tagName,
                  event_id: n.dataset?.eventId ?? null,
                  original_summary_connected: summary.isConnected,
                });
      });
      observer.observe(section, { childList: true, subtree: true });
      samples.push(snapshot());
      await new Promise((resolve) => {
        const timer = window.setInterval(() => {
          if (performance.now() - start >= samples.length * 1100) {
            samples.push(snapshot());
            if (samples.length === 4) {
              window.clearInterval(timer);
              resolve();
            }
          }
        }, 50);
      });
      observer.disconnect();
      return {
        view,
        samples,
        mutations: trace,
        observation_ms: performance.now() - start,
      };
    }, view);
  try {
    const id = await page.evaluate(async () => {
      const h = window.__BLACKBOX_SYNTHETIC__,
        before = new Set(h.monitor.journal.ids());
      const r = await fetch("/backend-api/f/conversation?case=ui-locale", {
        method: "POST",
        body: JSON.stringify({ model: "gpt-5-6-thinking" }),
      });
      await r.text();
      return h.monitor.journal
        .ids()
        .find(
          (id) =>
            !before.has(id) &&
            h.monitor.journal.snapshot(id).start.mode === "live",
        );
    });
    await page.waitForFunction(
      (id) =>
        window.__BLACKBOX_SYNTHETIC__.monitor.journal
          .snapshot(id)
          ?.events.some((e) => e.level === "A"),
      id,
    );
    await click("View details");
    await click("Advanced evidence");
    const before = await sample("Timeline");
    result.views.push(before);
    result.click_start_ms = await page.evaluate(() => performance.now());
    try {
      await root.locator("article summary").first().click();
      result.click = "PASS";
    } catch (error) {
      result.click = "FAIL";
      result.click_error = String(error);
      if (after) throw error;
    }
    result.click_end_ms = await page.evaluate(() => performance.now());
    if (after) {
      assert.ok(
        before.samples.every(
          (s) =>
            s.same_summary_node && s.same_details_node && s.same_article_node,
        ),
      );
      const opened = await sample("Timeline");
      result.views.push(opened);
      assert.ok(
        opened.samples.every((s) => s.details_open && s.same_summary_node),
      );
      result.incremental_append = await page.evaluate((id) => {
        const h = window.__BLACKBOX_SYNTHETIC__,
          before = h.monitor.journal.snapshot(id),
          e = before.events.find((e) => e.level === "A");
        const added = h.monitor.journal.append({
          ...e,
          value: "incremental-one",
        });
        const current = h.monitor.journal.snapshot(id);
        return {
          new_event_id: added?.event_id ?? null,
          journal_presence:
            !!added &&
            current.events.some((event) => event.event_id === added.event_id),
          journal_count_before: before.events.length,
          journal_count_after: current.events.length,
        };
      }, id);
      assert.ok(result.incremental_append.new_event_id);
      assert.equal(result.incremental_append.journal_presence, true);
      assert.equal(
        result.incremental_append.journal_count_after,
        result.incremental_append.journal_count_before + 1,
      );
      const incremental = await sample("Timeline");
      result.views.push(incremental);
      assert.ok(
        incremental.samples.every(
          (s) =>
            s.same_article_node &&
            s.same_details_node &&
            s.same_summary_node &&
            s.original_summary_connected &&
            s.details_open,
        ),
      );
      const prior = opened.samples.at(-1),
        latest = incremental.samples.at(-1);
      const PAGE_SIZE = 50;
      result.incremental_pagination = {
        before_total: prior.timeline_total,
        after_total: latest.timeline_total,
        before_rows: prior.article_count,
        after_rows: latest.article_count,
        page_size: PAGE_SIZE,
        full_page: prior.article_count === PAGE_SIZE,
      };
      assert.ok(Number.isInteger(prior.timeline_total));
      assert.equal(latest.timeline_total, prior.timeline_total + 1);
      assert.equal(
        latest.article_count,
        prior.article_count === PAGE_SIZE ? PAGE_SIZE : prior.article_count + 1,
      );
      assert.ok(incremental.samples.every((s) => s.article_count <= PAGE_SIZE));
      await root.locator("article summary").first().click();
      const closed = await sample("Timeline");
      result.views.push(closed);
      assert.ok(
        closed.samples.every((s) => !s.details_open && s.same_summary_node),
      );
    }
    await click("Close");
    await click("View details");
    const quick = await sample("Quick");
    result.views.push(quick);
    if (after) {
      assert.ok(
        quick.samples.every((s) => s.same_details_node && s.same_summary_node),
      );
      await root
        .locator(".cards")
        .getByText(
          await page.evaluate(() =>
            window.__BLACKBOX_SYNTHETIC__.ui.i18n.t("Raw fields"),
          ),
          { exact: true },
        )
        .click();
      const opened = await sample("Quick");
      result.views.push(opened);
      assert.ok(
        opened.samples.every((s) => s.same_summary_node && s.details_open),
      );
      await click("Advanced evidence");
      const t = (key) =>
        page.evaluate((k) => window.__BLACKBOX_SYNTHETIC__.ui.i18n.t(k), key);
      const category = async (value) => {
        const nav = root.locator(`.work-nav button[data-category="${value}"]`);
        if (!(await nav.isVisible()))
          await root.locator(".work-nav details summary").click();
        await nav.click();
      };
      const controls = async (keys, focused) => {
        const evidence = await page.evaluate(
          async ({ keys, focused }) => {
            const h = window.__BLACKBOX_SYNTHETIC__,
              shadow = h.ui.shadow;
            const find = (key) =>
              [...shadow.querySelectorAll("[aria-label]")].find(
                (el) => el.getAttribute("aria-label") === h.ui.i18n.t(key),
              );
            const nodes = keys.map(find);
            if (nodes.some((n) => !n)) throw Error("form_control_not_found");
            const values = nodes.map((n) => n.value),
              focus = find(focused);
            const start = performance.now(),
              samples = [];
            const snapshot = () => ({
              monotonic_ms: performance.now(),
              identity: nodes.map(
                (n, i) => n === find(keys[i]) && n.isConnected,
              ),
              values_unchanged: nodes.map((n, i) => n.value === values[i]),
              focus_unchanged: shadow.activeElement === focus,
            });
            samples.push(snapshot());
            await new Promise((resolve) => {
              const timer = setInterval(() => {
                if (performance.now() - start >= samples.length * 1100) {
                  samples.push(snapshot());
                  if (samples.length === 4) {
                    clearInterval(timer);
                    resolve();
                  }
                }
              }, 50);
            });
            return { keys, samples, observation_ms: performance.now() - start };
          },
          { keys, focused },
        );
        result.controls ??= [];
        result.controls.push(evidence);
        assert.ok(
          evidence.samples.every(
            (s) =>
              s.identity.every(Boolean) &&
              s.values_unchanged.every(Boolean) &&
              s.focus_unchanged,
          ),
        );
      };
      await category("Experiment");
      await root
        .getByLabel(
          await t("Optional transient user content for HMAC association"),
          { exact: true },
        )
        .fill("synthetic-only transient draft");
      await root
        .getByLabel(await t("Optional shared local experiment key"), {
          exact: true,
        })
        .fill("fixture-only");
      await root
        .getByLabel(await t("Local experiment descriptor JSON"), {
          exact: true,
        })
        .fill("fixture draft");
      await controls(
        [
          "Local experiment descriptor JSON",
          "Optional shared local experiment key",
          "Optional transient user content for HMAC association",
          "Import local experiment descriptor",
          "Current capture",
          "Evidence section",
        ],
        "Local experiment descriptor JSON",
      );
      await category("Compare");
      await root
        .getByLabel(await t("Timing ratio flag threshold"), { exact: true })
        .fill("12");
      await root
        .getByLabel(await t("Timing absolute difference threshold in ms"), {
          exact: true,
        })
        .fill("12345");
      await controls(
        [
          "Timing ratio flag threshold",
          "Timing absolute difference threshold in ms",
          "Current capture",
          "Evidence section",
        ],
        "Timing absolute difference threshold in ms",
      );
      await category("Timeline");
      const returned = await sample("Timeline");
      result.views.push(returned);
      assert.ok(
        returned.samples.every(
          (s) =>
            s.same_article_node &&
            s.same_details_node &&
            s.same_summary_node &&
            !s.details_open,
        ),
      );
      await click("Next page");
      const paginated = await sample("Timeline");
      result.views.push(paginated);
      assert.notEqual(
        paginated.samples[0].first_event_id,
        returned.samples[0].first_event_id,
      );
      assert.ok(
        paginated.samples.every(
          (s) =>
            s.same_article_node &&
            s.same_details_node &&
            s.same_summary_node &&
            s.original_summary_connected &&
            s.article_count <= 50,
        ),
      );
    }
    result.classification = after
      ? "STABILITY_PASS"
      : before.samples
            .slice(1)
            .every((s) => !s.same_summary_node && !s.original_summary_connected)
        ? "R1"
        : "R3";
    result.quick_rebuild = quick.samples
      .slice(1)
      .some((s) => !s.same_summary_node);
    result.status = after ? "PASS" : "DIAGNOSTIC_COMPLETED";
    if (!after) assert.equal(result.classification, "R1");
    return result;
  } catch (error) {
    result.status = "FAIL";
    result.error = String(error);
    await page
      .screenshot({ path: `${output}/${name}-dom-first-failure.png` })
      .catch(() => {});
    throw error;
  } finally {
    await writeFile(
      `${output}/${name}-dom-stability.json`,
      JSON.stringify(result, null, 2),
    );
  }
}
