import { safeAssociation } from "../compare/compare.ts";
import { projectState, type Occurrence } from "../core/journal.ts";
import { verdict } from "../core/route.ts";
import {
  ExportRedactor,
  REDACTION_VERSION,
  safeSnapshot,
  safeWord,
  type Snapshot,
} from "./safety.ts";
import { digest, encode } from "./storage.ts";
import { zipFiles, unzipFiles } from "./zip.ts";
export const BUNDLE_SCHEMA = "bundle-1";
export const BUNDLE_FILES = [
  "manifest.json",
  "summary.json",
  "timeline.jsonl",
  "network_metadata.json",
  "environment.json",
  "comparison.json",
  "report.md",
].map((n) => "evidence/" + n);
export interface BundleManifest {
  schema_version: string;
  tool_version: string;
  adapter_versions: string[];
  rule_versions: string[];
  redaction_version: string;
  export_id: string;
  experiment_id: string | null;
  run_id: string | null;
  revision: number;
  export_time: string;
  as_of: string;
  scope: string[];
  files: { path: string; sha256: string; bytes: number; records: number }[];
  source_completeness: string;
  notes: string[];
}
export function summarize(s: Snapshot, related: Snapshot[] = []) {
  const health = projectState(s),
    route = verdict(
      s.events,
      s.start.capture_id,
      "answer",
      health.completeness,
    );
  const final = s.controls.find((c) => c.kind === "complete");
  const content = s.events.find(
    (e) => e.field_namespace === "timing" && e.field === "first_content",
  );
  const network =
    s.events
      .filter(
        (e) =>
          e.level === "N" &&
          e.field_namespace === "network.verdict" &&
          e.field === "status",
      )
      .at(-1)?.value ?? "Unknown";
  return {
    schema_version: BUNDLE_SCHEMA,
    start: s.start,
    controls: s.controls,
    control_dropped: s.control_dropped,
    related_contexts: related.map(
      ({ events: _events, ...metadata }) => metadata,
    ),
    A: s.events.filter((e) => e.level === "A"),
    B: s.events.filter((e) => e.level === "B"),
    C: s.events.filter((e) => e.level === "C"),
    D: s.events.filter((e) => e.level === "D"),
    availability: {
      A: route.coverage === "no-A" ? "unknown" : "observed",
      N: network === "Unknown" ? "unknown" : "observed",
    },
    route_verdict: route,
    network_verdict: network,
    display_mismatch: route.label_mismatch,
    timing: {
      definition: "client_request_start_to_protocol_done",
      total_ms:
        s.start.mode === "reload" || !final
          ? null
          : Math.max(0, final.monotonic_ms - s.start.started_at),
      elapsed_ms: null,
      first_content_ms: content
        ? content.monotonic_ms - s.start.started_at
        : null,
      first_visible_output_ms: null,
      confirmation: health.lifecycle,
    },
    capture_health: health,
    supporting_event_ids: s.events
      .filter((e) => ["A", "B", "N"].includes(e.level))
      .map((e) => e.event_id),
  };
}
export type Summary = ReturnType<typeof summarize>;
export interface Bundle {
  manifest: BundleManifest;
  summary: Summary;
  snapshot: Snapshot;
  related: Snapshot[];
  comparison: unknown;
  verified: true;
  read_only: boolean;
}
export function escapeMarkdown(v: unknown) {
  return String(v)
    .replace(/[&<>`[\]()|\\*_#!]/g, (c) => `&#${c.charCodeAt(0)};`)
    .replace(/[\r\n]/g, " ")
    .slice(0, 1024);
}
export function report(summary: Summary) {
  return `# Local Evidence Report\n\nDigest verifies package integrity, not a server signature.\n\nRoute: ${escapeMarkdown(summary.route_verdict.verdict)}\nServer-reported route: ${escapeMarkdown(summary.route_verdict.actual_route)}\nNetwork: ${escapeMarkdown(summary.network_verdict)}\nCapture: ${escapeMarkdown(summary.capture_health.completeness)}\nClient total ms: ${escapeMarkdown(summary.timing.total_ms ?? "Unknown")}\n\nNo client timing inference about reasoning budget.\n`;
}
export async function exportBundle(
  snapshot: Snapshot,
  toolVersion: string,
  association: { experiment_id?: string; run_id?: string } = {},
  comparison: unknown = { state: "not_compared" },
  related: Snapshot[] = [],
) {
  const redactor = new ExportRedactor();
  const s = redactor.snapshot(snapshot),
    contexts = related.slice(0, 32).map((x) => redactor.snapshot(x)),
    all = [...s.events, ...contexts.flatMap((x) => x.events)],
    summary = summarize(s, contexts),
    files = new Map<string, Uint8Array>();
  const timeline = new TextEncoder().encode(
    all.map((e) => JSON.stringify(e)).join("\n") + (all.length ? "\n" : ""),
  );
  files.set("evidence/summary.json", encode(summary));
  files.set("evidence/timeline.jsonl", timeline);
  files.set(
    "evidence/network_metadata.json",
    encode(
      all.filter((e) => e.level === "N" || e.field_namespace.startsWith("pow")),
    ),
  );
  files.set(
    "evidence/environment.json",
    encode(
      all.filter(
        (e) => e.level === "E" && !e.field_namespace.startsWith("pow"),
      ),
    ),
  );
  // P8 supplies only its validated structured comparison projection; no freeform imported report.
  const runAssociation = safeAssociation(comparison);
  files.set("evidence/comparison.json", encode(runAssociation));
  files.set("evidence/report.md", new TextEncoder().encode(report(summary)));
  const manifest: BundleManifest = {
    schema_version: BUNDLE_SCHEMA,
    tool_version: toolVersion,
    adapter_versions: [...new Set(all.map((e) => e.adapter_version))],
    rule_versions: [...new Set(all.map((e) => e.rule_version))],
    redaction_version: REDACTION_VERSION,
    export_id: crypto.randomUUID(),
    experiment_id:
      association.experiment_id &&
      /^[a-f0-9-]{36}$/i.test(association.experiment_id)
        ? association.experiment_id
        : null,
    run_id:
      association.run_id && /^[a-f0-9-]{36}$/i.test(association.run_id)
        ? association.run_id
        : null,
    revision: summary.capture_health.revision,
    export_time: new Date().toISOString(),
    as_of:
      s.events.at(-1)?.timestamp ??
      s.controls.at(-1)?.timestamp ??
      new Date().toISOString(),
    scope: [...new Set(all.map((e) => e.task_scope))],
    files: [],
    source_completeness: summary.capture_health.completeness,
    notes: [
      ...new Set(
        s.controls.filter((c) => c.kind === "health").map((c) => c.code),
      ),
      ...(s.control_dropped ? ["control_drop"] : []),
    ],
  };
  for (const [path, data] of files)
    manifest.files.push({
      path,
      sha256: await digest(data),
      bytes: data.length,
      records: path.endsWith("timeline.jsonl")
        ? all.length
        : path.endsWith("network_metadata.json")
          ? all.filter(
              (e) => e.level === "N" || e.field_namespace.startsWith("pow"),
            ).length
          : path.endsWith("environment.json")
            ? all.filter(
                (e) => e.level === "E" && !e.field_namespace.startsWith("pow"),
              ).length
            : 1,
    });
  files.set("evidence/manifest.json", encode(manifest));
  return {
    bytes: zipFiles(files),
    manifest,
    summary,
    preview: {
      source_events:
        snapshot.events.length +
        related.reduce((n, r) => n + r.events.length, 0),
      export_events: all.length,
      id_mapping: "bundle-local",
      removed: ["full UA", "origin", "client IP", "authentication", "content"],
      coarsened: ["screen/viewport", "hardware"],
      as_of: manifest.as_of,
      revision: manifest.revision,
    },
  };
}
function parse(data: Uint8Array) {
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(data),
    (key, value) => {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw Error("unsafe_json_key");
      return value;
    },
  );
}
function same(a: unknown, b: unknown) {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([, value]) => value !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, canonical(value)]),
          )
        : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
export async function importBundle(bytes: Uint8Array): Promise<Bundle> {
  const files = await unzipFiles(bytes, BUNDLE_FILES),
    m = parse(files.get("evidence/manifest.json")!) as BundleManifest;
  if (
    m.schema_version !== BUNDLE_SCHEMA ||
    m.redaction_version !== REDACTION_VERSION
  )
    throw Error("unsupported_bundle_schema");
  const uuid = (v: unknown) =>
    typeof v === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
  const allowed = [
    "schema_version",
    "tool_version",
    "adapter_versions",
    "rule_versions",
    "redaction_version",
    "export_id",
    "experiment_id",
    "run_id",
    "revision",
    "export_time",
    "as_of",
    "scope",
    "files",
    "source_completeness",
    "notes",
  ];
  if (
    Object.keys(m).some((k) => !allowed.includes(k)) ||
    !uuid(m.export_id) ||
    (m.experiment_id !== null && !uuid(m.experiment_id)) ||
    (m.run_id !== null && !uuid(m.run_id)) ||
    !safeWord(m.tool_version) ||
    ![m.adapter_versions, m.rule_versions, m.notes, m.scope].every(
      (a) =>
        Array.isArray(a) &&
        a.length <= 256 &&
        a.every((x) => safeWord(x) !== null),
    ) ||
    ![m.export_time, m.as_of].every(
      (x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(x),
    )
  )
    throw Error("invalid_manifest_metadata");
  if (
    !Array.isArray(m.files) ||
    m.files.length !== 6 ||
    new Set(m.files.map((f) => f.path)).size !== 6
  )
    throw Error("invalid_file_manifest");
  for (const ref of m.files) {
    const b = files.get(ref.path);
    if (
      !b ||
      ref.path === "evidence/manifest.json" ||
      ref.bytes !== b.length ||
      ref.sha256 !== (await digest(b))
    )
      throw Error("bundle_digest_mismatch");
  }
  const summary = parse(files.get("evidence/summary.json")!) as Summary;
  const text = new TextDecoder("utf-8", { fatal: true }).decode(
    files.get("evidence/timeline.jsonl")!,
  );
  const lines = text
    ? (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n")
    : [];
  if (lines.length > 640000) throw Error("timeline_count_limit");
  const events = lines.map((line) => {
    if (new TextEncoder().encode(line).length > 65536)
      throw Error("jsonl_line_limit");
    return parse(new TextEncoder().encode(line)) as Occurrence;
  });
  if (
    !summary.start ||
    !Array.isArray(summary.controls) ||
    summary.controls.length > 2050
  )
    throw Error("invalid_summary");
  const metadata = summary.related_contexts;
  if (!Array.isArray(metadata) || metadata.length > 32)
    throw Error("related_context_limit");
  const captureIDs = [
    summary.start.capture_id,
    ...metadata.map((s) => s.start.capture_id),
  ];
  if (new Set(captureIDs).size !== captureIDs.length)
    throw Error("duplicate_capture_id");
  const previous = new Map<string, number>();
  const ids = new Set<string>();
  const declaredRedaction = new Set(
    [{ start: summary.start, controls: summary.controls }, ...metadata]
      .filter((s) =>
        s.controls?.some(
          (c) =>
            c.kind === "health" &&
            c.code === "storage_redaction_drop" &&
            c.health === "Partial" &&
            Number.isFinite(c.monotonic_ms),
        ),
      )
      .map((s) => s.start.capture_id),
  );
  for (const e of events) {
    const before = previous.get(e.capture_id) ?? 0;
    if (
      !Number.isSafeInteger(e.event_index) ||
      e.event_index <= before ||
      (e.event_index !== before + 1 && !declaredRedaction.has(e.capture_id)) ||
      ids.has(e.event_id) ||
      !captureIDs.includes(e.capture_id) ||
      !Number.isFinite(e.monotonic_ms) ||
      !["fetch", "xhr", "websocket", "reload", "dom"].includes(e.transport) ||
      !["inbound", "outbound", "local"].includes(e.direction) ||
      !["confirmed", "candidate", "ambiguous", "orphan"].includes(
        e.association,
      ) ||
      !["value", "invalid", "removed", "explicit_null"].includes(e.value_state)
    )
      throw Error("invalid_timeline_sequence_or_source");
    previous.set(e.capture_id, e.event_index);
    ids.add(e.event_id);
  }
  const snapshot: Snapshot = {
    start: summary.start,
    events: events.filter((e) => e.capture_id === summary.start.capture_id),
    controls: summary.controls,
    control_dropped: summary.control_dropped,
  };
  const related = metadata.map((meta) => ({
    ...meta,
    events: events.filter((e) => e.capture_id === meta.start.capture_id),
  }));
  for (const context of related) {
    if (
      !same(safeSnapshot(context), context) ||
      !["environment", "network", "requirements"].includes(
        context.start.mode,
      ) ||
      context.events.some((e) => !["N", "E"].includes(e.level))
    )
      throw Error("unsafe_related_context");
  }
  const safe = safeSnapshot(snapshot);
  if (!same(safe, snapshot)) throw Error("unsafe_or_unregistered_projection");
  // Imported grades/verdicts are not trusted: registered provenance and all projections are recomputed.
  const recomputed = summarize(safe, related);
  if (!same(summary, recomputed)) throw Error("summary_projection_mismatch");
  if (
    !same(
      parse(files.get("evidence/network_metadata.json")!),
      events.filter(
        (e) => e.level === "N" || e.field_namespace.startsWith("pow"),
      ),
    ) ||
    !same(
      parse(files.get("evidence/environment.json")!),
      events.filter(
        (e) => e.level === "E" && !e.field_namespace.startsWith("pow"),
      ),
    )
  )
    throw Error("auxiliary_projection_mismatch");
  for (const ref of m.files) {
    const expected = ref.path.endsWith("timeline.jsonl")
      ? events.length
      : ref.path.endsWith("network_metadata.json")
        ? events.filter(
            (e) => e.level === "N" || e.field_namespace.startsWith("pow"),
          ).length
        : ref.path.endsWith("environment.json")
          ? events.filter(
              (e) => e.level === "E" && !e.field_namespace.startsWith("pow"),
            ).length
          : 1;
    if (ref.records !== expected) throw Error("record_count_mismatch");
  }
  if (
    m.revision !== recomputed.capture_health.revision ||
    m.source_completeness !== recomputed.capture_health.completeness ||
    !same(m.adapter_versions, [
      ...new Set(events.map((e) => e.adapter_version)),
    ]) ||
    !same(m.rule_versions, [...new Set(events.map((e) => e.rule_version))])
  )
    throw Error("manifest_projection_mismatch");
  // report.md is checked for integrity but NEVER rendered/executed; regenerate from verified structures.
  if (
    new TextDecoder().decode(files.get("evidence/report.md")!) !==
    report(recomputed)
  )
    throw Error("unsafe_report");
  const rawComparison = parse(files.get("evidence/comparison.json")!);
  const comparison = safeAssociation(rawComparison);
  if (!same(comparison, rawComparison))
    throw Error("unsupported_comparison_schema");
  if (
    comparison.run &&
    (comparison.run.descriptor.experiment_uuid !== m.experiment_id ||
      comparison.run.run_id !== m.run_id)
  )
    throw Error("experiment_manifest_mismatch");
  return {
    manifest: m,
    summary: recomputed,
    snapshot: safe,
    related,
    comparison,
    verified: true,
    read_only: events.some(
      (e) =>
        !["metadata-1", "network-1", "environment-1", "build-1"].includes(
          e.adapter_version,
        ),
    ),
  };
}
