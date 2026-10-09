import test from "node:test";
import assert from "node:assert/strict";
import { endpoint } from "../../src/host/endpoints.ts";
const origin = "https://chatgpt.com";
test("supported stream spellings require correct origin and POST", () => {
  for (const path of [
    "/backend-api/conversation",
    "/backend-api/f/conversation",
    "/backend-api/f/conversations",
  ]) {
    assert.equal(endpoint(path, "POST", origin, [origin])?.mode, "live");
    assert.equal(endpoint(path, "GET", origin, [origin]), null);
    assert.equal(
      endpoint("https://example.com" + path, "POST", origin, [origin]),
      null,
    );
  }
});
test("reload is a single record, not pagination or authentication", () => {
  assert.deepEqual(
    endpoint("/backend-api/conversation/c1", "GET", origin, [origin]),
    { mode: "reload", conversation_id: "c1" },
  );
  for (const path of [
    "/backend-api/conversation/c1?cursor=x",
    "/api/auth/session",
    "/backend-api/payments/checkout",
    "/backend-api/conversation/init",
  ]) {
    assert.equal(endpoint(path, "GET", origin, [origin]), null);
  }
});
