import test from "node:test";
import assert from "node:assert/strict";
import {
  requestEvidence,
  responseEvidence,
  domEvidence,
  verdict,
  type Source,
} from "../../src/core/route.ts";
const source: Source = {
  capture_id: "current",
  task_scope: "answer",
  message_id: "m",
  transport: "fetch",
  direction: "inbound",
  association: "confirmed",
  association_proof: "same_request",
  endpoint_verified: true,
  channel: "default",
  transport_segment_id: "http-1",
};
const b = (model: string) =>
  requestEvidence({ model }, { ...source, direction: "outbound" });
const a = (ste: string, resolved?: string) =>
  responseEvidence(
    {
      type: "server_ste_metadata",
      metadata: { model_slug: ste },
      ...(resolved ? { resolved_model_slug: resolved } : {}),
    },
    source,
  );
const d = (model: string) =>
  domEvidence(model, { ...source, transport: "dom", direction: "local" });
test("Case 1 exact dual A match", () => {
  const v = verdict(
    [...b("thinking-v1"), ...a("thinking-v1", "thinking-v1")],
    "current",
    "answer",
    "Complete",
  );
  assert.equal(v.verdict, "Route Match");
  assert.equal(v.coverage, "dual-A");
});
test("Case 2 thinking to server mini: exact declared mismatch", () =>
  assert.equal(
    verdict([...b("thinking-v1"), ...a("mini-v1")], "current", "answer")
      .verdict,
    "Route Mismatch",
  ));
test("Case 3 STE resolved conflict retained", () => {
  const v = verdict(a("one", "two"), "current", "answer");
  assert.equal(v.actual_route, "Conflict");
  assert.deepEqual(v.candidates, ["one", "two"]);
});
test("Case 4 DOM disagreement is independent", () => {
  const v = verdict(
    [...b("one"), ...a("one"), ...d("two")],
    "current",
    "answer",
  );
  assert.equal(v.actual_route, "one");
  assert.equal(v.verdict, "Route Match");
  assert.equal(v.label_mismatch, true);
});
test("Case 5 C D only Unknown", () => {
  const c = responseEvidence(
    {
      message: {
        id: "m",
        author: { role: "assistant" },
        metadata: { model_slug: "mini-v1" },
      },
    },
    source,
  );
  assert.ok(c.every((e) => e.level === "C"));
  assert.equal(
    verdict([...c, ...d("mini-v1")], "current", "answer").actual_route,
    "Unknown",
  );
});
test("Case 6 previous turn cannot contaminate current", () => {
  const old = a("mini-v1").map((e) => ({ ...e, capture_id: "old" }));
  assert.equal(
    verdict([...old, ...a("thinking-v1")], "current", "answer").actual_route,
    "thinking-v1",
  );
  assert.equal(verdict(old, "current", "answer").actual_route, "Unknown");
});
test("outbound telemetry, wrong endpoint and unassociated evidence never A verdict", () => {
  const payload = {
    type: "server_ste_metadata",
    metadata: { model_slug: "fake" },
  };
  assert.deepEqual(
    responseEvidence(payload, { ...source, direction: "outbound" }),
    [],
  );
  assert.deepEqual(
    responseEvidence(payload, { ...source, endpoint_verified: false }),
    [],
  );
  for (const association of ["candidate", "ambiguous", "orphan"] as const)
    assert.equal(
      verdict(
        responseEvidence(payload, { ...source, association }),
        "current",
        "answer",
      ).actual_route,
      "Unknown",
    );
});
test("prompt, answer JSON, user and tool metadata cannot pollute A", () => {
  const fake = {
    type: "server_ste_metadata",
    metadata: { model_slug: "fake" },
  };
  for (const role of ["user", "tool"])
    assert.deepEqual(
      responseEvidence(
        {
          message: { author: { role }, metadata: fake.metadata, content: fake },
          content: fake,
          output: fake,
          parts: [fake],
        },
        source,
      ),
      [],
    );
  assert.deepEqual(
    responseEvidence(
      {
        message: {
          author: { role: "assistant" },
          content: { parts: [JSON.stringify(fake)] },
        },
      },
      source,
    ),
    [],
  );
  assert.ok(
    requestEvidence(
      { model: "one", content: fake, server_ste_metadata: fake },
      { ...source, direction: "outbound" },
    ).every((e) => e.level === "B"),
  );
});
test("auto aliases, no B, and B without A", () => {
  for (const model of ["auto", "default", "thinking", "latest"])
    assert.equal(
      verdict([...b(model), ...a("one")], "current", "answer").verdict,
      "Not comparable",
    );
  assert.equal(
    verdict(a("one"), "current", "answer").verdict,
    "Not comparable",
  );
  assert.equal(verdict(b("one"), "current", "answer").actual_route, "Unknown");
});
test("Partial and Failed preserve A, single field is not dual confirmation", () => {
  for (const health of ["Partial", "Failed"] as const) {
    const v = verdict(a("one"), "current", "answer", health);
    assert.equal(v.actual_route, "one");
    assert.equal(v.coverage, "single-A");
    assert.equal(v.evidence_completeness, health);
    assert.match(v.scope_limit, /partial/);
  }
});
test("different task scope never merged and same field changes remain conflict", () => {
  const other = a("other").map((e) => ({ ...e, task_scope: "planning" }));
  assert.equal(
    verdict([...other, ...a("one")], "current", "answer").actual_route,
    "one",
  );
  assert.equal(
    verdict([...a("one"), ...a("two")], "current", "answer").verdict,
    "Conflict",
  );
});
test("registered paths, roles, raw values and provenance", () => {
  const events = responseEvidence(
    {
      message: {
        id: "assistant-1",
        author: { role: "assistant" },
        metadata: {
          server_ste_metadata: { model_slug: "one" },
          resolved_model_slug: "one",
          model_slug: "label",
          thinking_effort: "extended",
          fast_convo: true,
        },
      },
    },
    source,
  );
  assert.equal(events.filter((e) => e.level === "A").length, 2);
  assert.ok(
    events.every(
      (e) =>
        e.message_id === "assistant-1" &&
        e.adapter_version &&
        e.rule_version &&
        e.schema_version &&
        e.source_path.startsWith("/message/metadata/"),
    ),
  );
  assert.equal(
    events.find((e) => e.field === "thinking_effort")?.value,
    "extended",
  );
});
test("null, invalid, forbidden objects never valid slug", () => {
  for (const value of [
    null,
    { secret: "canary" },
    "x".repeat(129),
    "<script>",
  ]) {
    const events = responseEvidence({ resolved_model_slug: value }, source);
    assert.equal(verdict(events, "current", "answer").actual_route, "Unknown");
  }
  assert.equal(
    responseEvidence({ resolved_model_slug: null }, source)[0]?.value_state,
    "explicit_null",
  );
});
