import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { Monitor } from "../../src/adapters/monitor.ts";
import { Protocol, metadataOnly } from "../../src/adapters/protocol.ts";
import type { Source } from "../../src/core/route.ts";
import type { CaptureStart } from "../../src/host/types.ts";
const context = { document_id: "d", visit_id: "v", epoch: 0 };
const capture: CaptureStart = {
  capture_id: "c",
  context,
  mode: "live",
  transport: "fetch",
  conversation_id: null,
  started_at: 0,
};
const monitors: Monitor[] = [];
function monitor() {
  const m = new Monitor();
  m.request(capture, JSON.stringify({ model: "one", request_id: "request" }));
  monitors.push(m);
  return m;
}
afterEach(() => {
  for (const m of monitors) m.reset(context, "dispose");
  monitors.length = 0;
});
const frame = (value: unknown, event = "message") =>
  `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
const socket = (value: string) =>
  JSON.stringify([
    { topic_id: "topic", payload: { payload: { encoded_item: value } } },
  ]);
test("unknown envelope and invalid metadata after valid A reduce coverage", async () => {
  for (const payload of [
    { type: "unknown", resolved_model_slug: "fake" },
    { resolved_model_slug: { body: "CANARY" } },
    [1, 2],
  ]) {
    const m = monitor();
    await m.response(
      capture,
      new Response(
        frame({ resolved_model_slug: "one" }) +
          frame(payload) +
          "data: [DONE]\n\n",
        { headers: { "content-type": "text/event-stream" } },
      ),
    );
    assert.equal(m.journal.route("c", "answer").actual_route, "one");
    assert.equal(m.journal.state("c").completeness, "Partial");
  }
});
test("multi-phase unsupported scope quarantined rather than forced into answer", async () => {
  const m = monitor();
  await m.response(
    capture,
    new Response(
      frame({ task_scope: "planning", resolved_model_slug: "fake" }) +
        "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } },
    ),
  );
  assert.equal(m.journal.route("c", "answer").actual_route, "Unknown");
  assert.equal(m.journal.state("c").completeness, "Partial");
});
test("WS malformed after associated A cannot remain Complete", async () => {
  const m = monitor();
  await m.response(
    capture,
    new Response(frame({ type: "subscribe_ws_topic", topic_id: "topic" }), {
      headers: { "content-type": "text/event-stream" },
    }),
  );
  await m.socketMessage(
    "s",
    socket(frame({ resolved_model_slug: "one" })),
    context,
    1,
  );
  await m.socketMessage("s", "broken", context, 2);
  await m.socketMessage("s", socket("data: [DONE]\n\n"), context, 3);
  assert.equal(m.journal.route("c", "answer").actual_route, "one");
  assert.equal(m.journal.state("c").completeness, "Partial");
});
test("queue known drops bounded and no overwritten successful A", async () => {
  const m = monitor();
  await m.response(
    capture,
    new Response(frame({ type: "subscribe_ws_topic", topic_id: "topic" }), {
      headers: { "content-type": "text/event-stream" },
    }),
  );
  const blob = new Blob([socket(frame({ resolved_model_slug: "one" }))]);
  await Promise.all(
    Array.from({ length: 70 }, (_, i) =>
      m.socketMessage("s", blob, context, i + 1),
    ),
  );
  assert.ok(m.counters.dropped >= 6);
  assert.equal(m.journal.route("c", "answer").actual_route, "one");
  assert.equal(m.journal.state("c").completeness, "Partial");
});
test("clear/pause cancel clone only, original response still consumable", async () => {
  const m = monitor();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const original = new Response(
    new ReadableStream({
      start(c) {
        controller = c;
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
  const observed = m.response(capture, original.clone());
  controller.enqueue(
    new TextEncoder().encode(frame({ resolved_model_slug: "one" })),
  );
  await new Promise((resolve) => setImmediate(resolve));
  m.reset({ ...context, epoch: 1 }, "clear");
  controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
  controller.close();
  assert.ok((await original.text()).includes("one"));
  await observed;
  assert.equal(m.journal.snapshot("c"), null);
});
test("safe valid array add/append/remove/truncate; invalid index explicitly rejected", () => {
  const errors: string[] = [];
  const source: Source = {
    capture_id: "c",
    task_scope: "answer",
    message_id: null,
    transport: "fetch",
    direction: "inbound",
    association: "confirmed",
    association_proof: "request",
    endpoint_verified: true,
    channel: "0",
    transport_segment_id: "http",
  };
  const parser = new Protocol(() => source, {
    evidence() {},
    identity() {},
    control() {},
    error: (code) => errors.push(code),
  });
  parser.text(frame("v1", "delta_encoding"));
  for (const op of [
    {
      p: "",
      o: "add",
      v: { message: { metadata: { server_ste_metadata: [] } } },
    },
    {
      p: "/message/metadata/server_ste_metadata",
      o: "append",
      v: [{ model_slug: "one" }],
    },
    {
      p: "/message/metadata/server_ste_metadata/0",
      o: "add",
      v: { model_slug: "two" },
    },
    { p: "/message/metadata/server_ste_metadata/0", o: "remove" },
    { p: "/message/metadata/server_ste_metadata", o: "truncate", v: 0 },
  ])
    parser.text(frame(op, "delta"));
  assert.equal(errors.length, 0);
  parser.text(
    frame(
      { p: "/message/metadata/server_ste_metadata/999", o: "add", v: {} },
      "delta",
    ),
  );
  assert.ok(errors.includes("invalid_array_index"));
});
test("metadata projection bounded nodes and depth, sensitive keys never retained", () => {
  let root: unknown = { model_slug: "one" };
  for (let i = 0; i < 18; i++) root = { metadata: root };
  assert.throws(() => metadataOnly(root), /depth/);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        metadataOnly({
          content: "CANARY",
          authorization: "CANARY",
          hidden_reasoning: "CANARY",
          model_slug: "one",
        }),
      ),
    ),
    { model_slug: "one" },
  );
});
