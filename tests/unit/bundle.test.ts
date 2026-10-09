import test from "node:test";
import assert from "node:assert/strict";
import {
  exportBundle,
  importBundle,
  BUNDLE_FILES,
  escapeMarkdown,
} from "../../src/history/bundle.ts";
import { zipFiles, unzipFiles } from "../../src/history/zip.ts";
import { digest, encode } from "../../src/history/storage.ts";
import { safeOccurrence, ExportRedactor } from "../../src/history/safety.ts";
import { sample } from "../fixtures/history.ts";
import type { Snapshot } from "../../src/history/safety.ts";

test("document environment stays separate E context in cross-file bundle and never supplies A", async () => {
  const main = sample().snapshot,
    base = structuredClone(main.events[0]!);
  const env: Snapshot = {
    start: {
      ...main.start,
      capture_id: "environment-local",
      mode: "environment",
      transport: "dom",
    },
    controls: main.controls,
    control_dropped: 0,
    events: [
      {
        ...base,
        capture_id: "environment-local",
        event_index: 1,
        event_id: "environment-event",
        direction: "local",
        transport: "dom",
        field_namespace: "environment.fields",
        field: "browser",
        source_path: "derived:navigator.userAgent",
        source_type: "local_environment",
        raw_source_type: "dom",
        level: "E",
        endpoint_verified: false,
        association: "orphan",
        association_proof: "document_environment_only",
        value: "Chrome",
        new_value: "Chrome",
        old_value: null,
      },
    ],
  };
  const exported = await exportBundle(
    main,
    "test",
    {},
    { state: "not_compared" },
    [env],
  );
  const imported = await importBundle(exported.bytes);
  assert.equal(imported.related.length, 1);
  assert.equal(imported.related[0]!.events[0]!.level, "E");
  assert.equal(imported.related[0]!.events[0]!.association, "orphan");
  assert.equal(imported.summary.route_verdict.verdict, "Route Match");
  assert.notEqual(
    imported.related[0]!.start.capture_id,
    imported.snapshot.start.capture_id,
  );
});
async function altered(
  change: (files: Map<string, Uint8Array>) => void,
  reHash = true,
) {
  const f = await unzipFiles(
    (await exportBundle(sample().snapshot, "test-1")).bytes,
    BUNDLE_FILES,
  );
  change(f);
  if (reHash) {
    const m = JSON.parse(
      new TextDecoder().decode(f.get("evidence/manifest.json")!),
    );
    for (const r of m.files) {
      const b = f.get(r.path);
      if (b) {
        r.sha256 = await digest(b);
        r.bytes = b.length;
      }
    }
    f.set("evidence/manifest.json", encode(m));
  }
  return zipFiles(f);
}
test("seven-file local ZIP round trip verifies hashes, counts, recomputed route, stable mapped IDs, no content", async () => {
  const s = sample().snapshot,
    b = await exportBundle(s, "test-1"),
    f = await unzipFiles(b.bytes, BUNDLE_FILES),
    i = await importBundle(b.bytes);
  assert.equal(f.size, 7);
  assert.equal(i.summary.route_verdict.verdict, "Route Match");
  assert.equal(i.summary.capture_health.completeness, "Complete");
  assert.equal(i.summary.timing.total_ms, 1000);
  assert.deepEqual(i.comparison, { state: "not_compared" });
  const text = [...f.values()]
    .map((x) => new TextDecoder().decode(x))
    .join("\n");
  for (const raw of [
    "SECRET_PROMPT",
    "SECRET_AUTH",
    "SECRET_ANSWER",
    "conv-real",
    "msg-real",
    "request-real",
    "doc-real",
    "visit-real",
    "segment-real",
  ])
    assert.ok(!text.includes(raw), raw);
  assert.equal(i.snapshot.events[0]!.request_id, "request-1");
  assert.equal(i.snapshot.events[0]!.capture_id, i.snapshot.start.capture_id);
  assert.deepEqual(s, sample().snapshot); // projection/export never mutates the original.
});
test("storage/export projection rejects unknown fields and suspicious values and reclassifies provenance", () => {
  const e = sample().snapshot.events[0]!;
  assert.equal(safeOccurrence({ ...e, field: "Authorization" }), null);
  assert.equal(
    safeOccurrence({ ...e, value: "SECRET_ACCESS_TOKEN" })!.value,
    null,
  );
  assert.equal(
    safeOccurrence({ ...e, value: "alice@example.com" })!.value,
    null,
  );
  assert.equal(safeOccurrence({ ...e, level: "A" }), null);
  assert.equal(safeOccurrence({ ...e, direction: "inbound" }), null);
  const out = new ExportRedactor().snapshot(sample().snapshot);
  assert.equal(out.events[0]!.request_id, out.events[1]!.request_id);
});
test("digest corruption and forged self-reported verdict rejected", async () => {
  await assert.rejects(
    importBundle(
      await altered(
        (f) => f.set("evidence/report.md", encode("changed")),
        false,
      ),
    ),
    /digest/,
  );
  await assert.rejects(
    importBundle(
      await altered((f) => {
        const s = JSON.parse(
          new TextDecoder().decode(f.get("evidence/summary.json")!),
        );
        s.route_verdict.actual_route = "forged";
        f.set("evidence/summary.json", encode(s));
      }),
    ),
    /projection/,
  );
});
test("malformed JSON/JSONL, sequence gaps, duplicate event IDs, prototype keys rejected", async () => {
  for (const text of [
    "{bad}\n",
    '{"__proto__":{"polluted":true}}\n',
    JSON.stringify({ ...sample().snapshot.events[0], event_index: 3 }) + "\n",
  ]) {
    await assert.rejects(
      importBundle(
        await altered((f) =>
          f.set("evidence/timeline.jsonl", new TextEncoder().encode(text)),
        ),
      ),
    );
  }
  const bytes = await altered((f) => {
    const lines = new TextDecoder()
      .decode(f.get("evidence/timeline.jsonl")!)
      .trim()
      .split("\n");
    const first = JSON.parse(lines[0]!);
    const second = JSON.parse(lines[1]!);
    second.event_id = first.event_id;
    lines[1] = JSON.stringify(second);
    f.set(
      "evidence/timeline.jsonl",
      new TextEncoder().encode(lines.join("\n") + "\n"),
    );
  });
  await assert.rejects(importBundle(bytes), /sequence_or_source/);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});
test("ZIP traversal, duplicate, missing, unknown files, large compressed input and bomb sizes rejected", async () => {
  const b = await exportBundle(sample().snapshot, "test"),
    f = await unzipFiles(b.bytes, BUNDLE_FILES);
  for (const bad of ["../outside", "evidence/extra.html"]) {
    const copy = new Map(f);
    copy.delete("evidence/report.md");
    copy.set(bad, encode("bad"));
    await assert.rejects(importBundle(zipFiles(copy)), /path/);
  }
  const missing = new Map(f);
  missing.delete("evidence/report.md");
  await assert.rejects(importBundle(zipFiles(missing)), /count/);
  const duplicate = b.bytes.slice();
  const needle = new TextEncoder().encode("evidence/environment.json"),
    replacement = new TextEncoder().encode("evidence/comparison.json ");
  assert.equal(needle.length, replacement.length);
  for (let i = 0; i < duplicate.length - needle.length; i++)
    if (needle.every((x, k) => duplicate[i + k] === x))
      duplicate.set(replacement, i);
  await assert.rejects(importBundle(duplicate));
  await assert.rejects(importBundle(new Uint8Array(20 * 1048576 + 1)), /size/);
  const bomb = b.bytes.slice(),
    v = new DataView(bomb.buffer);
  for (let k = 0; k < bomb.length - 46; k++)
    if (v.getUint32(k, true) === 0x02014b50) {
      v.setUint32(k + 24, 50 * 1048576 + 1, true);
      break;
    }
  await assert.rejects(importBundle(bomb), /bomb/);
});
test("unknown schema, oversized JSONL and executable HTML/Markdown report cannot enter history", async () => {
  await assert.rejects(
    importBundle(
      await altered((f) => {
        const m = JSON.parse(
          new TextDecoder().decode(f.get("evidence/manifest.json")!),
        );
        m.schema_version = "bundle-999";
        f.set("evidence/manifest.json", encode(m));
      }),
    ),
    /unsupported/,
  );
  await assert.rejects(
    importBundle(
      await altered((f) =>
        f.set(
          "evidence/timeline.jsonl",
          new TextEncoder().encode(" ".repeat(65537) + "\n"),
        ),
      ),
    ),
    /line/,
  );
  await assert.rejects(
    importBundle(
      await altered((f) =>
        f.set(
          "evidence/report.md",
          new TextEncoder().encode(
            "<img src=x onerror=alert(1)> [x](javascript:alert(2))",
          ),
        ),
      ),
    ),
    /unsafe_report/,
  );
  const escaped = escapeMarkdown("<script> [x](javascript:x) | ` ```\n");
  assert.ok(
    !escaped.includes("<") &&
      !escaped.includes("[") &&
      !escaped.includes("|") &&
      !escaped.includes("`"),
  );
});
