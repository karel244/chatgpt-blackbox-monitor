import type { Journal } from "../core/journal.ts";
import { identifier, record, type Scalar } from "../core/route.ts";
import {
  AUX_SCHEMA_VERSION,
  NETWORK_VERSION,
  SAFE_HEADERS,
  httpEvidence,
  htmlIndicators,
  networkVerdict,
  powEvidence,
  powAssociation,
  type Availability,
  type HttpEvidence,
  type NetworkVerdict,
} from "../core/network.ts";
import type { CaptureStart, Context, HookEvent } from "../host/types.ts";

export class NetworkMonitor {
  private captures = new Map<
    string,
    { capture: CaptureStart; request_id: string | null; valid: boolean }
  >();
  private readers = new Map<string, ReadableStreamDefaultReader<Uint8Array>>();
  private generation = 0;
  private xhrSeen = new WeakMap<XMLHttpRequest, string>();
  private reconnectSeen = new Set<string>();
  private socketEvents = new Map<
    string,
    {
      context: Context;
      events: { kind: string; code: number | null; clean: boolean | null }[];
    }
  >();
  private socketLinks = new Set<string>();
  private powReadings: {
    capture: CaptureStart;
    request_id: string | null;
    document_id: string;
    epoch: number;
    monotonic_ms: number;
  }[] = [];
  private links = new Set<string>();
  constructor(
    readonly journal: Journal,
    private now = () => performance.now(),
    private wall = () => new Date().toISOString(),
  ) {}
  start(capture: CaptureStart, body: unknown) {
    if (!this.journal.start(capture) || this.captures.size >= 128) return;
    let request_id: string | null = null;
    if (typeof body === "string" && body.length <= 1048576) {
      try {
        request_id = identifier(record(JSON.parse(body))?.request_id);
      } catch {
        /* no raw input */
      }
    }
    this.captures.set(capture.capture_id, { capture, request_id, valid: true });
    if (capture.mode === "live")
      for (const reading of this.powReadings)
        this.linkPow(reading, capture, request_id);
  }
  append(
    capture: CaptureStart,
    namespace: string,
    field: string,
    value: Scalar,
    availability: Availability = "observed",
    proof = "same_observed_request",
    association: "confirmed" | "candidate" | "orphan" = "confirmed",
    segment = capture.capture_id,
  ) {
    const entry = this.captures.get(capture.capture_id);
    if (!entry?.valid) return;
    this.journal.append(
      {
        capture_id: capture.capture_id,
        task_scope: "network_environment",
        message_id: null,
        transport: capture.mode === "reload" ? "reload" : capture.transport,
        direction: "inbound",
        association,
        association_proof: proof,
        endpoint_verified: true,
        channel: "0",
        transport_segment_id: segment,
        field_namespace: namespace,
        field,
        level: namespace.startsWith("pow") ? "E" : "N",
        value,
        value_state:
          availability === "explicit_null"
            ? "explicit_null"
            : availability === "invalid"
              ? "invalid"
              : "value",
        source_path:
          namespace === "network.headers"
            ? `/response/headers/${field}`
            : namespace.startsWith("network.server-timing")
              ? `/response/headers/server-timing/${field}`
              : namespace === "network.http"
                ? "/response/status"
                : namespace === "pow"
                  ? (capture.endpoint_path ?? "/requirements")
                  : `/network/${field}`,
        source_type: namespace.startsWith("pow")
          ? "requirements_environment"
          : "network_observation",
        raw_source_type: capture.transport,
        schema_version: AUX_SCHEMA_VERSION,
        adapter_version: NETWORK_VERSION,
        rule_version: NETWORK_VERSION,
        availability,
        privacy_class:
          field === "cf-ray" || field === "request_id"
            ? "local_identifier_redact_on_export"
            : "safe_metadata",
        observed_at: this.wall(),
      },
      { request_id: entry.request_id },
    );
  }
  private commitHttp(capture: CaptureStart, evidence: HttpEvidence) {
    this.append(
      capture,
      "network.http",
      "http_status",
      evidence.status.value,
      evidence.status.availability,
    );
    for (const name of SAFE_HEADERS) {
      const header = evidence.headers[name];
      if (header.value === null || typeof header.value === "string")
        this.append(
          capture,
          "network.headers",
          name,
          header.value,
          header.availability,
        );
      else if (Array.isArray(header.value)) {
        this.append(
          capture,
          "network.headers",
          "server-timing.availability",
          header.availability,
        );
        header.value.forEach((metric, index) => {
          this.append(
            capture,
            `network.server-timing.${index}`,
            "metric_name",
            metric.name,
          );
          this.append(
            capture,
            `network.server-timing.${index}`,
            "dur",
            metric.dur,
            metric.dur === null ? "absent" : "observed",
          );
        });
      } else {
        this.append(
          capture,
          "network.headers",
          "retry-after.seconds",
          header.value.seconds,
          header.value.seconds === null ? "absent" : "observed",
        );
        this.append(
          capture,
          "network.headers",
          "retry-after.date",
          header.value.date,
          header.value.date === null ? "absent" : "observed",
        );
      }
    }
    this.append(capture, "network.verdict", "status", networkVerdict(evidence));
  }
  async response(capture: CaptureStart, response: Response) {
    this.refreshIdentity(capture);
    const evidence = httpEvidence(
      response.status,
      (name) => response.headers.get(name),
      response.type === "opaque" || response.type === "opaqueredirect"
        ? "opaque"
        : response.type === "cors"
          ? "cors"
          : "readable",
    );
    this.commitHttp(capture, evidence);
    if (capture.mode !== "requirements" && !evidence.indicators.html) return;
    if (!response.body) {
      this.append(capture, "network.observer", "body", null, "not_captured");
      return;
    }
    if (this.readers.size >= 32) {
      this.append(capture, "network.observer", "body", null, "not_captured");
      void response.body.cancel().catch(() => {});
      return;
    }
    const reader = response.body.getReader(),
      generation = this.generation;
    this.readers.set(capture.capture_id, reader);
    let size = 0;
    const chunks: Uint8Array[] = [];
    const limit = capture.mode === "requirements" ? 262144 : 65536;
    try {
      while (generation === this.generation) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > limit) {
          this.append(
            capture,
            "network.observer",
            "body_limit",
            true,
            "not_captured",
          );
          if (capture.mode !== "requirements") {
            const prefix = new Uint8Array(Math.min(size, limit));
            let pos = 0;
            for (const chunk of [...chunks, next.value]) {
              const part = chunk.subarray(0, limit - pos);
              prefix.set(part, pos);
              pos += part.length;
              if (pos === limit) break;
            }
            Object.assign(
              evidence.indicators,
              htmlIndicators(new TextDecoder().decode(prefix)),
            );
            for (const [name, value] of Object.entries(evidence.indicators))
              this.append(capture, "network.challenge", name, value);
            this.append(
              capture,
              "network.verdict",
              "status",
              networkVerdict(evidence),
            );
          }
          void reader.cancel().catch(() => {});
          return;
        }
        chunks.push(next.value);
      }
      if (
        generation !== this.generation ||
        !this.captures.get(capture.capture_id)?.valid
      )
        return;
      const merged = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(merged);
      if (capture.mode === "requirements") this.pow(capture, JSON.parse(text));
      else {
        Object.assign(evidence.indicators, htmlIndicators(text));
        for (const [name, value] of Object.entries(evidence.indicators))
          this.append(capture, "network.challenge", name, value);
        this.append(
          capture,
          "network.verdict",
          "status",
          networkVerdict(evidence),
        );
      }
    } catch {
      if (generation === this.generation)
        this.append(capture, "network.observer", "body", null, "invalid");
    } finally {
      this.readers.delete(capture.capture_id);
      reader.releaseLock();
      if (capture.mode === "requirements")
        this.journal.terminate(
          capture.capture_id,
          "requirements_observation_ended",
        );
    }
  }
  pow(capture: CaptureStart, value: unknown) {
    const pow = powEvidence(value),
      entry = this.captures.get(capture.capture_id);
    if (!entry?.valid) return;
    entry.request_id = pow.request_id ?? entry.request_id;
    this.append(capture, "pow", "raw_hex", pow.raw_hex, pow.validity);
    this.append(capture, "pow", "decimal", pow.decimal, pow.validity);
    this.append(capture, "pow", "source_path", pow.source_path);
    this.append(
      capture,
      "pow",
      "requirements_endpoint",
      capture.endpoint_path ?? null,
      capture.endpoint_path ? "observed" : "unknown",
    );
    this.append(capture, "pow", "association_status", "unassociated");
    const observed = {
      request_id: entry.request_id,
      document_id: capture.context.document_id,
      epoch: capture.context.epoch,
      monotonic_ms: this.now(),
    };
    if (this.powReadings.length === 32) this.powReadings.shift();
    const reading = { ...observed, capture };
    this.powReadings.push(reading);
    for (const other of this.captures.values()) {
      if (!other.valid || other.capture.mode !== "live") continue;
      this.linkPow(reading, other.capture, other.request_id);
    }
  }
  private linkPow(
    reading: NetworkMonitor["powReadings"][number],
    capture: CaptureStart,
    request_id: string | null,
  ) {
    const a = powAssociation(reading, {
      request_id,
      document_id: capture.context.document_id,
      epoch: capture.context.epoch,
      monotonic_ms: capture.started_at,
    });
    if (a.status === "unassociated") return;
    if (
      a.status === "confirmed" &&
      [...this.captures.values()].filter(
        (e) =>
          e.valid &&
          e.capture.mode === "live" &&
          e.request_id === request_id &&
          e.capture.context.document_id === capture.context.document_id &&
          e.capture.context.epoch === capture.context.epoch,
      ).length !== 1
    ) {
      this.append(
        capture,
        "pow.association",
        "association_status",
        "ambiguous",
        "observed",
        "duplicate_request_id",
        "orphan",
      );
      return;
    }
    const key = `${reading.capture.capture_id}:${capture.capture_id}:${a.status}`;
    if (this.links.has(key) || this.links.size >= 4096) return;
    this.links.add(key);
    // Link only by explicit evidence. Time proximity stays E/candidate, never Route A.
    this.append(
      capture,
      "pow.association",
      "association_status",
      a.status,
      "observed",
      a.proof,
      a.status === "confirmed" ? "confirmed" : "candidate",
    );
    this.append(
      capture,
      "pow.association",
      "requirements_capture_id",
      reading.capture.capture_id,
      "observed",
      a.proof,
      a.status === "confirmed" ? "confirmed" : "candidate",
    );
    this.append(
      capture,
      "pow.association",
      "delta_ms",
      a.delta_ms,
      a.delta_ms === null ? "absent" : "observed",
      a.proof,
      a.status === "confirmed" ? "confirmed" : "candidate",
    );
    this.append(
      reading.capture,
      "pow.association",
      `target.${capture.capture_id}`,
      a.status,
      "observed",
      a.proof,
      a.status === "confirmed" ? "confirmed" : "candidate",
    );
  }
  refreshIdentity(capture: CaptureStart) {
    const entry = this.captures.get(capture.capture_id);
    if (!entry?.valid || capture.mode !== "live") return;
    const events = this.journal.snapshot(capture.capture_id)?.events ?? [];
    const ids = [
      ...new Set(
        events
          .filter(
            (e) =>
              (e.level === "A" || e.level === "B") &&
              e.association === "confirmed" &&
              e.request_id,
          )
          .map((e) => e.request_id),
      ),
    ];
    if (ids.length === 1) entry.request_id = ids[0] ?? null;
    for (const reading of this.powReadings)
      this.linkPow(reading, capture, entry.request_id);
  }
  socket(id: string, kind: string, event: Event, context: Context) {
    if (kind === "message") return;
    const capture: CaptureStart = {
      capture_id: `network:${context.document_id}:${context.epoch}`,
      context,
      mode: "network",
      transport: "websocket",
      conversation_id: null,
      started_at: this.now(),
    };
    if (!this.captures.has(capture.capture_id)) {
      this.start(capture, null);
      this.journal.terminate(
        capture.capture_id,
        "auxiliary_observation_context",
      );
    }
    if (!this.socketEvents.has(id) && this.socketEvents.size < 32)
      this.socketEvents.set(id, { context, events: [] });
    const saved = this.socketEvents.get(id);
    if (saved && saved.events.length < 3)
      saved.events.push({
        kind,
        code:
          kind === "close" && Number.isInteger((event as CloseEvent).code)
            ? (event as CloseEvent).code
            : null,
        clean:
          kind === "close" &&
          typeof (event as CloseEvent).wasClean === "boolean"
            ? (event as CloseEvent).wasClean
            : null,
      });
    this.append(
      capture,
      `network.websocket.${id}`,
      "event",
      kind,
      "observed",
      "observed_socket_event",
      "orphan",
      id,
    );
    if (kind === "close") {
      const close = event as CloseEvent;
      this.append(
        capture,
        `network.websocket.${id}`,
        "code",
        Number.isInteger(close.code) ? close.code : null,
        Number.isInteger(close.code) ? "observed" : "not_exposed",
        "observed_socket_event",
        "orphan",
        id,
      );
      this.append(
        capture,
        `network.websocket.${id}`,
        "wasClean",
        typeof close.wasClean === "boolean" ? close.wasClean : null,
        typeof close.wasClean === "boolean" ? "observed" : "not_exposed",
        "observed_socket_event",
        "orphan",
        id,
      );
    }
    if (kind === "error")
      this.append(
        capture,
        `network.websocket.${id}`,
        "cause",
        null,
        "unknown",
        "observed_socket_event",
        "orphan",
        id,
      );
  }
  xhr(capture: CaptureStart, xhr: XMLHttpRequest, kind: string) {
    if (["error", "timeout", "abort"].includes(kind)) {
      this.failure(
        capture,
        kind === "abort" ? "abort" : kind === "timeout" ? "timeout" : "generic",
      );
      return;
    }
    if (
      (kind === "readystatechange" && xhr.readyState >= 2) ||
      kind === "load"
    ) {
      if (this.xhrSeen.get(xhr) !== capture.capture_id) {
        this.xhrSeen.set(xhr, capture.capture_id);
        this.commitHttp(
          capture,
          httpEvidence(
            xhr.status,
            (name) => xhr.getResponseHeader(name),
            this.xhrVisibility(xhr),
          ),
        );
      }
      if (kind === "load" && capture.mode === "requirements") {
        try {
          if (xhr.responseType === "json") {
            // Native XHR has already buffered JSON; only fixed registered paths are inspected.
            // No generic stringify/dump is permitted; byte budget cannot be measured here.
            this.append(
              capture,
              "pow.observer",
              "byte_budget",
              null,
              "not_exposed",
            );
            this.pow(capture, xhr.response);
          } else if (xhr.responseType === "" || xhr.responseType === "text") {
            const text = xhr.responseText;
            if (
              text.length > 262144 ||
              new TextEncoder().encode(text).byteLength > 262144
            )
              this.append(
                capture,
                "pow.observer",
                "body_limit",
                true,
                "not_captured",
              );
            else this.pow(capture, JSON.parse(text));
          } else
            this.append(capture, "pow.observer", "body", null, "unsupported");
          this.journal.terminate(
            capture.capture_id,
            "requirements_observation_ended",
          );
        } catch {
          this.append(capture, "pow", "validity", null, "invalid");
        }
      }
      if (
        kind === "load" &&
        (xhr.responseType === "" || xhr.responseType === "text") &&
        xhr.getResponseHeader("content-type")?.includes("text/html")
      ) {
        const indicators = htmlIndicators(xhr.responseText.slice(0, 65536));
        for (const [name, value] of Object.entries(indicators))
          this.append(capture, "network.challenge", name, value);
        const e = httpEvidence(
          xhr.status,
          (name) => xhr.getResponseHeader(name),
          this.xhrVisibility(xhr),
        );
        Object.assign(e.indicators, indicators);
        this.append(capture, "network.verdict", "status", networkVerdict(e));
      }
    }
  }
  private xhrVisibility(xhr: XMLHttpRequest): "readable" | "cors" {
    try {
      return xhr.responseURL &&
        typeof location !== "undefined" &&
        new URL(xhr.responseURL).origin === location.origin
        ? "readable"
        : "cors";
    } catch {
      return "cors";
    }
  }
  reconcile(
    diagnostics: readonly {
      code: string;
      count: number;
      capture_id: string | null;
      socket_id: string | null;
    }[],
  ) {
    for (const entry of this.captures.values()) {
      if (!entry.valid || entry.capture.mode !== "live") continue;
      this.refreshIdentity(entry.capture);
      const events =
        this.journal.snapshot(entry.capture.capture_id)?.events ?? [];
      for (const event of events) {
        if (
          event.transport !== "websocket" ||
          event.association !== "confirmed" ||
          event.level !== "A"
        )
          continue;
        const id = event.transport_segment_id,
          saved = id ? this.socketEvents.get(id) : undefined;
        if (
          !id ||
          !saved ||
          saved.context.document_id !== entry.capture.context.document_id ||
          saved.context.epoch !== entry.capture.context.epoch
        )
          continue;
        for (const [index, data] of saved.events.entries()) {
          const key = `${entry.capture.capture_id}:${id}:${index}`;
          if (this.socketLinks.has(key)) continue;
          this.socketLinks.add(key);
          const cap = { ...entry.capture, transport: "websocket" as const };
          this.append(
            cap,
            `network.websocket.${id}`,
            "event",
            data.kind,
            "observed",
            event.association_proof,
            "confirmed",
            id,
          );
          if (data.kind === "close") {
            this.append(
              cap,
              `network.websocket.${id}`,
              "code",
              data.code,
              data.code === null ? "not_exposed" : "observed",
              event.association_proof,
              "confirmed",
              id,
            );
            this.append(
              cap,
              `network.websocket.${id}`,
              "wasClean",
              data.clean,
              data.clean === null ? "not_exposed" : "observed",
              event.association_proof,
              "confirmed",
              id,
            );
          }
        }
      }
    }
    for (const d of diagnostics) {
      if (
        !d.capture_id ||
        !d.socket_id ||
        !["candidate_reconnect", "confirmed_reconnect"].includes(d.code)
      )
        continue;
      const key = `${d.code}:${d.capture_id}:${d.socket_id}:${d.count}`;
      if (this.reconnectSeen.has(key) || this.reconnectSeen.size >= 512)
        continue;
      this.reconnectSeen.add(key);
      const entry = this.captures.get(d.capture_id);
      if (!entry?.valid) continue;
      this.append(
        { ...entry.capture, transport: "websocket" },
        `network.websocket.${d.socket_id}`,
        "reconnect",
        d.code === "confirmed_reconnect" ? "confirmed" : "candidate",
        "observed",
        d.code === "confirmed_reconnect"
          ? "registered_protocol_resume"
          : "same_topic_new_socket",
        d.code === "confirmed_reconnect" ? "confirmed" : "candidate",
        d.socket_id,
      );
    }
  }
  challengeResource(context: Context, observed: boolean) {
    if (!observed) return;
    const capture: CaptureStart = {
      capture_id: `network:${context.document_id}:${context.epoch}`,
      context,
      mode: "network",
      transport: "fetch",
      conversation_id: null,
      started_at: this.now(),
    };
    if (!this.captures.has(capture.capture_id)) {
      this.start(capture, null);
      this.journal.terminate(
        capture.capture_id,
        "auxiliary_observation_context",
      );
    }
    this.append(
      capture,
      "network.challenge.resource",
      "path_template",
      "/cdn-cgi/challenge-platform/",
      "observed",
      "document_resource_only",
      "orphan",
    );
  }
  failure(capture: CaptureStart, kind: "abort" | "timeout" | "generic") {
    this.append(capture, "network.failure", "category", kind);
    this.append(capture, "network.failure", "cause", null, "unknown");
    this.append(
      capture,
      "network.verdict",
      "status",
      networkVerdict(null, kind),
    );
  }
  event(event: HookEvent) {
    if (
      event.capture_id &&
      ["request_rejected", "request_throw"].includes(event.kind)
    ) {
      const entry = this.captures.get(event.capture_id);
      if (entry) this.failure(entry.capture, event.failure_kind ?? "generic");
    }
  }
  verdict(id: string): NetworkVerdict {
    const events =
      this.journal
        .snapshot(id)
        ?.events.filter(
          (e) =>
            e.field_namespace === "network.verdict" && e.field === "status",
        ) ?? [];
    return (events.at(-1)?.value as NetworkVerdict) ?? "Unknown";
  }
  canReleaseClosed(id: string) {
    return (
      this.journal.state(id).lifecycle === "Closed" && !this.readers.has(id)
    );
  }
  releaseClosedCapture(id: string) {
    if (!this.canReleaseClosed(id)) return false;
    const entry = this.captures.get(id);
    if (entry) entry.valid = false;
    this.captures.delete(id);
    this.powReadings = this.powReadings.filter(
      (r) => r.capture.capture_id !== id,
    );
    for (const key of this.links)
      if (key.startsWith(`${id}:`) || key.includes(`:${id}:`))
        this.links.delete(key);
    for (const key of this.socketLinks)
      if (key.startsWith(`${id}:`)) this.socketLinks.delete(key);
    for (const key of this.reconnectSeen)
      if (key.includes(`:${id}:`)) this.reconnectSeen.delete(key);
    return true;
  }
  reset(context: Context, reason: string) {
    for (const entry of this.captures.values())
      if (
        ["pause", "clear", "dispose"].includes(reason) ||
        entry.capture.context.document_id !== context.document_id ||
        entry.capture.mode === "requirements"
      )
        entry.valid = false;
    if (["pause", "clear", "dispose"].includes(reason)) {
      this.powReadings = [];
      this.links.clear();
      this.generation++;
      for (const reader of this.readers.values())
        void reader.cancel().catch(() => {});
      this.readers.clear();
      this.xhrSeen = new WeakMap();
      this.socketEvents.clear();
      this.socketLinks.clear();
      this.reconnectSeen.clear();
      if (reason === "clear") this.captures.clear();
    }
  }
}
