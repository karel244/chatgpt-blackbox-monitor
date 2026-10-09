import test from "node:test";
import assert from "node:assert/strict";
import { environmentFields } from "../../src/core/environment.ts";
const stamp = "2026-10-03T00:00:00Z";
test("all minimal environment fields have availability/source/privacy/time; all missing stable", () => {
  const fields = environmentFields({}, stamp);
  for (const key of [
    "user_agent",
    "browser",
    "browser_major",
    "platform",
    "os",
    "language",
    "languages",
    "timezone",
    "timezone_offset",
    "screen.width",
    "screen.height",
    "viewport.width",
    "viewport.height",
    "device_pixel_ratio",
    "hardware_concurrency",
    "device_memory",
    "connection.effective_type",
    "connection.rtt",
    "connection.downlink",
    "connection.save_data",
    "origin",
    "visibility",
    "focus",
    "online",
    "client_ip",
  ]) {
    assert.ok(fields[key], key);
    assert.equal(fields[key]!.observed_at, stamp);
    assert.ok(fields[key]!.source);
    assert.ok(fields[key]!.privacy_class);
    assert.notEqual(fields[key]!.availability, "observed");
  }
  assert.equal(fields.client_ip!.value, null);
  assert.equal(fields.client_ip!.availability, "unknown");
});
test("present fields derive browser/OS with uncertainty; optional APIs absent distinct", () => {
  const f = environmentFields(
    {
      navigator: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0",
        platform: "Win32",
        language: "en-US",
        languages: ["en-US", "zh-CN"],
        hardwareConcurrency: 8,
        deviceMemory: 8,
        userAgentData: {},
        onLine: true,
        connection: {
          effectiveType: "4g",
          rtt: 50,
          downlink: 10,
          saveData: false,
        },
      },
      screen: { width: 1920, height: 1080 },
      viewport: { width: 1280, height: 720, dpr: 1 },
      origin: "https://chatgpt.com",
      visibility: "visible",
      focus: true,
      timezone: "Asia/Shanghai",
      offset: -480,
    },
    stamp,
  );
  assert.equal(f.browser!.value, "Edge");
  assert.equal(f.browser_major!.value, 154);
  assert.equal(f.os!.availability, "derived");
  assert.match(String(f.os_uncertainty!.value), /spoofable/);
  assert.equal(f.online!.value, true);
  assert.equal(f["connection.rtt"]!.value, 50);
  assert.equal(f.device_memory!.value, 8);
  const absent = environmentFields(
    { navigator: { userAgent: "Mozilla/5.0 Firefox/150.0" } },
    stamp,
  );
  assert.equal(absent.ua_data_availability!.availability, "not_exposed");
  assert.equal(absent.device_memory!.availability, "not_exposed");
  assert.equal(absent["connection.rtt"]!.availability, "not_exposed");
});
test("timezone and spoof-like inconsistencies are evidence only; malformed values rejected", () => {
  const a = environmentFields(
    {
      timezone: "Asia/Shanghai",
      offset: -480,
      navigator: {
        userAgent: "Windows Chrome/154.0",
        platform: "Linux",
        language: "SECRET@example.com",
        languages: ["email@example.com"],
        hardwareConcurrency: Infinity,
        connection: { rtt: -1 },
      },
    },
    stamp,
  );
  const b = environmentFields({ timezone: "Europe/London", offset: 0 }, stamp);
  assert.notEqual(a.timezone!.value, b.timezone!.value);
  assert.equal(a.consistency!.value, "inconsistent");
  assert.equal(a.language!.availability, "invalid");
  assert.equal(a.languages!.value, null);
  assert.equal(a.hardware_concurrency!.value, null);
  assert.ok(!JSON.stringify(a).includes("SECRET"));
  assert.equal(a["connection.rtt"]!.availability, "invalid");
});
