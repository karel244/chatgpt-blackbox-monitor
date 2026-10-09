import { writeFile } from "node:fs/promises";
export async function optionInventory(page, output, name, inputs) {
  const record = await page.evaluate(async (inputs) => {
    const h = window.__BLACKBOX_SYNTHETIC__,
      context = { ...h.context },
      ids = h.monitor.journal.ids();
    const snapshots = ids
      .map((id) => h.monitor.journal.snapshot(id))
      .filter(Boolean);
    const inventory = snapshots.map((s) => ({
      capture_id: s.start.capture_id,
      mode: s.start.mode,
      ...s.start.context,
      lifecycle:
        s.lifecycle?.lifecycle ??
        h.monitor.journal.state(s.start.capture_id)?.lifecycle,
    }));
    const current = snapshots
      .filter(
        (s) =>
          ["live", "reload"].includes(s.start.mode) &&
          s.start.context.document_id === context.document_id &&
          s.start.context.visit_id === context.visit_id &&
          s.start.context.epoch === context.epoch,
      )
      .sort((a, b) => b.start.started_at - a.start.started_at)
      .map((s) => s.start.capture_id);
    const select = h.ui.shadow.querySelector(".capture-context select"),
      box = select.getBoundingClientRect();
    const selector = {
      visible:
        box.width > 0 &&
        box.height > 0 &&
        window.getComputedStyle(select).visibility !== "hidden",
      enabled: !select.disabled,
      value: select.value,
      option_count: select.options.length,
      option_values: [...select.options].map((o) => o.value),
      option_labels: [...select.options].map((o) => o.textContent),
    };
    const keys = (await h.history.store.keys()).filter((k) =>
      k.endsWith(":manifest"),
    );
    const manifests = [];
    for (const k of keys) {
      const m = await h.history.store.get(k);
      if (inputs.ids.includes(m?.capture_id))
        manifests.push({
          capture_id: m.capture_id,
          clear_epoch: m.clear_epoch,
          mode: m.snapshot?.start?.mode,
          context: m.snapshot?.start?.context,
          committed_sequence: m.committed_sequence,
          status: m.status,
        });
    }
    const recovered = await h.history.list();
    const targets = inputs.ids.slice(0, 2).map((id) => {
      const s = h.monitor.journal.snapshot(id),
        r = recovered.find((r) => r.manifest.capture_id === id);
      return {
        capture_id: id,
        journal_has_id: ids.includes(id),
        snapshot_exists: !!s,
        mode: s?.start.mode ?? null,
        context: s?.start.context ?? null,
        lifecycle: s ? h.monitor.journal.state(id)?.lifecycle : null,
        projected_current: current.includes(id),
        selector_has_option: selector.option_values.includes(id),
        history_manifest_exists: manifests.some((m) => m.capture_id === id),
        recovered_record_exists: !!r,
        recovered_mode: r?.snapshot?.start.mode ?? null,
        recovered_context: r?.snapshot?.start.context ?? null,
        recovered_lifecycle: r?.snapshot?.lifecycle?.lifecycle ?? null,
      };
    });
    return {
      test_ids: {
        first: inputs.ids[0],
        second: inputs.ids[1],
        last: inputs.ids.at(-1),
        hidden_ids: inputs.hiddenIds,
      },
      initial_context: inputs.initialContext,
      current_context: context,
      journal: { count: ids.length, ids, inventory },
      targets,
      selector,
      currentCaptures_ids: current,
      persistent_history: { record_count: recovered.length, manifests },
    };
  }, inputs);
  const t = record.targets[0],
    old = t.context ?? t.recovered_context ?? record.initial_context,
    c = record.current_context;
  const changed =
    old &&
    (old.document_id !== c.document_id ||
      old.visit_id !== c.visit_id ||
      old.epoch !== c.epoch);
  record.classification =
    t.projected_current && !t.selector_has_option
      ? "A"
      : changed
        ? "C"
        : !t.projected_current && t.recovered_record_exists
          ? "B"
          : !t.snapshot_exists && !t.recovered_record_exists
            ? "D"
            : "Unproven";
  record.projection_equals_options =
    JSON.stringify(record.currentCaptures_ids) ===
    JSON.stringify(record.selector.option_values);
  await writeFile(
    `${output}/${name}-option-inventory.json`,
    JSON.stringify(record, null, 2),
  );
  return record;
}
