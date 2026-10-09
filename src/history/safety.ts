import type { Journal, Occurrence } from "../core/journal.ts";
import { identifier, type Scalar, type Level } from "../core/route.ts";
import { normalizeAsset } from "../core/assets.ts";

export const HISTORY_SCHEMA = "history-2";
export const REDACTION_VERSION = "redaction-1";
export type Snapshot = NonNullable<ReturnType<Journal["snapshot"]>>;
const secret =
  /(?:secret|canary|access.?token|session.?token|authorization|cookie|csrf|password|credential|payment|bearer)/i;
export function safeWord(v: unknown, limit = 128): string | null {
  return typeof v === "string" &&
    v.length <= limit &&
    !secret.test(v) &&
    /^[a-zA-Z0-9_.: /@#=[\](),-]+$/.test(v)
    ? v
    : null;
}
function id(v: unknown): string | null {
  return identifier(v) && !secret.test(String(v)) ? String(v) : null;
}
export function registeredLevel(
  e: Pick<
    Occurrence,
    | "field_namespace"
    | "field"
    | "source_path"
    | "direction"
    | "transport"
    | "endpoint_verified"
  >,
): Level | null {
  const ns = e.field_namespace,
    f = e.field,
    path = e.source_path;
  if (
    e.direction === "outbound" &&
    e.endpoint_verified &&
    ["request", "request.reasoning_options"].includes(ns) &&
    [
      "model",
      "thinking_effort",
      "reasoning_effort",
      "requested_model_experience",
    ].includes(f) &&
    [
      "/model",
      "/thinking_effort",
      "/requested_model_experience",
      "/model_configuration/reasoning_effort",
      "/reasoning_options/reasoning_effort",
      "/reasoning_options/thinking_effort",
    ].includes(path)
  )
    return "B";
  if (e.direction === "inbound" && e.endpoint_verified) {
    if (
      ns === "server_ste_metadata" &&
      f === "model_slug" &&
      [
        "/metadata/model_slug",
        "/message/metadata/server_ste_metadata/model_slug",
      ].includes(path)
    )
      return "A";
    if (
      ns === "resolved" &&
      f === "resolved_model_slug" &&
      [
        "/metadata/resolved_model_slug",
        "/resolved_model_slug",
        "/message/metadata/resolved_model_slug",
      ].includes(path)
    )
      return "A";
    if (
      ns === "assistant.metadata" &&
      f === "model_slug" &&
      path === "/message/metadata/model_slug"
    )
      return "C";
    if (
      ["response", "response.echo"].includes(ns) &&
      ["thinking_effort", "fast_convo", "requested_model_experience"].includes(
        f,
      ) &&
      path === `/message/metadata/${f}`
    )
      return "C";
  }
  if (
    ns === "dom" &&
    f === "model_slug" &&
    path === "/@data-message-model-slug" &&
    e.transport === "dom" &&
    e.direction === "local"
  )
    return "D";
  const fields: Record<string, string[]> = {
    "network.http": ["http_status"],
    "network.headers": [
      "content-type",
      "cf-mitigated",
      "cf-ray",
      "server",
      "server-timing.availability",
      "retry-after.seconds",
      "retry-after.date",
    ],
    "network.verdict": ["status"],
    "network.failure": ["category", "cause"],
    "network.challenge": [
      "html",
      "challenge_resource_template",
      "registered_html_structure",
    ],
    "network.observer": ["body"],
    pow: [
      "raw_hex",
      "decimal",
      "source_path",
      "request_id",
      "association_status",
      "validity",
    ],
    "pow.association": [
      "association_status",
      "proof",
      "delta_ms",
      "requirements_capture_id",
    ],
    "pow.observer": ["body", "byte_budget"],
    "environment.reference": ["snapshot_id", "reason"],
    "environment.snapshot": ["snapshot_id", "reason"],
    "environment.fields": [
      "user_agent",
      "browser",
      "browser_major",
      "platform",
      "os",
      "os_uncertainty",
      "consistency",
      "ua_data_availability",
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
    ],
    "frontend.assets": [
      "asset_set_hash",
      "normalization_version",
      "resource_count",
      "overflow",
      "completeness",
      "window_start_ms",
      "window_end_ms",
      "resource_timing_availability",
      "performance_observer_availability",
    ],
    "frontend.markers": ["build_id", "deployment_marker", "conflict"],
    "frontend.service_worker": [
      "availability",
      "controller_url",
      "controller_state",
    ],
  };
  const allowed =
    fields[ns]?.includes(f) ||
    (ns === "network.challenge.resource" && f === "path_template") ||
    (ns === "pow.association" && /^target\.[a-zA-Z0-9_.:-]{1,128}$/.test(f)) ||
    (/^network\.server-timing\.\d{1,2}$/.test(ns) &&
      ["metric_name", "dur"].includes(f)) ||
    (/^frontend\.asset\.\d{1,3}$/.test(ns) &&
      ["url", "asset_url_token"].includes(f)) ||
    (ns === "frontend.service_worker" &&
      /^registration\.\d{1,2}\.(url|state)$/.test(f)) ||
    (/^network\.websocket\.[a-zA-Z0-9_.:-]{1,128}$/.test(ns) &&
      [
        "segment_id",
        "event",
        "code",
        "wasClean",
        "reconnect",
        "association_status",
        "proof",
      ].includes(f));
  if (!allowed) return null;
  if (ns.startsWith("network.")) return "N";
  if (
    ns.startsWith("pow") ||
    ns.startsWith("environment.") ||
    ns.startsWith("frontend.")
  )
    return "E";
  return null;
}
function value(e: Occurrence, v: unknown): Scalar {
  if (v === null || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (
    typeof v !== "string" ||
    secret.test(v) ||
    [...v].some((c) => c.charCodeAt(0) < 32) ||
    /[<>`\\]|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(v)
  )
    return null;
  if (e.field === "url" || e.field.endsWith("_url") || /\.url$/.test(e.field))
    return normalizeAsset(v, "", "storage", "").asset?.url ?? null;
  if (e.field === "origin") {
    try {
      const u = new URL(v);
      return ["https:", "http:"].includes(u.protocol) && u.origin === v
        ? v
        : null;
    } catch {
      return null;
    }
  }
  if (e.field === "user_agent") return v.length <= 512 ? v : null;
  if (e.field === "content-type")
    return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(v) ? v : null;
  if (e.field === "timezone")
    return /^[a-zA-Z_]+(?:\/[a-zA-Z_+-]+){0,2}$/.test(v) ? v : null;
  if (e.field === "languages")
    try {
      const a = JSON.parse(v);
      return Array.isArray(a) &&
        a.length <= 16 &&
        a.every(
          (x) =>
            typeof x === "string" &&
            /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(x),
        )
        ? JSON.stringify(a)
        : null;
    } catch {
      return null;
    }
  if (e.field.endsWith(".date"))
    return /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(v) ? v : null;
  return safeWord(v, e.field === "decimal" ? 1024 : 256);
}
export function safeOccurrence(input: Occurrence): Occurrence | null {
  const level = registeredLevel(input);
  if (!level || level !== input.level) return null;
  const capture = id(input.capture_id),
    event = id(input.event_id),
    doc = id(input.document_id),
    visit = id(input.visit_id);
  if (
    !capture ||
    !event ||
    !doc ||
    !visit ||
    !Number.isInteger(input.event_index) ||
    input.event_index < 1
  )
    return null;
  const v = value(input, input.value);
  const out: Occurrence = {
    capture_id: capture,
    event_id: event,
    document_id: doc,
    visit_id: visit,
    epoch: input.epoch,
    event_index: input.event_index,
    timestamp: /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(input.timestamp)
      ? input.timestamp
      : "",
    monotonic_ms: input.monotonic_ms,
    task_scope: safeWord(input.task_scope) ?? "unknown",
    message_id: id(input.message_id),
    transport: input.transport,
    direction: input.direction,
    association: input.association,
    association_proof: safeWord(input.association_proof) ?? "unknown",
    endpoint_verified: input.endpoint_verified,
    channel: safeWord(input.channel) ?? "unknown",
    transport_segment_id: id(input.transport_segment_id) ?? capture,
    field_namespace: input.field_namespace,
    field: input.field,
    level,
    value: v,
    value_state:
      input.value !== null && v === null ? "invalid" : input.value_state,
    source_path: safeWord(input.source_path, 512) ?? "unknown",
    source_type: safeWord(input.source_type) ?? "unknown",
    raw_source_type: safeWord(input.raw_source_type) ?? "unknown",
    schema_version: safeWord(input.schema_version) ?? "unknown",
    adapter_version: safeWord(input.adapter_version) ?? "unknown",
    rule_version: safeWord(input.rule_version) ?? "unknown",
    old_value: value(input, input.old_value),
    old_value_state: input.old_value_state,
    new_value: v,
    arrival_index: input.arrival_index,
    decode_index: input.decode_index,
    envelope_id: id(input.envelope_id),
    delta_op: safeWord(input.delta_op),
    request_id: id(input.request_id),
    conversation_id: id(input.conversation_id),
    parent_message_id: id(input.parent_message_id),
    parser_status: safeWord(input.parser_status) ?? "unknown",
    observed_vs_declared_time: "observed",
    late_metadata: input.late_metadata,
    revision: input.revision,
    delta_header: input.delta_header
      ? {
          path: safeWord(input.delta_header.path, 512) ?? "unknown",
          channel: safeWord(input.delta_header.channel) ?? "unknown",
          explicit: {
            c: input.delta_header.explicit.c,
            p: input.delta_header.explicit.p,
            o: input.delta_header.explicit.o,
          },
        }
      : null,
    envelope_event: safeWord(input.envelope_event),
    envelope_retry: input.envelope_retry,
    availability: safeWord(input.availability) ?? "unknown",
    privacy_class: safeWord(input.privacy_class) ?? "safe_metadata",
    observed_at: input.timestamp,
  };
  return out;
}
export function safeSnapshot(s: Snapshot): Snapshot {
  const events = s.events
    .map(safeOccurrence)
    .filter((e): e is Occurrence => e !== null);
  const controls = s.controls.slice(0, 2049).map((c) => ({
    kind: [
      "started",
      "complete",
      "health",
      "closed",
      "invalidated",
      "segment_eof",
    ].includes(c.kind)
      ? c.kind
      : "health",
    monotonic_ms: c.monotonic_ms,
    timestamp: /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(c.timestamp)
      ? c.timestamp
      : "",
    code: safeWord(c.code) ?? "redacted",
    health: ["Complete", "Partial", "Failed", "Unknown"].includes(c.health)
      ? c.health
      : "Partial",
  }));
  if (events.length !== s.events.length)
    controls.push({
      kind: "health",
      monotonic_ms: s.start.started_at,
      timestamp: new Date().toISOString(),
      code: "storage_redaction_drop",
      health: "Partial",
    });
  return {
    start: {
      capture_id: id(s.start.capture_id) ?? "invalid",
      context: {
        document_id: id(s.start.context.document_id) ?? "invalid",
        visit_id: id(s.start.context.visit_id) ?? "invalid",
        epoch: s.start.context.epoch,
      },
      mode: s.start.mode,
      endpoint_path: safeWord(s.start.endpoint_path) ?? undefined,
      transport: s.start.transport,
      conversation_id: id(s.start.conversation_id),
      started_at: s.start.started_at,
    },
    events,
    controls,
    control_dropped: s.control_dropped,
  };
}
export class ExportRedactor {
  private ids = new Map<string, string>();
  pseudonym(kind: string, v: string | null): string | null {
    if (!v) return null;
    const key = `${kind}:${v}`;
    if (!this.ids.has(key))
      this.ids.set(
        key,
        `${kind}-${[...this.ids.keys()].filter((k) => k.startsWith(kind + ":")).length + 1}`,
      );
    return this.ids.get(key)!;
  }
  snapshot(s: Snapshot): Snapshot {
    const safe = safeSnapshot(s);
    const events = safe.events.map((e) => {
      const out = { ...e };
      if (e.field_namespace.startsWith("network.websocket."))
        out.field_namespace =
          "network.websocket." +
          this.pseudonym(
            "segment",
            e.field_namespace.slice("network.websocket.".length),
          );
      if (
        e.field_namespace === "pow.association" &&
        e.field.startsWith("target.")
      )
        out.field = "target." + this.pseudonym("capture", e.field.slice(7));
      for (const [key, kind] of [
        ["capture_id", "capture"],
        ["event_id", "event"],
        ["document_id", "document"],
        ["visit_id", "visit"],
        ["message_id", "message"],
        ["request_id", "request"],
        ["conversation_id", "conversation"],
        ["parent_message_id", "message"],
        ["transport_segment_id", "segment"],
        ["envelope_id", "envelope"],
      ] as const) {
        const mapped = this.pseudonym(kind, e[key]);
        if (mapped !== null) out[key] = mapped;
      }
      if (
        e.field === "cf-ray" ||
        e.field === "request_id" ||
        e.field === "requirements_capture_id" ||
        e.field === "snapshot_id" ||
        e.field === "segment_id"
      ) {
        const kind =
          e.field === "cf-ray"
            ? "ray"
            : e.field === "request_id"
              ? "request"
              : e.field === "requirements_capture_id"
                ? "capture"
                : "segment";
        out.value = this.pseudonym(
          kind,
          typeof e.value === "string" ? e.value : null,
        );
        out.new_value = out.value;
        out.old_value = this.pseudonym(
          kind,
          typeof e.old_value === "string" ? e.old_value : null,
        );
      }
      if (e.field_namespace === "environment.fields") {
        const coarse = (v: Scalar): Scalar =>
          e.field === "user_agent" ||
          e.field === "origin" ||
          e.field === "client_ip"
            ? null
            : typeof v === "number" && /(width|height)/.test(e.field)
              ? Math.round(v / 200) * 200
              : typeof v === "number" && /(memory|concurrency)/.test(e.field)
                ? 2 ** Math.floor(Math.log2(Math.max(1, v)))
                : v;
        out.value = coarse(out.value);
        out.old_value = coarse(out.old_value);
        out.new_value = out.value;
        if (out.value === null) out.availability = "redacted";
      }
      return out;
    });
    return {
      ...safe,
      start: {
        ...safe.start,
        capture_id: this.pseudonym("capture", safe.start.capture_id)!,
        conversation_id: this.pseudonym(
          "conversation",
          safe.start.conversation_id,
        ),
        context: {
          ...safe.start.context,
          document_id: this.pseudonym(
            "document",
            safe.start.context.document_id,
          )!,
          visit_id: this.pseudonym("visit", safe.start.context.visit_id)!,
        },
      },
      events,
    };
  }
}
