import test from "node:test";
import assert from "node:assert/strict";
import { Journal, projectState } from "../../src/core/journal.ts";
import {
  responseEvidence,
  verdict,
  type Evidence,
  type Source,
} from "../../src/core/route.ts";
import type { CaptureStart } from "../../src/host/types.ts";
const capture: CaptureStart = {
  capture_id: "c",
  context: { document_id: "d", visit_id: "v", epoch: 0 },
  mode: "live",
  transport: "fetch",
  conversation_id: null,
  started_at: 0,
};
const source: Source = {
  capture_id: "c",
  task_scope: "answer",
  message_id: "m",
  transport: "fetch",
  direction: "inbound",
  association: "confirmed",
  association_proof: "same_request",
  endpoint_verified: true,
  channel: "one",
  transport_segment_id: "http",
};
function item(value: unknown): Evidence {
  return responseEvidence({ resolved_model_slug: value }, source)[0]!;
}
function setup() {
  let time = 0,
    index = 0;
  const j = new Journal(
    () => time,
    () => new Date(time).toISOString(),
    () => `e-${++index}`,
  );
  j.start(capture);
  return {
    j,
    time: (t: number) => {
      time = t;
    },
  };
}
test("same chunk, multi chunk and repeated declarations append every occurrence", () => {
  const { j, time } = setup();
  for (const value of ["one", "two", "two", "three"]) j.append(item(value));
  time(5);
  j.append(item("four"));
  const events = j.snapshot("c")!.events;
  assert.deepEqual(
    events.map((e) => e.new_value),
    ["one", "two", "two", "three", "four"],
  );
  assert.deepEqual(
    events.map((e) => e.old_value),
    [null, "one", "two", "two", "three"],
  );
  assert.deepEqual(
    events.map((e) => e.event_index),
    [1, 2, 3, 4, 5],
  );
  assert.equal(j.route("c", "answer").verdict, "Conflict");
  assert.ok(Object.isFrozen(events[0]));
});
test("null, remove and invalid remain different; channel/scope namespaces isolated", () => {
  const { j } = setup();
  j.append(item("one"));
  j.append(item(null));
  j.append({ ...item(null), value_state: "removed" });
  j.append(item({ fake: 1 }));
  j.append({ ...item("two"), channel: "two" });
  j.append({ ...item("three"), task_scope: "planning" });
  const events = j.snapshot("c")!.events;
  assert.deepEqual(
    events.slice(0, 4).map((e) => e.value_state),
    ["value", "explicit_null", "removed", "invalid"],
  );
  assert.equal(events[4]!.old_value_state, "absent");
  assert.equal(events[5]!.old_value_state, "absent");
});
test("10/20/30 second late observations, fixed settling deadline, closed revision", () => {
  const { j, time } = setup();
  j.append(item("one"));
  j.complete("c");
  assert.equal(j.state("c").lifecycle, "Settling");
  for (const t of [10000, 20000]) {
    time(t);
    j.append(item("one"));
    assert.equal(j.state("c").lifecycle, "Settling");
  }
  time(30000);
  const late = j.append(item("two"));
  assert.equal(j.state("c").lifecycle, "Closed");
  assert.equal(late?.late_metadata, true);
  assert.equal(late?.revision, 1);
  time(40000);
  j.append(item("three"));
  assert.equal(j.state("c").revision, 2);
  assert.equal(j.state("c").confirmation_deadline, 30000);
  assert.equal(j.snapshot("c")!.events.length, 5);
});
test("lifecycle separate from completeness, STE/EOF not completed", () => {
  const { j } = setup();
  j.append(item("one"));
  j.segmentEof("c");
  assert.deepEqual(
    [j.state("c").lifecycle, j.state("c").completeness],
    ["Capturing", "Unknown"],
  );
  j.health("c", "Partial", "malformed");
  j.complete("c");
  assert.deepEqual(
    [j.state("c").lifecycle, j.state("c").completeness],
    ["Settling", "Partial"],
  );
  assert.equal(j.route("c", "answer").actual_route, "one");
});
test("pure projection/verdict rebuild, rule-version rebuild does not mutate journal", () => {
  const { j } = setup();
  j.append(item("one"));
  j.complete("c");
  const snapshot = j.snapshot("c")!;
  const serialized = JSON.stringify(snapshot);
  const rebuilt = JSON.parse(serialized) as typeof snapshot;
  assert.deepEqual(projectState(rebuilt), j.state("c"));
  assert.deepEqual(
    verdict(rebuilt.events, "c", "answer", projectState(rebuilt).completeness),
    j.route("c", "answer"),
  );
  assert.equal(
    j.route("c", "answer", "route-rebuild-test").rule_version,
    "route-rebuild-test",
  );
  assert.equal(JSON.stringify(j.snapshot("c")), serialized);
});
test("pause clear block stale writes; SPA/BFCache retain old bound stream under original scope", () => {
  for (const reason of ["pause", "clear", "dispose"]) {
    const { j } = setup();
    j.reset({ ...capture.context, epoch: 1 }, reason);
    assert.equal(j.append(item("old")), null);
    assert.equal(j.state("c").lifecycle, "Closed");
  }
  for (const reason of ["pushState", "replaceState", "popstate", "pageshow"]) {
    const { j } = setup();
    j.reset({ ...capture.context, visit_id: "new", epoch: 1 }, reason);
    const event = j.append(item("old-bound"));
    assert.equal(event?.visit_id, "v");
    assert.equal(event?.epoch, 0);
    assert.equal(j.snapshot("c")!.start.context.visit_id, "v");
  }
});
test("reload observed time/provenance never invents live start", () => {
  const { j } = setup();
  j.start({ ...capture, capture_id: "reload", mode: "reload", started_at: 99 });
  j.append({ ...item("one"), capture_id: "reload", transport: "reload" });
  const events = j.snapshot("reload")!.events;
  assert.equal(events[0]?.transport, "reload");
  assert.equal(events[0]?.observed_vs_declared_time, "observed");
  assert.equal(events[0]?.arrival_index, null);
  assert.equal(j.snapshot("reload")!.start.mode, "reload");
});
test("20 minute mock clock does not expire; 24h safety cap is explicit Partial", () => {
  const { j, time } = setup();
  time(1200000);
  j.tick();
  assert.equal(j.state("c").lifecycle, "Capturing");
  assert.ok(j.append(item("late")));
  time(86400000);
  j.tick();
  assert.equal(j.state("c").completeness, "Partial");
  assert.equal(j.append(item("too-late")), null);
});
