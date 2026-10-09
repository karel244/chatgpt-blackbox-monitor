import { Journal } from "../core/journal.ts";
import {
  environmentFields,
  readEnvironment,
  ENVIRONMENT_VERSION,
  type EnvironmentField,
} from "../core/environment.ts";
import {
  AssetSet,
  assetSetHash,
  publicMarkers,
  normalizeAsset,
  BUILD_VERSION,
  NORMALIZATION_VERSION,
  type Asset,
} from "../core/assets.ts";
import { AUX_SCHEMA_VERSION } from "../core/network.ts";
import type { Context, Realm, CaptureStart } from "../host/types.ts";
import type { Scalar } from "../core/route.ts";
export interface EnvironmentSnapshot {
  snapshot_id: string;
  reason: string;
  observed_at: string;
  monotonic_ms: number;
  fields: Record<string, EnvironmentField>;
  assets: Asset[];
  asset_set_hash: string | null;
  normalization_version: string;
  resource_count: number;
  window: { start_ms: number; end_ms: number };
  completeness: "Complete" | "Partial" | "Unknown";
  overflow: boolean;
  resource_timing_availability: string;
  performance_observer_availability: string;
  markers: ReturnType<typeof publicMarkers>;
  service_worker: {
    availability: string;
    controller: { script_url: string | null; state: string | null } | null;
    registrations: { script_url: string | null; state: string | null }[];
  };
}
export class EnvironmentMonitor {
  readonly snapshots: EnvironmentSnapshot[] = [];
  readonly health = { journal: "Unknown", dropped: 0 };
  private assets = new AssetSet();
  private context: Context;
  private active = true;
  private generation = 0;
  private sequence = 0;
  private cleanup: (() => void)[] = [];
  private observer: PerformanceObserver | null = null;
  private resourceTiming = "not_exposed";
  private observerAvailability = "not_exposed";
  private windowStart: number;
  private scheduled = false;
  private chain = Promise.resolve();
  private latestSignature: string | null = null;
  private sw: EnvironmentSnapshot["service_worker"] = {
    availability: "not_exposed",
    controller: null,
    registrations: [],
  };
  constructor(
    private page: Realm,
    readonly journal: Journal,
    context: Context,
    private now = () => performance.now(),
    private wall = () => new Date().toISOString(),
  ) {
    this.windowStart = this.now();
    this.context = { ...context };
  }
  private safe<T>(read: () => T): T | undefined {
    try {
      return read();
    } catch {
      return undefined;
    }
  }
  private origin() {
    return this.safe(() => this.page.location.origin) ?? "";
  }
  private listen(
    target: EventTarget | undefined,
    event: string,
    handler: EventListener,
  ) {
    if (!target?.addEventListener) return;
    target.addEventListener(event, handler);
    this.cleanup.push(() => target.removeEventListener(event, handler));
  }
  start() {
    this.scan();
    const ctor = this.safe(() => this.page.PerformanceObserver);
    if (ctor)
      try {
        this.observer = new ctor((list) => {
          if (!this.active) return;
          let changed = false;
          const entries = list.getEntries();
          if (entries.length > 500) this.assets.overflow = true;
          for (const e of entries.slice(0, 500))
            changed =
              this.assets.add(
                e.name,
                this.origin(),
                "PerformanceObserver/resource",
                this.wall(),
              ) || changed;
          if (changed || this.assets.overflow)
            this.schedule("resource_set_change");
        });
        this.observer.observe({ type: "resource", buffered: true });
        this.observerAvailability = "observed";
      } catch {
        this.observerAvailability = "unavailable";
      }
    this.listen(this.page.performance, "resourcetimingbufferfull", () => {
      if (this.active) {
        this.assets.overflow = true;
        this.schedule("resource_buffer_overflow");
      }
    });
    let width = this.safe(() => this.page.innerWidth),
      height = this.safe(() => this.page.innerHeight);
    this.listen(this.page, "resize", () => {
      const w = this.safe(() => this.page.innerWidth),
        h = this.safe(() => this.page.innerHeight);
      if (
        Math.abs((w ?? 0) - (width ?? 0)) >= 64 ||
        Math.abs((h ?? 0) - (height ?? 0)) >= 64
      ) {
        width = w;
        height = h;
        this.schedule("significant_resize");
      }
    });
    this.listen(this.page.document, "visibilitychange", () =>
      this.schedule("visibility_change"),
    );
    for (const event of ["online", "offline", "focus", "blur"])
      this.listen(this.page, event, () => this.schedule(event));
    this.listen(this.page.document, "DOMContentLoaded", () => {
      this.scan();
      this.schedule("environment_ready");
    });
    void this.observeServiceWorkers().then(() =>
      this.snapshot("service_worker_ready"),
    );
    return this.snapshot("document_start");
  }
  private schedule(reason: string) {
    if (!this.active || this.scheduled) return;
    this.scheduled = true;
    const generation = this.generation;
    this.page.queueMicrotask(() => {
      this.scheduled = false;
      if (generation === this.generation && this.active)
        void this.snapshot(reason);
    });
  }
  private scan() {
    const scripts = this.safe(() =>
      this.page.document.querySelectorAll("script[src]"),
    );
    if (scripts) {
      let count = 0;
      for (const script of scripts) {
        if (count++ >= 500) {
          this.assets.overflow = true;
          break;
        }
        this.assets.add(
          script.getAttribute("src"),
          this.origin(),
          "DOM/script.src",
          this.wall(),
        );
      }
    }
    const timing = this.safe(() =>
      this.page.performance.getEntriesByType("resource"),
    );
    this.resourceTiming = timing ? "observed" : "not_exposed";
    if (timing) {
      if (timing.length > 500) this.assets.overflow = true;
      for (const e of timing.slice(0, 500))
        this.assets.add(
          e.name,
          this.origin(),
          "PerformanceResourceTiming/name",
          this.wall(),
        );
    }
  }
  private markers() {
    const node = this.safe(() =>
      this.page.document.getElementById("__NEXT_DATA__"),
    );
    const raw = node?.textContent;
    let next: unknown = null;
    if (raw && raw.length <= 262144)
      try {
        next = JSON.parse(raw);
      } catch {
        /* missing marker stays Unknown */
      }
    const declared = this.safe(() =>
      this.page.document
        .querySelector('meta[name="deployment-id"]')
        ?.getAttribute("content"),
    );
    return publicMarkers(next, declared);
  }
  async observeServiceWorkers() {
    const generation = this.generation;
    const api = this.safe(() => this.page.navigator.serviceWorker);
    if (!api) {
      this.sw = {
        availability: "not_exposed",
        controller: null,
        registrations: [],
      };
      return;
    }
    const project = (worker: ServiceWorker | null | undefined) =>
      worker
        ? {
            script_url:
              normalizeAsset(
                this.safe(() => worker.scriptURL),
                this.origin(),
                "ServiceWorker.scriptURL",
                this.wall(),
              ).asset?.url ?? null,
            state: [
              "installing",
              "installed",
              "activating",
              "activated",
              "redundant",
            ].includes(worker.state)
              ? worker.state
              : null,
          }
        : null;
    try {
      const registrations = await api.getRegistrations();
      if (generation !== this.generation || !this.active) return;
      this.sw = {
        availability: registrations.length > 32 ? "partial" : "observed",
        controller: project(api.controller),
        registrations: registrations
          .slice(0, 32)
          .map((r) => project(r.active ?? r.waiting ?? r.installing))
          .filter((v): v is NonNullable<typeof v> => v !== null),
      };
    } catch {
      if (generation === this.generation)
        this.sw = {
          availability: "unavailable",
          controller: project(api.controller),
          registrations: [],
        };
    }
  }
  snapshot(reason = "run_start"): Promise<EnvironmentSnapshot | null> {
    const generation = this.generation;
    let result: EnvironmentSnapshot | null = null;
    this.chain = this.chain
      .then(async () => {
        if (!this.active || generation !== this.generation) return;
        this.scan();
        const observed_at = this.wall(),
          monotonic_ms = this.now();
        const fields = environmentFields(
            readEnvironment(this.page),
            observed_at,
          ),
          assets = this.assets.all(),
          markers = this.markers();
        let hash: string | null = null;
        try {
          hash = await assetSetHash(
            assets.map((a) => a.url),
            (bytes) =>
              this.page.crypto.subtle.digest("SHA-256", bytes as BufferSource),
          );
        } catch {
          /* unavailable digest */
        }
        if (!this.active || generation !== this.generation) return;
        const snapshot: EnvironmentSnapshot = {
          snapshot_id: `environment-${this.context.document_id}-${this.context.epoch}-${++this.sequence}`,
          reason,
          observed_at,
          monotonic_ms,
          fields,
          assets,
          asset_set_hash: hash,
          normalization_version: NORMALIZATION_VERSION,
          resource_count: assets.length,
          window: { start_ms: this.windowStart, end_ms: monotonic_ms },
          completeness:
            this.assets.overflow || this.sw.availability === "partial"
              ? "Partial"
              : this.resourceTiming !== "observed" ||
                  fields.origin?.availability !== "observed" ||
                  this.observerAvailability !== "observed" ||
                  hash === null
                ? "Unknown"
                : "Complete",
          overflow: this.assets.overflow,
          resource_timing_availability: this.resourceTiming,
          performance_observer_availability: this.observerAvailability,
          markers,
          service_worker: structuredClone(this.sw),
        };
        // Deduplicate values across identical snapshots; references retain each reason/time.
        const signature = JSON.stringify({
          fields: Object.fromEntries(
            Object.entries(fields).map(([k, v]) => [
              k,
              { ...v, observed_at: "" },
            ]),
          ),
          assets: assets.map((a) => a.url),
          markers,
          sw: this.sw,
          completeness: snapshot.completeness,
          overflow: snapshot.overflow,
          resourceTiming: this.resourceTiming,
          observerAvailability: this.observerAvailability,
        });
        const capture: CaptureStart = {
          capture_id: `environment:${this.context.document_id}:${this.context.epoch}`,
          context: { ...this.context },
          mode: "environment",
          transport: "dom",
          conversation_id: null,
          started_at: this.windowStart,
        };
        if (!this.journal.start(capture)) {
          this.health.journal = "Partial";
          this.health.dropped++;
          return;
        }
        this.health.journal = "Available";
        const append = (
          namespace: string,
          field: string,
          value: Scalar,
          source: string,
          availability = "observed",
          privacy = "safe_metadata",
        ) => {
          const saved = this.journal.append({
            capture_id: capture.capture_id,
            task_scope: "environment",
            message_id: null,
            transport: "dom",
            direction: "local",
            association: "orphan",
            association_proof: "document_environment_only",
            endpoint_verified: false,
            channel: "0",
            transport_segment_id: snapshot.snapshot_id,
            field_namespace: namespace,
            field,
            level: "E",
            value,
            value_state: "value",
            source_path: source,
            source_type: "local_environment",
            raw_source_type: "dom",
            schema_version: AUX_SCHEMA_VERSION,
            adapter_version: namespace.startsWith("frontend")
              ? BUILD_VERSION
              : ENVIRONMENT_VERSION,
            rule_version: namespace.startsWith("frontend")
              ? BUILD_VERSION
              : ENVIRONMENT_VERSION,
            availability,
            privacy_class: privacy,
            observed_at,
          });
          if (!saved) {
            snapshot.completeness = "Partial";
            snapshot.overflow = true;
            this.health.journal = "Partial";
            this.health.dropped++;
          }
          return saved;
        };
        if (signature === this.latestSignature) {
          append(
            "environment.reference",
            "snapshot_id",
            this.snapshots.at(-1)?.snapshot_id ?? null,
            "identical_observed_values",
          );
          append("environment.reference", "reason", reason, "snapshot_trigger");
          result = this.snapshots.at(-1) ?? null;
          return;
        }
        this.latestSignature = signature;
        append(
          "environment.snapshot",
          "snapshot_id",
          snapshot.snapshot_id,
          "local_snapshot",
        );
        append("environment.snapshot", "reason", reason, "snapshot_trigger");
        for (const [key, field] of Object.entries(fields))
          append(
            "environment.fields",
            key,
            field.value,
            field.source,
            field.availability,
            field.privacy_class,
          );
        append(
          "frontend.assets",
          "asset_set_hash",
          hash,
          "SHA256:normalized_sorted_deduplicated_URL_identifiers",
          hash ? "observed" : "unavailable",
        );
        append(
          "frontend.assets",
          "normalization_version",
          NORMALIZATION_VERSION,
          "registered_normalizer",
        );
        append(
          "frontend.assets",
          "resource_count",
          assets.length,
          "observed_asset_identifiers",
        );
        append(
          "frontend.assets",
          "overflow",
          snapshot.overflow,
          "observer_budget",
        );
        append(
          "frontend.assets",
          "completeness",
          snapshot.completeness,
          "observed_resource_window",
        );
        append(
          "frontend.assets",
          "window_start_ms",
          snapshot.window.start_ms,
          "document_resource_observation_window",
        );
        append(
          "frontend.assets",
          "window_end_ms",
          snapshot.window.end_ms,
          "document_resource_observation_window",
        );
        append(
          "frontend.assets",
          "resource_timing_availability",
          this.resourceTiming,
          "performance.getEntriesByType/resource",
        );
        append(
          "frontend.assets",
          "performance_observer_availability",
          this.observerAvailability,
          "PerformanceObserver/resource",
        );
        for (const [index, asset] of assets.entries()) {
          append(`frontend.asset.${index}`, "url", asset.url, asset.source);
          append(
            `frontend.asset.${index}`,
            "asset_url_token",
            asset.asset_url_token,
            asset.source,
            asset.asset_url_token ? "observed" : "unknown",
          );
        }
        append(
          "frontend.markers",
          "build_id",
          markers.build_id,
          "DOM#__NEXT_DATA__.buildId",
          markers.build_id ? "observed" : "unknown",
        );
        append(
          "frontend.markers",
          "deployment_marker",
          markers.deployment_marker,
          "DOM meta[name=deployment-id]",
          markers.deployment_marker ? "observed" : "unknown",
        );
        append(
          "frontend.markers",
          "conflict",
          markers.conflict,
          "registered_public_markers",
        );
        append(
          "frontend.service_worker",
          "availability",
          this.sw.availability,
          "navigator.serviceWorker",
        );
        append(
          "frontend.service_worker",
          "controller_url",
          this.sw.controller?.script_url ?? null,
          "navigator.serviceWorker.controller.scriptURL",
          this.sw.controller ? "observed" : "not_exposed",
        );
        append(
          "frontend.service_worker",
          "controller_state",
          this.sw.controller?.state ?? null,
          "navigator.serviceWorker.controller.state",
          this.sw.controller
            ? this.sw.controller.state
              ? "observed"
              : "unknown"
            : this.sw.availability === "observed"
              ? "absent_in_observed_payload"
              : "not_exposed",
        );
        for (const [index, worker] of this.sw.registrations.entries()) {
          append(
            "frontend.service_worker",
            `registration.${index}.url`,
            worker.script_url,
            "navigator.serviceWorker.getRegistrations/scriptURL",
          );
          append(
            "frontend.service_worker",
            `registration.${index}.state`,
            worker.state,
            "ServiceWorker.state",
            worker.state ? "observed" : "unknown",
          );
        }
        this.journal.terminate(
          capture.capture_id,
          "environment_observation_context",
        );
        if (this.snapshots.length >= 16) this.snapshots.shift();
        this.snapshots.push(snapshot);
        result = snapshot;
      })
      .catch(() => {
        /* observer cannot affect business calls */
      });
    return this.chain.then(() => result);
  }
  reset(context: Context, reason: string) {
    const wasActive = this.active;
    this.generation++;
    if (context.document_id !== this.context.document_id || reason === "clear")
      this.windowStart = this.now();
    this.context = { ...context };
    this.latestSignature = null;
    if (["pause", "dispose"].includes(reason)) this.active = false;
    else this.active = true;
    if (reason === "clear") {
      this.snapshots.length = 0;
      this.assets = new AssetSet();
    }
    if (!this.active) {
      this.observer?.disconnect();
      for (const fn of this.cleanup) fn();
      this.cleanup = [];
      this.observer = null;
    }
    if (this.active && !wasActive) void this.start();
    else if (this.active) void this.snapshot("context_" + reason);
  }
}
