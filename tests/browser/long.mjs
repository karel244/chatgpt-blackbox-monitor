import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { installHost } from "../../src/host/capture.ts";
import { Monitor } from "../../src/adapters/monitor.ts";
const started = performance.now(),
  startUtc = new Date().toISOString();
const port = Number(process.argv[2] ?? 44000);
const sourcePaths = [
  "src/userscript.ts",
  "src/host/request.ts",
  "src/host/capture.ts",
  "src/host/types.ts",
  "src/host/endpoints.ts",
  "src/core/route.ts",
  "src/core/journal.ts",
  "src/adapters/sse.ts",
  "src/adapters/protocol.ts",
  "src/adapters/monitor.ts",
  "scripts/build.mjs",
  "package-lock.json",
  "tests/browser/p1.mjs",
  "tests/browser/long.mjs",
  "dist/chatgpt-blackbox-monitor.user.js",
];
if (process.env.BLACKBOX_SYNTHETIC_FILE)
  sourcePaths.push(process.env.BLACKBOX_SYNTHETIC_FILE);
const output = process.env.BLACKBOX_RESULTS_DIR ?? "test-results/calibration";
async function hashes() {
  const result = {};
  for (const path of sourcePaths)
    result[path] = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  return result;
}
const sourceHashes = await hashes();
const frame = (value) => `data: ${JSON.stringify(value)}\n\n`;
let requestCount = 0,
  handoffAt = null,
  pageFinishedAt = null,
  wsReceivedAt = null;
const requestKinds = { monitored: 0, baseline: 0 };
const samples = [],
  lifecycle = [];
const server = createServer((req, res) => {
  requestCount++;
  const baseline = req.url.includes("baseline=1");
  requestKinds[baseline ? "baseline" : "monitored"]++;
  req.resume();
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.write(
    frame({
      type: "server_ste_metadata",
      metadata: {
        model_slug: "long-route",
        request_id: "long-request",
        conversation_id: "long-conversation",
      },
    }),
  );
  const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 10000);
  setTimeout(() => {
    clearInterval(heartbeat);
    if (!baseline) handoffAt = performance.now() - started;
    res.end(
      frame({
        type: "subscribe_ws_topic",
        topic_id: "long-topic",
        request_id: "long-request",
        conversation_id: "long-conversation",
      }),
    );
  }, 660000);
});
const wss = new WebSocketServer({ server });
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
const events = new EventTarget();
class DummyXhr extends EventTarget {
  open() {}
  send() {}
}
const page = {
  fetch,
  WebSocket,
  XMLHttpRequest: DummyXhr,
  EventSource: undefined,
  URL,
  Blob,
  ArrayBuffer,
  TextEncoder,
  crypto,
  performance,
  queueMicrotask,
  location: {
    origin: `http://127.0.0.1:${port}`,
    href: `http://127.0.0.1:${port}/`,
  },
  history: { pushState() {}, replaceState() {} },
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
};
const monitor = new Monitor();
const nativeFetch = fetch,
  NativeSocket = WebSocket;
const host = installHost(page, {
  allowedOrigins: [page.location.origin],
  sink: monitor.sink(),
});
const original = page.fetch(
  `http://127.0.0.1:${port}/backend-api/f/conversation`,
  {
    method: "POST",
    body: JSON.stringify({
      model: "long-route",
      request_id: "long-request",
      messages: [{ id: "long-input", content: "SECRET_LONG_PROMPT" }],
    }),
  },
);
const baselineBody = nativeFetch(
  `http://127.0.0.1:${port}/backend-api/f/conversation?baseline=1`,
  {
    method: "POST",
    body: JSON.stringify({
      model: "long-route",
      request_id: "long-request",
      messages: [{ id: "long-input", content: "SECRET_LONG_PROMPT" }],
    }),
  },
).then((response) => response.text());
const digest = (text) => createHash("sha256").update(text).digest("hex");
let observedBody;
const nativeBody = original.then(async (response) => {
  const text = await response.text();
  observedBody = text;
  pageFinishedAt = performance.now() - started;
  assert.ok(text.includes("long-topic"));
  return text.length;
});
const socket = new page.WebSocket(`ws://127.0.0.1:${port}/socket`);
const baselineSocket = new NativeSocket(
  `ws://127.0.0.1:${port}/socket-baseline`,
);
const observedMessages = [],
  baselineMessages = [];
baselineSocket.onmessage = (event) => baselineMessages.push(digest(event.data));
const nativeMessage = new Promise((resolve, reject) => {
  socket.onmessage = (event) => {
    observedMessages.push(digest(event.data));
    wsReceivedAt ??= performance.now() - started;
    assert.ok(event.data.includes("long-route"));
    resolve(event.data.length);
  };
  socket.onerror = reject;
});
let row;
function sample() {
  const queues = [...monitor.socketQueues.values()];
  const snapshot = {
    elapsed_ms: performance.now() - started,
    lifecycle: monitor.journal
      .ids()
      .map((id) => monitor.journal.state(id).lifecycle),
    pending: queues.reduce((sum, q) => sum + q.pending, 0),
    queue_bytes: queues.reduce((sum, q) => sum + q.bytes, 0),
    queue_count: queues.length,
    reader_count: monitor.readers.size,
    parser_count: monitor.socketParsers.size,
    memory: process.memoryUsage(),
    handoffAt,
  };
  assert.ok(
    snapshot.pending <= 64 &&
      snapshot.queue_bytes <= 8388608 &&
      snapshot.queue_count <= 1,
  );
  assert.ok(snapshot.reader_count <= 1 && snapshot.parser_count <= 1);
  samples.push(snapshot);
  return snapshot;
}
const progress = setInterval(
  () =>
    console.log(
      JSON.stringify({ stage: "20-minute real-time synthetic", ...sample() }),
    ),
  60000,
);
try {
  await new Promise((resolve) => setTimeout(resolve, 1200000));
  assert.ok(handoffAt >= 660000, "handoff must be later than 10min");
  const id = monitor.journal.ids()[0];
  assert.equal(
    monitor.journal.state(id).lifecycle,
    "Capturing",
    "HTTP EOF cannot close handoff",
  );
  lifecycle.push({
    at_ms: performance.now() - started,
    state: monitor.journal.state(id),
  });
  const payload = JSON.stringify([
    {
      topic_id: "long-topic",
      payload: {
        payload: {
          encoded_item:
            frame({
              request_id: "long-request",
              conversation_id: "long-conversation",
              resolved_model_slug: "long-route",
            }) + "data: [DONE]\n\n",
        },
      },
    },
  ]);
  for (const client of wss.clients) client.send(payload);
  const nativeWsLength = await nativeMessage;
  const nativeLength = await nativeBody;
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(monitor.journal.route(id, "answer").actual_route, "long-route");
  assert.ok(
    monitor.journal
      .snapshot(id)
      .events.some((e) => e.transport === "websocket"),
  );
  assert.equal(monitor.journal.state(id).lifecycle, "Settling");
  assert.equal(requestKinds.monitored, 1);
  assert.equal(requestKinds.baseline, 1);
  assert.equal(requestCount, 2);
  const baselineText = await baselineBody;
  const semanticBody = (text) => text.replace(/^: keepalive\n\n/gm, "");
  assert.equal(
    semanticBody(observedBody),
    semanticBody(baselineText),
    "original SSE data must match observer-off baseline",
  );
  assert.deepEqual(observedMessages, baselineMessages);
  const websocketEvents = monitor.journal
    .snapshot(id)
    .events.filter((e) => e.transport === "websocket");
  assert.ok(
    websocketEvents.every(
      (e) => e.association_proof === "confirmed_request_id",
    ),
  );
  lifecycle.push({
    at_ms: performance.now() - started,
    state: monitor.journal.state(id),
  });
  await new Promise((resolve) => setTimeout(resolve, 31000));
  assert.equal(
    monitor.journal.state(id).lifecycle,
    "Closed",
    "real 30-second confirmation deadline",
  );
  lifecycle.push({
    at_ms: performance.now() - started,
    state: monitor.journal.state(id),
  });
  const countBeforeLate = monitor.journal.snapshot(id).events.length;
  const late = JSON.stringify([
    {
      topic_id: "long-topic",
      payload: {
        payload: {
          encoded_item: frame({
            request_id: "long-request",
            resolved_model_slug: "long-route",
          }),
        },
      },
    },
  ]);
  for (const client of wss.clients) client.send(late);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const finalSnapshot = monitor.journal.snapshot(id);
  assert.equal(finalSnapshot.events.length, countBeforeLate + 1);
  assert.equal(finalSnapshot.events.at(-1).late_metadata, true);
  assert.equal(finalSnapshot.events.at(-1).revision, 1);
  assert.equal(monitor.journal.state(id).lifecycle, "Closed");
  assert.equal(monitor.journal.state(id).completeness, "Complete");
  assert.equal(monitor.journal.route(id, "answer").actual_route, "long-route");
  assert.deepEqual(observedMessages, baselineMessages);
  assert.equal(observedMessages.length, 2);
  const finalQueue = sample();
  assert.equal(finalQueue.pending, 0);
  assert.equal(finalQueue.queue_bytes, 0);
  assert.equal(finalQueue.reader_count, 0);
  assert.equal(monitor.counters.dropped, 0);
  assert.ok(
    !JSON.stringify(monitor.journal.snapshot(id)).includes(
      "SECRET_LONG_PROMPT",
    ),
  );
  row = {
    status: "PASS",
    started_at: startUtc,
    completed_at: new Date().toISOString(),
    duration_ms: performance.now() - started,
    handoff_at_ms: handoffAt,
    page_finished_at_ms: pageFinishedAt,
    ws_received_at_ms: wsReceivedAt,
    request_count: requestCount,
    request_kinds: requestKinds,
    lifecycle_checkpoints: lifecycle,
    samples,
    non_interference: {
      http_semantic_sha256: digest(semanticBody(observedBody)),
      baseline_http_semantic_sha256: digest(semanticBody(baselineText)),
      observed_ws_sha256: observedMessages,
      baseline_ws_sha256: baselineMessages,
      native_response_length: observedBody.length,
      baseline_response_length: baselineText.length,
      heartbeat_comments_excluded_from_data_comparison: true,
    },
    native_response_length: nativeLength,
    native_ws_length: nativeWsLength,
    state: monitor.journal.state(id),
    route: monitor.journal.route(id, "answer"),
    events: monitor.journal.snapshot(id).events,
    source_hashes: sourceHashes,
  };
  assert.deepEqual(
    await hashes(),
    sourceHashes,
    "runtime source changed during long test",
  );
} catch (error) {
  row = {
    status: "FAIL",
    error: String(error),
    started_at: startUtc,
    duration_ms: performance.now() - started,
  };
  process.exitCode = 1;
} finally {
  clearInterval(progress);
  host.dispose();
  socket.close();
  baselineSocket.close();
  for (const client of wss.clients) client.terminate();
  wss.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/p4-long-real-time-${port}.json`,
    JSON.stringify(row, null, 2),
  );
  console.log(
    JSON.stringify({
      status: row.status,
      duration_ms: row.duration_ms,
      error: row.error,
    }),
  );
}
