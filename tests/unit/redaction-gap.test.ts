import test from "node:test";
import assert from "node:assert/strict";
import {
  exportBundle,
  importBundle,
  BUNDLE_FILES,
} from "../../src/history/bundle.ts";
import { unzipFiles, zipFiles } from "../../src/history/zip.ts";
import { digest, encode } from "../../src/history/storage.ts";
import { sample } from "../fixtures/history.ts";
import { safeSnapshot } from "../../src/history/safety.ts";
async function redacted() {
  const s = sample().snapshot;
  s.events = [
    { ...s.events[0]!, event_index: 1 },
    { ...s.events[1]!, event_index: 2, field: "Authorization" },
    { ...s.events[2]!, event_index: 3 },
  ];
  const source = structuredClone(s);
  const exported = await exportBundle(s, "test-gap");
  assert.deepEqual(s, source);
  return { s, exported };
}
async function mutate(change: (files: Map<string, Uint8Array>) => void) {
  const { exported } = await redacted();
  const files = await unzipFiles(exported.bytes, BUNDLE_FILES);
  change(files);
  const manifest = JSON.parse(
    new TextDecoder().decode(files.get("evidence/manifest.json")),
  );
  for (const ref of manifest.files) {
    ref.sha256 = await digest(files.get(ref.path)!);
    ref.bytes = files.get(ref.path)!.length;
  }
  files.set("evidence/manifest.json", encode(manifest));
  return zipFiles(files);
}
test("legitimate redaction keeps Journal indices 1,3 and coherent Partial summary/manifest/support/report", async () => {
  const { s, exported } = await redacted();
  assert.deepEqual(
    safeSnapshot(s).events.map((e) => e.event_index),
    [1, 3],
  );
  const imported = await importBundle(exported.bytes);
  assert.deepEqual(
    imported.snapshot.events.map((e) => e.event_index),
    [1, 3],
  );
  assert.ok(
    imported.snapshot.controls.some(
      (c) => c.code === "storage_redaction_drop" && c.health === "Partial",
    ),
  );
  assert.equal(imported.summary.capture_health.completeness, "Partial");
  assert.equal(imported.manifest.source_completeness, "Partial");
  assert.equal(
    imported.manifest.files.find((f) => f.path.endsWith("timeline.jsonl"))!
      .records,
    2,
  );
  assert.deepEqual(
    imported.summary.supporting_event_ids,
    imported.snapshot.events.map((e) => e.event_id),
  );
});
test("forged unexplained gaps, rollback, duplicate index and duplicate event ID remain rejected", async () => {
  await assert.rejects(
    importBundle(
      await mutate((files) => {
        const summary = JSON.parse(
          new TextDecoder().decode(files.get("evidence/summary.json")),
        );
        summary.controls = summary.controls.filter(
          (c: { code: string }) => c.code !== "storage_redaction_drop",
        );
        files.set("evidence/summary.json", encode(summary));
      }),
    ),
    /sequence_or_source/,
  );
  for (const kind of [
    "backward",
    "duplicate_index",
    "duplicate_id",
    "zero",
    "fractional",
  ]) {
    await assert.rejects(
      importBundle(
        await mutate((files) => {
          const lines = new TextDecoder()
            .decode(files.get("evidence/timeline.jsonl"))
            .trimEnd()
            .split("\n")
            .map((line) => JSON.parse(line));
          if (kind === "backward") lines.reverse();
          if (kind === "duplicate_index")
            lines[1].event_index = lines[0].event_index;
          if (kind === "duplicate_id") lines[1].event_id = lines[0].event_id;
          if (kind === "zero") lines[0].event_index = 0;
          if (kind === "fractional") lines[0].event_index = 1.5;
          files.set(
            "evidence/timeline.jsonl",
            new TextEncoder().encode(
              lines.map((e) => JSON.stringify(e)).join("\n") + "\n",
            ),
          );
        }),
      ),
      /sequence_or_source/,
    );
  }
});
