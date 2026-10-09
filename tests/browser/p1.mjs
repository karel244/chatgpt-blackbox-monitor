import { verifyClearAll } from "./clear-all-diagnostic.mjs";
import { diagnoseDom } from "./dom-stability.mjs";
import { diagnoseSelector } from "./selector-diagnostic.mjs";
import { diagnoseCsp } from "./ui-csp-diagnostic.mjs";
import { verifyUI } from "./refactor.mjs";
import { verifyV11UI } from "./v11-ui.mjs";
import { verifyGitHubUX } from "./github-ux.mjs";
import { verifyCleanup } from "./ux-cleanup.mjs";
import { verifyComparison } from "./comparison.mjs";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { readFile, writeFile, mkdir, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { diagnoseXhr } from "./xhr-diagnostic.mjs";
import { verifyEnvironment } from "./environment.mjs";
import { verifyHistory } from "./history.mjs";
import { diagnoseHistory } from "./history-diagnostic.mjs";
import { diagnoseSecond } from "./p7-second-diagnostic.mjs";
import { installXhrTrace } from "./xhr-trace.mjs";
import { diagnoseUnknownDrift } from "./unknown-drift.mjs";

const scratch = resolve(
  process.env.BLACKBOX_HARNESS_SCRATCH ?? "test-results/browser-profiles",
);
const extension = resolve(
  process.env.BLACKBOX_EXTENSION_PATH ?? resolve(scratch, "tampermonkey"),
);
const syntheticPath =
  process.env.BLACKBOX_SYNTHETIC_FILE ?? "test-results/synthetic.user.js";
const code = await readFile(syntheticPath, "utf8");
const attempt = Number(process.argv[2] ?? 1);
const output = process.env.BLACKBOX_RESULTS_DIR ?? "test-results/calibration";
// Reject an unavailable manager before starting either browser.
const extensionPreflight = {
  requested_path: extension,
  required_version: "5.5.0",
  status: "ENVIRONMENT BLOCKED",
};
try {
  extensionPreflight.resolved_path = await realpath(extension);
  assert.equal(
    (await stat(extensionPreflight.resolved_path)).isDirectory(),
    true,
  );
  const manifestBytes = await readFile(resolve(extension, "manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(manifest.version, "5.5.0");
  assert.equal(manifest.manifest_version, 3);
  const name = manifest.name.startsWith("__MSG_")
    ? JSON.parse(
        await readFile(
          resolve(
            extension,
            "_locales",
            manifest.default_locale,
            "messages.json",
          ),
          "utf8",
        ),
      )[manifest.name.slice(6, -2)]?.message
    : manifest.name;
  assert.equal(name, "Tampermonkey");
  const officialId = [
    ...createHash("sha256")
      .update(Buffer.from(manifest.key, "base64"))
      .digest("hex")
      .slice(0, 32),
  ]
    .map((digit) => "abcdefghijklmnop"[parseInt(digit, 16)])
    .join("");
  assert.ok(
    [
      "iikmkjmpaadaobahmlepeloendndfphd",
      "dhdgffkkebhmkfjojejmpbldmpobfkfo",
    ].includes(officialId),
  );
  extensionPreflight.official_id = officialId;
  const required = new Set(
    [
      manifest.background?.service_worker,
      manifest.options_ui?.page ?? manifest.options_page,
      manifest.action?.default_popup,
      manifest.storage?.managed_schema,
      ...Object.values(manifest.icons ?? {}),
      ...(manifest.content_scripts ?? []).flatMap((s) => [
        ...(s.js ?? []),
        ...(s.css ?? []),
      ]),
    ].filter(Boolean),
  );
  for (const path of required) {
    assert.equal((await stat(resolve(extension, path))).isFile(), true);
  }
  extensionPreflight.status = "READY";
  extensionPreflight.version = manifest.version;
  extensionPreflight.name = name;
  extensionPreflight.required_files = [...required];
  extensionPreflight.manifest_sha256 = createHash("sha256")
    .update(manifestBytes)
    .digest("hex");
} catch (error) {
  extensionPreflight.safe_error_code = error.code ?? "invalid_extension_asset";
}
await mkdir(output, { recursive: true });
await writeFile(
  `${output}/extension-preflight.json`,
  JSON.stringify(extensionPreflight, null, 2),
);
if (extensionPreflight.status !== "READY") {
  throw Error(
    "ENVIRONMENT BLOCKED: official Tampermonkey 5.5.0 unpacked asset unavailable",
  );
}
const provenancePaths = [
  "src/userscript.ts",
  "src/ui/i18n.ts",
  "src/ui/layers.ts",
  "src/ui/cleanup.ts",
  "tests/browser/ux-cleanup.mjs",
  "src/ui/preferences.ts",
  "tests/browser/refactor.mjs",
  "tests/browser/selector-diagnostic.mjs",
  "tests/browser/option-inventory.mjs",
  "tests/browser/dom-stability.mjs",
  "tests/browser/localization.mjs",
  "src/compare/experiment.ts",
  "src/ui/projection.ts",
  "src/ui/layers.ts",
  "src/ui/scale.ts",
  "src/ui/preferences.ts",
  "src/ui/i18n.ts",
  "src/ui/cleanup.ts",
  "src/ui/history-view.ts",
  "tests/browser/v11-ui.mjs",
  "tests/browser/github-ux.mjs",
  "tests/browser/clear-all-diagnostic.mjs",
  "src/ui/panel.ts",
  "src/ui/style.ts",
  "tests/browser/ui.mjs",
  "tests/browser/ui-csp-diagnostic.mjs",
  "src/compare/compare.ts",
  "tests/browser/comparison.mjs",
  "src/host/capture.ts",
  "src/host/types.ts",
  "src/host/endpoints.ts",
  "src/host/request.ts",
  "src/core/route.ts",
  "src/core/journal.ts",
  "src/adapters/sse.ts",
  "src/adapters/protocol.ts",
  "src/adapters/monitor.ts",
  "src/adapters/network-monitor.ts",
  "src/core/network.ts",
  "src/history/safety.ts",
  "src/history/storage.ts",
  "src/history/flush.ts",
  "src/history/zip.ts",
  "src/history/bundle.ts",
  "tests/browser/history.mjs",
  "tests/browser/history-diagnostic.mjs",
  "tests/browser/p7-second-diagnostic.mjs",
  "tests/browser/xhr-trace.mjs",
  "src/core/environment.ts",
  "src/core/assets.ts",
  "src/adapters/environment-monitor.ts",
  "scripts/build.mjs",
  "package-lock.json",
  "tests/browser/p1.mjs",
  "tests/browser/unknown-drift.mjs",
  "tests/browser/xhr-diagnostic.mjs",
  "tests/browser/environment.mjs",
  "tests/browser/long.mjs",
  "dist/chatgpt-blackbox-monitor.user.js",
  syntheticPath,
];
async function hashes() {
  const result = {};
  for (const path of provenancePaths)
    result[path] = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  return result;
}
const sourceHashes = await hashes();
const runId = Date.now();
const phase4 = process.argv.includes("--phase4");
const phase5 = process.argv.includes("--phase5");
const phase6 = process.argv.includes("--phase6");
const phase7 = process.argv.includes("--phase7");
const phase8 = process.argv.includes("--phase8");
const phase9 = process.argv.includes("--phase9");
let comparisonShared;
const historyDiagnostic = process.argv.includes("--history-diagnostic");
const secondDiagnostic = process.argv.includes("--second-diagnostic");
const thirdDiagnostic = process.argv.includes("--third-diagnostic");
const cspDiagnostic = process.argv.includes("--csp-diagnostic");
const selectorDiagnostic = process.argv.includes("--selector-diagnostic");
const domDiagnostic = process.argv.includes("--dom-diagnostic");
const unknownDiagnostic = process.argv.includes("--unknown-diagnostic");
const clearDiagnostic = process.argv.includes("--clear-all-diagnostic");
const extensionSmoke = process.argv.includes("--extension-smoke");
const phase = clearDiagnostic
  ? "v1-1-clear-all-diagnostic"
  : extensionSmoke
    ? "v1-1-extension-smoke"
    : unknownDiagnostic
      ? "v1-1-unknown-diagnostic"
      : domDiagnostic
        ? "ui-dom-diagnostic"
        : selectorDiagnostic
          ? "ui-selector-diagnostic"
          : cspDiagnostic
            ? "p9-csp-diagnostic"
            : thirdDiagnostic
              ? "p7-third-diagnostic"
              : secondDiagnostic
                ? "p7-second-diagnostic"
                : historyDiagnostic
                  ? "history-diagnostic"
                  : process.argv.includes("--xhr-diagnostic")
                    ? "xhr-diagnostic"
                    : phase9
                      ? "p9"
                      : phase8
                        ? "p8"
                        : phase7
                          ? "p7"
                          : phase6
                            ? "p6"
                            : phase5
                              ? "p5"
                              : phase4
                                ? "p4"
                                : "p1";
const requests = new Map();
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:43997");
  if (url.pathname === "/early-init") {
    req.resume();
    res.end("EARLY");
    return;
  }
  if (/^\/(?:backend-api|backend-anon|api)\//.test(url.pathname)) {
    const kind = url.searchParams.get("case") ?? "ok";
    requests.set(kind, (requests.get(kind) ?? 0) + 1);
    req.resume();
    if (kind === "diagnostic-reload") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          current_node: "a",
          mapping: {
            a: {
              parent: null,
              message: { id: "a", author: { role: "assistant" }, metadata: {} },
            },
          },
        }),
      );
      return;
    }
    if (kind.startsWith("p5-")) {
      if (["p5-cors", "p5-opaque"].includes(kind)) {
        res.writeHead(302, { location: `http://127.0.0.1:43998/${kind}` });
        res.end();
        return;
      }
      if (kind.startsWith("p5-pow")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            request_id:
              kind === "p5-pow-confirmed" ? "pow-browser-r" : undefined,
            proofofwork: {
              difficulty:
                kind === "p5-pow-invalid"
                  ? "badhex-secret"
                  : "ffffffffffffffff",
              challenge: "SECRET_P5_TOKEN",
            },
          }),
        );
        return;
      }
      const status = kind.includes("403")
        ? 403
        : kind.includes("429")
          ? 429
          : kind.includes("500")
            ? 500
            : kind.includes("502")
              ? 502
              : kind.includes("503")
                ? 503
                : 200;
      const html =
        kind.includes("html") ||
        kind.includes("confirmed") ||
        kind.includes("resource");
      const headers = {
        "content-type": html ? "text/html" : "text/event-stream",
        "server-timing": 'edge;dur=2;desc="SECRET_P5_TIMING"',
        "set-cookie": "SECRET_P5_COOKIE",
        "x-private": "SECRET_P5_HEADER",
      };
      if (kind.includes("confirmed")) {
        headers["cf-mitigated"] = "challenge";
        headers["cf-ray"] = "abcdef0123456789-SEA";
        headers.server = "cloudflare";
      }
      if (kind === "p5-429-seconds") headers["retry-after"] = "42";
      if (kind === "p5-429-date")
        headers["retry-after"] = "Sat, 03 Oct 2026 10:00:00 GMT";
      if (kind === "p5-429-invalid") headers["retry-after"] = "SECRET_P5_RETRY";
      res.writeHead(status, headers);
      res.end(
        html
          ? kind.includes("resource")
            ? '<script src="/cdn-cgi/challenge-platform/SECRET_P5_TOKEN"></script>'
            : "<p>ordinary SECRET_P5_HTML</p>"
          : 'data: {"resolved_model_slug":"one"}\n\ndata: [DONE]\n\n',
      );
      return;
    }
    if (kind === "ui-locale") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(
        'data: {"type":"server_ste_metadata","metadata":{"model_slug":"gpt-5-6-thinking","resolved_model_slug":"gpt-5-6-thinking"}}\n\ndata: [DONE]\n\n',
      );
      return;
    }
    if (kind === "reject" || kind === "xhr-error") {
      req.socket.destroy();
      return;
    }
    if (kind === "abort" || kind === "timeout") {
      return;
    }
    if (
      kind === "p7-sse" ||
      kind === "p4-sse" ||
      kind === "p4-partial" ||
      kind === "p4-handoff" ||
      kind === "p4-unknown" ||
      kind === "p4-identity"
    ) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      const frame = (value) => "data: " + JSON.stringify(value) + "\n\n";
      const data =
        kind === "p4-handoff"
          ? frame({ type: "subscribe_ws_topic", topic_id: "p4-topic" })
          : kind === "p4-identity"
            ? frame({
                message: {
                  author: { role: "assistant" },
                  metadata: { model_slug: "one" },
                },
              })
            : kind === "p4-unknown"
              ? 'event: delta_encoding\ndata: "v2"\n\ndata: [DONE]\n\n'
              : frame({
                  type: "server_ste_metadata",
                  metadata: {
                    model_slug: kind === "p7-sse" ? "synthetic-route" : "one",
                  },
                }) +
                (kind === "p4-partial" ? "data: {broken}\n\n" : "") +
                "data: [DONE]\n\n";
      let index = 0;
      const timer = setInterval(() => {
        if (index >= data.length) {
          clearInterval(timer);
          res.end();
        } else {
          res.write(data.slice(index, index + 7));
          index += 7;
        }
      }, 1);
      res.on("close", () => clearInterval(timer));
      return;
    }
    if (url.pathname === "/backend-api/conversation/record-p4") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          conversation_id: "record-p4",
          current_node: "a",
          mapping: {
            u: {
              parent: null,
              message: {
                id: "u",
                author: { role: "user" },
                content: "PRIVATE_RELOAD_PROMPT",
              },
            },
            a: {
              parent: "u",
              message: {
                id: "a",
                author: { role: "assistant" },
                metadata: { resolved_model_slug: "one" },
              },
            },
            old: {
              parent: null,
              message: {
                id: "old",
                author: { role: "assistant" },
                metadata: { resolved_model_slug: "fake" },
              },
            },
          },
        }),
      );
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ORIGINAL");
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    res.writeHead(200, { "content-type": "text/javascript" });
    if (url.pathname === "/assets/stable.ffffffffffff.js") {
      const revision = (requests.get("fixture_asset_revision") ?? 0) + 1;
      requests.set("fixture_asset_revision", revision);
      res.end(`window.fixtureBodyRevision=${revision};`);
      return;
    }
    res.end("window.fixtureAssetLoads=(window.fixtureAssetLoads||0)+1;");
    return;
  }
  if (url.pathname === "/sw-fixture.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end("self.addEventListener('install',()=>self.skipWaiting());");
    return;
  }
  if (url.pathname === "/first.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end(
      `window.earlyTime=performance.now();window.earlyHook=!!window.__BLACKBOX_SYNTHETIC__;window.earlyRequest=fetch('/early-init').then(r=>r.text());document.addEventListener('DOMContentLoaded',()=>document.querySelector('#send').onclick=()=>{window.conversationTime=performance.now();window.firstHook=!!window.__BLACKBOX_SYNTHETIC__;window.firstRequest=fetch('/backend-api/f/conversation?case=first',{method:'POST',body:JSON.stringify({model:'synthetic-route',thinking_effort:'high',messages:[{content:'PRIVATE_PROMPT_CANARY'}]})}).then(r=>r.text());});`,
    );
    return;
  }
  if (["/ui-locale-normal", "/ui-locale-no-csp"].includes(url.pathname)) {
    const headers = { "content-type": "text/html" };
    if (url.pathname === "/ui-locale-normal")
      headers["content-security-policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:43997";
    res.writeHead(200, headers);
    res.end(
      '<!doctype html><script src="/first.js"></script><body><button id="send">Send conversation</button></body>',
    );
    return;
  }
  res.writeHead(200, {
    "content-type": "text/html",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; connect-src 'self' ws://127.0.0.1:43997" +
      (url.pathname === "/phase5" ? " http://127.0.0.1:43998" : ""),
  });
  res.end(
    "<!doctype html>" +
      (url.pathname === "/phase6"
        ? '<meta name="deployment-id" content="public-build-two"><script id="__NEXT_DATA__" type="application/json">{"buildId":"public-build-one","token":"SECRET_P6_NEXT"}</script><script src="/assets/app.abcdef012345.js?token=SECRET_P6_BOOT"></script>'
        : "") +
      '<script>window.cspInlineRan=true</script><script src="/first.js"></script><body><button id="send">Send conversation</button></body>',
  );
});
const crossServer = createServer((req, res) => {
  req.resume();
  res.writeHead(403, {
    "content-type": "text/html",
    "access-control-allow-origin": "http://127.0.0.1:43997",
    "cf-mitigated": "challenge",
    "cf-ray": "abcdef0123456789-SEA",
  });
  res.end("ordinary SECRET_P5_CORS");
});
const sockets = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws-error") {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(req, socket, head, (ws) => {
    if (req.url === "/p4-ws") {
      ws.on("message", () =>
        ws.send(
          JSON.stringify([
            {
              topic_id: "p4-topic",
              payload: {
                payload: {
                  encoded_item:
                    'data: {"resolved_model_slug":"one"}\n\ndata: [DONE]\n\n',
                },
              },
            },
          ]),
        ),
      );
      return;
    }
    ws.on("message", (data) => ws.send(data.toString()));
  });
});
await new Promise((resolve) => server.listen(43997, "127.0.0.1", resolve));
await new Promise((resolve) => crossServer.listen(43998, "127.0.0.1", resolve));
await mkdir(output, { recursive: true });
const results = [];
try {
  for (const [name, executablePath] of [
    ["chrome", process.env.BLACKBOX_CHROME_PATH],
    ["edge", process.env.BLACKBOX_EDGE_PATH],
  ]) {
    if (process.argv.includes("--only-chrome") && name !== "chrome") continue;
    if (process.argv.includes("--only-edge") && name !== "edge") continue;
    if (!executablePath)
      throw new Error(
        `Set BLACKBOX_${name.toUpperCase()}_PATH to a browser executable; use --only-chrome/--only-edge for one browser`,
      );
    const row = {
      name,
      attempt,
      tampermonkey: "5.5.0",
      started_at: new Date().toISOString(),
      checks: [],
      source_hashes: sourceHashes,
    };
    let context, diagnosticPage;
    try {
      context = await chromium.launchPersistentContext(
        resolve(scratch, `${name}-calibrated-${runId}-${attempt}`),
        {
          executablePath,
          headless: true,
          ignoreDefaultArgs: ["--disable-extensions"],
          args: [
            "--enable-unsafe-extension-debugging",
            "--disable-background-networking",
            "--lang=en-US",
          ],
          timeout: 15000,
        },
      );
      await context.route("**/*", (route) => {
        const url = route.request().url();
        return url.startsWith("http://127.0.0.1:43997/") ||
          url.startsWith("chrome-extension:")
          ? route.continue()
          : route.abort();
      });
      row.browser = context.browser().version();
      row.extension_preflight = extensionPreflight;
      const cdp = await context.browser().newBrowserCDPSession();
      const { id } = await cdp.send("Extensions.loadUnpacked", {
        path: extension,
      });
      const manager = await context.newPage();
      await manager.goto(`chrome://extensions/?id=${id}`);
      if (name === "chrome") {
        const toggle = manager.locator(
          "extensions-detail-view #allow-user-scripts cr-toggle",
        );
        await toggle.waitFor({ state: "visible", timeout: 10000 });
        if (!(await toggle.evaluate((e) => e.checked))) await toggle.click();
        assert.equal(await toggle.evaluate((e) => e.checked), true);
      } else {
        row.permission = await manager.evaluate(async (id) => {
          if (!chrome.developerPrivate?.getExtensionInfo)
            return {
              available: false,
              text: document.body.innerText.slice(0, 700),
            };
          const info = await chrome.developerPrivate.getExtensionInfo(id);
          await chrome.developerPrivate.updateExtensionConfiguration({
            extensionId: id,
            userScriptsAccess: true,
          });
          return {
            available: true,
            keys: Object.keys(info),
            after: await chrome.developerPrivate.getExtensionInfo(id),
          };
        }, id);
        assert.equal(
          row.permission.available,
          true,
          "Edge native extension permission API unavailable",
        );
      }
      const options = await context.newPage();
      await options.goto(`chrome-extension://${id}/options.html`);
      await options.waitForFunction(
        () => typeof window.sendMessage === "function",
        {},
        { timeout: 10000 },
      );
      if (process.argv.includes("--dynamic")) {
        const setting = await options.evaluate(
          () =>
            new Promise((resolve) =>
              window.sendMessage(
                {
                  method: "setOption",
                  name: "runtime_content_mode",
                  value: "userscripts-dynamic",
                },
                resolve,
              ),
            ),
        );
        row.runtime_content_mode =
          setting?.options?.runtime_content_mode ??
          "userscripts-dynamic requested";
      }
      const saved = await options.evaluate(
        (code) =>
          new Promise((resolve) =>
            window.sendMessage(
              {
                method: "saveScript",
                uuid: "new-user-script",
                code,
                new_script: true,
                force: true,
                reload: true,
              },
              resolve,
            ),
          ),
        code,
      );
      assert.ok(!saved?.error, JSON.stringify({ error: saved?.error }));
      row.install_response = {
        installed: saved?.installed,
        success: saved?.success,
        error: saved?.error ?? null,
      };
      if (process.argv.includes("--dynamic")) {
        const worker = context
          .serviceWorkers()
          .find((w) => w.url().startsWith(`chrome-extension://${id}/`));
        assert.ok(worker, "Tampermonkey worker absent");
        const deadline = Date.now() + 5000;
        let registrations = [];
        do {
          registrations = await worker.evaluate(() =>
            chrome.userScripts.getScripts(),
          );
          if (registrations.length) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        } while (Date.now() < deadline);
        row.registered_scripts = registrations.map((r) => ({
          id: r.id,
          runAt: r.runAt,
          world: r.world,
          matches: r.matches,
        }));
        assert.ok(
          registrations.length,
          "Dynamic UserScripts registration absent",
        );
      }
      row.runtime_content_mode = "userscripts (default)";
      const page = await context.newPage();
      diagnosticPage = page;
      row.page_errors = [];
      page.on("pageerror", (e) => row.page_errors.push(String(e)));
      page.on("console", (m) => {
        if (m.type() === "error") row.page_errors.push(m.text().slice(0, 300));
      });
      if (cspDiagnostic)
        await page.addInitScript(() => {
          window.__BLACKBOX_CSP_DIAGNOSTIC__ = [];
          document.addEventListener("securitypolicyviolation", (e) => {
            if (e.effectiveDirective.startsWith("style"))
              window.__BLACKBOX_CSP_DIAGNOSTIC__.push({
                effectiveDirective: e.effectiveDirective,
                violatedDirective: e.violatedDirective,
                blockedURI: e.blockedURI,
                disposition: e.disposition,
              });
          });
        });
      const initialResponse = await page.goto("http://127.0.0.1:43997/");
      if (cspDiagnostic)
        row.fixture_csp = initialResponse.headers()["content-security-policy"];
      await page.waitForFunction(
        () => !!window.__BLACKBOX_SYNTHETIC__,
        {},
        { timeout: 10000 },
      );
      if (extensionSmoke) {
        await page
          .locator("#chatgpt-blackbox-monitor")
          .waitFor({ state: "attached" });
        assert.equal(
          await page.locator("#chatgpt-blackbox-monitor .launcher").isVisible(),
          true,
        );
        row.extension_smoke = await page.evaluate(() => {
          const h = window.__BLACKBOX_SYNTHETIC__;
          return {
            injected: !!h,
            host_connected: h.ui.host.isConnected,
            health: { ...h.health },
            locale: h.ui.i18n.locale,
          };
        });
        for (const key of ["realm", "gm", "fetch", "xhr", "websocket"])
          assert.equal(row.extension_smoke.health[key], "Available", key);
        await page.screenshot({
          path: `${output}/${name}-extension-smoke.png`,
        });
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "PASS";
      } else if (process.argv.includes("--github-ux")) {
        row.github_ux = await verifyGitHubUX(page, output, name);
        row.p9 = await verifyUI(page, context, output, name);
        row.ux_cleanup = await verifyCleanup(page, output, name);
        row.v1_1_ui = await verifyV11UI(page, output, name);
        row.dom_stability = await diagnoseDom(page, output, name, {
          after: true,
        });
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "PASS";
      } else if (clearDiagnostic) {
        row.clear_all_diagnostic = await verifyClearAll(page, output, name, {
          seed: true,
        });
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "PASS";
      } else if (unknownDiagnostic) {
        row.unknown_diagnostic = await diagnoseUnknownDrift(
          page,
          output,
          name,
          { after: process.argv.includes("--after") },
        );
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "DIAGNOSTIC_COMPLETED";
      } else if (domDiagnostic) {
        row.dom_diagnostic = await diagnoseDom(page, output, name, {
          after: process.argv.includes("--after"),
        });
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "PASS";
      } else if (selectorDiagnostic) {
        row.selector_diagnostic = await diagnoseSelector(page, output, name);
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "PASS";
      } else if (cspDiagnostic) {
        row.csp_diagnostic = await diagnoseCsp(page);
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "DIAGNOSTIC_COMPLETED";
      } else if (thirdDiagnostic) {
        row.P7_HELPER_DIAGNOSTIC = await verifyHistory(page, context, {
          diagnosticOnly: true,
        });
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "DIAGNOSTIC_COMPLETED";
      } else if (secondDiagnostic) {
        row.second_diagnostic = await diagnoseSecond(page, name);
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "DIAGNOSTIC_COMPLETED";
      } else if (
        historyDiagnostic &&
        process.argv.includes("--diagnostic-only")
      ) {
        row.history_diagnostic = await diagnoseHistory(page, context);
        assert.deepEqual(await hashes(), sourceHashes);
        row.status = "DIAGNOSTIC_COMPLETED";
      } else {
        await page.locator("#send").click();
        const startup = await page.evaluate(async () => {
          const host = window.__BLACKBOX_SYNTHETIC__;
          return {
            firstHook: window.firstHook,
            firstResponse: await window.firstRequest,
            cspInlineRan: !!window.cspInlineRan,
            health: { ...host.health },
            readyTimes: { ...host.readyTimes },
            context: { ...host.context },
            origin: location.origin,
            topLevel: window.top === window,
            earlyTime: window.earlyTime,
            earlyHook: window.earlyHook,
            conversationTime: window.conversationTime,
            firstObservation: host.events.find(
              (e) => e.kind === "request_start",
            ),
            metadata: host.requestMetadata[0],
          };
        });
        row.startup = startup;
        assert.equal(startup.firstHook, true);
        assert.equal(startup.firstResponse, "ORIGINAL");
        assert.equal(startup.cspInlineRan, false);
        for (const key of ["realm", "gm", "fetch", "xhr", "websocket"])
          assert.equal(startup.health[key], "Available", key);
        for (const key of ["fetch", "xhr", "websocket"])
          assert.ok(
            startup.readyTimes[key] < startup.conversationTime,
            key + " Ready before conversation",
          );
        assert.ok(startup.firstObservation?.capture_id);
        assert.equal(startup.metadata?.metadata.model, "synthetic-route");
        assert.ok(!JSON.stringify(startup).includes("PRIVATE_PROMPT_CANARY"));
        row.early_page_coverage = startup.earlyHook ? "Unknown" : "Partial";
        row.checks.push(
          "conversation-first request",
          "real Tampermonkey realm",
          "real GM storage",
          "CSP",
        );
        const network = await page.evaluate(async () => {
          const fetchResults = [];
          for (const monitored of [false, true]) {
            const h = window.__BLACKBOX_SYNTHETIC__;
            if (monitored) h.resume();
            else h.pause();
            fetchResults.push(
              await (
                await fetch("/backend-api/f/conversation?case=ok", {
                  method: "POST",
                })
              ).text(),
            );
            try {
              await fetch("/backend-api/f/conversation?case=reject", {
                method: "POST",
              });
              fetchResults.push("BAD");
            } catch (e) {
              fetchResults.push(e.name);
            }
            const controller = new AbortController();
            const p = fetch("/backend-api/f/conversation?case=abort", {
              method: "POST",
              signal: controller.signal,
            });
            controller.abort();
            try {
              await p;
              fetchResults.push("BAD");
            } catch (e) {
              fetchResults.push(e.name);
            }
          }
          const xhrResults = [];
          for (const monitored of [false, true]) {
            const h = window.__BLACKBOX_SYNTHETIC__;
            if (monitored) h.resume();
            else h.pause();
            for (const kind of ["ok", "xhr-error", "abort", "timeout"]) {
              xhrResults.push(
                await new Promise((resolve) => {
                  const x = new XMLHttpRequest();
                  x.open("POST", "/backend-api/f/conversation?case=" + kind);
                  x.onload = () => resolve("load:" + x.responseText);
                  x.onerror = () => resolve("error");
                  x.onabort = () => resolve("abort");
                  x.ontimeout = () => resolve("timeout");
                  if (kind === "timeout") x.timeout = 30;
                  x.send();
                  if (kind === "abort") x.abort();
                }),
              );
            }
          }
          const wsResults = [];
          for (const monitored of [false, true]) {
            const h = window.__BLACKBOX_SYNTHETIC__;
            if (monitored) h.resume();
            else h.pause();
            wsResults.push(
              await new Promise((resolve) => {
                const values = [];
                const ws = new WebSocket("ws://127.0.0.1:43997/ws");
                ws.onopen = () => {
                  values.push("open");
                  ws.send("ORIGINAL_WS");
                };
                ws.onmessage = (e) => {
                  values.push(e.data);
                  ws.close(1000);
                };
                ws.onclose = (e) => {
                  values.push(e.code);
                  resolve(values);
                };
              }),
            );
            wsResults.push(
              await new Promise((resolve) => {
                const ws = new WebSocket("ws://127.0.0.1:43997/ws-error");
                ws.onerror = () => resolve("error");
              }),
            );
          }
          return { fetchResults, xhrResults, wsResults, events: hSnapshot() };
          function hSnapshot() {
            return window.__BLACKBOX_SYNTHETIC__.events.map((e) => ({
              kind: e.kind,
              transport: e.transport,
            }));
          }
        });
        assert.deepEqual(
          network.fetchResults.slice(0, 3),
          network.fetchResults.slice(3),
        );
        assert.deepEqual(network.fetchResults.slice(0, 3), [
          "ORIGINAL",
          "TypeError",
          "AbortError",
        ]);
        assert.deepEqual(
          network.xhrResults.slice(0, 4),
          network.xhrResults.slice(4),
        );
        assert.deepEqual(network.xhrResults.slice(0, 4), [
          "load:ORIGINAL",
          "error",
          "abort",
          "timeout",
        ]);
        assert.deepEqual(
          network.wsResults.slice(0, 2),
          network.wsResults.slice(2),
        );
        assert.deepEqual(network.wsResults[0], ["open", "ORIGINAL_WS", 1000]);
        for (const transport of ["fetch", "xhr", "websocket"])
          assert.ok(network.events.some((e) => e.transport === transport));
        row.checks.push(
          "fetch resolve/reject/abort on-off",
          "XHR success/error/abort/timeout on-off",
          "WS open/message/close/error on-off",
        );
        if (process.argv.includes("--xhr-diagnostic")) {
          row.xhr_diagnostic = await diagnoseXhr(page);
          row.checks.push(
            "test-only XHR event order diagnostic; unchanged production build",
          );
        }
        if (phase4) {
          row.p4 = await page.evaluate(async () => {
            const h = window.__BLACKBOX_SYNTHETIC__;
            h.resume();
            h.clear();
            const m = h.monitor;
            const semantic = [];
            for (const enabled of [false, true]) {
              if (enabled) h.resume();
              else h.pause();
              semantic.push(
                await (
                  await fetch("/backend-api/f/conversation?case=p4-sse", {
                    method: "POST",
                    body: JSON.stringify({ model: "one" }),
                  })
                ).text(),
              );
              semantic.push(
                await new Promise((resolve) => {
                  const x = new XMLHttpRequest();
                  x.open("POST", "/backend-api/f/conversation?case=p4-sse");
                  x.onload = () => resolve(x.responseText);
                  x.send(JSON.stringify({ model: "one" }));
                }),
              );
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
            const liveIds = m.journal
              .ids()
              .filter((id) => m.journal.snapshot(id)?.start.mode === "live");
            const routes = liveIds.map((id) => m.journal.route(id, "answer"));
            const handoffBody = await (
              await fetch("/backend-api/f/conversation?case=p4-handoff", {
                method: "POST",
                body: JSON.stringify({
                  model: "one",
                  request_id: "browser-request",
                }),
              })
            ).text();
            await new Promise((resolve) => setTimeout(resolve, 10));
            const handoffId = m.journal
              .ids()
              .filter(
                (id) =>
                  !["environment", "network"].includes(
                    m.journal.snapshot(id)?.start.mode,
                  ),
              )
              .at(-1);
            const eofState = m.journal.state(handoffId);
            const wsResult = await new Promise((resolve) => {
              const socket = new WebSocket("ws://127.0.0.1:43997/p4-ws");
              socket.binaryType = "blob";
              socket.onopen = () => socket.send("READY");
              socket.onmessage = async (e) => {
                const native =
                  e.data instanceof Blob ? await e.data.text() : e.data;
                await new Promise((r) => setTimeout(r, 20));
                resolve({
                  native_length: native.length,
                  route: m.journal.route(handoffId, "answer"),
                  state: m.journal.state(handoffId),
                  events: m.journal
                    .snapshot(handoffId)
                    .events.filter(
                      (e) =>
                        e.transport === "websocket" &&
                        e.level !== "N" &&
                        e.level !== "E",
                    ),
                });
                socket.close();
              };
            });
            await (
              await fetch("/backend-api/f/conversation?case=p4-partial", {
                method: "POST",
                body: "{}",
              })
            ).text();
            await new Promise((resolve) => setTimeout(resolve, 10));
            const partialId = m.journal
              .ids()
              .filter(
                (id) =>
                  !["environment", "network"].includes(
                    m.journal.snapshot(id)?.start.mode,
                  ),
              )
              .at(-1);
            const partial = {
              route: m.journal.route(partialId, "answer"),
              state: m.journal.state(partialId),
            };
            await (
              await fetch("/backend-api/f/conversation?case=p4-unknown", {
                method: "POST",
                body: "{}",
              })
            ).text();
            await new Promise((resolve) => setTimeout(resolve, 10));
            const unknownId = m.journal
              .ids()
              .filter(
                (id) =>
                  !["environment", "network"].includes(
                    m.journal.snapshot(id)?.start.mode,
                  ),
              )
              .at(-1);
            const unknown = {
              route: m.journal.route(unknownId, "answer"),
              state: m.journal.state(unknownId),
            };
            await (await fetch("/backend-api/conversation/record-p4")).json();
            await new Promise((resolve) => setTimeout(resolve, 10));
            const reloadId = m.journal
              .ids()
              .filter(
                (id) =>
                  !["environment", "network"].includes(
                    m.journal.snapshot(id)?.start.mode,
                  ),
              )
              .at(-1);
            const reload = {
              route: m.journal.route(reloadId, "answer"),
              events: m.journal.snapshot(reloadId).events,
            };
            async function identityRequest(body) {
              await (
                await fetch("/backend-api/f/conversation?case=p4-identity", {
                  method: "POST",
                  body: JSON.stringify({ model: "one", ...body }),
                })
              ).text();
              await new Promise((r) => setTimeout(r, 20));
              return m.journal
                .ids()
                .filter(
                  (id) =>
                    !["environment", "network"].includes(
                      m.journal.snapshot(id)?.start.mode,
                    ),
                )
                .at(-1);
            }
            async function echoFrame(topic, value) {
              const payload = JSON.stringify([
                {
                  topic_id: topic,
                  payload: {
                    payload: {
                      encoded_item: "data: " + JSON.stringify(value) + "\n\n",
                    },
                  },
                },
              ]);
              await new Promise((resolve) => {
                const ws = new WebSocket("ws://127.0.0.1:43997/ws");
                ws.onopen = () => ws.send(payload);
                ws.onmessage = async () => {
                  await new Promise((r) => setTimeout(r, 30));
                  ws.close();
                  resolve();
                };
              });
            }
            const requestId = await identityRequest({
              request_id: "proof-request",
            });
            const requestBefore = m.journal.route(requestId, "answer");
            await echoFrame("proof-request-topic", {
              request_id: "proof-request",
              resolved_model_slug: "one",
            });
            const pairId = await identityRequest({
              parent_message_id: "proof-parent",
              messages: [{ id: "proof-input" }],
            });
            const pairBefore = m.journal.route(pairId, "answer");
            await echoFrame("proof-pair-topic", {
              input_message_id: "proof-input",
              parent_message_id: "proof-parent",
              resolved_model_slug: "one",
            });
            const ambiguousIds = [];
            for (const request_id of ["amb-one", "amb-two"])
              ambiguousIds.push(
                await identityRequest({
                  request_id,
                  parent_message_id: "amb-parent",
                  messages: [{ id: "amb-input" }],
                }),
              );
            const quarantineBefore = m.counters.quarantine;
            await echoFrame("ambiguous-topic", {
              input_message_id: "amb-input",
              parent_message_id: "amb-parent",
              resolved_model_slug: "fake",
            });
            const associations = {
              requestBefore,
              pairBefore,
              request: m.journal
                .snapshot(requestId)
                .events.filter(
                  (e) =>
                    e.transport === "websocket" &&
                    e.level !== "N" &&
                    e.level !== "E",
                ),
              pair: m.journal
                .snapshot(pairId)
                .events.filter(
                  (e) =>
                    e.transport === "websocket" &&
                    e.level !== "N" &&
                    e.level !== "E",
                ),
              ambiguous: ambiguousIds.map((id) =>
                m.journal.route(id, "answer"),
              ),
              quarantine_delta: m.counters.quarantine - quarantineBefore,
              diagnostics: m.diagnostics.filter((d) =>
                d.code.includes("ambiguous"),
              ),
            };
            const before = { ...h.context };
            window.dispatchEvent(
              new PageTransitionEvent("pageshow", { persisted: true }),
            );
            const after = { ...h.context };
            const serialized = JSON.stringify(
              m.journal.ids().map((id) => m.journal.snapshot(id)),
            );
            return {
              semantic,
              routes,
              handoffBodyLength: handoffBody.length,
              eofState,
              wsResult,
              partial,
              unknown,
              reload,
              associations,
              bfcache_synthetic: { before, after },
              canary_absent: !serialized.includes("PRIVATE_RELOAD_PROMPT"),
            };
          });
          assert.equal(row.p4.semantic[0], row.p4.semantic[2]);
          assert.equal(row.p4.semantic[1], row.p4.semantic[3]);
          assert.ok(row.p4.routes.length >= 2);
          assert.ok(
            row.p4.routes.every(
              (r) => r.actual_route === "one" && r.verdict === "Route Match",
            ),
          );
          assert.equal(row.p4.eofState.lifecycle, "Capturing");
          assert.equal(row.p4.wsResult.route.actual_route, "one");
          assert.equal(row.p4.wsResult.state.lifecycle, "Settling");
          assert.ok(row.p4.wsResult.events.length > 0);
          assert.ok(
            row.p4.wsResult.events.every(
              (e) =>
                e.association_proof === "confirmed_handoff_topic" &&
                e.association === "confirmed",
            ),
          );
          assert.equal(
            row.p4.associations.requestBefore.actual_route,
            "Unknown",
          );
          assert.equal(row.p4.associations.pairBefore.actual_route, "Unknown");
          assert.equal(row.p4.associations.request.length, 1);
          assert.equal(
            row.p4.associations.request[0].association_proof,
            "confirmed_request_id",
          );
          assert.equal(row.p4.associations.pair.length, 1);
          assert.equal(
            row.p4.associations.pair[0].association_proof,
            "confirmed_input_parent",
          );
          assert.ok(
            row.p4.associations.ambiguous.every(
              (r) => r.actual_route === "Unknown",
            ),
          );
          assert.ok(row.p4.associations.quarantine_delta >= 1);
          assert.ok(row.p4.associations.diagnostics.length > 0);
          assert.equal(row.p4.partial.route.actual_route, "one");
          assert.equal(row.p4.partial.state.completeness, "Partial");
          assert.equal(row.p4.unknown.route.actual_route, "Unknown");
          assert.notEqual(row.p4.unknown.state.completeness, "Complete");
          assert.equal(row.p4.reload.route.actual_route, "one");
          assert.ok(
            row.p4.reload.events.every((e) => e.transport === "reload"),
          );
          assert.ok(row.p4.canary_absent);
          assert.ok(
            row.p4.bfcache_synthetic.after.epoch >
              row.p4.bfcache_synthetic.before.epoch,
          );
          row.checks.push(
            "P4 actual TM fetch/XHR incremental SSE on-off",
            "HTTP EOF + WS Blob handoff",
            "partial A preserved",
            "unknown version",
            "reload current branch",
            "synthetic pageshow persisted",
            "all three association proof paths; ambiguous quarantine; C cannot supply A",
          );
        }
        if (phase5) {
          await page.goto("http://127.0.0.1:43997/phase5");
          await page.waitForFunction(
            () => window.__BLACKBOX_SYNTHETIC__?.health.gm === "Available",
          );
          await installXhrTrace(page);
          row.p5 = await page.evaluate(async () => {
            const h = window.__BLACKBOX_SYNTHETIC__,
              m = h.monitor,
              n = h.network;
            h.resume();
            h.clear();
            const results = [];
            const kinds = [
              "p5-403-confirmed",
              "p5-403-html",
              "p5-403-resource",
              "p5-403-json",
              "p5-429-seconds",
              "p5-429-date",
              "p5-429-invalid",
              "p5-429-missing",
              "p5-500",
              "p5-502",
              "p5-503",
              "p5-cors",
              "p5-opaque",
            ];
            for (const kind of kinds) {
              let baseline;
              h.pause();
              const options = {
                method: "POST",
                body: '{"model":"one"}',
                ...(kind === "p5-opaque" ? { mode: "no-cors" } : {}),
              };
              const off = await fetch(
                "/backend-api/f/conversation?case=" + kind,
                options,
              );
              baseline = {
                status: off.status,
                type: off.type,
                text: await off.text(),
              };
              h.resume();
              const before = new Set(m.journal.ids());
              const on = await fetch(
                "/backend-api/f/conversation?case=" + kind,
                options,
              );
              const observed = {
                status: on.status,
                type: on.type,
                text: await on.text(),
              };
              await new Promise((resolve) => setTimeout(resolve, 30));
              const id = m.journal
                .ids()
                .find(
                  (id) =>
                    !before.has(id) &&
                    !["environment", "network"].includes(
                      m.journal.snapshot(id)?.start.mode,
                    ),
                );
              results.push({
                kind,
                baseline,
                observed,
                network: n.verdict(id),
                route: m.journal.route(id, "answer"),
                events: m.journal.snapshot(id)?.events,
              });
            }
            // Requirements before conversation: exact ID vs a separately observed time-only reading.
            h.clear();
            for (const [root, suffix] of [
              ["/backend-api", ""],
              ["/backend-anon", "/prepare"],
              ["/api", "/prepare"],
            ]) {
              await (
                await fetch(
                  root +
                    "/sentinel/chat-requirements" +
                    suffix +
                    "?case=p5-pow-confirmed",
                  { method: "POST" },
                )
              ).text();
            }
            await new Promise((resolve) => setTimeout(resolve, 30));
            await (
              await fetch("/backend-api/f/conversation?case=p5-503", {
                method: "POST",
                body: '{"model":"one","request_id":"pow-browser-r"}',
              })
            ).text();
            await new Promise((resolve) => setTimeout(resolve, 30));
            const confirmed = m.journal.snapshot(
              m.journal
                .ids()
                .filter(
                  (id) =>
                    !["environment", "network"].includes(
                      m.journal.snapshot(id)?.start.mode,
                    ),
                )
                .at(-1),
            );
            await (
              await fetch(
                "/backend-api/sentinel/chat-requirements?case=p5-pow-candidate",
                { method: "POST" },
              )
            ).text();
            await new Promise((resolve) => setTimeout(resolve, 30));
            await (
              await fetch("/backend-api/f/conversation?case=p5-500", {
                method: "POST",
                body: '{"model":"one"}',
              })
            ).text();
            await new Promise((resolve) => setTimeout(resolve, 30));
            const candidate = m.journal.snapshot(
              m.journal
                .ids()
                .filter(
                  (id) =>
                    !["environment", "network"].includes(
                      m.journal.snapshot(id)?.start.mode,
                    ),
                )
                .at(-1),
            );
            const xhr = [];
            for (const kind of ["timeout", "abort", "xhr-error"]) {
              const before = new Set(m.journal.ids());
              const event = await new Promise((resolve) => {
                const x = new XMLHttpRequest();
                x.open("POST", "/backend-api/f/conversation?case=" + kind);
                x.timeout = 30;
                x.onload = () => resolve("load");
                x.ontimeout = () => resolve("timeout");
                x.onabort = () => resolve("abort");
                x.onerror = () => resolve("error");
                x.send();
                if (kind === "abort") x.abort();
              });
              const id = m.journal
                .ids()
                .find(
                  (id) =>
                    !before.has(id) &&
                    !["environment", "network"].includes(
                      m.journal.snapshot(id)?.start.mode,
                    ),
                );
              // A page onerror/ontimeout promise can resume before later TM listeners.
              // Wait for this capture's explicit observer evidence, never infer from status=0.
              const settlementStarted = performance.now();
              const category = kind === "xhr-error" ? "generic" : kind;
              window.__BLACKBOX_XHR_TRACE__?.mark("capture_selection", {
                selected_capture_id: id,
                native_terminal: event,
                fixture: kind,
              });
              const expectedVerdict =
                kind === "abort" ? "Aborted" : "Transport Failure";
              await new Promise((resolve, reject) => {
                const check = () => {
                  const events = m.journal.snapshot(id)?.events ?? [];
                  if (
                    events.some(
                      (e) =>
                        e.field_namespace === "network.failure" &&
                        e.field === "category" &&
                        e.value === category,
                    ) &&
                    n.verdict(id) === expectedVerdict
                  ) {
                    window.__BLACKBOX_XHR_TRACE__?.mark(
                      "formal_predicate_first_true",
                      { capture_id: id, fixture: kind },
                    );
                    return resolve();
                  }
                  if (performance.now() - settlementStarted >= 1000)
                    return reject(
                      new Error(
                        `XHR observer settlement deadline: ${kind}/${id}`,
                      ),
                    );
                  setTimeout(check, 0);
                };
                check();
              });
              xhr.push({
                kind,
                event,
                settlement_ms: performance.now() - settlementStarted,
                network: n.verdict(id),
                events: m.journal.snapshot(id)?.events,
              });
            }
            const failures = [];
            for (const kind of ["reject", "abort"]) {
              const before = new Set(m.journal.ids()),
                controller = new AbortController();
              const request = fetch(
                new window.Request("/backend-api/f/conversation?case=" + kind, {
                  method: "POST",
                  signal: controller.signal,
                }),
              );
              if (kind === "abort") controller.abort();
              let error;
              try {
                await request;
              } catch (e) {
                error = e.name;
              }
              await new Promise((resolve) => setTimeout(resolve, 10));
              const id = m.journal
                .ids()
                .find(
                  (id) =>
                    !before.has(id) &&
                    !["environment", "network"].includes(
                      m.journal.snapshot(id)?.start.mode,
                    ),
                );
              failures.push({ kind, error, network: n.verdict(id) });
            }
            const serialized = JSON.stringify([
              ...results.map((r) => r.events),
              confirmed,
              candidate,
              xhr,
            ]);
            return {
              results: results.map((r) => ({
                ...r,
                baseline: {
                  status: r.baseline.status,
                  type: r.baseline.type,
                  length: r.baseline.text.length,
                },
                observed: {
                  status: r.observed.status,
                  type: r.observed.type,
                  length: r.observed.text.length,
                },
                native_equal:
                  JSON.stringify(r.baseline) === JSON.stringify(r.observed),
              })),
              confirmed,
              candidate,
              xhr,
              failures,
              canary_absent: !serialized.includes("SECRET_P5"),
            };
          });
          const expected = [
            "Challenge Confirmed",
            "HTTP Error",
            "Challenge Suspected",
            "HTTP Error",
            "Rate Limited",
            "Rate Limited",
            "Rate Limited",
            "Rate Limited",
            "Server Error",
            "Server Error",
            "Server Error",
            "HTTP Error",
            "Unknown",
          ];
          row.p5.results.forEach((r, i) => {
            assert.equal(r.network, expected[i], r.kind);
            assert.ok(r.native_equal, r.kind);
            assert.equal(
              r.route.actual_route,
              [
                "p5-403-json",
                "p5-429-seconds",
                "p5-429-date",
                "p5-429-invalid",
                "p5-429-missing",
                "p5-500",
                "p5-502",
                "p5-503",
              ].includes(r.kind)
                ? "one"
                : "Unknown",
            );
          });
          const cors = row.p5.results.find((r) => r.kind === "p5-cors");
          assert.ok(
            cors.events.some(
              (e) =>
                e.field === "cf-mitigated" && e.availability === "not_exposed",
            ),
          );
          const opaque = row.p5.results.find((r) => r.kind === "p5-opaque");
          assert.ok(
            opaque.events.some(
              (e) =>
                e.field === "http_status" && e.availability === "not_exposed",
            ),
          );
          assert.ok(
            row.p5.confirmed.events.some(
              (e) =>
                e.field === "association_status" &&
                e.value === "confirmed" &&
                e.level === "E",
            ),
          );
          assert.ok(
            row.p5.candidate.events.some(
              (e) =>
                e.field === "association_status" &&
                e.value === "candidate" &&
                e.association === "candidate",
            ),
          );
          assert.deepEqual(
            row.p5.xhr.map((r) => r.network),
            ["Transport Failure", "Aborted", "Transport Failure"],
          );
          assert.deepEqual(
            row.p5.failures.map((r) => r.network),
            ["Transport Failure", "Aborted"],
          );
          assert.ok(row.p5.canary_absent);
          row.checks.push(
            "P5 Cases10-12 native on-off semantics; real CORS redirect unexposed headers and opaque response; PoW exact ID/candidate; fetch Request.signal abort; XHR timeout/error/abort; privacy",
          );
        }
        if (phase6) {
          row.p6 = await verifyEnvironment(page, context);
          row.checks.push(
            "P6 environment/asset snapshots; real dynamic chunks/resize/offline/online/timezone; registered public markers; actual fixture SW read-only guarded; bounded references/overflow/privacy",
          );
        }
        if (historyDiagnostic)
          row.history_diagnostic = await diagnoseHistory(page, context);
        if (phase7) {
          row.p7 = await verifyHistory(page, context);
          row.checks.push(
            "P7 actual GM persistent history, bundle round-trip, import isolation, two tabs, clear epoch and pause/resume",
          );
        }
        if (phase8) {
          row.p8 = await verifyComparison(page, comparisonShared, name);
          comparisonShared = {
            descriptor: row.p8.descriptor,
            bytes: row.p8.evidence.bytes,
          };
          row.checks.push(
            "P8 actual request bundles, experiment UUID pairing, local compare, duplicate ID isolation; Edge imports Chrome bundle",
          );
        }
        if (phase9) {
          row.p9 = await verifyUI(page, context, output, name, {
            optionDiagnostic: process.argv.includes("--option-diagnostic"),
          });
          row.checks.push(
            "P9 actual Shadow DOM capsule, keyboard/focus, drag/resize, current visit/late events, paged timeline, history, local export/import/compare, input non-interference",
          );
          if (process.argv.includes("--ux-cleanup")) {
            row.ux_cleanup = await verifyCleanup(page, output, name);
            row.checks.push(
              "Final UX cleanup five Tabs, normal/abnormal disclosure, History, bilingual accessibility and real screenshots",
            );
          }
        }
        if (process.argv.includes("--v1-1")) {
          row.v1_1_ui = await verifyV11UI(page, output, name);
          row.dom_stability = await diagnoseDom(page, output, name, {
            after: true,
          });
          row.checks.push(
            "V1.1 native proportional scaling, strict scoped capture and launcher provenance, four tabs/default Route, prefs, evidence equality, complete DOM Stability",
          );
        }
        const lifecycle = await page.evaluate(() => {
          const h = window.__BLACKBOX_SYNTHETIC__;
          const before = h.context.visit_id;
          history.pushState({}, "", "/c/synthetic");
          const changed = before !== h.context.visit_id;
          const replacement = () =>
            Promise.resolve(new Response("third-party"));
          window.fetch = replacement;
          h.checkHooks();
          h.checkHooks();
          const notices = h.events.filter(
            (e) => e.kind === "hook_replaced",
          ).length;
          h.dispose();
          return {
            changed,
            notices,
            restoredThirdParty: window.fetch === replacement,
          };
        });
        assert.deepEqual(lifecycle, {
          changed: true,
          notices: 1,
          restoredThirdParty: true,
        });
        row.checks.push(
          "SPA boundary",
          "hook_replaced once",
          "dispose preserves third-party hook",
        );
        row.startup = startup;
        row.on_off = {
          fetch: network.fetchResults,
          xhr: network.xhrResults,
          websocket: network.wsResults,
        };
        row.request_counts = Object.fromEntries(requests);
        assert.deepEqual(
          await hashes(),
          sourceHashes,
          "source/build changed during browser test",
        );
        row.status = "PASS";
      }
    } catch (error) {
      row.status = "FAIL";
      row.error = String(error);
      if (error.diagnostic) row.deadline_diagnostic = error.diagnostic;
      if (diagnosticPage)
        row.xhr_first_failure = await diagnosticPage
          .evaluate(() => {
            const d = window.__BLACKBOX_XHR_TRACE__;
            if (!d) return null;
            return {
              trace: d.trace,
              requests: d.requests,
              observer_health: window.__BLACKBOX_SYNTHETIC__?.health,
            };
          })
          .catch(() => null);
      process.exitCode = 1;
    } finally {
      await context?.close();
    }
    row.completed_at = new Date().toISOString();
    results.push(row);
    console.log(JSON.stringify(row));
    if (row.status === "FAIL") break;
  }
} finally {
  for (const ws of sockets.clients) ws.terminate();
  sockets.close();
  crossServer.closeAllConnections();
  await new Promise((resolve) => crossServer.close(resolve));
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    `${output}/${phase}-browser-attempt${attempt}.json`,
    JSON.stringify(results, null, 2),
  );
  await writeFile(
    `${output}/${phase}-browser.json`,
    JSON.stringify(results, null, 2),
  );
  if (thirdDiagnostic)
    await writeFile(
      `${output}/P7_HELPER_DIAGNOSTIC.json`,
      JSON.stringify(results, null, 2),
    );
}
