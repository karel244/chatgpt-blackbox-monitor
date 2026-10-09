import test from "node:test";
import assert from "node:assert/strict";
import { Monitor } from "../../src/adapters/monitor.ts";
import { NetworkMonitor } from "../../src/adapters/network-monitor.ts";
import type { CaptureStart } from "../../src/host/types.ts";
const context = { document_id: "d", visit_id: "v", epoch: 0 };
const capture = (
  id = "c",
  mode: CaptureStart["mode"] = "live",
  time = 100,
): CaptureStart => ({
  capture_id: id,
  context,
  mode,
  transport: "fetch",
  conversation_id: null,
  started_at: time,
  endpoint_path:
    mode === "requirements"
      ? "/backend-api/sentinel/chat-requirements/prepare"
      : undefined,
});
test("network and route coexist: 503 cannot overwrite observed A or route occurrences", async () => {
  const route = new Monitor(),
    network = new NetworkMonitor(route.journal);
  const c = capture();
  route.request(c, '{"model":"one"}');
  network.start(c, '{"model":"one"}');
  await route.response(
    c,
    new Response('data: {"resolved_model_slug":"one"}\n\n', {
      headers: { "content-type": "text/event-stream" },
    }),
  );
  const prior = route.journal
    .snapshot("c")!
    .events.filter((e) => e.level === "A" || e.level === "B");
  await network.response(
    c,
    new Response(null, {
      status: 503,
      headers: {
        "server-timing": 'edge;dur=12;desc="SECRET_AUTH"',
        authorization: "SECRET_AUTH",
        "set-cookie": "SECRET_COOKIE",
      },
    }),
  );
  assert.equal(network.verdict("c"), "Server Error");
  assert.equal(route.journal.route("c", "answer").actual_route, "one");
  assert.deepEqual(
    route.journal
      .snapshot("c")!
      .events.filter((e) => e.level === "A" || e.level === "B"),
    prior,
  );
  assert.ok(!JSON.stringify(route.journal.snapshot("c")).includes("SECRET"));
  const indices = route.journal.snapshot("c")!.events.map((e) => e.event_index);
  assert.deepEqual(
    indices,
    indices.map((_, i) => i + 1),
  );
  route.reset(context, "dispose");
});
test("bounded HTML retains indicators only; ordinary HTML never confirmed; original body readable", async () => {
  for (const [html, expected] of [
    ["<p>ordinary SECRET_HTML</p>", "HTTP Error"],
    [
      '<script src="/cdn-cgi/challenge-platform/SECRET_CHALLENGE"></script>',
      "Challenge Suspected",
    ],
  ]) {
    const route = new Monitor(),
      network = new NetworkMonitor(route.journal);
    const c = capture();
    network.start(c, null);
    const original = new Response(html, {
      status: 403,
      headers: { "content-type": "text/html" },
    });
    await network.response(c, original.clone());
    assert.equal(network.verdict("c"), expected);
    assert.equal(await original.text(), html);
    assert.ok(!JSON.stringify(route.journal.snapshot("c")).includes("SECRET"));
  }
});
test("PoW survives only as E and candidate/confirmed links, not Route A; clear cancels old state", () => {
  let now = 100;
  const route = new Monitor(),
    network = new NetworkMonitor(route.journal, () => now);
  const p = capture("pow", "requirements", 0);
  network.start(p, null);
  network.pow(p, {
    proofofwork: {
      difficulty: "ffffffffffffffff",
      challenge: "SECRET_SOLUTION",
    },
    request_id: "r",
  });
  now = 200;
  const live = capture("live", "live", 200);
  route.request(live, '{"request_id":"r","model":"one"}');
  network.start(live, '{"request_id":"r"}');
  const events = route.journal.snapshot("live")!.events;
  assert.ok(
    events.some(
      (e) =>
        e.field_namespace === "pow.association" &&
        e.field === "association_status" &&
        e.value === "confirmed",
    ),
  );
  assert.equal(route.journal.route("live", "answer").actual_route, "Unknown");
  const candidate = capture("candidate", "live", 300);
  network.start(candidate, null);
  assert.ok(
    route.journal
      .snapshot("candidate")!
      .events.some(
        (e) =>
          e.field === "association_status" &&
          e.value === "candidate" &&
          e.association === "candidate",
      ),
  );
  assert.ok(
    !JSON.stringify(
      route.journal.ids().map((id) => route.journal.snapshot(id)),
    ).includes("SECRET"),
  );
  network.reset({ ...context, epoch: 1 }, "clear");
  route.reset({ ...context, epoch: 1 }, "clear");
  network.pow(p, { proofofwork: { difficulty: "f" } });
  assert.equal(route.journal.snapshot("pow"), null);
});
test("WS code/wasClean retain no reason and never complete task; failure reasons remain Unknown", () => {
  const route = new Monitor(),
    network = new NetworkMonitor(route.journal);
  const c = capture();
  network.start(c, null);
  network.socket("socket", "open", new Event("open"), context);
  network.socket(
    "socket",
    "close",
    Object.assign(new Event("close"), {
      code: 1000,
      wasClean: true,
      reason: "SECRET_CLOSE",
    }),
    context,
  );
  network.failure(c, "generic");
  assert.equal(network.verdict("c"), "Transport Failure");
  const events = route.journal
    .ids()
    .flatMap((id) => route.journal.snapshot(id)!.events);
  assert.ok(events.some((e) => e.field === "wasClean" && e.value === true));
  assert.ok(!JSON.stringify(events).includes("SECRET"));
  assert.equal(route.journal.state("c").lifecycle, "Capturing");
  network.failure(c, "abort");
  assert.equal(network.verdict("c"), "Aborted");
});

test("PoW late response identity is reconciled without modifying A; duplicate IDs ambiguous", async () => {
  const route = new Monitor();
  let now = 100;
  const n = new NetworkMonitor(route.journal, () => now);
  const p = capture("pow", "requirements", 0);
  n.start(p, null);
  n.pow(p, { request_id: "late-r", difficulty: "0xff" });
  const c = capture("live", "live", 200);
  now = 200;
  route.request(c, '{"model":"one"}');
  n.start(c, null);
  await route.response(
    c,
    new Response(
      'data: {"request_id":"late-r","resolved_model_slug":"one"}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    ),
  );
  const a = route.journal
    .snapshot("live")!
    .events.filter((e) => e.level === "A");
  n.reconcile(route.diagnostics);
  assert.ok(
    route.journal
      .snapshot("live")!
      .events.some(
        (e) => e.field === "association_status" && e.value === "confirmed",
      ),
  );
  assert.deepEqual(
    route.journal.snapshot("live")!.events.filter((e) => e.level === "A"),
    a,
  );
  const duplicate = capture("duplicate", "live", 300);
  n.start(duplicate, '{"request_id":"late-r"}');
  assert.ok(
    route.journal
      .snapshot("duplicate")!
      .events.some(
        (e) => e.field === "association_status" && e.value === "ambiguous",
      ),
  );
  route.reset(context, "dispose");
});
test("WS network reconciliation preserves candidate vs registered resume confirmed in shared journal", async () => {
  const r = new Monitor();
  const n = new NetworkMonitor(r.journal);
  const c = capture();
  r.request(c, '{"model":"one","request_id":"c-request"}');
  n.start(c, '{"request_id":"c-request"}');
  const frame = (v: unknown) => `data: ${JSON.stringify(v)}\n\n`;
  const ws = (v: unknown) =>
    JSON.stringify([
      { topic_id: "topic", payload: { payload: { encoded_item: frame(v) } } },
    ]);
  await r.response(
    c,
    new Response(frame({ type: "subscribe_ws_topic", topic_id: "topic" }), {
      headers: { "content-type": "text/event-stream" },
    }),
  );
  for (const id of ["s1", "s2"]) {
    n.socket(id, "open", new Event("open"), context);
    await r.socketMessage(id, ws({ resolved_model_slug: "one" }), context, 1);
    n.reconcile(r.diagnostics);
  }
  assert.ok(
    r.journal
      .snapshot("c")!
      .events.some(
        (e) =>
          e.field === "reconnect" &&
          e.value === "candidate" &&
          e.association === "candidate",
      ),
  );
  assert.ok(
    !r.journal
      .snapshot("c")!
      .events.some((e) => e.field === "reconnect" && e.value === "confirmed"),
  );
  await r.socketMessage(
    "s2",
    ws({ type: "stream_resume", topic_id: "topic", request_id: "c-request" }),
    context,
    3,
  );
  n.reconcile(r.diagnostics);
  assert.ok(
    r.journal
      .snapshot("c")!
      .events.some(
        (e) =>
          e.field === "reconnect" && e.value === "confirmed" && e.level === "N",
      ),
  );
  n.socket(
    "s2",
    "close",
    Object.assign(new Event("close"), {
      code: 1000,
      wasClean: true,
      reason: "SECRET",
    }),
    context,
  );
  n.reconcile(r.diagnostics);
  assert.ok(
    r.journal
      .snapshot("c")!
      .events.some(
        (e) =>
          e.field === "code" && e.value === 1000 && e.transport === "websocket",
      ),
  );
  assert.equal(r.journal.state("c").lifecycle, "Capturing");
  assert.ok(!JSON.stringify(r.journal.snapshot("c")).includes("SECRET"));
  r.reset(context, "dispose");
});
test("requirements stream byte limit and clear in-flight invalidate observer only", async () => {
  const r = new Monitor(),
    n = new NetworkMonitor(r.journal);
  const c = capture("p", "requirements");
  n.start(c, null);
  const body = '{"difficulty":"f","token":"' + "SECRET".repeat(60000) + '"}';
  const original = new Response(body, {
    headers: { "content-type": "application/json" },
  });
  await n.response(c, original.clone());
  assert.equal(await original.text(), body);
  assert.ok(
    r.journal
      .snapshot("p")!
      .events.some(
        (e) => e.field === "body_limit" && e.availability === "not_captured",
      ),
  );
  assert.ok(!JSON.stringify(r.journal.snapshot("p")).includes("SECRET"));
  let enqueue: ReadableStreamDefaultController<Uint8Array>;
  const late = capture("late", "requirements");
  n.start(late, null);
  const observing = n.response(
    late,
    new Response(
      new ReadableStream({
        start(controller) {
          enqueue = controller;
        },
      }),
    ),
  );
  n.reset({ ...context, epoch: 1 }, "clear");
  r.reset({ ...context, epoch: 1 }, "clear");
  await observing;
  assert.equal(r.journal.snapshot("late"), null);
  assert.throws(() =>
    enqueue.enqueue(new TextEncoder().encode('{"difficulty":"f"}')),
  );
});
test("same XHR reused across attempts records distinct statuses and no unsupported body access", () => {
  const r = new Monitor(),
    n = new NetworkMonitor(r.journal);
  let status = 429;
  const xhr = {
    readyState: 4,
    get status() {
      return status;
    },
    responseType: "arraybuffer",
    getResponseHeader: (name: string) =>
      name === "content-type" ? "text/html" : null,
    get responseText() {
      throw new Error("must not read");
    },
  } as unknown as XMLHttpRequest;
  for (const [id, code] of [
    ["one", 429],
    ["two", 503],
  ] as const) {
    status = code;
    const c = capture(id);
    n.start(c, null);
    n.xhr(c, xhr, "load");
    assert.equal(n.verdict(id), code === 429 ? "Rate Limited" : "Server Error");
  }
  n.failure(capture("two"), "timeout");
  assert.ok(
    r.journal
      .snapshot("two")!
      .events.some((e) => e.field === "category" && e.value === "timeout"),
  );
});
