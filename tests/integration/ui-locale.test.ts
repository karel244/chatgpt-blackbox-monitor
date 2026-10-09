import test from "node:test";
import assert from "node:assert/strict";
import { I18n, LOCALE_KEY } from "../../src/ui/i18n.ts";
import { POSITION_KEY } from "../../src/ui/preferences.ts";
import { HistoryStore } from "../../src/history/storage.ts";
import { exportBundle, importBundle } from "../../src/history/bundle.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
test("UI preference survives actual Clear all; locale toggles never alter capture or exported machine Evidence", async () => {
  const store = new MemoryStore(),
    history = new HistoryStore(store, "locale-test");
  await history.init();
  const capture = sample();
  await history.flush(capture.j);
  const original = JSON.stringify(capture.snapshot);
  const before = await exportBundle(capture.snapshot, "fixture-version");
  const i = new I18n({
    get: () => store.data.get(LOCALE_KEY),
    set: (value) => {
      store.data.set(LOCALE_KEY, value);
    },
  });
  i.setLocale("en-US");
  i.display(capture.snapshot);
  i.setLocale("zh-CN");
  assert.equal(JSON.stringify(capture.snapshot), original);
  const after = await exportBundle(capture.snapshot, "fixture-version");
  const a = await importBundle(before.bytes),
    b = await importBundle(after.bytes);
  for (const key of ["summary", "snapshot", "related", "comparison"] as const)
    assert.deepEqual(a[key], b[key], key);
  assert.ok(!JSON.stringify(b).includes(LOCALE_KEY));
  store.data.set(POSITION_KEY, { x: 125, y: 80 });
  await history.clearAll();
  assert.deepEqual(store.data.get(POSITION_KEY), { x: 125, y: 80 });
  assert.equal(store.data.get(LOCALE_KEY), "zh-CN");
  assert.equal(
    new I18n({ get: () => store.data.get(LOCALE_KEY), set: () => {} }).locale,
    "zh-CN",
  );
  history.dispose();
});
