import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  normalizeAsset,
  AssetSet,
  assetSetHash,
  publicMarkers,
} from "../../src/core/assets.ts";
const origin = "https://chatgpt.com",
  stamp = "2026-10-03T00:00:00Z";
test("registered asset URL tokens are URL evidence; query/hash and unknown identifiers dropped", () => {
  const a = normalizeAsset(
    "/assets/app.abcdef012345.js?token=SECRET_QUERY#SECRET_HASH",
    origin,
    "DOM/script",
    stamp,
  ).asset!;
  assert.equal(a.url, origin + "/assets/app.abcdef012345.js");
  assert.equal(a.asset_url_token, "abcdef012345");
  assert.ok(!("content_hash" in a));
  for (const url of [
    "/c/session-secret/assets.js",
    "/assets/session-SECRET_ID.js",
    "/private/SECRET_ID.js",
    "/assets/123e4567-e89b-12d3-a456-426614174000/file.js",
  ]) {
    const value = normalizeAsset(url, origin, "timing", stamp).asset!;
    assert.equal(value.url, origin + "/[script]");
    assert.equal(value.asset_url_token, null);
    assert.ok(!JSON.stringify(value).includes("SECRET"));
  }
  assert.equal(
    normalizeAsset("data:text/javascript,SECRET", origin, "script", stamp)
      .asset,
    null,
  );
});
test("500 resource and 2KiB limits, dedup and overflow Partial input", () => {
  const set = new AssetSet();
  assert.equal(
    set.add("/assets/app.abcdef012345.js?a=1", origin, "script", stamp),
    true,
  );
  assert.equal(
    set.add("/assets/app.abcdef012345.js?a=2#x", origin, "timing", stamp),
    false,
  );
  for (let i = 0; i < 510; i++)
    set.add(
      `/assets/chunk.${i.toString(16).padStart(8, "0")}.js`,
      origin,
      "timing",
      stamp,
    );
  assert.equal(set.all().length, 500);
  assert.equal(set.overflow, true);
  assert.equal(
    normalizeAsset(
      "/assets/" + "x".repeat(2048) + ".js",
      origin,
      "script",
      stamp,
    ).overflow,
    true,
  );
});
test("asset_set_hash exact SHA256 normalized sorted dedup identifiers; same URL cannot attest content", async () => {
  const urls = [
    origin + "/assets/b.js",
    origin + "/assets/a.js",
    origin + "/assets/a.js",
  ];
  const hash = await assetSetHash(urls);
  assert.equal(
    hash,
    createHash("sha256")
      .update(JSON.stringify([...new Set(urls)].sort()))
      .digest("hex"),
  );
  assert.equal(hash, await assetSetHash([...urls].reverse()));
  const first = normalizeAsset(
    "/assets/a.js?content=one",
    origin,
    "resource",
    stamp,
  ).asset!;
  const second = normalizeAsset(
    "/assets/a.js?content=two",
    origin,
    "resource",
    stamp,
  ).asset!;
  assert.equal(
    await assetSetHash([first.url]),
    await assetSetHash([second.url]),
  );
  assert.notEqual(first.source, "verified_body_digest");
});
test("registered public markers missing Unknown; conflicts preserved; no recursive extraction", () => {
  assert.deepEqual(publicMarkers({}, null), {
    build_id: null,
    deployment_marker: null,
    availability: "unknown",
    conflict: false,
  });
  assert.equal(
    publicMarkers({ buildId: "build-one" }, "build-two").conflict,
    true,
  );
  assert.equal(
    publicMarkers({ nested: { buildId: "SECRET" } }, null).build_id,
    null,
  );
  assert.equal(
    publicMarkers({ buildId: "secret@example.com" }, null).build_id,
    null,
  );
});

test("missing page origin never invents a base for relative assets", () => {
  assert.equal(
    normalizeAsset("/assets/app.abcdef012345.js", "", "DOM/script", stamp)
      .asset,
    null,
  );
  assert.equal(
    normalizeAsset(
      "https://chatgpt.com/assets/app.abcdef012345.js",
      "",
      "ResourceTiming/name",
      stamp,
    ).asset!.url,
    "https://chatgpt.com/assets/app.abcdef012345.js",
  );
});
