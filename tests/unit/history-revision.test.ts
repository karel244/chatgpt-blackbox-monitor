import test from "node:test";
import assert from "node:assert/strict";
import { Journal, projectState } from "../../src/core/journal.ts";
import { HistoryStore, LIMITS } from "../../src/history/storage.ts";
import { safeSnapshot } from "../../src/history/safety.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";

function tracking(h: HistoryStore) {
  return (h as unknown as { persistedRevisions: Map<string, Readonly<object>> })
    .persistedRevisions;
}
function fresh(id = "fresh") {
  const template = sample(id);
  let now = 0,
    event = 0;
  const j = new Journal(
    () => now,
    () => new Date(now).toISOString(),
    () => `${id}-${++event}`,
  );
  j.start(template.snapshot.start);
  j.append(template.snapshot.events[0]!);
  return {
    j,
    time: (value: number) => {
      now = value;
    },
  };
}
async function setup() {
  const store = new MemoryStore(),
    h = new HistoryStore(store, "revision");
  await h.init();
  return { store, h };
}

test("T1: 100 unchanged flushes skip snapshot, queue and manifest reads/writes; committed bytes remain identical", async (t) => {
  const { store, h } = await setup(),
    { j } = sample();
  await h.flush(j);
  const before = structuredClone([...store.data]);
  const snapshot = t.mock.method(j, "snapshot"),
    queue = t.mock.method(h, "queue");
  const get = t.mock.method(store, "get"),
    set = t.mock.method(store, "set");
  for (let n = 0; n < 100; n++) await h.flush(j);
  assert.equal(snapshot.mock.callCount(), 0);
  assert.equal(queue.mock.callCount(), 0);
  assert.equal(
    get.mock.calls.filter((c) => c.arguments[0].endsWith(":manifest")).length,
    0,
  );
  assert.equal(set.mock.callCount(), 0);
  assert.equal(get.mock.callCount(), 100, "one retained epoch check per pass");
  assert.deepEqual([...store.data], before);
});

test("T2/T5: new occurrence and Closed late occurrence persist without changing public revision semantics", async () => {
  const { h } = await setup(),
    { j, time } = fresh();
  await h.flush(j);
  j.append({ ...j.snapshot("fresh")!.events[0]!, value: "model-two" });
  await h.flush(j);
  assert.equal((await h.list())[0]!.snapshot.events.length, 2);
  j.complete("fresh");
  time(31000);
  j.tick();
  await h.flush(j);
  const late = j.append({
    ...j.snapshot("fresh")!.events[0]!,
    value: "model-three",
  });
  assert.equal(late!.late_metadata, true);
  assert.equal(late!.revision, 1);
  await h.flush(j);
  const recovered = (await h.list())[0]!;
  assert.equal(recovered.snapshot.events.at(-1)!.value, "model-three");
  assert.equal(recovered.snapshot.events.at(-1)!.revision, 1);
  assert.equal(await h.committedThrough(j.snapshot("fresh")!), true);
});

test("T3/T4: event index unchanged while complete, health, EOF, Closed and invalidation metadata are committed", async () => {
  const { h } = await setup(),
    { j, time } = fresh();
  await h.flush(j);
  const count = j.snapshot("fresh")!.events.length;
  for (const change of [
    () => j.complete("fresh"),
    () => j.health("fresh", "Partial", "test_health"),
    () => j.segmentEof("fresh"),
    () => {
      time(31000);
      j.tick();
    },
    () => j.reset({ document_id: "next", visit_id: "next", epoch: 1 }, "clear"),
  ]) {
    const token = j.revision("fresh");
    change();
    assert.notEqual(j.revision("fresh"), token);
    await h.flush(j);
    assert.deepEqual(
      (await h.list())[0]!.manifest.snapshot.controls,
      j.snapshot("fresh")!.controls,
    );
    assert.equal(j.snapshot("fresh")!.events.length, count);
  }
  assert.equal(projectState((await h.list())[0]!.snapshot).lifecycle, "Closed");
});

test("mutation token changes for control_dropped but stays stable for genuine no-ops; never enters public snapshot", () => {
  const { j } = fresh();
  const token = j.revision("fresh");
  j.start(j.snapshot("fresh")!.start);
  j.tick();
  j.complete("missing");
  assert.equal(j.revision("fresh"), token);
  j.complete("fresh");
  const complete = j.revision("fresh");
  j.complete("fresh");
  assert.equal(j.revision("fresh"), complete);
  for (let n = 0; n < 2050; n++)
    j.health("fresh", "Partial", "bounded_control");
  const capped = j.revision("fresh"),
    before = j.snapshot("fresh")!.control_dropped;
  j.health("fresh", "Partial", "bounded_control");
  assert.notEqual(j.revision("fresh"), capped);
  assert.equal(j.snapshot("fresh")!.control_dropped, before + 1);
  assert.deepEqual(Object.keys(j.snapshot("fresh")!), [
    "start",
    "events",
    "controls",
    "control_dropped",
  ]);
  j.reset({ document_id: "next", visit_id: "next", epoch: 1 }, "clear");
  const invalidated = j.revision("fresh");
  j.append(sample().snapshot.events[0]!);
  j.tick();
  assert.equal(j.revision("fresh"), invalidated);
});

test("T6: in-flight mutation never acknowledges a newer event/control revision", async () => {
  const { store, h } = await setup(),
    { j } = sample("race");
  const set = store.set.bind(store);
  let release!: () => void, entered!: () => void;
  const blocked = new Promise<void>((r) => {
      release = r;
    }),
    started = new Promise<void>((r) => {
      entered = r;
    });
  let once = true;
  store.set = async (key, value) => {
    if (once && key.includes(":chunk:")) {
      once = false;
      entered();
      await blocked;
    }
    await set(key, value);
  };
  const revision = j.revision("race"),
    pending = h.flush(j);
  await started;
  j.append({ ...j.snapshot("race")!.events[0]!, value: "late-race" });
  j.health("race", "Partial", "in_flight_control");
  release();
  await pending;
  assert.equal(tracking(h).get("race"), revision);
  assert.notEqual(tracking(h).get("race"), j.revision("race"));
  await h.flush(j);
  const recovered = (await h.list())[0]!;
  assert.equal(recovered.snapshot.events.at(-1)!.value, "late-race");
  assert.ok(
    recovered.snapshot.controls.some((c) => c.code === "in_flight_control"),
  );
  assert.equal(tracking(h).get("race"), j.revision("race"));
});

test("pending caller cannot certify its own unqueued control-only snapshot", async () => {
  const { store, h } = await setup(),
    { j } = fresh();
  const set = store.set.bind(store);
  let release!: () => void, entered!: () => void;
  const blocked = new Promise<void>((r) => {
      release = r;
    }),
    started = new Promise<void>((r) => {
      entered = r;
    });
  let once = true;
  store.set = async (key, value) => {
    if (once && key.includes(":chunk:")) {
      once = false;
      entered();
      await blocked;
    }
    await set(key, value);
  };
  const first = h.flush(j);
  await started;
  j.complete("fresh");
  const second = h.flush(j);
  release();
  await Promise.all([first, second]);
  assert.notEqual(tracking(h).get("fresh"), j.revision("fresh"));
  await h.flush(j);
  assert.equal(
    projectState((await h.list())[0]!.snapshot).lifecycle,
    "Settling",
  );
});

test("T7: more than 32 pending batches stay dirty until all safe events and metadata commit", async () => {
  const store = new MemoryStore(),
    h = new HistoryStore(store, "batches", Date.now, {
      ...LIMITS,
      pending: 8192,
      chunk: 4096,
    });
  await h.init();
  const { j } = sample("many", 150);
  await h.flush(j);
  assert.equal(tracking(h).has("many"), false);
  const partial = (await h.list())[0]!;
  assert.ok(partial.snapshot.events.length < j.snapshot("many")!.events.length);
  await h.flush(j);
  assert.equal(tracking(h).get("many"), j.revision("many"));
  const raw = j.snapshot("many")!;
  const expected = safeSnapshot(raw);
  assert.equal(
    expected.events.length,
    raw.events.length,
    "fixture has no redaction drop",
  );
  assert.equal(
    expected.controls.some((c) => c.code === "storage_redaction_drop"),
    false,
  );
  const recovered = (await h.list())[0]!;
  assert.deepEqual(recovered.snapshot, expected);
  assert.equal(recovered.snapshot.events.length, expected.events.length);
  assert.ok(recovered.manifest.chunks.length > 32);
});

test("T8: get/set failures never acknowledge clean and existing failure policy remains", async () => {
  for (const fault of ["get", "set"]) {
    const { store, h } = await setup(),
      { j } = sample(fault);
    if (fault === "get") {
      const get = store.get.bind(store);
      store.get = async (key) => {
        if (key.endsWith(":manifest")) throw Error("get fault");
        return get(key);
      };
    } else store.fail = (key) => key.endsWith(":manifest");
    await h.flush(j);
    assert.equal(tracking(h).has(fault), false);
    assert.equal(h.health.status, "Failed");
    assert.equal(h.health.queued_bytes, 0);
    await h.flush(j);
    assert.equal(tracking(h).has(fault), false);
  }
});

test("T9: epoch clears cache, old IDs stay deleted and new evidence commits", async () => {
  const { h } = await setup(),
    old = sample("old"),
    next = sample("post-clear");
  await h.flush(old.j);
  assert.equal(tracking(h).size, 1);
  await h.clearAll();
  assert.equal(tracking(h).size, 0);
  await h.flush(old.j);
  assert.equal((await h.list()).length, 0);
  await h.flush(next.j);
  assert.deepEqual(
    (await h.list()).map((r) => r.manifest.capture_id),
    ["post-clear"],
  );
  await h.clearCurrent("post-clear");
  assert.equal(tracking(h).size, 0);
});

test("T10: 200 committed rounds, paired release and 30-day cleanup bound and release tracking", async () => {
  let now = 0,
    wall = 0;
  const store = new MemoryStore(),
    h = new HistoryStore(store, "bounded", () => wall);
  await h.init();
  const j = new Journal(
    () => now,
    () => new Date(now).toISOString(),
  );
  for (let n = 0; n < 200; n++) {
    const id = `round-${n}`,
      fixture = sample(id);
    j.start({ ...fixture.snapshot.start, started_at: now });
    j.append(fixture.snapshot.events[0]!);
    j.complete(id);
    now += 31000;
    j.tick();
    await h.flush(j);
    if (j.ids().length > 96) {
      const oldest = j.ids()[0]!;
      assert.equal(await h.committedThrough(j.snapshot(oldest)!), true);
      j.discard(oldest);
      h.releaseCommitted(oldest);
    }
    assert.ok(tracking(h).size <= 96);
  }
  assert.equal((await h.list()).length, 200);
  assert.equal(tracking(h).size, 96);
  wall = 31 * 86400000;
  await h.cleanup();
  assert.equal(tracking(h).size, 0);
  assert.equal((await h.list()).length, 0);
  j.clear();
  await h.flush(j);
  assert.equal(tracking(h).size, 0);
});

test("tokens cannot alias across distinct Journals or discarded/restarted IDs", async () => {
  const { h } = await setup(),
    first = fresh("same"),
    second = fresh("same");
  await h.flush(first.j);
  assert.notEqual(first.j.revision("same"), second.j.revision("same"));
  second.j.health("same", "Partial", "second_journal");
  await h.flush(second.j);
  assert.ok(
    (await h.list())[0]!.snapshot.controls.some(
      (c) => c.code === "second_journal",
    ),
  );
  const old = second.j.revision("same");
  second.j.discard("same");
  assert.equal(second.j.revision("same"), undefined);
  await h.flush(second.j);
  assert.equal(tracking(h).size, 0);
  second.j.start(sample("same").snapshot.start);
  assert.notEqual(second.j.revision("same"), old);
});
