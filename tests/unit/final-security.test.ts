import test from "node:test";
import assert from "node:assert/strict";
import {
  exportBundle,
  importBundle,
  BUNDLE_FILES,
} from "../../src/history/bundle.ts";
import { zipFiles, unzipFiles } from "../../src/history/zip.ts";
import { digest, encode } from "../../src/history/storage.ts";
import { sample } from "../fixtures/history.ts";

test("final deterministic archive mutations and rehashed malformed JSONL never execute or alter source", async () => {
  const s = sample().snapshot;
  const original = structuredClone(s);
  const exported = await exportBundle(s, "final-security");
  for (let seed = 1; seed <= 64; seed++) {
    const bad = exported.bytes.slice();
    // Corrupt the central directory's signature, count or archive tail, rather than
    // treating valid random payload alterations as inherently invalid archives.
    const offset = bad.length - 22 + (seed % 4);
    bad[offset] = bad[offset]! ^ (1 + (seed % 255));
    await assert.rejects(importBundle(bad), "seed " + seed);
  }
  for (const line of [
    "{",
    "null",
    "[]",
    "true",
    "42",
    '"scalar"',
    '{"constructor":{"prototype":{"polluted":true}}}',
    '{"__proto__":{"polluted":true}}',
    '{"event_index":1,"value":"<img src=x onerror=alert(1)>"}',
    "\u0000",
    '{"event_index":1e309}',
  ]) {
    const files = await unzipFiles(exported.bytes, BUNDLE_FILES);
    files.set("evidence/timeline.jsonl", new TextEncoder().encode(line + "\n"));
    const m = JSON.parse(
      new TextDecoder().decode(files.get("evidence/manifest.json")!),
    );
    for (const r of m.files) {
      const b = files.get(r.path)!;
      r.sha256 = await digest(b);
      r.bytes = b.length;
    }
    files.set("evidence/manifest.json", encode(m));
    await assert.rejects(importBundle(zipFiles(files)), line);
  }
  assert.deepEqual(s, original);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal((await importBundle(exported.bytes)).verified, true);
});
