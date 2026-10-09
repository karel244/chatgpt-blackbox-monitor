import test from "node:test";
import assert from "node:assert/strict";
import {
  HistoryStore,
  LIMITS,
  encode,
  conversationHistory,
  relatedHistory,
} from "../../src/history/storage.ts";
import { exportBundle, importBundle } from "../../src/history/bundle.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
import type { CaptureStart } from "../../src/host/types.ts";

function auxiliary(
  id: string,
  mode: CaptureStart["mode"] = "environment",
  active = false,
) {
  const a = sample(id, 0),
    base = a.snapshot.events[0]!;
  a.j.clear();
  a.j.start({ ...a.snapshot.start, mode, transport: "dom" });
  a.j.append({
    task_scope: base.task_scope,
    message_id: base.message_id,
    channel: base.channel,
    transport_segment_id: base.transport_segment_id,
    value_state: "value",
    schema_version: base.schema_version,
    adapter_version: base.adapter_version,
    rule_version: base.rule_version,
    capture_id: id,
    direction: "local",
    transport: "dom",
    field_namespace: "environment.fields",
    field: "browser",
    source_path: "derived:navigator.userAgent",
    source_type: "local_environment",
    raw_source_type: "dom",
    level: "E",
    endpoint_verified: false,
    association: "orphan",
    association_proof: "document_environment_only",
    value: "Chrome",
  });
  if (!active) {
    a.j.complete(id);
    a.time(64000);
    a.j.tick();
  }
  return a;
}

test("200 conversation rounds plus environment retain first round and 201 records; 201 rounds evict only oldest live", async () => {
  const store = new MemoryStore();
  let wall = 0;
  const h = new HistoryStore(store, "policy", () => wall);
  await h.init();
  for (let i = 0; i < 200; i++) {
    wall = i;
    await h.flush(sample(`round-${i}`, 0).j);
  }
  wall = 200;
  await h.flush(auxiliary("env").j);
  const clean = await h.cleanup(),
    records = await h.list();
  assert.equal(clean.conversation_rounds, 200);
  assert.equal(clean.total_records, 201);
  assert.equal(clean.auxiliary_records, 1);
  assert.ok(records.some((r) => r.manifest.capture_id === "round-0"));
  const rows = conversationHistory(records);
  assert.equal(rows.length, 200);
  assert.equal(rows.at(-1)!.manifest.capture_id, "round-0");
  const old = rows.at(-1)!,
    related = relatedHistory(records, old.snapshot);
  assert.equal(related.length, 1);
  const exported = await exportBundle(
    old.snapshot,
    "test",
    {},
    { state: "not_compared" },
    related,
  );
  const imported = await importBundle(exported.bytes);
  assert.equal(imported.verified, true);
  assert.equal(imported.related[0]!.start.mode, "environment");
  assert.equal(imported.related[0]!.events[0]!.level, "E");
  assert.ok(!JSON.stringify(imported).includes("SECRET"));
  wall = 201;
  await h.flush(sample("round-200", 0).j);
  const next = await h.cleanup(),
    remaining = await h.list();
  assert.equal(next.conversation_rounds, 200);
  assert.equal(next.total_records, 201);
  assert.equal(next.removed.conversation_limit, 1);
  assert.ok(!remaining.some((r) => r.manifest.capture_id === "round-0"));
  assert.ok(remaining.some((r) => r.manifest.capture_id === "env"));
});

test("global byte budget removes closed auxiliary before live and protects active; age applies to both closed modes", async () => {
  const store = new MemoryStore(),
    limits = { ...LIMITS };
  let wall = 0;
  const h = new HistoryStore(store, "budget", () => wall, limits);
  await h.init();
  await h.flush(sample("live", 0).j);
  wall = 1;
  await h.flush(auxiliary("env").j);
  wall = 2;
  await h.flush(auxiliary("active", "environment", true).j);
  const records = await h.list(),
    bytes = (id: string) => {
      const r = records.find((r) => r.manifest.capture_id === id)!;
      return r.manifest.bytes + encode(r.manifest).length;
    };
  limits.total = bytes("live") + bytes("active");
  const first = await h.cleanup();
  assert.equal(first.removed.auxiliary, 1);
  assert.equal(first.removed.live, 0);
  assert.equal(first.active_retained, 1);
  limits.total = bytes("active");
  const second = await h.cleanup();
  assert.equal(second.removed.live, 1);
  assert.equal(second.active_retained, 1);
  limits.total = LIMITS.total;
  wall = 3;
  await h.flush(sample("old-live", 0).j);
  await h.flush(auxiliary("old-env").j);
  wall = 31 * 86400000;
  const age = await h.cleanup();
  assert.equal(age.removed.age, 2);
  assert.equal(age.removed.live, 1);
  assert.equal(age.removed.auxiliary, 1);
  assert.equal(age.active_retained, 1);
  assert.equal(age.total_records, 1);
});

test("historical related context excludes different document/epoch and caps related export input", async () => {
  const store = new MemoryStore(),
    h = new HistoryStore(store, "scope");
  await h.init();
  await h.flush(sample("live", 0).j);
  for (let i = 0; i < 34; i++)
    await h.flush(auxiliary(`aux-${i}`, i % 2 ? "network" : "requirements").j);
  const rows = await h.list(),
    live = rows.find((r) => r.snapshot.start.mode === "live")!;
  assert.equal(conversationHistory(rows).length, 1);
  assert.equal(relatedHistory(rows, live.snapshot).length, 32);
  const changed = structuredClone(live.snapshot);
  changed.start.context.epoch++;
  assert.equal(relatedHistory(rows, changed).length, 0);
  changed.start.context.epoch = 0;
  changed.start.context.document_id = "other-document";
  assert.equal(relatedHistory(rows, changed).length, 0);
});
