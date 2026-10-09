import test from "node:test";
import assert from "node:assert/strict";
import {
  createDescriptor,
  validateDescriptor,
  associatePrompt,
  Experiments,
  CONDITION_KEYS,
  type Run,
} from "../../src/compare/experiment.ts";
import {
  compareValue,
  compareBundles,
  baseline,
} from "../../src/compare/compare.ts";
import { sample, MemoryStore } from "../fixtures/history.ts";
import {
  exportBundle,
  importBundle,
  type Bundle,
} from "../../src/history/bundle.ts";
const descriptor = () =>
  createDescriptor("task-one", "Chrome", {
    mode: { value: "normal_chat", availability: "declared" },
    order: { value: 1, availability: "declared" },
  });
async function fixture(
  d = descriptor(),
  ms = 1000,
  kind = "complete",
  run = crypto.randomUUID(),
): Promise<Bundle> {
  const s = structuredClone(sample("compare", 1).snapshot);
  if (kind === "no-A") s.events = s.events.filter((e) => e.level !== "A");
  if (kind === "partial")
    s.controls.push({
      kind: "health",
      code: "fixture_partial",
      health: "Partial",
      timestamp: new Date(0).toISOString(),
      monotonic_ms: 0,
    });
  const final = s.controls.find((c) => c.kind === "complete")!;
  final.monotonic_ms = ms;
  const closed = s.controls.find((c) => c.kind === "closed")!;
  closed.monotonic_ms = ms + 31000;
  if (kind === "missing_duration")
    s.controls = s.controls.filter((c) => c.kind !== "complete");
  const association: Run = { descriptor: d, run_id: run, prompt: null };
  return importBundle(
    (
      await exportBundle(
        s,
        "compare-test",
        { experiment_id: d.experiment_uuid, run_id: run },
        { state: "not_compared", run: association },
      )
    ).bytes,
  );
}
test("comparison statuses never equate missing values and handle incompatible semantics", () => {
  assert.equal(compareValue(null, null).status, "Unknown");
  assert.equal(compareValue([], []).status, "Unknown");
  assert.equal(
    compareValue([{ value: null }], [{ value: null }]).status,
    "Unknown",
  );
  assert.equal(compareValue(false, false).status, "Equal");
  assert.equal(compareValue(1, 2).status, "Different");
  assert.equal(compareValue(1, 1, false).status, "Not comparable");
});
test("UUID task replicate independent runs pair; duplicate display IDs/browser labels do not guess pairing", async () => {
  const d = descriptor(),
    a = await fixture(d),
    b = await fixture(d);
  assert.equal(compareBundles(a, b).state, "compared");
  const other = descriptor();
  other.display_id = d.display_id;
  assert.equal(compareBundles(a, await fixture(other)).state, "not_comparable");
  assert.equal(
    compareBundles(a, await fixture({ ...d, task_id: "other" })).state,
    "not_comparable",
  );
  assert.equal(
    compareBundles(a, await fixture({ ...d, replicate: 2 })).state,
    "not_comparable",
  );
  assert.equal(compareBundles(a, a).state, "not_comparable");
});
test("Case15 dual A same, terminated Complete, 1s vs1200s yields only material client timing; absent A/Partial/missing duration remain limited", async () => {
  const d = descriptor(),
    a = await fixture(d),
    b = await fixture(d, 1200000);
  const r = compareBundles(a, b);
  assert.equal(r.fields.actual_route!.status, "Equal");
  assert.equal(r.fields.server_STE_chain!.status, "Equal");
  assert.equal(r.fields.resolved_route_chain!.status, "Equal");
  assert.equal(r.fields["timing.total_ms"]!.status, "Different");
  assert.equal(r.timing.flag, true);
  assert.equal(
    r.conclusion,
    "Observed client timing differs materially in this paired sample.",
  );
  const noA = compareBundles(
    await fixture(d, 1000, "no-A"),
    await fixture(d, 1200000, "no-A"),
  );
  assert.equal(noA.fields.actual_route!.status, "Unknown");
  assert.match(noA.conclusion, /Unknown/);
  assert.match(
    compareBundles(a, await fixture(d, 1200000, "partial")).conclusion,
    /insufficient/,
  );
  assert.equal(
    compareBundles(a, await fixture(d, 1200000, "missing_duration")).fields[
      "timing.total_ms"
    ]!.status,
    "Unknown",
  );
  b.read_only = true;
  assert.equal(
    compareBundles(a, b).fields.actual_route!.status,
    "Not comparable",
  );
  b.read_only = false;
  b.manifest.rule_versions = ["route-newer"];
  assert.equal(
    compareBundles(a, b).fields.actual_route!.status,
    "Not comparable",
  );
});
test("HMAC exact characters/whitespace/part order, shared local key, key mismatch Not comparable; no content/key export or GM body", async () => {
  const key = "ab".repeat(32),
    other = "cd".repeat(32);
  const p = await associatePrompt(key, ["TRANSIENT_CONTENT_CANARY", " x "]);
  assert.deepEqual(
    p,
    await associatePrompt(key, ["TRANSIENT_CONTENT_CANARY", " x "]),
  );
  assert.notEqual(
    p.hmac,
    (await associatePrompt(key, [" x ", "TRANSIENT_CONTENT_CANARY"])).hmac,
  );
  assert.notEqual(
    p.hmac,
    (await associatePrompt(key, ["TRANSIENT_CONTENT_CANARY", "x"])).hmac,
  );
  const s = new MemoryStore(),
    e = new Experiments(s),
    d = descriptor();
  await e.save(d, key);
  const run = await e.bind("local", d, ["TRANSIENT_CONTENT_CANARY"]);
  const bytes = (
    await exportBundle(
      sample().snapshot,
      "hmac-test",
      { experiment_id: d.experiment_uuid, run_id: run.run_id },
      { state: "not_compared", run },
    )
  ).bytes;
  const text = new TextDecoder().decode(bytes);
  assert.equal(text.includes(key), false);
  assert.equal(text.includes("TRANSIENT_CONTENT_CANARY"), false);
  assert.equal(
    JSON.stringify([...s.data]).includes("TRANSIENT_CONTENT_CANARY"),
    false,
  );
  const a = await importBundle(bytes),
    b = await fixture(d);
  (b.comparison as { run: Run }).run.prompt = await associatePrompt(other, [
    "TRANSIENT_CONTENT_CANARY",
  ]);
  assert.equal(
    compareBundles(a, b).fields.prompt_association!.status,
    "Not comparable",
  );
  (b.comparison as { run: Run }).run.prompt = run.prompt;
  assert.equal(compareBundles(a, b).fields.prompt_association!.status, "Equal");
});
test("conditions observed/declared/unknown; account declared only, secret descriptor fields rejected; baseline partitions mode/order", async () => {
  const d = descriptor();
  assert.deepEqual(Object.keys(d.conditions), [...CONDITION_KEYS]);
  assert.throws(() =>
    validateDescriptor({ ...d, email: "secret@example.com" }),
  );
  assert.throws(() => validateDescriptor({ ...d, browser_label: "<script>" }));
  assert.throws(() =>
    validateDescriptor({
      ...d,
      conditions: {
        ...d.conditions,
        account: { value: "same", availability: "observed" },
      },
    }),
  );
  const rows = [];
  for (let i = 1; i <= 5; i++)
    rows.push(
      compareBundles(await fixture(d, i * 1000), await fixture(d, i * 2000)),
    );
  const groups = baseline(rows);
  assert.equal(groups[0]!.eligible_pairs, 5);
  assert.equal(groups[0]!.left.median, 3000);
  assert.deepEqual(groups[0]!.right.range, [2000, 10000]);
  const work = {
    ...d,
    conditions: {
      ...d.conditions,
      mode: { value: "work", availability: "declared" as const },
    },
  };
  assert.equal(
    baseline([
      ...rows,
      compareBundles(await fixture(work), await fixture(work)),
    ]).length,
    2,
  );
  assert.match(baseline(rows.slice(0, 1))[0]!.recommendation, /3-5/);
});
