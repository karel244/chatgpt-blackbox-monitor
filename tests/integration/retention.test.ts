import test from "node:test";
import assert from "node:assert/strict";
import { Monitor } from "../../src/adapters/monitor.ts";
import { NetworkMonitor } from "../../src/adapters/network-monitor.ts";
import {
  HistoryStore,
  type HistoryManifest,
} from "../../src/history/storage.ts";
import { compactClosed } from "../../src/history/retention.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
import type { CaptureStart } from "../../src/host/types.ts";
const context = { document_id: "doc", visit_id: "visit", epoch: 0 };
const capture = (id: string, t = 0): CaptureStart => ({
  capture_id: id,
  context,
  mode: "live",
  transport: "fetch",
  conversation_id: id,
  started_at: t,
});
const frame = (v: unknown) => `data: ${JSON.stringify(v)}\n\n`;
const sseResponse = (payload: string) => {
  const fixture = new Response(payload, {
    headers: { "content-type": "text/event-stream" },
  });
  assert.equal(fixture.headers.get("content-type"), "text/event-stream");
  return fixture;
};
const ws = (id: string) =>
  JSON.stringify([
    {
      topic_id: id,
      payload: {
        payload: {
          encoded_item: frame({ request_id: id, resolved_model_slug: "one" }),
        },
      },
    },
  ]);

test("read-back certificate rejects uncommitted, Partial, failed, missing, hash, sequence and stale Closed metadata", async () => {
  for (const fault of [
    "none",
    "uncommitted",
    "partial",
    "failed",
    "missing",
    "hash",
    "gap",
    "late",
    "metadata",
  ]) {
    const store = new MemoryStore(),
      history = new HistoryStore(store, "doc");
    await history.init();
    const a = sample("proof");
    if (fault !== "uncommitted") await history.flush(a.j);
    const key = (await store.keys()).find((k) => k.endsWith(":manifest"));
    if (key) {
      const m = (await store.get(key)) as HistoryManifest;
      if (fault === "partial") m.status = "Partial";
      if (fault === "failed") m.status = "Failed";
      if (fault === "gap") m.chunks[0]!.sequence = 9;
      if (fault === "metadata") m.snapshot.controls = [];
      if (["partial", "failed", "gap", "metadata"].includes(fault))
        await store.set(key, m);
      if (fault === "missing") await store.delete(m.chunks[0]!.key);
      if (fault === "hash") await store.set(m.chunks[0]!.key, {});
      if (fault === "late")
        a.j.append({ ...a.snapshot.events.at(-1)!, value: "two" });
    }
    const before = JSON.stringify([...store.data]);
    assert.equal(
      await history.committedThrough(a.j.snapshot("proof")!),
      fault === "none",
      fault,
    );
    assert.equal(
      JSON.stringify([...store.data]),
      before,
      "certificate performs no writes",
    );
  }
});

test("200 sequential Closed turns retain bounded paired adapters; saved old route remains exportable; late evicted request cannot attach latest", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let now = 0;
  const monitor = new Monitor(() => now),
    network = new NetworkMonitor(monitor.journal, () => now);
  const store = new MemoryStore(),
    history = new HistoryStore(store, "doc");
  await history.init();
  for (let n = 1; n <= 200; n++) {
    const c = capture(`turn-${n}`, now),
      body = JSON.stringify({ model: "one", request_id: c.capture_id });
    monitor.request(c, body);
    network.start(c, body);
    assert.ok(monitor.journal.ids().includes(c.capture_id), `start ${n}`);
    await monitor.response(
      c,
      sseResponse(
        frame({ request_id: c.capture_id, resolved_model_slug: "one" }) +
          "data: [DONE]\n\n",
      ),
    );
    assert.equal(monitor.journal.state(c.capture_id).lifecycle, "Settling");
    assert.equal(monitor.canReleaseClosed(c.capture_id), false);
    now += 31000;
    t.mock.timers.tick(31000);
    monitor.journal.tick();
    await history.flush(monitor.journal);
    await compactClosed(monitor, network, history, () => c.capture_id);
    assert.ok(monitor.journal.ids().length <= 96);
    assert.ok(monitor.journal.ids().includes(c.capture_id));
  }
  const refs = monitor as unknown as {
    captures: Map<string, unknown>;
    evicted: Map<string, unknown>;
  };
  const net = network as unknown as { captures: Map<string, unknown> };
  assert.equal(refs.captures.size, 96);
  assert.equal(net.captures.size, 96);
  assert.equal(refs.evicted.size, 104);
  const records = await history.list();
  assert.equal(records.length, 200);
  const old = records.find((r) => r.manifest.capture_id === "turn-1")!;
  assert.equal(old.completeness, "Complete");
  const { exportBundle, importBundle } =
    await import("../../src/history/bundle.ts");
  assert.equal(
    (await importBundle((await exportBundle(old.snapshot, "test")).bytes))
      .summary.route_verdict.actual_route,
    "one",
  );
  const last = JSON.stringify(monitor.journal.snapshot("turn-200"));
  await monitor.socketMessage("late-socket", ws("turn-1"), context, 1);
  assert.ok(
    monitor.diagnostics.some(
      (d) =>
        d.code === "late_event_association_lost" && d.capture_id === "turn-1",
    ),
  );
  assert.equal(JSON.stringify(monitor.journal.snapshot("turn-200")), last);
  assert.equal(monitor.journal.snapshot("turn-1"), null);
  monitor.reset(context, "dispose");
});

test("unpersisted Closed, current/selected, readers, timers, pending fragments and queue are protected", async () => {
  const monitor = new Monitor(),
    network = new NetworkMonitor(monitor.journal);
  const history = new HistoryStore(new MemoryStore(), "doc");
  await history.init();
  for (let n = 0; n < 100; n++) {
    const c = capture(`closed-${n}`);
    monitor.request(c, JSON.stringify({ model: "one" }));
    network.start(c, null);
    monitor.journal.complete(c.capture_id);
    monitor.journal.terminate(c.capture_id, "test_closed");
    monitor.journal.health(c.capture_id, "Failed", "test_failed");
  }
  await compactClosed(monitor, network, history, () => "closed-0");
  assert.equal(monitor.journal.ids().length, 100, "unpersisted must not evict");
  const internals = monitor as unknown as {
    readers: Map<string, unknown>;
    timers: Map<string, unknown>;
    socketQueues: Map<string, { pending: number }>;
  };
  internals.readers.set("closed-1", {});
  assert.equal(monitor.canReleaseClosed("closed-1"), false);
  internals.readers.clear();
  internals.timers.set("closed-2", {});
  assert.equal(monitor.canReleaseClosed("closed-2"), false);
  internals.timers.clear();
  internals.socketQueues.set("pending", { pending: 1 });
  assert.equal(monitor.canReleaseClosed("closed-3"), false);
  internals.socketQueues.clear();
  const net = network as unknown as { readers: Map<string, unknown> };
  net.readers.set("closed-4", {});
  assert.equal(network.canReleaseClosed("closed-4"), false);
  net.readers.clear();
  // terminate is a failure; even committed failed captures cannot certify eviction.
  await history.flush(monitor.journal);
  await compactClosed(monitor, network, history, () => "closed-0");
  assert.equal(monitor.journal.ids().length, 100);
});

test("active guard continues rejecting the 33rd non-Closed turn", () => {
  const m = new Monitor();
  for (let n = 0; n < 40; n++)
    m.request(capture(`active-${n}`), JSON.stringify({ model: "one" }));
  assert.equal(m.journal.ids().length, 32);
  assert.ok(m.diagnostics.some((d) => d.code === "capture_limit"));
  m.reset(context, "dispose");
});

test("committed candidates preserve selected/current and proof races; pending WS fragments block paired release", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let now = 0;
  const m = new Monitor(() => now),
    n = new NetworkMonitor(m.journal, () => now),
    h = new HistoryStore(new MemoryStore(), "doc");
  await h.init();
  for (let i = 0; i < 100; i++) {
    const c = capture(`saved-${i}`, now);
    m.request(c, JSON.stringify({ model: "one" }));
    n.start(c, null);
    m.journal.complete(c.capture_id);
    now += 31000;
    m.journal.tick();
  }
  await h.flush(m.journal);
  const prove = h.committedThrough.bind(h);
  h.committedThrough = async (snapshot) => {
    const ok = await prove(snapshot);
    if (snapshot.start.capture_id === "saved-1")
      m.journal.health("saved-1", "Partial", "late_race");
    return ok;
  };
  await compactClosed(m, n, h, () => "saved-0");
  assert.equal(m.journal.ids().length, 96);
  assert.ok(m.journal.ids().includes("saved-0"));
  assert.ok(m.journal.ids().includes("saved-1"));
  assert.ok(m.journal.ids().includes("saved-99"));
  const c = capture("ws-owned", now);
  m.request(c, JSON.stringify({ model: "one", request_id: c.capture_id }));
  n.start(c, null);
  await m.response(
    c,
    sseResponse(frame({ type: "subscribe_ws_topic", topic_id: "ws-owned" })),
  );
  await m.socketMessage(
    "socket",
    JSON.stringify([
      {
        topic_id: "ws-owned",
        payload: { payload: { encoded_item: "data: [DONE]\n\n" } },
      },
    ]),
    context,
    1,
  );
  now += 31000;
  t.mock.timers.tick(31000);
  m.journal.tick();
  assert.equal(m.canReleaseClosed(c.capture_id), true);
  await m.socketMessage(
    "socket",
    JSON.stringify([
      {
        topic_id: "ws-owned",
        payload: { payload: { encoded_item: "data: {" } },
      },
    ]),
    context,
    2,
  );
  assert.equal(
    m.canReleaseClosed(c.capture_id),
    false,
    "pending fragment remains owned",
  );
  m.reset(context, "dispose");
});
