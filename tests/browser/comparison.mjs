import assert from "node:assert/strict";
export async function verifyComparison(page, shared, name) {
  await page.goto("http://127.0.0.1:43997/");
  await page.waitForFunction(
    () => window.__BLACKBOX_SYNTHETIC__?.history?.health.status === "Ready",
  );
  const descriptor = shared?.descriptor ?? {
    schema_version: "experiment-1",
    experiment_uuid: await page.evaluate(() => crypto.randomUUID()),
    display_id: "AB-fixture-001",
    task_id: "same-task",
    replicate: 1,
    browser_label: name,
    conditions: Object.fromEntries(
      [
        "account",
        "attachments",
        "history",
        "memory",
        "tools",
        "mode",
        "browser_profile",
        "order",
      ].map((k) => [
        k,
        {
          value: k === "mode" ? "normal_chat" : null,
          availability: k === "mode" ? "declared" : "unknown",
        },
      ]),
    ),
  };
  const ids = [];
  for (let i = 0; i < 2; i++) {
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
      return (
        !!id &&
        h.monitor.journal.snapshot(id).events.some((e) => e.level === "A") &&
        h.monitor.journal
          .snapshot(id)
          .controls.some((c) => c.kind === "complete")
      );
    });
    ids.push(
      await page.evaluate(
        async (d) => {
          const h = window.__BLACKBOX_SYNTHETIC__;
          const id = h.monitor.journal
            .ids()
            .filter(
              (id) => h.monitor.journal.snapshot(id).start.mode === "live",
            )
            .at(-1);
          await h.experiments.save(d);
          await h.experiments.bind(id, d);
          return id;
        },
        { ...descriptor, browser_label: name },
      ),
    );
  }
  await page.waitForFunction(
    (ids) => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      h.monitor.journal.tick();
      return ids.every(
        (id) => h.monitor.journal.state(id).lifecycle === "Closed",
      );
    },
    ids,
    { timeout: 45000 },
  );
  const evidence = await page.evaluate(
    async ({ ids, remote }) => {
      const h = window.__BLACKBOX_SYNTHETIC__;
      const bundles = [];
      for (const id of ids) bundles.push(await h.bundle.export(id));
      const imported = [];
      for (const b of bundles) imported.push(await h.bundle.import(b.bytes));
      const local = h.comparison.compare(...imported);
      const duplicate = window.structuredClone(imported[1]);
      duplicate.comparison.run.descriptor.experiment_uuid = crypto.randomUUID();
      const cross = remote
        ? h.comparison.compare(
            await h.bundle.import(Uint8Array.from(remote)),
            imported[1],
          )
        : null;
      return {
        bytes: Array.from(bundles[0].bytes),
        local,
        cross,
        duplicate_display_ids_not_paired:
          h.comparison.compare(imported[0], duplicate).state ===
          "not_comparable",
        run_ids_independent:
          imported[0].manifest.run_id !== imported[1].manifest.run_id,
        descriptor_key_absent: !new TextDecoder()
          .decode(bundles[0].bytes)
          .includes('"key":'),
        all_closed: imported.every(
          (b) => b.summary.capture_health.lifecycle === "Closed",
        ),
        source:
          "Actual official GM/Tampermonkey request captures and local ZIP import/compare; real 30s settlement",
      };
    },
    { ids, remote: shared?.bytes },
  );
  for (const k of [
    "duplicate_display_ids_not_paired",
    "run_ids_independent",
    "descriptor_key_absent",
    "all_closed",
  ])
    assert.equal(evidence[k], true, "P8 " + k);
  assert.equal(evidence.local.state, "compared", "P8 local_pair");
  if (shared)
    assert.equal(
      evidence.cross.state,
      "compared",
      "P8 cross_browser_import_pair",
    );
  return { descriptor, evidence };
}
