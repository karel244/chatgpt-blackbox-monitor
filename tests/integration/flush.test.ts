import test from "node:test";
import assert from "node:assert/strict";
import { coalescedFlush } from "../../src/history/flush.ts";
import { HistoryStore } from "../../src/history/storage.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
test("timer and concurrent explicit flush await current and latest committed events without backlog", async () => {
  const memory = new MemoryStore(),
    history = new HistoryStore(memory, "flush-tab", () => 1000);
  await history.init();
  const a = sample("flush-cap", 2),
    started = deferred(),
    release = deferred();
  const original = memory.set.bind(memory);
  let blocked = false;
  memory.set = async (key, value) => {
    if (key.includes(":chunk:") && !blocked) {
      blocked = true;
      started.resolve();
      await release.promise;
    }
    await original(key, value);
  };
  let passes = 0;
  const flush = coalescedFlush(async () => {
    passes++;
    await history.flush(a.j);
  });
  const timer = flush();
  await started.promise;
  a.time(40000);
  a.j.append({ ...a.snapshot.events.at(-1)!, value: "model-two" });
  const last = a.j.snapshot("flush-cap")!.events.at(-1)!;
  const callers = Array.from({ length: 1000 }, () => flush());
  assert.ok(callers.every((p) => p === timer));
  let settled = false;
  void callers[0]!.then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  release.resolve();
  await Promise.all(callers);
  assert.equal(passes, 2);
  const recovered = (await history.list())[0]!;
  assert.equal(recovered.snapshot.events.at(-1)!.event_index, last.event_index);
  assert.equal(recovered.snapshot.events.at(-1)!.value, "model-two");
  assert.equal(history.health.queued_bytes, 0);
});
test("new requests during rerun settle before return; rejection releases the lifecycle", async () => {
  const gates = [deferred(), deferred(), deferred()],
    begins = [deferred(), deferred(), deferred()];
  let passes = 0;
  const flush = coalescedFlush(async () => {
    const i = passes++;
    begins[i]!.resolve();
    await gates[i]!.promise;
  });
  const first = flush();
  await begins[0]!.promise;
  const second = flush();
  gates[0]!.resolve();
  await begins[1]!.promise;
  const third = flush();
  gates[1]!.resolve();
  await begins[2]!.promise;
  let returned = false;
  void first.then(() => {
    returned = true;
  });
  await Promise.resolve();
  assert.equal(returned, false);
  gates[2]!.resolve();
  await Promise.all([first, second, third]);
  assert.equal(passes, 3);
  let fail = true;
  const retry = coalescedFlush(async () => {
    if (fail) throw Error("synthetic_failed_pass");
  });
  await assert.rejects(retry(), /synthetic_failed_pass/);
  fail = false;
  await retry();
});
