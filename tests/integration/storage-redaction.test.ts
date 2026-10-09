import test from "node:test";
import assert from "node:assert/strict";
import {
  HistoryStore,
  digest,
  encode,
  type HistoryManifest,
} from "../../src/history/storage.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
import { exportBundle, importBundle } from "../../src/history/bundle.ts";
import { projectState } from "../../src/core/journal.ts";
async function setup() {
  let now = 1000;
  const s = new MemoryStore(),
    h = new HistoryStore(s, "redaction", () => now++);
  await h.init();
  const a = sample().snapshot;
  a.events = [
    { ...a.events[0]!, event_index: 1 },
    { ...a.events[1]!, event_index: 2, field: "Authorization" },
    { ...a.events[2]!, event_index: 3 },
  ];
  const original = structuredClone(a);
  await h.queue(a);
  assert.deepEqual(a, original);
  const key = (await s.keys()).find((k) => k.endsWith(":manifest"))!;
  return { s, h, key, a };
}
test("exact committed digest-covered redaction gap keeps indices 1,3, Partial redaction and stable repeated list/recover", async () => {
  const { s, h, key } = await setup();
  const first = await h.recover(key),
    second = await h.recover(key);
  assert.deepEqual(first, second);
  assert.deepEqual(await h.list(), await h.list());
  assert.deepEqual(
    first.snapshot.events.map((e) => e.event_index),
    [1, 3],
  );
  assert.equal(first.manifest.schema_version, "history-2");
  assert.deepEqual(first.manifest.redaction_gaps, [
    { after: 1, before: 3, dropped: 1 },
  ]);
  const chunk = (await s.get(first.manifest.chunks[0]!.key)) as {
    redaction_gaps: unknown;
  };
  assert.deepEqual(chunk.redaction_gaps, first.manifest.redaction_gaps);
  assert.equal(await digest(encode(chunk)), first.manifest.chunks[0]!.sha256);
  assert.equal(first.completeness, "Partial");
  assert.equal(projectState(first.snapshot).completeness, "Partial");
  assert.ok(
    first.snapshot.controls.some((c) => c.code === "storage_redaction_drop"),
  );
  assert.equal(
    first.snapshot.controls.some((c) => c.code === "storage_recovery_gap"),
    false,
  );
  assert.equal(first.notes.includes("sequence_gap"), false);
  assert.equal(
    JSON.stringify(await s.get(key)).includes("Authorization"),
    false,
  );
});
test("undeclared gap, coarse drop, forged bounds, backward/duplicate, missing chunk and hash mismatch remain corruption and stable", async () => {
  for (const kind of [
    "undeclared",
    "coarse",
    "forged",
    "backward",
    "duplicate",
    "missing",
    "hash",
  ]) {
    const { s, h, key } = await setup();
    const m = (await s.get(key)) as HistoryManifest,
      ref = m.chunks[0]!;
    const c = (await s.get(ref.key)) as {
      events: typeof m.snapshot extends never
        ? never
        : ReturnType<typeof sample>["snapshot"]["events"];
      redaction_gaps: typeof m.redaction_gaps;
    };
    if (kind === "missing") await s.delete(ref.key);
    else if (kind === "hash") {
      c.events[0]!.value = "changed";
      await s.set(ref.key, c);
    } else {
      if (kind === "undeclared" || kind === "coarse") {
        c.redaction_gaps = [];
        m.redaction_gaps = [];
      }
      if (kind === "forged") {
        c.redaction_gaps = [{ after: 0, before: 3, dropped: 2 }];
        m.redaction_gaps = c.redaction_gaps;
      }
      if (kind === "backward") c.events.reverse();
      if (kind === "duplicate") c.events[1]!.event_index = 1;
      ref.sha256 = await digest(encode(c));
      ref.bytes = encode(c).length;
      await s.set(ref.key, c);
      await s.set(key, m);
    }
    const r = await h.recover(key);
    assert.equal(r.completeness, "Partial", kind);
    assert.ok(
      r.snapshot.controls.some((c) => c.code === "storage_recovery_gap"),
      kind,
    );
    assert.deepEqual(r, await h.recover(key), kind);
  }
});
test("raw missing index cannot be authorized by redaction; legacy history-1 is read-only, no silent migration or baseline write", async () => {
  const { s, h, key, a } = await setup();
  const broken = {
    ...a,
    start: { ...a.start, capture_id: "raw-hole" },
    events: [a.events[0]!, a.events[2]!],
  };
  await h.queue(broken);
  const r = (await h.list()).find((r) => r.manifest.capture_id === "raw-hole")!;
  assert.ok(r.notes.includes("sequence_gap"));
  assert.deepEqual(r.manifest.redaction_gaps, []);
  const m = (await s.get(key)) as HistoryManifest;
  m.schema_version = "history-1";
  for (const ref of m.chunks) {
    const c = (await s.get(ref.key)) as { schema_version: string };
    c.schema_version = "history-1";
    ref.sha256 = await digest(encode(c));
    ref.bytes = encode(c).length;
    await s.set(ref.key, c);
  }
  await s.set(key, m);
  const before = structuredClone([...s.data]);
  assert.equal((await h.recover(key)).read_only, true);
  assert.deepEqual([...s.data], before);
  await assert.rejects(h.migrate(key), /migration_validation_failed/);
  assert.deepEqual(await s.get(key), m);
});
test("valid, malformed and malicious local import make zero Store writes/deletes; background flush is separated and quiesced stability holds", async () => {
  const { s, h, key } = await setup();
  const r = await h.recover(key),
    bundle = await exportBundle(r.snapshot, "import-oracle");
  let writes = 0,
    deletes = 0;
  const set = s.set.bind(s),
    del = s.delete.bind(s);
  s.set = async (k, v) => {
    writes++;
    await set(k, v);
  };
  s.delete = async (k) => {
    deletes++;
    await del(k);
  };
  const before = encode([...s.data]);
  await importBundle(bundle.bytes);
  await assert.rejects(importBundle(new Uint8Array([1, 2, 3])));
  const bad = bundle.bytes.slice();
  bad[40] = bad[40]! ^ 1;
  await assert.rejects(importBundle(bad));
  assert.equal(writes, 0);
  assert.equal(deletes, 0);
  assert.deepEqual(encode([...s.data]), before);
  const background = h.flush(sample("background").j);
  await importBundle(bundle.bytes);
  await background;
  assert.ok(writes > 0);
  assert.equal(deletes, 0);
  const settledWrites = writes,
    settled = encode([...s.data]);
  await importBundle(bundle.bytes);
  await assert.rejects(importBundle(bad));
  assert.equal(writes, settledWrites);
  assert.deepEqual(encode([...s.data]), settled);
  assert.deepEqual(await h.list(), await h.list());
});
