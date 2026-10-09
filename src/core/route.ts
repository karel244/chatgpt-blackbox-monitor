export const SCHEMA_VERSION = "1.0";
export const RULE_VERSION = "route-1";
export const ADAPTER_VERSION = "metadata-1";
export type Level = "A" | "B" | "C" | "D" | "N" | "E";
export type Completeness = "Complete" | "Partial" | "Failed" | "Unknown";
export type Scalar = string | boolean | number | null;
export interface Source {
  capture_id: string;
  task_scope: string;
  message_id: string | null;
  transport: "fetch" | "xhr" | "websocket" | "reload" | "dom";
  direction: "inbound" | "outbound" | "local";
  association: "confirmed" | "candidate" | "ambiguous" | "orphan";
  association_proof: string;
  endpoint_verified: boolean;
  channel: string;
  transport_segment_id: string;
}
export interface Evidence extends Source {
  availability?: string;
  privacy_class?: string;
  observed_at?: string;
  field_namespace: string;
  field: string;
  level: Level;
  value: Scalar;
  value_state: "value" | "explicit_null" | "removed" | "invalid";
  source_path: string;
  source_type: string;
  raw_source_type: string;
  schema_version: string;
  adapter_version: string;
  rule_version: string;
}
export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function identifier(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value)
    ? value
    : null;
}
function field(
  source: Source,
  namespace: string,
  key: string,
  value: unknown,
  level: Level,
  path: string,
): Evidence {
  const scalar =
    value === null || (key === "fast_convo" && typeof value === "boolean")
      ? value
      : identifier(value);
  return {
    ...source,
    field_namespace: namespace,
    field: key,
    level,
    value: scalar,
    value_state:
      value === null ? "explicit_null" : scalar === null ? "invalid" : "value",
    source_path: path,
    source_type:
      level === "B"
        ? "request"
        : level === "D"
          ? "dom_label"
          : "supported_metadata",
    raw_source_type: source.transport,
    schema_version: SCHEMA_VERSION,
    adapter_version: ADAPTER_VERSION,
    rule_version: RULE_VERSION,
  };
}
function take(
  output: Evidence[],
  source: Source,
  container: unknown,
  entries: [string, string, Level][],
  prefix: string,
) {
  const object = record(container);
  if (!object) return;
  for (const [key, namespace, level] of entries)
    if (Object.hasOwn(object, key))
      output.push(
        field(source, namespace, key, object[key], level, `${prefix}/${key}`),
      );
}
export function requestEvidence(value: unknown, source: Source): Evidence[] {
  if (!source.endpoint_verified || source.direction !== "outbound") return [];
  const result: Evidence[] = [];
  take(
    result,
    source,
    value,
    [
      ["model", "request", "B"],
      ["thinking_effort", "request", "B"],
      ["requested_model_experience", "request", "B"],
    ],
    "",
  );
  const config = record(record(value)?.model_configuration);
  take(
    result,
    source,
    config,
    [["reasoning_effort", "request", "B"]],
    "/model_configuration",
  );
  take(
    result,
    source,
    record(value)?.reasoning_options,
    [
      ["reasoning_effort", "request.reasoning_options", "B"],
      ["thinking_effort", "request.reasoning_options", "B"],
    ],
    "/reasoning_options",
  );
  return result;
}
export function responseEvidence(value: unknown, source: Source): Evidence[] {
  if (!source.endpoint_verified || source.direction !== "inbound") return [];
  const root = record(value);
  if (!root) return [];
  if (
    root.type !== undefined &&
    !["server_ste_metadata", "message", "response_metadata"].includes(
      String(root.type),
    )
  )
    return [];
  if (["user", "tool"].includes(String(record(root.author)?.role))) return [];
  const result: Evidence[] = [];
  // Exact registered containers only: no recursion through content/tool payloads.
  if (root.type === "server_ste_metadata") {
    take(
      result,
      source,
      root.metadata,
      [
        ["model_slug", "server_ste_metadata", "A"],
        ["resolved_model_slug", "resolved", "A"],
      ],
      "/metadata",
    );
  }
  take(result, source, root, [["resolved_model_slug", "resolved", "A"]], "");
  const message = record(root.message);
  if (record(message?.author)?.role === "assistant") {
    const scoped = {
      ...source,
      message_id: identifier(message?.id) ?? source.message_id,
    };
    const metadata = record(message?.metadata);
    take(
      result,
      scoped,
      metadata,
      [
        ["model_slug", "assistant.metadata", "C"],
        ["thinking_effort", "response", "C"],
        ["fast_convo", "response", "C"],
        ["requested_model_experience", "response.echo", "C"],
        ["resolved_model_slug", "resolved", "A"],
      ],
      "/message/metadata",
    );
    take(
      result,
      scoped,
      metadata?.server_ste_metadata,
      [["model_slug", "server_ste_metadata", "A"]],
      "/message/metadata/server_ste_metadata",
    );
  }
  return result;
}
export function domEvidence(slug: unknown, source: Source): Evidence[] {
  if (source.direction !== "local" || source.transport !== "dom") return [];
  return [
    field(source, "dom", "model_slug", slug, "D", "/@data-message-model-slug"),
  ];
}
export interface Verdict {
  actual_route: string;
  verdict:
    | "Unknown"
    | "Conflict"
    | "Route Match"
    | "Route Mismatch"
    | "Not comparable";
  coverage: "no-A" | "single-A" | "dual-A" | "conflict";
  candidates: string[];
  label_mismatch: boolean;
  evidence_completeness: Completeness;
  scope_limit: string;
  rule_version: string;
}
export function verdict(
  events: readonly Evidence[],
  capture: string,
  scope: string,
  completeness: Completeness = "Unknown",
  ruleVersion = RULE_VERSION,
): Verdict {
  const selected = events.filter(
    (e) =>
      e.capture_id === capture &&
      e.task_scope === scope &&
      e.association === "confirmed",
  );
  const a = selected.filter(
    (e) =>
      e.level === "A" &&
      e.value_state === "value" &&
      typeof e.value === "string",
  );
  const candidates = [...new Set(a.map((e) => String(e.value)))];
  const result: Verdict = {
    actual_route: "Unknown",
    verdict: "Unknown",
    coverage: "no-A",
    candidates,
    label_mismatch: false,
    evidence_completeness: completeness,
    scope_limit:
      completeness === "Complete"
        ? "supported associated observed segments only"
        : "based on partial or unconfirmed capture coverage",
    rule_version: ruleVersion,
  };
  if (!candidates.length) return result;
  if (candidates.length > 1)
    return {
      ...result,
      actual_route: "Conflict",
      verdict: "Conflict",
      coverage: "conflict",
    };
  const actual = candidates[0]!;
  result.actual_route = actual;
  result.coverage =
    new Set(a.map((e) => e.field_namespace)).size > 1 ? "dual-A" : "single-A";
  const requested = [
    ...new Set(
      selected
        .filter(
          (e) =>
            e.level === "B" &&
            e.field_namespace === "request" &&
            e.field === "model" &&
            e.value_state === "value",
        )
        .map((e) => String(e.value)),
    ),
  ];
  // Explicit alias names are non-comparable; lexical tiers/generations are never consulted.
  const nonComparable = new Set([
    "auto",
    "default",
    "latest",
    "thinking",
    "fast",
    "instant",
    "chatgpt",
  ]);
  result.verdict =
    requested.length !== 1 || nonComparable.has(requested[0]!)
      ? "Not comparable"
      : requested[0] === actual
        ? "Route Match"
        : "Route Mismatch";
  result.label_mismatch = selected.some(
    (e) =>
      (e.level === "C" || e.level === "D") &&
      e.field === "model_slug" &&
      e.value_state === "value" &&
      e.value !== actual,
  );
  return result;
}
