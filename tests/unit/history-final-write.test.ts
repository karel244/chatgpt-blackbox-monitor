import test from "node:test";
import assert from "node:assert/strict";
import {
  HistoryStore,
  LIMITS,
  type HistoryManifest,
} from "../../src/history/storage.ts";
import { safeSnapshot } from "../../src/history/safety.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
async function setup(limits = { ...LIMITS }) {
  const store = new MemoryStore(),
    history = new HistoryStore(store, "write-proof", Date.now, limits);
  const writes: { key: string; value: unknown }[] = [],
    set = store.set.bind(store);
  store.set = async (key, value) => {
    await set(key, value);
    writes.push({ key, value: structuredClone(value) });
  };
  await history.init();
  return { store, history, writes };
}
test("WRITE-A event batch commits one manifest; control-only health and Closed updates still commit", async () => {
  const { history, writes } = await setup(),
    a = sample("write");
  await history.flush(a.j);
  assert.deepEqual(
    writes.map((w) => w.key.split(":").slice(-2).join(":")),
    ["chunk:1", "write:manifest"],
  );
  assert.deepEqual(
    (await history.list())[0]!.snapshot,
    safeSnapshot(a.j.snapshot("write")!),
  );
  writes.length = 0;
  a.j.health("write", "Partial", "control_only");
  await history.flush(a.j);
  assert.equal(writes.length, 1);
  assert.ok(writes[0]!.key.endsWith(":manifest"));
  const x = sample("settling");
  x.j.clear();
  x.j.start(x.snapshot.start);
  x.j.append(x.snapshot.events[0]!);
  x.j.complete("settling");
  await history.flush(x.j);
  writes.length = 0;
  x.time(64000);
  x.j.tick();
  await history.flush(x.j);
  assert.equal(writes.length, 1);
  assert.ok(
    (await history.list())
      .find((r) => r.manifest.capture_id === "settling")!
      .snapshot.controls.some((c) => c.kind === "closed"),
  );
});
test("WRITE-A multi-chunk preserves each chunk-before-manifest commit without duplicate tail", async () => {
  const { history, writes } = await setup({ ...LIMITS, chunk: 4096 }),
    a = sample("multi", 20);
  await history.flush(a.j);
  const r = (await history.list())[0]!;
  assert.ok(r.manifest.chunks.length > 1);
  assert.equal(writes.length, r.manifest.chunks.length * 2);
  for (let i = 0; i < r.manifest.chunks.length; i++) {
    assert.ok(writes[i * 2]!.key.endsWith(`:chunk:${i + 1}`));
    assert.ok(writes[i * 2 + 1]!.key.endsWith(":manifest"));
    assert.equal(
      (writes[i * 2 + 1]!.value as HistoryManifest).committed_sequence,
      i + 1,
    );
  }
  assert.deepEqual(r.snapshot, safeSnapshot(a.j.snapshot("multi")!));
});
test("WRITE-A forced failure keeps manifest write and never marks clean", async () => {
  const { history, writes } = await setup({ ...LIMITS, pending: 1 });
  await history.flush(sample("forced").j);
  assert.equal(writes.length, 1);
  const m = writes[0]!.value as HistoryManifest;
  assert.equal(m.status, "Partial");
  assert.ok(m.notes.includes("pending_queue_limit"));
  assert.equal(m.chunks.length, 0);
});
test("WRITE-A budget failure after an earlier commit writes changed Partial manifest", async () => {
  const { history, writes } = await setup({
    ...LIMITS,
    chunk: 1500,
    occurrences: 1,
  });
  await history.flush(sample("limit", 0).j);
  assert.ok(
    writes.some((w) => w.key.includes(":chunk:")),
    "fixture first chunk committed",
  );
  const manifests = writes
    .filter((w) => w.key.endsWith(":manifest"))
    .map((w) => w.value as HistoryManifest);
  assert.ok(manifests.length >= 2);
  assert.equal(manifests[0]!.status, "Saved");
  assert.equal(manifests.at(-1)!.status, "Partial");
  assert.ok(manifests.at(-1)!.notes.includes("capture_storage_limit"));
  assert.equal(manifests.at(-1)!.count, 1);
});
test("WRITE-A interrupted chunk commit retains previous manifest and orphan recovery", async () => {
  const { history, store } = await setup();
  const first = sample("interrupt", 0);
  await history.flush(first.j);
  const key = [...store.data.keys()].find((k) => k.endsWith(":manifest"))!;
  const before = await store.get(key);
  first.j.append({ ...first.snapshot.events[0]!, value: "model-two" });
  store.fail = (k) => k.endsWith(":manifest");
  await history.flush(first.j);
  assert.equal(history.health.status, "Failed");
  assert.deepEqual(await store.get(key), before);
  const r = (await history.list())[0]!;
  assert.ok(r.notes.includes("orphan_chunk"));
  assert.equal(r.completeness, "Partial");
});
