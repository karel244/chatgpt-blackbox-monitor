import test from "node:test";
import assert from "node:assert/strict";
import { currentCaptures } from "../../src/ui/projection.ts";
import { HistoryStore } from "../../src/history/storage.ts";
import { exportBundle, importBundle } from "../../src/history/bundle.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
test("persisted old-scope capture is not a Current option but remains recovered and exportable History", async () => {
  const history = new HistoryStore(new MemoryStore(), "stale-history"),
    capture = sample("old-scope");
  await history.init();
  await history.flush(capture.j);
  const current = {
    ...capture.snapshot.start.context,
    visit_id: "next-visit",
    epoch: 2,
  };
  assert.deepEqual(currentCaptures([capture.snapshot], current), []);
  const records = await history.list(),
    record = records.find((r) => r.manifest.capture_id === "old-scope");
  assert.ok(record?.snapshot);
  assert.equal(record.snapshot.start.mode, "live");
  const bundle = await exportBundle(record.snapshot, "fixture-version"),
    imported = await importBundle(bundle.bytes);
  assert.equal(imported.snapshot.start.mode, "live");
  assert.ok(imported.snapshot.events.length > 0);
  history.dispose();
});
