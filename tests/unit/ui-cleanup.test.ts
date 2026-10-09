import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  historyDisplay,
  networkDisplay,
  viewportText,
} from "../../src/ui/cleanup.ts";
import { I18n, messages } from "../../src/ui/i18n.ts";
import { sample } from "../fixtures/history.ts";
import type { Snapshot } from "../../src/history/safety.ts";

const ui = readFileSync(
  new URL("../../src/ui/layers.ts", import.meta.url),
  "utf8",
);
function network(
  fields: [string, string, string | number | boolean | null][],
): Snapshot {
  const s = sample().snapshot;
  s.events = fields.map(([ns, field, value], index) => ({
    ...s.events[0]!,
    field_namespace: ns,
    field,
    value,
    level: "N",
    event_index: index + 1,
  }));
  return s;
}
test("Overview UI removed; shared Current capture selector preserved", () => {
  assert.doesNotMatch(ui, /current === "Overview"/);
  assert.match(ui, /context\.append\(contextLabel, selector, brief\)/);
});

test("Route technical evidence is in default-closed details with original levels", () => {
  assert.match(ui, /details\("Evidence details"/);
  assert.match(ui, /\["A", "B", "C", "D"\]/);
  assert.doesNotMatch(ui, /\.open = true/);
});
test("healthy 2xx has only status and HTTP at primary level", () => {
  const d = networkDisplay(
    network([
      ["network.verdict", "status", "OK"],
      ["network.http", "http_status", 200],
    ]),
  );
  assert.equal(d.status, "OK");
  assert.equal(d.http, 200);
  assert.deepEqual(d.alerts, []);
  assert.ok(d.fields.some(([key]) => key === "PoW"));
});
test("abnormal HTTP verdicts remain unchanged, retry/challenge/failure/WS auto-surface", () => {
  for (const [status, http] of [
    ["HTTP Error", 403],
    ["Rate Limited", 429],
    ["Server Error", 503],
    ["Challenge Suspected", 403],
    ["Aborted", null],
    ["Transport Failure", null],
  ] as const) {
    const d = networkDisplay(
      network([
        ["network.verdict", "status", status],
        ["network.http", "http_status", http],
      ]),
    );
    assert.equal(d.status, status);
    assert.equal(d.http, http);
  }
  const d = networkDisplay(
    network([
      ["network.verdict", "status", "Challenge Confirmed"],
      ["network.headers", "cf-mitigated", "challenge"],
      ["network.headers", "retry-after.seconds", 0],
      ["network.failure", "category", "timeout"],
      ["network.websocket.safe", "code", 1006],
      ["network.websocket.safe", "reconnect", "candidate"],
    ]),
  );
  assert.deepEqual(
    d.alerts.map(([key]) => key),
    ["Cloudflare", "Retry-After", "WebSocket diagnostics", "Transport failure"],
  );
  assert.match(String(d.alerts[2]![1]), /candidate/);
});
test("Retry-After date remains accessible and unknown is not promoted", () => {
  const d = networkDisplay(
    network([
      ["network.headers", "retry-after.seconds", null],
      ["network.headers", "retry-after.date", "2026-10-05T00:00:00.000Z"],
    ]),
  );
  assert.equal(d.alerts[0]![1], "2026-10-05T00:00:00.000Z");
  assert.equal(networkDisplay(null).status, "Unknown");
});
test("viewport human formatting includes only already-known valid DPR", () => {
  assert.equal(viewportText(1222, 592, 1.25), "1222 × 592 · DPR 1.25");
  assert.equal(viewportText(1222, 592), "1222 × 592");
  assert.equal(viewportText(null, 592), null);
  assert.equal(viewportText(Infinity, 592), null);
});
test("environment technical fields move to details", () => {
  assert.match(ui, /details\("Technical details"/);
  const env = ui
    .split("const events = data.related")[1]!
    .split("const raw =")[0]!;
  const primary = env.split('details("Technical details"')[0]!;
  assert.doesNotMatch(primary, /"build_marker",\s*"asset_set"/);
});
test("History projection uses existing verdict, server source and protocol duration; never mutates", () => {
  const s = sample().snapshot,
    before = JSON.stringify(s),
    d = historyDisplay(s, new I18n(), new Date(0));
  assert.equal(d.model, "model-one");
  assert.equal(d.modelSource, "服务器路由");
  assert.equal(d.verdict, "路由一致");
  assert.equal(d.effort, "高");
  assert.equal(d.duration, "1.0 秒");
  assert.match(d.time, /^\d{2}:\d{2}$/);
  assert.equal(JSON.stringify(s), before);
});
test("History request fallback and missing time/duration are explicit", () => {
  const s = sample().snapshot;
  s.events = s.events
    .filter((e) => e.level !== "A")
    .map((e) => ({ ...e, timestamp: "invalid", observed_at: "invalid" }));
  s.controls = [];
  const d = historyDisplay(s, new I18n());
  assert.equal(d.model, "model-one");
  assert.equal(d.modelSource, "请求模型");
  assert.equal(d.verdict, "未知");
  assert.equal(d.time, "时间未知");
  assert.equal(d.duration, "耗时未知");
});
test("cleanup labels have unified bilingual coverage", () => {
  for (const key of [
    "Evidence details",
    "Detailed diagnostics",
    "Technical details",
    "Time unknown",
    "Duration unknown",
    "Export this history round",
    "WebSocket diagnostics",
    "Transport failure",
    "Online",
    "Offline",
  ]) {
    assert.ok(Object.hasOwn(messages, key));
    const i = new I18n();
    assert.notEqual(i.t(key), key);
    i.setLocale("en-US");
    assert.equal(i.t(key), key);
  }
});
