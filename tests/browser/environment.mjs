import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export async function verifyEnvironment(page, context) {
  await page.goto("http://127.0.0.1:43997/phase6");
  await page.waitForFunction(
    () => window.__BLACKBOX_SYNTHETIC__?.environment?.snapshots.length > 0,
  );
  const initial = await page.evaluate(() =>
    window.__BLACKBOX_SYNTHETIC__.environment.snapshot("run_start"),
  );
  assert.equal(initial.markers.build_id, "public-build-one");
  assert.equal(initial.markers.deployment_marker, "public-build-two");
  assert.equal(initial.markers.conflict, true);
  assert.equal(initial.fields.client_ip.value, null);
  assert.equal(initial.fields.client_ip.availability, "unknown");
  for (const field of Object.values(initial.fields)) {
    assert.ok(field.source);
    assert.ok(field.availability);
    assert.ok(field.privacy_class);
    assert.ok(field.observed_at);
  }
  assert.ok(initial.assets.some((a) => a.url.endsWith("app.abcdef012345.js")));
  const dynamic = await page.evaluate(async () => {
    const script = document.createElement("script");
    script.src =
      "/assets/chunk.ffffffffeeee.js?token=SECRET_P6_QUERY#SECRET_P6_HASH";
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    return window.__BLACKBOX_SYNTHETIC__.environment.snapshot(
      "finalize_window",
    );
  });
  assert.ok(dynamic.assets.some((a) => a.asset_url_token === "ffffffffeeee"));
  assert.notEqual(dynamic.asset_set_hash, initial.asset_set_hash);
  assert.equal(
    dynamic.asset_set_hash,
    createHash("sha256")
      .update(
        JSON.stringify([...new Set(dynamic.assets.map((a) => a.url))].sort()),
      )
      .digest("hex"),
  );
  const contentBoundary = await page.evaluate(async () => {
    const env = window.__BLACKBOX_SYNTHETIC__.environment;
    const first = await (await fetch("/assets/stable.ffffffffffff.js")).text();
    const deadline = performance.now() + 1000;
    let a;
    while (performance.now() <= deadline) {
      a = await env.snapshot("same_url_first_body");
      if (
        a.assets.some((asset) => asset.url.endsWith("stable.ffffffffffff.js"))
      )
        break;
      if (performance.now() >= deadline)
        throw new Error("asset resource settlement deadline");
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (
      !a?.assets.some((asset) => asset.url.endsWith("stable.ffffffffffff.js"))
    )
      throw new Error("asset resource settlement deadline");
    const second = await (await fetch("/assets/stable.ffffffffffff.js")).text();
    const b = await env.snapshot("same_url_second_body");
    return {
      bodies_differ: first !== second,
      first_asset_set_hash: a.asset_set_hash,
      second_asset_set_hash: b.asset_set_hash,
    };
  });
  assert.ok(contentBoundary.bodies_differ);
  assert.equal(
    contentBoundary.first_asset_set_hash,
    contentBoundary.second_asset_set_hash,
  );
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForFunction(
    () =>
      window.__BLACKBOX_SYNTHETIC__.environment.snapshots.at(-1)?.fields[
        "viewport.width"
      ].value === 900,
  );
  const resize = await page.evaluate(() =>
    window.__BLACKBOX_SYNTHETIC__.environment.snapshot("run_start"),
  );
  assert.equal(resize.fields["viewport.height"].value, 600);
  await context.setOffline(true);
  let offline;
  try {
    await page.waitForFunction(() => window.navigator.onLine === false);
    offline = await page.evaluate(() =>
      window.__BLACKBOX_SYNTHETIC__.environment.snapshot("run_start"),
    );
    assert.equal(offline.fields.online.value, false);
  } finally {
    await context.setOffline(false);
  }
  await page.waitForFunction(() => window.navigator.onLine === true);
  const online = await page.evaluate(() =>
    window.__BLACKBOX_SYNTHETIC__.environment.snapshot("run_start"),
  );
  assert.equal(online.fields.online.value, true);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTimezoneOverride", {
    timezoneId: "Europe/London",
  });
  const timezone = await page.evaluate(() =>
    window.__BLACKBOX_SYNTHETIC__.environment.snapshot("run_start"),
  );
  assert.equal(timezone.fields.timezone.value, "Europe/London");
  const serviceWorker = await page.evaluate(async () => {
    // Fixture setup belongs to the test page, not the monitor. After activation all mutation APIs are guarded.
    const api = window.navigator.serviceWorker;
    const registration = await api.register("/sw-fixture.js");
    await api.ready;
    if (!registration.active)
      await new Promise((resolve) => {
        const worker = registration.installing ?? registration.waiting;
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") resolve();
        });
      });
    let mutations = 0,
      reads = 0;
    const native = {
      register: api.register,
      update: window.ServiceWorkerRegistration.prototype.update,
      unregister: window.ServiceWorkerRegistration.prototype.unregister,
      get: api.getRegistrations,
    };
    api.register = () => {
      mutations++;
      throw new Error("monitor SW mutation");
    };
    window.ServiceWorkerRegistration.prototype.update = () => {
      mutations++;
      throw new Error("monitor SW mutation");
    };
    window.ServiceWorkerRegistration.prototype.unregister = () => {
      mutations++;
      throw new Error("monitor SW mutation");
    };
    api.getRegistrations = function () {
      reads++;
      return Reflect.apply(native.get, this, []);
    };
    try {
      const env = window.__BLACKBOX_SYNTHETIC__.environment;
      await env.observeServiceWorkers();
      const snapshot = await env.snapshot("run_start");
      return { snapshot, mutations, reads, fixture_registration: true };
    } finally {
      api.register = native.register;
      api.getRegistrations = native.get;
      window.ServiceWorkerRegistration.prototype.update = native.update;
      window.ServiceWorkerRegistration.prototype.unregister = native.unregister;
    }
  });
  assert.equal(serviceWorker.mutations, 0);
  assert.ok(serviceWorker.reads >= 1);
  assert.ok(serviceWorker.snapshot.service_worker.registrations.length >= 1);
  const missing = await page.evaluate(async () => {
    document.getElementById("__NEXT_DATA__").remove();
    document.querySelector('meta[name="deployment-id"]').remove();
    return window.__BLACKBOX_SYNTHETIC__.environment.snapshot("run_start");
  });
  assert.equal(missing.markers.availability, "unknown");
  assert.equal(missing.markers.build_id, null);
  const overflow = await page.evaluate(async () => {
    const fragment = document.createDocumentFragment();
    for (const url of [
      "/assets/session-SECRET_P6_ID.js",
      "/assets/" + "x".repeat(2048) + ".js",
    ]) {
      const s = document.createElement("script");
      s.type = "application/x-test-unused";
      s.src = url;
      fragment.append(s);
    }
    for (let i = 0; i < 510; i++) {
      const script = document.createElement("script");
      script.type = "application/x-test-unused";
      script.src = `/assets/chunk.${i.toString(16).padStart(8, "0")}.js`;
      fragment.append(script);
    }
    document.head.append(fragment);
    window.performance.dispatchEvent(
      new window.Event("resourcetimingbufferfull"),
    );
    document.dispatchEvent(new window.Event("visibilitychange"));
    const env = window.__BLACKBOX_SYNTHETIC__.environment;
    const snapshot = await env.snapshot("finalize_window");
    const events = env.journal
      .ids()
      .filter((id) => env.journal.snapshot(id).start.mode === "environment")
      .flatMap((id) => env.journal.snapshot(id).events);
    return {
      snapshot,
      events,
      canary_absent: !JSON.stringify({ snapshot, events }).includes(
        "SECRET_P6",
      ),
      visibility_event_is_synthetic: true,
    };
  });
  assert.equal(overflow.snapshot.completeness, "Partial");
  assert.equal(overflow.snapshot.overflow, true);
  assert.ok(overflow.snapshot.resource_count <= 500);
  assert.ok(overflow.canary_absent);
  assert.ok(
    overflow.events.every((e) => e.level === "E" && e.direction === "local"),
  );
  return {
    initial,
    dynamic,
    contentBoundary,
    resize,
    offline,
    online,
    timezone,
    serviceWorker,
    missing,
    overflow,
  };
}
