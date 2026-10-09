import test from "node:test";
import assert from "node:assert/strict";
import {
  currentCaptures,
  chooseCapture,
  timelinePage,
  displayConversation,
} from "../../src/ui/projection.ts";
import { sample } from "../fixtures/history.ts";
test("current UI visit and epoch, latest request start, manual selection and old late metadata cannot steal focus", () => {
  const a = structuredClone(sample("old").snapshot),
    b = structuredClone(sample("new").snapshot);
  b.start.started_at = 10;
  a.events.at(-1)!.monotonic_ms = 999999;
  const c = b.start.context;
  assert.equal(chooseCapture([a, b], c)!.start.capture_id, "new");
  assert.equal(chooseCapture([a, b], c, "old")!.start.capture_id, "old");
  a.start.context.visit_id = "previous";
  assert.equal(currentCaptures([a, b], c).length, 1);
  assert.equal(chooseCapture([a, b], c, "old")!.start.capture_id, "new");
  assert.equal(chooseCapture([a, b], { ...c, epoch: c.epoch + 1 }), null);
});
test("timeline paging keeps complete sequence but never renders unbounded list", () => {
  const s = structuredClone(sample().snapshot);
  s.events = Array.from({ length: 20000 }, (_, i) => ({
    ...s.events[0]!,
    event_index: i + 1,
    event_id: String(i),
  }));
  const first = timelinePage(s, 0),
    last = timelinePage(s, 999999);
  assert.equal(first.events.length, 50);
  assert.equal(first.pages, 400);
  assert.equal(first.events[0]!.event_index, 1);
  assert.equal(last.events.length, 50);
  assert.equal(last.events.at(-1)!.event_index, 20000);
  assert.equal(timelinePage(s, 0, 999999).events.length, 100);
  assert.equal(s.events.length, 20000);
});

test("display anchor does not expand Current scope or override explicit empty reload; no evidence means no anchor", () => {
  const known = sample("known").snapshot;
  const empty = structuredClone(known);
  empty.start.capture_id = "empty";
  empty.start.mode = "reload";
  empty.start.started_at = 99;
  empty.events = [];
  const context = known.start.context;
  assert.equal(
    chooseCapture([known, empty], context)?.start.capture_id,
    "empty",
  );
  assert.equal(displayConversation([known, empty], context).snapshot, known);
  assert.equal(
    displayConversation([known, empty], context, "empty").snapshot,
    empty,
  );
  const next = { ...context, epoch: context.epoch + 1, visit_id: "next" };
  assert.equal(currentCaptures([known], next).length, 0);
  assert.deepEqual(displayConversation([known], next), {
    snapshot: known,
    source: "recent",
  });
  assert.equal(displayConversation([], next).snapshot, null);
  assert.equal(
    displayConversation([known], { ...next, document_id: "other" }).snapshot,
    null,
  );
});
