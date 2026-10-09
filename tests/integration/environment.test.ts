import test from "node:test";
import assert from "node:assert/strict";
import { EnvironmentMonitor } from "../../src/adapters/environment-monitor.ts";
import { Monitor } from "../../src/adapters/monitor.ts";
import { NetworkMonitor } from "../../src/adapters/network-monitor.ts";
import type { Realm, CaptureStart } from "../../src/host/types.ts";
const context = { document_id: "env-doc", visit_id: "env-visit", epoch: 0 };
function surface() {
  const state = {
    entries: [
      {
        name: "https://chatgpt.com/assets/app.abcdef012345.js?token=SECRET_QUERY",
      },
    ],
    scripts: ["/assets/app.abcdef012345.js"],
    next: { buildId: "build-one" },
    deployment: "build-two",
    swReads: 0,
    probes: 0,
  };
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    hasFocus: () => true,
    querySelectorAll: () =>
      state.scripts.map((src) => ({ getAttribute: () => src })),
    getElementById: () => ({ textContent: JSON.stringify(state.next) }),
    querySelector: () => ({ getAttribute: () => state.deployment }),
  });
  const timing = Object.assign(new EventTarget(), {
    getEntriesByType: () => state.entries,
    now: () => performance.now(),
  });
  let resourceCallback:
    ((list: { getEntries: () => { name: string }[] }) => void) | undefined;
  let disconnected = 0;
  class Observer {
    constructor(cb: typeof resourceCallback) {
      resourceCallback = cb;
    }
    observe() {}
    disconnect() {
      disconnected++;
    }
  }
  const worker = {
    scriptURL: "https://chatgpt.com/assets/sw.abcdef012345.js?token=SECRET_SW",
    state: "activated",
  };
  const nav = {
    userAgent: "Windows Chrome/154.0",
    platform: "Win32",
    language: "en-US",
    languages: ["en-US"],
    onLine: true,
    hardwareConcurrency: 8,
    serviceWorker: {
      controller: worker,
      getRegistrations: async () => {
        state.swReads++;
        return [{ active: worker }];
      },
      register: () => {
        state.probes++;
        throw Error("forbidden");
      },
    },
    userAgentData: {
      getHighEntropyValues: () => {
        state.probes++;
        throw Error("forbidden");
      },
    },
  };
  const page = Object.assign(new EventTarget(), {
    document,
    navigator: nav,
    performance: timing,
    PerformanceObserver: Observer,
    location: { origin: "https://chatgpt.com" },
    screen: { width: 1920, height: 1080 },
    innerWidth: 1000,
    innerHeight: 700,
    devicePixelRatio: 1,
    crypto,
    queueMicrotask,
    Intl,
    Date,
  });
  return {
    page: page as unknown as Realm,
    mutable: page,
    state,
    emit: (name: string) =>
      resourceCallback?.({ getEntries: () => [{ name }] }),
    emitBatch: (entries: { name: string }[]) =>
      resourceCallback?.({ getEntries: () => entries }),
    disconnected: () => disconnected,
  };
}

test("environment readiness waits for digest completion, invalidates pending old document/epoch, retains only current E context", async () => {
  const f = surface(),
    route = new Monitor();
  let release: () => void = () => {},
    entered: () => void = () => {};
  const blocked = new Promise<void>((r) => {
    release = r;
  });
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const nativeCrypto = f.page.crypto;
  Object.defineProperty(f.page, "crypto", {
    configurable: true,
    value: {
      subtle: {
        digest: async (algorithm: AlgorithmIdentifier, bytes: BufferSource) => {
          entered();
          await blocked;
          return nativeCrypto.subtle.digest(algorithm, bytes);
        },
      },
    },
  });
  const env = new EnvironmentMonitor(f.page, route.journal, context);
  const pending = env.start();
  await started;
  assert.equal(
    env.snapshots.length,
    0,
    "not yet ready is distinct from empty completed snapshot",
  );
  const current = {
    document_id: "new-document",
    visit_id: "new-visit",
    epoch: 1,
  };
  route.journal.clear();
  env.reset(current, "clear");
  release();
  await pending;
  await env.snapshot("condition_ready");
  assert.ok(env.snapshots.length > 0);
  const records = route.journal.ids().map((id) => route.journal.snapshot(id)!);
  assert.ok(records.length > 0);
  assert.ok(
    records.every(
      (r) =>
        r.start.context.document_id === current.document_id &&
        r.start.context.epoch === 1,
    ),
  );
  assert.ok(records.every((r) => r.events.every((e) => e.level === "E")));
  assert.equal(JSON.stringify(records).includes("SECRET"), false);
  env.reset(current, "dispose");
});
test("environment start/lifecycle/assets/SW read-only are E and cannot change route or network", async () => {
  const f = surface(),
    route = new Monitor(),
    network = new NetworkMonitor(route.journal),
    env = new EnvironmentMonitor(f.page, route.journal, context);
  const c: CaptureStart = {
    capture_id: "conversation",
    context,
    transport: "fetch",
    mode: "live",
    conversation_id: null,
    started_at: performance.now(),
  };
  route.request(c, '{"model":"one"}');
  network.start(c, null);
  await route.response(
    c,
    new Response('data: {"resolved_model_slug":"one"}\n\n', {
      headers: { "content-type": "text/event-stream" },
    }),
  );
  await network.response(c, new Response(null, { status: 503 }));
  const prior = route.journal.snapshot(c.capture_id)!.events;
  await env.start();
  await env.observeServiceWorkers();
  let snap = await env.snapshot("run_start");
  assert.ok(snap);
  assert.equal(snap.markers.conflict, true);
  assert.equal(snap.service_worker.controller!.state, "activated");
  assert.ok(snap.service_worker.registrations.length);
  assert.equal(f.state.probes, 0);
  assert.ok(f.state.swReads >= 1);
  assert.equal(snap.fields.client_ip!.availability, "unknown");
  assert.ok(!JSON.stringify(snap).includes("SECRET"));
  const before = snap.resource_count;
  f.emit(
    "https://chatgpt.com/assets/chunk.ffffffffeeee.js?session=SECRET_DYNAMIC",
  );
  snap = await env.snapshot("finalize_window");
  assert.equal(snap!.resource_count, before + 1);
  f.mutable.innerWidth = 1300;
  f.mutable.dispatchEvent(new Event("resize"));
  await env.snapshot("run_start");
  assert.equal(env.snapshots.at(-1)!.fields["viewport.width"]!.value, 1300);
  f.mutable.document.visibilityState = "hidden";
  f.mutable.document.dispatchEvent(new Event("visibilitychange"));
  await env.snapshot("run_start");
  assert.equal(env.snapshots.at(-1)!.fields.visibility!.value, "hidden");
  f.mutable.navigator.onLine = false;
  f.mutable.dispatchEvent(new Event("offline"));
  await env.snapshot("run_start");
  assert.equal(env.snapshots.at(-1)!.fields.online!.value, false);
  f.mutable.navigator.onLine = true;
  f.mutable.dispatchEvent(new Event("online"));
  await env.snapshot("run_start");
  assert.equal(env.snapshots.at(-1)!.fields.online!.value, true);
  assert.deepEqual(route.journal.snapshot(c.capture_id)!.events, prior);
  assert.equal(route.journal.route(c.capture_id, "answer").actual_route, "one");
  assert.equal(network.verdict(c.capture_id), "Server Error");
  const evidence = route.journal
    .ids()
    .filter((id) => id.startsWith("environment:"))
    .flatMap((id) => route.journal.snapshot(id)!.events);
  assert.ok(evidence.length > 0);
  assert.ok(
    evidence.every(
      (e) =>
        e.level === "E" &&
        e.direction === "local" &&
        e.association === "orphan",
    ),
  );
  assert.ok(!JSON.stringify(evidence).includes("SECRET"));
  env.reset(context, "pause");
  assert.ok(f.disconnected() > 0);
  const count = env.snapshots.length;
  f.emit("/assets/chunk.12345678.js");
  assert.equal(env.snapshots.length, count);
  env.reset(context, "dispose");
  route.reset(context, "dispose");
});
test("all APIs and environment fields missing: stable Unknown; empty SW/controller; dedup references", async () => {
  const route = new Monitor(),
    env = new EnvironmentMonitor(
      { queueMicrotask } as unknown as Realm,
      route.journal,
      context,
    );
  await env.start();
  const snap = await env.snapshot("finalize_window");
  assert.ok(snap);
  assert.equal(snap.asset_set_hash, null);
  assert.equal(snap.completeness, "Unknown");
  assert.equal(snap.fields.browser!.availability, "unknown");
  assert.equal(snap.service_worker.availability, "not_exposed");
  assert.equal(snap.markers.availability, "unknown");
  await env.snapshot("run_start");
  assert.ok(
    route.journal
      .snapshot("environment:env-doc:0")!
      .events.some((e) => e.field_namespace === "environment.reference"),
  );
  env.reset(context, "dispose");
});
test("resource buffer and count/URL overflow Partial; clear invalidates late digest and bounded snapshots", async () => {
  const f = surface(),
    route = new Monitor(),
    env = new EnvironmentMonitor(f.page, route.journal, context);
  await env.start();
  f.state.entries = Array.from({ length: 510 }, (_, i) => ({
    name: `https://chatgpt.com/assets/chunk.${i.toString(16).padStart(8, "0")}.js`,
  }));
  let snap = await env.snapshot("finalize_window");
  assert.equal(snap!.resource_count, 500);
  assert.equal(snap!.completeness, "Partial");
  f.mutable.performance.dispatchEvent(new Event("resourcetimingbufferfull"));
  snap = await env.snapshot("finalize_window");
  assert.equal(snap!.overflow, true);
  const pending = env.snapshot("old_epoch");
  env.reset({ ...context, epoch: 1 }, "pause");
  await pending;
  assert.ok(!env.snapshots.some((s) => s.reason === "old_epoch"));
  route.reset({ ...context, epoch: 1 }, "clear");
  env.reset({ ...context, epoch: 1 }, "clear");
  await env.snapshot("run_start");
  assert.equal(route.journal.snapshot("environment:env-doc:0"), null);
  env.reset(context, "dispose");
});
test("P4 shortened 20-minute-clock key fixture with Network/Environment observers: 11min handoff, 20min alive, DONE/Closed/late", async () => {
  let now = 0;
  const f = surface(),
    route = new Monitor(() => now),
    network = new NetworkMonitor(route.journal, () => now),
    env = new EnvironmentMonitor(f.page, route.journal, context, () => now);
  const c: CaptureStart = {
    capture_id: "long",
    context,
    transport: "fetch",
    mode: "live",
    conversation_id: null,
    started_at: 0,
  };
  route.request(c, '{"request_id":"long-r","model":"one"}');
  network.start(c, '{"request_id":"long-r"}');
  await env.start();
  const frame = (v: unknown) => `data: ${JSON.stringify(v)}\n\n`;
  const ws = (text: string) =>
    JSON.stringify([
      { topic_id: "long-topic", payload: { payload: { encoded_item: text } } },
    ]);
  await route.response(
    c,
    new Response(
      frame({ resolved_model_slug: "one" }) +
        frame({ type: "subscribe_ws_topic", topic_id: "long-topic" }),
      { headers: { "content-type": "text/event-stream" } },
    ),
  );
  for (let minute = 1; minute <= 20; minute++) {
    now = minute * 60000;
    route.journal.tick();
    await env.snapshot("long_window");
    if (minute === 11) {
      network.socket("long-socket", "open", new Event("open"), context);
      await route.socketMessage(
        "long-socket",
        ws(frame({ resolved_model_slug: "one" })),
        context,
        1,
      );
      network.reconcile(route.diagnostics);
    }
    assert.equal(route.journal.state("long").lifecycle, "Capturing");
    assert.equal(route.journal.route("long", "answer").actual_route, "one");
  }
  await route.socketMessage("long-socket", ws("data: [DONE]\n\n"), context, 2);
  assert.equal(route.journal.state("long").lifecycle, "Settling");
  now += 31000;
  route.journal.tick();
  assert.equal(route.journal.state("long").lifecycle, "Closed");
  await route.socketMessage(
    "long-socket",
    ws(frame({ resolved_model_slug: "late" })),
    context,
    3,
  );
  assert.ok(
    route.journal
      .snapshot("long")!
      .events.some(
        (e) => e.level === "A" && e.late_metadata && e.revision >= 1,
      ),
  );
  assert.ok(env.snapshots.length <= 16);
  env.reset(context, "dispose");
  network.reset(context, "dispose");
  route.reset(context, "dispose");
});

test("PerformanceObserver batch and journal exhaustion remain bounded and Partial", async () => {
  const f = surface(),
    route = new Monitor(),
    env = new EnvironmentMonitor(f.page, route.journal, context);
  await env.start();
  f.emitBatch(
    Array.from({ length: 700 }, (_, i) => ({
      name: `https://chatgpt.com/assets/chunk.${i.toString(16).padStart(8, "0")}.js`,
    })),
  );
  let snap = await env.snapshot("oversized_callback");
  assert.equal(snap!.resource_count, 500);
  assert.equal(snap!.completeness, "Partial");
  for (let i = 0; i < 24; i++) {
    f.mutable.innerWidth = 1000 + i * 100;
    snap = await env.snapshot("bounded_history");
  }
  assert.ok(env.snapshots.length <= 16);
  assert.equal(env.health.journal, "Partial");
  assert.ok(env.health.dropped > 0);
  assert.equal(snap!.completeness, "Partial");
  assert.ok(
    route.journal.snapshot("environment:env-doc:0")!.events.length <= 20000,
  );
  env.reset(context, "dispose");
});

test("missing origin with visible relative script references is Unknown, not fabricated location", async () => {
  const f = surface(),
    route = new Monitor();
  Object.defineProperty(f.page, "location", { value: {}, configurable: true });
  const env = new EnvironmentMonitor(f.page, route.journal, context);
  await env.start();
  const snap = await env.snapshot("missing_origin");
  assert.equal(snap!.fields.origin!.availability, "not_exposed");
  assert.equal(snap!.completeness, "Unknown");
  assert.ok(!JSON.stringify(snap).includes("invalid.local"));
  assert.ok(
    snap!.assets.every((asset) => asset.url.startsWith("https://chatgpt.com/")),
  );
  env.reset(context, "dispose");
});
