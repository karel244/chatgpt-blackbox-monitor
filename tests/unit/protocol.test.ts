import test from "node:test";
import assert from "node:assert/strict";
import { Sse, type Envelope } from "../../src/adapters/sse.ts";
import {
  Protocol,
  type ProtocolObservation,
} from "../../src/adapters/protocol.ts";
import type { Source, Evidence } from "../../src/core/route.ts";
const source: Source = {
  capture_id: "c",
  task_scope: "answer",
  message_id: "m",
  transport: "fetch",
  direction: "inbound",
  association: "confirmed",
  association_proof: "same_request",
  endpoint_verified: true,
  channel: "0",
  transport_segment_id: "http",
};
const frame = (value: unknown, event = "message") =>
  `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
function setup() {
  const events: Evidence[] = [],
    observations: ProtocolObservation[] = [],
    errors: string[] = [],
    controls: string[] = [];
  const parser = new Protocol(() => source, {
    identity() {},
    evidence: (e, o) => {
      events.push(...e);
      observations.push(o);
    },
    error: (code) => errors.push(code),
    control: (kind) => controls.push(kind),
  });
  return { parser, events, observations, errors, controls };
}
test("standard SSE UTF8 BOM CR LF CRLF multiline every byte split", () => {
  const raw =
    '\uFEFF: ping\r\nevent: metadata\rid: envelope-1\nretry: 123\r\ndata: {"resolved_model_slug":\r\ndata: "one","note":"汉字"}\r\n\r\n';
  const bytes = new TextEncoder().encode(raw);
  for (let split = 0; split <= bytes.length; split++) {
    const output: Envelope[] = [],
      errors: string[] = [];
    const sse = new Sse(
      (e) => output.push(e),
      (e) => errors.push(e),
    );
    sse.push(bytes.slice(0, split));
    sse.push(bytes.slice(split));
    sse.finish();
    assert.equal(output.length, 1, `split ${split}`);
    assert.equal(output[0]!.event, "metadata");
    assert.equal(output[0]!.id, "envelope-1");
    assert.equal(output[0]!.retry, 123);
    assert.equal(JSON.parse(output[0]!.data).resolved_model_slug, "one");
    assert.deepEqual(errors, []);
  }
});
test("one-byte chunks and EOF never dispatch incomplete envelope", () => {
  const output: Envelope[] = [],
    errors: string[] = [];
  const sse = new Sse(
    (e) => output.push(e),
    (e) => errors.push(e),
  );
  for (const byte of new TextEncoder().encode(
    'data: {"resolved_model_slug":"one"}\n',
  ))
    sse.push(Uint8Array.of(byte));
  sse.finish();
  assert.deepEqual(output, []);
  assert.deepEqual(errors, ["incomplete_sse_envelope"]);
});
test("id persists, comments/unknown lines/empty data standard behavior", () => {
  const output: Envelope[] = [];
  const sse = new Sse(
    (e) => output.push(e),
    () => {},
  );
  sse.text(
    "id: stable\n:keep\nunknown: x\ndata:\n\ndata: {}\n\nid: bad\0id\ndata: {}\n\n",
  );
  assert.equal(output.length, 3);
  assert.ok(output.every((e) => e.id === "stable"));
  assert.equal(output[0]!.data, "");
});
test("envelope byte budget counts Unicode and recovers after dropped block", () => {
  const output: Envelope[] = [],
    errors: string[] = [];
  const sse = new Sse(
    (e) => output.push(e),
    (e) => errors.push(e),
    24,
  );
  sse.text("data: " + "汉".repeat(12) + "\n\ndata: {}\n\n");
  assert.equal(output.length, 1);
  assert.equal(sse.counts.dropped, 1);
  assert.deepEqual(errors, ["sse_envelope_limit"]);
});
test("v1 each patch operation occurrence, repeat/null/remove and inherited header", () => {
  const { parser, events, observations, errors } = setup();
  parser.text(frame("v1", "delta_encoding"));
  parser.text(
    frame(
      {
        c: 1,
        p: "",
        o: "add",
        v: { type: "server_ste_metadata", metadata: { model_slug: "one" } },
      },
      "delta",
    ),
  );
  parser.text(
    frame({ p: "/metadata/model_slug", o: "replace", v: "two" }, "delta"),
  );
  parser.text(frame({ v: "two" }, "delta"));
  parser.text(
    frame(
      {
        p: "",
        o: "patch",
        v: [
          { p: "/metadata/model_slug", o: "replace", v: null },
          { p: "/metadata/model_slug", o: "remove" },
        ],
      },
      "delta",
    ),
  );
  assert.deepEqual(
    events.map((e) => e.value),
    ["one", "two", "two", null, null],
  );
  assert.deepEqual(
    events.map((e) => e.value_state),
    ["value", "value", "value", "explicit_null", "removed"],
  );
  assert.equal(observations[2]!.explicit.p, false);
  assert.equal(observations[2]!.channel, "1");
  assert.deepEqual(errors, []);
});
test("append/truncate/root replacement and per-channel inheritance stay isolated", () => {
  const { parser, events, errors } = setup();
  parser.text(frame("v1", "delta_encoding"));
  for (const op of [
    { c: 1, p: "", o: "add", v: { resolved_model_slug: "one" } },
    { p: "/resolved_model_slug", o: "append", v: "-tail" },
    { o: "truncate", v: 3 },
    { c: 2, p: "", o: "add", v: { resolved_model_slug: "other" } },
    { c: 1, v: 2 },
    { c: 2, p: "", o: "replace", v: { resolved_model_slug: "new" } },
  ])
    parser.text(frame(op, "delta"));
  assert.deepEqual(
    events.map((e) => e.value),
    ["one", "one-tail", "one", "other", "on", "new"],
  );
  assert.deepEqual(errors, []);
});
test("unknown version blocks legacy fallback and DONE completion", () => {
  const { parser, events, errors, controls } = setup();
  parser.text(
    frame("v2", "delta_encoding") +
      frame({ resolved_model_slug: "fake" }) +
      "data: [DONE]\n\n",
  );
  assert.equal(events.length, 0);
  assert.ok(errors.includes("unsupported_delta_encoding"));
  assert.ok(!controls.includes("done"));
});
test("malformed multiline JSON is not independently parsed data lines", () => {
  const { parser, events, errors } = setup();
  parser.text(
    'data: {"resolved_model_slug":"one"}\ndata: {"resolved_model_slug":"two"}\n\n',
  );
  assert.equal(events.length, 0);
  assert.deepEqual(errors, ["malformed_json"]);
});
test("Case 13 malformed; Case 14 later error preserves already emitted A", () => {
  const { parser, events, errors } = setup();
  parser.text(frame({ resolved_model_slug: "one" }) + "data: {broken}\n\n");
  assert.equal(events[0]!.value, "one");
  assert.deepEqual(errors, ["malformed_json"]);
});
test("dangerous/deep/unknown delta paths and versionless patch report health", () => {
  for (const path of [
    "/__proto__/x",
    "/constructor/x",
    "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q",
    "/unknown_field",
  ]) {
    const { parser, events, errors } = setup();
    parser.text(
      frame("v1", "delta_encoding") +
        frame({ p: path, o: "add", v: "secret" }, "delta"),
    );
    assert.equal(events.length, 0);
    assert.ok(errors.length);
  }
  const { parser, errors } = setup();
  parser.text(frame({ p: "", v: {} }, "delta"));
  assert.deepEqual(errors, ["delta_without_version"]);
});
test("body/hidden reasoning never retained; tools cannot route; STE never completion", () => {
  const { parser, events, controls } = setup();
  parser.text(
    frame({
      type: "server_ste_metadata",
      metadata: { model_slug: "one" },
      content: { secret: "CANARY" },
    }) +
      frame({ type: "tool_result", resolved_model_slug: "fake" }) +
      frame({
        message: {
          author: { role: "assistant" },
          content: { parts: ["PRIVATE_ANSWER"] },
        },
      }),
  );
  assert.deepEqual(
    events.map((e) => e.value),
    ["one"],
  );
  assert.ok(!controls.includes("done"));
  assert.ok(!JSON.stringify(events).includes("PRIVATE"));
});
