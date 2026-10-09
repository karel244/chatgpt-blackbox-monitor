import test from "node:test";
import assert from "node:assert/strict";
import {
  httpEvidence,
  htmlIndicators,
  networkVerdict,
  readSafeHeaders,
  retryAfter,
  serverTiming,
  powEvidence,
  powAssociation,
  redactNetworkScalar,
  SAFE_HEADERS,
} from "../../src/core/network.ts";
import { verdict } from "../../src/core/route.ts";
const response = (
  status: number,
  headers: Record<string, string | undefined> = {},
  visibility: "readable" | "cors" | "opaque" = "readable",
) => httpEvidence(status, (name) => headers[name] ?? null, visibility);
test("Case 10: status/HTML/edge traces are insufficient, readable mitigated header confirms", () => {
  for (const headers of [
    {},
    { "content-type": "text/html" },
    { server: "cloudflare", "cf-ray": "abcdef0123456789-SEA" },
  ])
    assert.equal(networkVerdict(response(403, headers)), "HTTP Error");
  const confirmed = response(403, {
    "cf-mitigated": "challenge",
    "content-type": "text/html",
  });
  assert.equal(networkVerdict(confirmed), "Challenge Confirmed");
  const suspected = response(403, { "content-type": "text/html" });
  Object.assign(
    suspected.indicators,
    htmlIndicators(
      '<script src="/cdn-cgi/challenge-platform/PRIVATE_TOKEN"></script>',
    ),
  );
  assert.equal(networkVerdict(suspected), "Challenge Suspected");
  assert.ok(!JSON.stringify(suspected).includes("PRIVATE_TOKEN"));
  assert.equal(
    htmlIndicators("<p>ordinary error page</p>").registered_html_structure,
    false,
  );
});
test("Case 11: Retry-After seconds/date/malformed/missing; no retry action", () => {
  assert.deepEqual(retryAfter("120"), { seconds: 120, date: null });
  assert.deepEqual(retryAfter("Sat, 03 Oct 2026 10:00:00 GMT"), {
    seconds: null,
    date: "2026-10-03T10:00:00.000Z",
  });
  for (const raw of ["-1", "1.5", "PRIVATE_TOKEN", "infinity"])
    assert.equal(retryAfter(raw), null);
  for (const raw of [
    undefined,
    "120",
    "bad",
    "Sat, 03 Oct 2026 10:00:00 GMT",
  ]) {
    const r = response(429, raw === undefined ? {} : { "retry-after": raw });
    assert.equal(networkVerdict(r), "Rate Limited");
    assert.equal(
      r.headers["retry-after"].availability,
      raw === undefined ? "absent" : raw === "bad" ? "invalid" : "observed",
    );
  }
});
test("Case 12: 500/502/503 independently Server Error; network never supplies A", () => {
  for (const status of [500, 502, 503])
    assert.equal(networkVerdict(response(status)), "Server Error");
  assert.equal(verdict([], "c", "answer").actual_route, "Unknown");
  assert.equal(networkVerdict(response(200)), "OK");
  assert.equal(networkVerdict(null), "Unknown");
  assert.equal(networkVerdict(null, "abort"), "Aborted");
  assert.equal(networkVerdict(null, "timeout"), "Transport Failure");
  assert.equal(networkVerdict(null, "generic"), "Transport Failure");
});
test("header allowlist reads no secret names; cors null is not_exposed; opaque status Unknown", () => {
  const names: string[] = [];
  const h = readSafeHeaders((name) => {
    names.push(name);
    return null;
  }, "cors");
  assert.deepEqual(names, [...SAFE_HEADERS]);
  assert.equal(h["cf-mitigated"].availability, "not_exposed");
  assert.equal(h["content-type"].availability, "absent");
  const opaque = response(0, { "cf-mitigated": "challenge" }, "opaque");
  assert.equal(opaque.status.availability, "not_exposed");
  assert.equal(networkVerdict(opaque), "Unknown");
  assert.equal(
    response(200, { server: "email@example.com" }).headers.server.availability,
    "invalid",
  );
  assert.equal(redactNetworkScalar("cf-ray", "abcdef0123456789-SEA"), null);
});
test("server-timing keeps name/duration only, descriptions and unknown params cannot persist", () => {
  const metrics = serverTiming(
    'edge;dur=12.5;desc="SECRET_AUTH, SECRET_COOKIE", origin;desc="FULL_ANSWER";dur=20',
  );
  assert.deepEqual(metrics, [
    { name: "edge", dur: 12.5 },
    { name: "origin", dur: 20 },
  ]);
  assert.ok(!JSON.stringify(metrics).includes("SECRET"));
  for (const raw of [
    "edge;dur=-1",
    "edge;dur=NaN",
    "x".repeat(4097),
    "<script>;dur=1",
  ])
    assert.equal(serverTiming(raw), null);
});
test("PoW registered paths project only bounded hex and BigInt-safe decimal, no tokens", () => {
  for (const value of [
    { proofofwork: { difficulty: "0xffffffffffffffff", challenge: "SECRET" } },
    {
      requirements: {
        proof_of_work: { difficulty: "ffffffffffffffff", solution: "SECRET" },
      },
    },
    { chat_requirements: { pow: { difficulty: "ffffffffffffffff" } } },
  ]) {
    const p = powEvidence(value);
    assert.equal(p.decimal, "18446744073709551615");
    assert.equal(p.validity, "observed");
    assert.ok(!JSON.stringify(p).includes("SECRET"));
  }
  assert.equal(powEvidence({}).validity, "absent_in_observed_payload");
  assert.equal(
    powEvidence({ proofofwork: { difficulty: null } }).validity,
    "explicit_null",
  );
  for (const difficulty of ["zz", "1".repeat(257), 42, { token: "SECRET" }])
    assert.equal(
      powEvidence({ proofofwork: { difficulty } }).validity,
      "invalid",
    );
});
test("PoW exact ID confirmed; proximity only candidate; contradiction/context mismatch unassociated", () => {
  const p = {
    request_id: "req",
    document_id: "d",
    epoch: 0,
    monotonic_ms: 100,
  };
  const c = { ...p, monotonic_ms: 500 };
  assert.equal(powAssociation(p, c).status, "confirmed");
  assert.deepEqual(powAssociation({ ...p, request_id: null }, c), {
    status: "candidate",
    proof: "same_document_epoch_time_only",
    delta_ms: 400,
  });
  for (const changed of [
    { ...c, request_id: "other" },
    { ...c, epoch: 1 },
    { ...c, document_id: "new" },
  ])
    assert.equal(powAssociation(p, changed).status, "unassociated");
  assert.equal(
    powAssociation({ ...p, request_id: null }, { ...c, monotonic_ms: 999999 })
      .status,
    "unassociated",
  );
});

test("requirements endpoints are six explicit same-origin POST registrations", async () => {
  const { endpoint } = await import("../../src/host/endpoints.ts");
  const origin = "https://chatgpt.com";
  for (const root of ["/backend-api", "/backend-anon", "/api"])
    for (const suffix of ["", "/prepare"]) {
      const path = `${root}/sentinel/chat-requirements${suffix}`;
      assert.equal(
        endpoint(path, "POST", origin, [origin])?.mode,
        "requirements",
      );
      assert.equal(
        endpoint(path + "/", "POST", origin, [origin])?.endpoint_path,
        path,
      );
      assert.equal(endpoint(path, "GET", origin, [origin]), null);
      assert.equal(
        endpoint("https://example.com" + path, "POST", origin, [origin]),
        null,
      );
      assert.equal(endpoint(path + "/guess", "POST", origin, [origin]), null);
    }
});
