import test from "node:test";
import assert from "node:assert/strict";
import {
  HistoryOperation,
  recoverHistoryView,
  exportHistoryRecord,
} from "../../src/ui/history-view.ts";
import { HistoryStore } from "../../src/history/storage.ts";
import { importBundle } from "../../src/history/bundle.ts";
import { NetworkMonitor } from "../../src/adapters/network-monitor.ts";
import { MemoryStore, sample } from "../fixtures/history.ts";
import type { CaptureStart } from "../../src/host/types.ts";

function auxiliary(id: string, mode: CaptureStart["mode"]) {
  const a = sample(id, 0),
    base = a.snapshot.events[0]!;
  a.j.clear();
  const capture: CaptureStart = {
    ...a.snapshot.start,
    mode,
    transport: mode === "environment" ? "dom" : "fetch",
  };
  if (mode === "environment") {
    a.j.start(capture);
    a.j.append({
      capture_id: id,
      task_scope: "document_environment",
      message_id: null,
      channel: "0",
      transport_segment_id: "environment",
      transport: "dom",
      direction: "local",
      association: "orphan",
      association_proof: "document_environment_only",
      endpoint_verified: false,
      field_namespace: "environment.fields",
      field: "browser",
      level: "E",
      value: "Chrome",
      value_state: "value",
      source_path: "derived:navigator.userAgent",
      source_type: "local_environment",
      raw_source_type: "dom",
      schema_version: base.schema_version,
      adapter_version: base.adapter_version,
      rule_version: base.rule_version,
    });
  } else {
    const network = new NetworkMonitor(a.j, () => 32000);
    network.start(capture, null);
    network.append(capture, "network.http", "http_status", 200);
  }
  a.j.complete(id);
  a.time(64000);
  a.j.tick();
  return a;
}

test("History export reuses recovered view once, includes safe auxiliary modes, excludes later records", async () => {
  const h = new HistoryStore(new MemoryStore(), "view");
  await h.init();
  await h.flush(sample("old").j);
  for (const mode of ["environment", "network", "requirements"] as const)
    await h.flush(auxiliary(mode, mode).j);
  let listCalls = 0,
    flushCalls = 0,
    tick = 0;
  const health = new HistoryOperation(() => ++tick);
  const view = await recoverHistoryView(
    async () => {
      flushCalls++;
    },
    async () => {
      listCalls++;
      return h.list();
    },
    health,
  );
  assert.equal(view.rows.length, 1);
  assert.equal(listCalls, 1);
  assert.equal(flushCalls, 1);
  await h.flush(auxiliary("later", "environment").j);
  const saved: Uint8Array[] = [];
  for (let i = 0; i < 2; i++)
    assert.ok(
      await exportHistoryRecord(
        view,
        view.rows[0]!,
        (b) => saved.push(b),
        health,
      ),
    );
  assert.equal(listCalls, 1);
  assert.equal(flushCalls, 1);
  assert.equal(saved.length, 2);
  const bundle = await importBundle(saved[0]!);
  assert.equal(bundle.verified, true);
  assert.equal(bundle.summary.route_verdict.actual_route, "model-one");
  assert.deepEqual(bundle.related.map((s) => s.start.mode).sort(), [
    "environment",
    "network",
    "requirements",
  ]);
  assert.ok(
    bundle.related.flatMap((s) => s.events).some((e) => e.level === "E"),
  );
  assert.ok(
    bundle.related.flatMap((s) => s.events).some((e) => e.level === "N"),
  );
  assert.ok(
    bundle.related.every(
      (s) =>
        s.start.context.document_id ===
          bundle.snapshot.start.context.document_id &&
        s.start.context.epoch === bundle.snapshot.start.context.epoch,
    ),
  );
  assert.ok(!JSON.stringify(bundle).includes("SECRET"));
  assert.equal(health.snapshot.status, "Success");
  assert.ok(
    !health.snapshot.timeline.some((e) => e.stage === "history_list_begin"),
  );
  assert.ok(
    health.snapshot.timeline.some(
      (e) => e.stage === "export_bundle_end" && e.details.zip_bytes! > 0,
    ),
  );
});

test("History operation failure reports stage and bounded safe code without exception secrets", async () => {
  const h = new HistoryStore(new MemoryStore(), "failure");
  await h.init();
  await h.flush(sample().j);
  const health = new HistoryOperation(() => 1),
    view = await recoverHistoryView(
      async () => {},
      () => h.list(),
      health,
    );
  const result = await exportHistoryRecord(
    view,
    view.rows[0]!,
    () => {
      throw Error("SECRET_COOKIE_ACCESS_TOKEN filesystem/path");
    },
    health,
  );
  assert.equal(result, null);
  assert.equal(health.snapshot.status, "Failed");
  assert.equal(health.snapshot.stage, "download_helper_called");
  assert.equal(health.snapshot.safe_error_code, "history_operation_failed");
  assert.ok(!JSON.stringify(health.snapshot).includes("SECRET"));
  await assert.rejects(
    recoverHistoryView(
      async () => {},
      async () => {
        throw Error("SECRET_PROMPT");
      },
      health,
    ),
  );
  assert.equal(health.snapshot.stage, "history_list_begin");
  assert.equal(health.snapshot.status, "Failed");
  assert.ok(!JSON.stringify(health.snapshot).includes("SECRET"));
  for (let i = 0; i < 100; i++) health.mark("related_source_begin");
  assert.ok(health.snapshot.timeline.length <= 16);
});

test("History clear/epoch invalidation during export suppresses stale download with safe state", async () => {
  const h = new HistoryStore(new MemoryStore(), "invalidate");
  await h.init();
  await h.flush(sample().j);
  const health = new HistoryOperation(() => 1),
    view = await recoverHistoryView(
      async () => {},
      () => h.list(),
      health,
    );
  let checks = 0,
    downloads = 0;
  assert.equal(
    await exportHistoryRecord(
      view,
      view.rows[0]!,
      () => downloads++,
      health,
      () => ++checks === 1,
    ),
    null,
  );
  assert.equal(downloads, 0);
  assert.equal(health.snapshot.safe_error_code, "history_view_changed");
  assert.equal(health.snapshot.status, "Failed");
});
