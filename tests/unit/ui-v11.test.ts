import test from "node:test";
import assert from "node:assert/strict";
import { launcherFacts } from "../../src/ui/cleanup.ts";
import {
  validScale,
  boundedScale,
  scaleGeometry,
  MAIN_SCALE_KEY,
  WORKBENCH_SCALE_KEY,
} from "../../src/ui/scale.ts";
import { sample } from "../fixtures/history.ts";
test("launcher model fallback preserves exact source and never upgrades request to server", () => {
  const s = sample().snapshot;
  assert.equal(launcherFacts(s).modelSource, "server_ste_metadata.model_slug");
  s.events = s.events.filter(
    (e) => e.field_namespace !== "server_ste_metadata",
  );
  assert.equal(launcherFacts(s).modelSource, "resolved.resolved_model_slug");
  s.events = s.events.filter((e) => e.field_namespace !== "resolved");
  assert.equal(launcherFacts(s).modelSource, "request.model");
  assert.equal(launcherFacts(null).model, "Unknown");
});
test("abnormal launcher HTTP has priority without altering network or route facts", () => {
  const s = sample().snapshot;
  const before = JSON.stringify(s);
  s.events.push(
    {
      ...s.events[0]!,
      level: "N",
      field_namespace: "network.verdict",
      field: "status",
      value: "Rate Limited",
    },
    {
      ...s.events[0]!,
      level: "N",
      field_namespace: "network.http",
      field: "http_status",
      value: 429,
    },
  );
  const input = JSON.stringify(s);
  assert.equal(launcherFacts(s).status, "HTTP 429");
  assert.equal(launcherFacts(s).abnormal, true);
  assert.equal(JSON.stringify(s), input);
  assert.notEqual(before, input);
});
test("scales have separate preference keys; corrupt preferences default rather than clamp", () => {
  for (const v of [undefined, null, "1.2", NaN, Infinity, 0.5, 1.5])
    assert.equal(validScale(v), 1);
  assert.equal(validScale(0.75), 0.75);
  assert.equal(validScale(1.4), 1.4);
  assert.equal(boundedScale(0.1), 0.75);
  assert.equal(boundedScale(2), 1.4);
  assert.equal(MAIN_SCALE_KEY, "blackbox.ui.mainScale");
  assert.equal(WORKBENCH_SCALE_KEY, "blackbox.ui.workbenchScale");
});
test("uniform scale geometry fits viewport, preserves requested preference and uses responsive base only on viewport change", () => {
  assert.deepEqual(scaleGeometry(1.4, 460, 560, 1920, 1080), {
    baseWidth: 460,
    baseHeight: 560,
    effective: 1.4,
  });
  const g = scaleGeometry(1.4, 960, 680, 420, 620);
  assert.ok(
    g.baseWidth * g.effective <= 404 && g.baseHeight * g.effective <= 604,
  );
  assert.equal(g.effective, 1);
  assert.equal(validScale(1.4), 1.4);
});
