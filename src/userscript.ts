import { I18n, LOCALE_KEY } from "./ui/i18n.ts";
import { compactClosed } from "./history/retention.ts";
import { installPanel } from "./ui/panel.ts";
import { Experiments } from "./compare/experiment.ts";
import { compareBundles, baseline } from "./compare/compare.ts";
import { installHost } from "./host/capture.ts";
import type { Realm } from "./host/types.ts";
import { projectRequest } from "./host/request.ts";
import { Monitor } from "./adapters/monitor.ts";
import { NetworkMonitor } from "./adapters/network-monitor.ts";
import { EnvironmentMonitor } from "./adapters/environment-monitor.ts";
import { HistoryStore } from "./history/storage.ts";
import { coalescedFlush } from "./history/flush.ts";
import { exportBundle, importBundle } from "./history/bundle.ts";
declare const __SYNTHETIC__: boolean;
declare const unsafeWindow: Realm;
declare function GM_getValue(key: string, fallback?: unknown): unknown;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_deleteValue(key: string): void;
declare function GM_listValues(): string[];
declare function GM_addValueChangeListener(
  key: string,
  callback: () => void,
): number;
declare function GM_removeValueChangeListener(id: number): void;
(() => {
  if (window.top !== window) return;
  const page = typeof unsafeWindow === "object" ? unsafeWindow : null;
  if (!page) return;
  const requests: { capture_id: string; metadata: Record<string, string> }[] =
    [];
  const monitor = new Monitor(() => page.performance.now());
  const sink = monitor.sink();
  const network = new NetworkMonitor(monitor.journal, () =>
    page.performance.now(),
  );
  let environment: EnvironmentMonitor | undefined;
  const host = installHost(page, {
    allowedOrigins: __SYNTHETIC__ ? ["http://127.0.0.1:43997"] : undefined,
    sink: {
      event(event) {
        try {
          network.event(event);
        } catch {
          /* retain route observer */
        }
        sink.event?.(event);
      },
      response(capture, response) {
        if (capture.mode === "requirements") {
          void network.response(capture, response);
          return;
        }
        // Headers share the existing observation clone; bounded HTML is observed without a second tee.
        const html =
          response.headers
            .get("content-type")
            ?.split(";")[0]
            ?.trim()
            .toLowerCase() === "text/html";
        if (html) {
          void network.response(capture, response);
          monitor.journal.segmentEof(capture.capture_id);
          monitor.journal.health(
            capture.capture_id,
            "Partial",
            "non_route_html_response",
          );
        } else {
          void network.response(capture, response);
          void monitor
            .response(capture, response)
            .then(() => network.reconcile(monitor.diagnostics))
            .catch(() => {});
        }
      },
      xhr(capture, xhr, kind) {
        try {
          network.xhr(capture, xhr, kind);
        } catch {
          /* auxiliary failure never suppresses route observation */
        }
        if (capture.mode !== "requirements") sink.xhr?.(capture, xhr, kind);
        network.reconcile(monitor.diagnostics);
      },
      socket(id, socket, kind, event, context) {
        try {
          network.socket(id, kind, event, context);
        } catch {
          /* retain route observer */
        }
        if (kind === "message")
          void monitor
            .socketMessage(
              id,
              (event as MessageEvent).data,
              context,
              monitor.counters.ws_message_events + 1,
            )
            .then(() => network.reconcile(monitor.diagnostics))
            .catch(() => {});
        else {
          sink.socket?.(id, socket, kind, event, context);
          network.reconcile(monitor.diagnostics);
        }
      },
      reset(context, reason) {
        network.reset(context, reason);
        sink.reset?.(context, reason);
        environment?.reset(context, reason);
      },
      request(capture, input, init, requestClone) {
        const metadata = projectRequest(
          capture.transport === "fetch" ? init?.body : input,
        );
        if (requests.length === 32) requests.shift();
        requests.push({ capture_id: capture.capture_id, metadata });
        if (capture.mode !== "requirements")
          sink.request?.(capture, input, init, requestClone);
        network.start(
          capture,
          capture.transport === "fetch" ? init?.body : input,
        );
      },
    },
  });
  const challengeResources = () => {
    try {
      const scripts = [
        ...page.document.querySelectorAll("script[src],link[href]"),
      ]
        .slice(0, 500)
        .some((el) =>
          /\/cdn-cgi\/challenge-platform\//.test(
            el.getAttribute("src") ?? el.getAttribute("href") ?? "",
          ),
        );
      const timing = page.performance
        .getEntriesByType("resource")
        .slice(0, 500)
        .some((entry) => /\/cdn-cgi\/challenge-platform\//.test(entry.name));
      if (host.active)
        network.challengeResource(host.context, scripts || timing);
    } catch {
      /* unavailable DOM/resource APIs cannot affect page */
    }
  };
  if (page.document.readyState === "loading")
    page.document.addEventListener("DOMContentLoaded", challengeResources, {
      once: true,
    });
  else challengeResources();
  host.health.realm =
    typeof page.fetch === "function" && typeof page.WebSocket === "function"
      ? "Available"
      : "Unavailable";
  try {
    const key = `blackbox:probe:${host.context.document_id}`;
    GM_setValue(key, true);
    host.health.gm = GM_getValue(key, false) === true ? "Available" : "Failed";
    GM_deleteValue(key);
  } catch {
    host.health.gm = "Unavailable";
  }
  if (host.health.gm !== "Available" || host.health.realm !== "Available")
    host.pause();
  if (host.active) {
    environment = new EnvironmentMonitor(
      page,
      monitor.journal,
      host.context,
      () => page.performance.now(),
    );
    void environment.start();
  }
  const history = new HistoryStore(
    {
      get: async (key) => GM_getValue(key),
      set: async (key, value) => {
        GM_setValue(key, value);
      },
      delete: async (key) => {
        GM_deleteValue(key);
      },
      keys: async () => GM_listValues(),
      listen: (key, callback) => {
        const id = GM_addValueChangeListener(key, callback);
        return () => GM_removeValueChangeListener(id);
      },
    },
    host.context.document_id,
  );
  let historyTimer: ReturnType<typeof setInterval> | undefined;
  history.onEpochChanged = () => host.clear();
  let flushes = 0;
  const flushHistory = coalescedFlush(async () => {
    try {
      monitor.journal.tick();
      await history.flush(monitor.journal);
      await compactClosed(monitor, network, history, () => ui.selected);
      if (++flushes % 60 === 0) await history.cleanup();
    } catch {
      history.health.status = "Failed";
    }
  });
  if (host.health.gm === "Available")
    void history
      .init()
      .then(() => {
        historyTimer = setInterval(() => {
          void flushHistory();
        }, 1000);
        void flushHistory();
      })
      .catch(() => {
        history.health.status = "Failed";
      });
  window.addEventListener(
    "pagehide",
    () => {
      void flushHistory();
    },
    { once: true },
  );
  window.addEventListener(
    "unload",
    () => {
      if (historyTimer) clearInterval(historyTimer);
      history.dispose();
    },
    { once: true },
  );
  const experiments = new Experiments(history.store);
  const comparison = { compare: compareBundles, baseline };
  const bundle = {
    export: async (id: string) => {
      const s = monitor.journal.snapshot(id);
      if (!s) throw Error("capture_unavailable");
      const related = monitor.journal
        .ids()
        .map((id) => monitor.journal.snapshot(id))
        .filter(
          (r): r is NonNullable<typeof r> =>
            !!r &&
            r.start.capture_id !== id &&
            r.start.context.document_id === s.start.context.document_id &&
            r.start.context.epoch === s.start.context.epoch &&
            ["environment", "network", "requirements"].includes(r.start.mode),
        );
      const run = experiments.get(id);
      return exportBundle(
        s,
        "1.1.0",
        run
          ? {
              experiment_id: run.descriptor.experiment_uuid,
              run_id: run.run_id,
            }
          : {},
        run ? { state: "not_compared", run } : { state: "not_compared" },
        related,
      );
    },
    import: importBundle,
  };
  const historyActions = {
    clearCurrent: async (id: string) => {
      await flushHistory();
      await history.clearCurrent(id);
      monitor.discardCapture(id);
    },
    clearHistory: () => history.clearHistory(),
    clearAll: async () => {
      await history.clearAll();
    },
    flush: flushHistory,
  };
  const i18n = new I18n({
    get: () =>
      typeof GM_getValue === "function" ? GM_getValue(LOCALE_KEY) : undefined,
    set: (value) => GM_setValue(LOCALE_KEY, value),
  });
  const ui = installPanel(
    document,
    monitor.journal,
    history,
    experiments,
    {
      context: () => host.context,
      active: () => host.active,
      pause: () => host.pause(),
      resume: () => host.resume(),
      ...historyActions,
      export: bundle.export,
      import: bundle.import,
      checkHooks: () => host.checkHooks(),
      captureStatus: () => ({
        health: host.health,
        early_page_coverage: "Unknown",
        captures: monitor.journal.ids().map((id) => ({
          id,
          state: monitor.journal.state(id),
          route: monitor.journal.route(id, "answer"),
          network: network.verdict(id),
        })),
        diagnostics: monitor.diagnostics,
        environment: environment?.snapshots.at(-1) ?? null,
      }),
      preferences: {
        get: (key) => GM_getValue(key),
        set: (key, value) => GM_setValue(key, value),
      },
    },
    i18n,
  );
  const originalDispose = host.dispose.bind(host);
  host.dispose = () => {
    ui.dispose();
    originalDispose();
  };
  window.addEventListener("unload", () => ui.dispose(), { once: true });
  if (__SYNTHETIC__) {
    Object.defineProperty(host, "requestMetadata", { value: requests });
    Object.defineProperty(host, "monitor", { value: monitor });
    Object.defineProperty(host, "network", { value: network });
    Object.defineProperty(host, "environment", { value: environment });
    Object.defineProperty(host, "history", { value: history });
    Object.defineProperty(host, "historyTestHooks", {
      value: {
        suspend: () => {
          if (historyTimer) clearInterval(historyTimer);
          historyTimer = undefined;
        },
        resume: () => {
          if (!historyTimer)
            historyTimer = setInterval(() => {
              void flushHistory();
            }, 1000);
        },
      },
    });
    Object.defineProperty(host, "historyActions", { value: historyActions });
    Object.defineProperty(host, "bundle", { value: bundle });
    Object.defineProperty(host, "experiments", { value: experiments });
    Object.defineProperty(host, "comparison", { value: comparison });
    Object.defineProperty(host, "ui", { value: ui });
    // Test-only diagnostic API: production never exposes the host or GM capabilities.
    Object.defineProperty(page, "__BLACKBOX_SYNTHETIC__", {
      value: host,
      configurable: true,
    });
  }
})();
