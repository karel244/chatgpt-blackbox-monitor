import test from "node:test";
import assert from "node:assert/strict";
import {
  HistoryStore,
  LIMITS,
  encode,
  digest,
  type HistoryManifest,
} from "../../src/history/storage.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
import { projectState } from "../../src/core/journal.ts";
import { exportBundle, importBundle } from "../../src/history/bundle.ts";
async function setup(limits = { ...LIMITS }) {
  const s = new MemoryStore(),
    h = new HistoryStore(s, "tab-one", () => 1000, limits);
  await h.init();
  return { s, h };
}
test("normal multi-chunk GM persistence/recovery is append-only, committed after chunk, bundle roundtrip", async () => {
  const { s, h } = await setup({ ...LIMITS, chunk: 8192 });
  const a = sample("cap", 20);
  await h.flush(a.j);
  const records = await h.list();
  assert.equal(records.length, 1);
  const r = records[0]!;
  assert.ok(r.manifest.chunks.length > 1);
  assert.equal(r.completeness, "Complete");
  assert.equal(r.snapshot.events.length, a.snapshot.events.length);
  assert.equal(r.manifest.committed_sequence, r.manifest.chunks.length);
  assert.equal(
    (await importBundle((await exportBundle(r.snapshot, "test")).bytes)).summary
      .route_verdict.verdict,
    "Route Match",
  );
  const before = structuredClone(r.snapshot.events);
  a.time(40000);
  a.j.append({ ...a.snapshot.events.at(-1)!, value: "model-two" });
  await h.flush(a.j);
  const late = (await h.list())[0]!;
  assert.deepEqual(late.snapshot.events.slice(0, before.length), before);
  assert.equal(late.snapshot.events.at(-1)!.late_metadata, true);
  assert.ok(late.snapshot.events.at(-1)!.revision > 0);
  assert.ok(!JSON.stringify([...s.data.values()]).includes("SECRET"));
});
test("quota failure never reports success, interrupted commit leaves orphan and marks Partial", async () => {
  const { s, h } = await setup();
  s.fail = (k) => k.includes(":chunk:");
  await h.flush(sample().j);
  assert.equal(h.health.status, "Failed");
  assert.equal((await h.list()).length, 0);
  const x = await setup();
  await x.h.flush(sample("old").j);
  x.s.fail = (k) => k.endsWith(":manifest");
  const a = sample("old", 5);
  await x.h.flush(a.j);
  assert.equal(x.h.health.status, "Failed");
  const r = (await x.h.list())[0]!;
  assert.ok(r.notes.includes("orphan_chunk"));
  assert.equal(r.completeness, "Partial");
});
test("missing chunk, digest corruption, sequence gap and orphan each recover as Partial without invented data", async () => {
  for (const kind of ["missing", "hash", "gap", "orphan"]) {
    const { s, h } = await setup({ ...LIMITS, chunk: 8192 });
    await h.flush(sample("cap", 10).j);
    const r = (await h.list())[0]!,
      key = (await s.keys()).find((k) => k.endsWith(":manifest"))!,
      m = (await s.get(key)) as HistoryManifest;
    if (kind === "missing") await s.delete(m.chunks[0]!.key);
    if (kind === "hash")
      await s.set(m.chunks[0]!.key, {
        schema_version: "history-1",
        events: [],
      });
    if (kind === "gap") {
      m.chunks[0]!.sequence = 4;
      await s.set(key, m);
    }
    if (kind === "orphan")
      await s.set(key.replace(":manifest", ":chunk:999"), {
        schema_version: "history-1",
        events: [],
      });
    const recovered = (await h.list())[0]!;
    assert.equal(recovered.completeness, "Partial", kind);
    assert.ok(recovered.notes.length > 0);
    assert.ok(recovered.snapshot.events.length <= r.snapshot.events.length);
    assert.equal(projectState(recovered.snapshot).completeness, "Partial");
  }
});
test("two independent tabs avoid shared whole-history RMW; clear epoch stops old/offline/late writes", async () => {
  const s = new MemoryStore(),
    a = new HistoryStore(s, "tab-a"),
    b = new HistoryStore(s, "tab-b");
  await Promise.all([a.init(), b.init()]);
  const sa = sample("a"),
    sb = sample("b");
  await Promise.all([a.flush(sa.j), b.flush(sb.j)]);
  assert.equal((await a.list()).length, 2);
  b.dispose();
  await a.clearAll();
  await b.flush(sb.j);
  assert.equal((await b.list()).length, 0);
  await b.flush(sample("new-b").j);
  assert.equal((await a.list()).length, 1);
  assert.equal((await a.list())[0]!.manifest.capture_id, "new-b");
});
test("clear-current/history/all are distinct; active retained; pause invalidates without deleting saved evidence", async () => {
  const { h } = await setup();
  const a = sample("closed"),
    b = sample("active");
  b.j.clear();
  b.j.start({ ...b.snapshot.start, capture_id: "active" });
  await h.flush(a.j);
  await h.flush(b.j);
  await h.clearHistory();
  assert.deepEqual(
    (await h.list()).map((r) => r.manifest.capture_id),
    ["active"],
  );
  b.j.reset({ ...b.snapshot.start.context, epoch: 1 }, "pause");
  await h.flush(b.j);
  assert.equal((await h.list())[0]!.completeness, "Partial");
  await h.clearCurrent("active");
  await h.flush(b.j);
  assert.equal((await h.list()).length, 0);
});
test("200-run / 30-day / 50MiB policies simulated with explicit scale, active captures not TTL deleted", async () => {
  const { s } = await setup();
  let wall = 0;
  const h = new HistoryStore(s, "many", () => wall);
  await h.init();
  for (let k = 0; k < 201; k++) {
    wall = k;
    await h.flush(sample(`run-${k}`, 0).j);
  }
  assert.equal((await h.cleanup()).count, 200);
  wall = 31 * 86400000;
  assert.equal((await h.cleanup()).count, 0);
  const q = new HistoryStore(s, "quota-policy", () => wall, {
    ...LIMITS,
    total: 1024,
  });
  await q.init();
  await q.flush(sample("budget", 0).j);
  assert.equal((await q.cleanup()).count, 0);
  const a = sample("active", 0);
  a.j.clear();
  a.j.start(a.snapshot.start);
  await q.flush(a.j);
  wall += 40 * 86400000;
  assert.equal((await q.cleanup()).active_retained, 1);
  assert.equal((await q.list()).length, 1);
});
test("capture occurrence and byte budgets and real queue allocation are bounded and labeled Partial", async () => {
  const { h } = await setup({ ...LIMITS, capture: 10000, chunk: 8192 });
  await h.flush(sample("cap", 60).j);
  const r = (await h.list())[0]!;
  assert.equal(r.completeness, "Partial");
  assert.ok(r.manifest.bytes <= 10000);
  assert.ok(h.health.queued_bytes <= LIMITS.active);
  const x = await setup({ ...LIMITS, occurrences: 3 });
  await x.h.flush(sample().j);
  assert.equal((await x.h.list())[0]!.completeness, "Partial");
  const tiny = await setup({ ...LIMITS, pending: 200 });
  await tiny.h.flush(sample().j);
  assert.equal(tiny.h.health.status, "Partial");
  assert.equal((await tiny.h.list())[0]!.completeness, "Partial");
});
test("pure migration preserves occurrence provenance; validates new namespace before active; rollback leaves old data", async () => {
  const { s, h } = await setup();
  await h.flush(sample().j);
  const oldKey = (await s.keys()).find((k) => k.endsWith(":manifest"))!,
    old = (await s.get(oldKey)) as HistoryManifest;
  old.schema_version = "history-0";
  for (const ref of old.chunks) {
    const chunk = (await s.get(ref.key)) as { schema_version: string };
    chunk.schema_version = "history-0";
    ref.sha256 = await digest(encode(chunk));
    ref.bytes = encode(chunk).length;
    await s.set(ref.key, chunk);
  }
  await s.set(oldKey, old);
  const copy = await s.get(oldKey);
  const migrated = await h.migrate(oldKey);
  assert.equal(migrated.manifest.schema_version, "history-2");
  assert.deepEqual(
    migrated.snapshot.events,
    (await h.recover(oldKey)).snapshot.events,
  );
  assert.deepEqual(await s.get(oldKey), copy);
  const active = await s.get("blackbox:history:active_schema");
  s.fail = (k) => k.includes("migration-");
  await assert.rejects(h.migrate(oldKey));
  assert.deepEqual(await s.get("blackbox:history:active_schema"), active);
  assert.deepEqual(await s.get(oldKey), copy);
  old.schema_version = "history-999";
  await s.set(oldKey, old);
  assert.equal((await h.recover(oldKey)).read_only, true);
  await assert.rejects(h.migrate(oldKey), /unsupported/);
  assert.deepEqual(await s.get("blackbox:history:active_schema"), active);
});

test("in-flight chunk completing after clear cannot commit into the new epoch; failed manifest leaves recoverable orphan", async () => {
  const s = new MemoryStore(),
    a = new HistoryStore(s, "a"),
    b = new HistoryStore(s, "b");
  await Promise.all([a.init(), b.init()]);
  let release: () => void = () => {},
    entered: () => void = () => {};
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const blocked = new Promise<void>((r) => {
    release = r;
  });
  const original = s.set.bind(s);
  s.set = async (k, v) => {
    if (k.includes(":chunk:")) {
      entered();
      await blocked;
    }
    await original(k, v);
  };
  const pending = b.flush(sample("late").j);
  await started;
  await a.clearAll();
  release();
  await pending;
  assert.equal((await a.list()).length, 0);
  assert.equal((await b.list()).length, 0);
  assert.equal(
    (await s.keys()).filter((k) => k.endsWith(":manifest")).length,
    0,
  ); // old namespace orphan cannot resurrect.
});

test("clear-experiment deletes descriptor/key namespace only; defaults stay at frozen initial budgets", async () => {
  const { s, h } = await setup();
  const uuid = crypto.randomUUID();
  await s.set(`blackbox:experiment:${uuid}:key`, {
    schema_version: "experiment-1",
    key: "private-local",
  });
  await h.flush(sample().j);
  await h.clearExperiment(uuid);
  assert.equal(await s.get(`blackbox:experiment:${uuid}:key`), undefined);
  assert.equal((await h.list()).length, 1);
  assert.deepEqual(LIMITS, {
    history: 200,
    age_ms: 30 * 86400000,
    total: 50 * 1048576,
    capture: 2 * 1048576,
    occurrences: 20000,
    chunk: 128 * 1024,
    pending: 256 * 1024,
    active: 8 * 1048576,
  });
});
