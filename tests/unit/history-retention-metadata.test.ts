import test from "node:test";
import assert from "node:assert/strict";
import {
  HistoryStore,
  LIMITS,
  type HistoryManifest,
} from "../../src/history/storage.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
async function setup() {
  let now = 0;
  const store = new MemoryStore(),
    history = new HistoryStore(store, "index", () => now);
  await history.init();
  return {
    store,
    history,
    time: (value: number) => {
      now = value;
    },
  };
}
function active(id: string) {
  const a = sample(id, 0);
  a.j.clear();
  a.j.start(a.snapshot.start);
  return a;
}
test("cleanup reads manifest metadata only; valid old Closed deletes, active missing chunk remains", async (t) => {
  const { store, history, time } = await setup();
  await history.flush(sample("closed").j);
  const a = active("active");
  a.j.append(sample("active").snapshot.events[0]!);
  await history.flush(a.j);
  const activeKey = [...store.data.keys()].find((k) =>
    k.includes(":active:manifest"),
  )!;
  const m = (await store.get(activeKey)) as HistoryManifest;
  await store.delete(m.chunks[0]!.key);
  const read = t.mock.method(store, "get"),
    recover = t.mock.method(history, "recover"),
    list = t.mock.method(history, "list");
  time(31 * 86400000);
  const result = await history.cleanup();
  assert.equal(result.removed.age, 1);
  assert.equal(result.active_retained, 1);
  assert.equal(recover.mock.callCount(), 0);
  assert.equal(list.mock.callCount(), 0);
  assert.equal(
    read.mock.calls.filter((c) => c.arguments[0].includes(":chunk:")).length,
    0,
  );
  assert.ok(store.data.has(activeKey));
  assert.equal(
    (await history.recover(activeKey)).completeness,
    "Partial",
    "UI/recovery still validates missing chunk",
  );
});
test("malformed, unsupported schema and unknown lifecycle metadata remain undeleted", async () => {
  for (const fault of [
    "controls",
    "kind",
    "mode",
    "schema",
    "epoch",
    "bytes",
    "chunks",
    "count",
    "identity",
  ]) {
    const { store, history, time } = await setup();
    await history.flush(sample("protected", 0).j);
    const key = [...store.data.keys()].find((k) => k.endsWith(":manifest"))!;
    const m = (await store.get(key)) as HistoryManifest;
    if (fault === "controls")
      (m.snapshot as unknown as { controls: unknown }).controls = null;
    if (fault === "kind")
      (m.snapshot.controls[0] as unknown as { kind: string }).kind = "unknown";
    if (fault === "mode")
      (m.snapshot.start as unknown as { mode: string }).mode = "unknown";
    if (fault === "schema") m.schema_version = "future-unknown";
    if (fault === "epoch") m.clear_epoch = "wrong";
    if (fault === "bytes") m.bytes = -1;
    if (fault === "chunks") m.chunks[0]!.sha256 = "broken";
    if (fault === "count") m.count = -1;
    if (fault === "identity") m.capture_id = "other";
    await store.set(key, m);
    const before = structuredClone([...store.data]);
    time(31 * 86400000);
    await history.cleanup();
    assert.deepEqual([...store.data], before, fault);
  }
});
test("metadata retention exactly preserves 200 conversation rounds, auxiliary-first budget and active protection", async () => {
  const { store, history, time } = await setup();
  for (let i = 0; i < 201; i++) {
    time(i);
    await history.flush(sample(`round-${i}`, 0).j);
  }
  const env = sample("aux", 0);
  env.j.clear();
  env.j.start({ ...env.snapshot.start, mode: "environment" });
  env.j.complete("aux");
  env.time(64000);
  env.j.tick();
  await history.flush(env.j);
  await history.flush(active("active").j);
  const first = await history.cleanup();
  assert.equal(first.removed.conversation_limit, 1);
  assert.equal(first.auxiliary_records, 1);
  assert.equal(first.active_retained, 1);
  const records = await history.list();
  assert.equal(
    records.some((r) => r.manifest.capture_id === "round-0"),
    false,
  );
  const bytes = (id: string) => {
    const r = records.find((r) => r.manifest.capture_id === id)!;
    return (
      r.manifest.bytes +
      new TextEncoder().encode(JSON.stringify(r.manifest)).length
    );
  };
  history.limits.total = first.bytes - bytes("aux");
  const second = await history.cleanup();
  assert.equal(second.removed.auxiliary, 1);
  assert.equal(second.removed.live, 0);
  assert.equal(second.active_retained, 1);
  history.limits.total = bytes("active");
  const third = await history.cleanup();
  assert.equal(third.removed.live, 200);
  assert.equal(third.active_retained, 1);
  history.limits.total = LIMITS.total;
  time(31 * 86400000);
  await history.cleanup();
  assert.ok([...store.data.keys()].some((k) => k.endsWith(":active:manifest")));
});
