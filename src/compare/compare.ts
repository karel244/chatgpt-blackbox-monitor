import type { Bundle } from "../history/bundle.ts";
import { validateRun, type Run } from "./experiment.ts";
export type ComparisonStatus =
  "Equal" | "Different" | "Unknown" | "Not comparable";
export interface FieldComparison {
  status: ComparisonStatus;
  left: unknown;
  right: unknown;
  reason: string;
}
export function compareValue(
  left: unknown,
  right: unknown,
  compatible = true,
): FieldComparison {
  const missing = (v: unknown): boolean =>
    v === null ||
    v === undefined ||
    (Array.isArray(v) && (v.length === 0 || v.some(missing))) ||
    (typeof v === "object" &&
      v !== null &&
      "value" in v &&
      missing((v as { value: unknown }).value));
  return {
    status: !compatible
      ? "Not comparable"
      : missing(left) || missing(right)
        ? "Unknown"
        : JSON.stringify(left) === JSON.stringify(right)
          ? "Equal"
          : "Different",
    left: left ?? null,
    right: right ?? null,
    reason: !compatible
      ? "incompatible_semantics"
      : missing(left) || missing(right)
        ? "not_observed"
        : "observed_values",
  };
}
export function bundleRun(bundle: Bundle): Run | null {
  const c = bundle.comparison as { state?: string; run?: unknown };
  return c?.run ? validateRun(c.run) : null;
}
export function compareBundles(
  left: Bundle,
  right: Bundle,
  threshold = { ratio: 10, absolute_ms: 10000 },
) {
  const a = bundleRun(left),
    b = bundleRun(right);
  const paired =
    !!a &&
    !!b &&
    a.descriptor.experiment_uuid === b.descriptor.experiment_uuid &&
    a.descriptor.task_id === b.descriptor.task_id &&
    a.descriptor.replicate === b.descriptor.replicate &&
    a.run_id !== b.run_id;
  const compatible =
    paired &&
    !left.read_only &&
    !right.read_only &&
    left.manifest.schema_version === right.manifest.schema_version &&
    JSON.stringify([...left.manifest.adapter_versions].sort()) ===
      JSON.stringify([...right.manifest.adapter_versions].sort()) &&
    JSON.stringify([...left.manifest.rule_versions].sort()) ===
      JSON.stringify([...right.manifest.rule_versions].sort()) &&
    left.manifest.redaction_version === right.manifest.redaction_version;
  const fields: Record<string, FieldComparison> = {};
  const add = (name: string, l: unknown, r: unknown, can = compatible) => {
    fields[name] = compareValue(l, r, can);
  };
  const events = (x: Bundle) => [
    ...x.snapshot.events,
    ...x.related.flatMap((r) => r.events),
  ];
  const chain = (x: Bundle, ns: string, f: string) =>
    events(x)
      .filter((e) => e.field_namespace === ns && e.field === f)
      .map((e) => ({
        value: e.value,
        level: e.level,
        scope: e.task_scope,
        source: e.source_path,
        availability: e.availability ?? e.value_state,
      }));
  const last = (x: Bundle, ns: string, f: string) =>
    events(x)
      .filter((e) => e.field_namespace === ns && e.field === f)
      .at(-1)?.value ?? null;
  for (const [name, ns, f] of [
    ["request.model", "request", "model"],
    ["thinking_effort", "request", "thinking_effort"],
    ["request.reasoning_effort", "request", "reasoning_effort"],
    ["requested_experience", "request", "requested_model_experience"],
    ["server_STE_chain", "server_ste_metadata", "model_slug"],
    ["resolved_route_chain", "resolved", "resolved_model_slug"],
    ["response_effort", "response", "thinking_effort"],
    ["fast_convo", "response", "fast_convo"],
    ["PoW.difficulty", "pow", "raw_hex"],
    ["PoW.decimal", "pow", "decimal"],
    ["PoW.validity", "pow", "validity"],
    ["PoW.association", "pow.association", "association_status"],
    ["IP.source", "environment.fields", "client_ip"],
    ["frontend.build", "frontend.markers", "build_id"],
    ["frontend.marker", "frontend.markers", "deployment_marker"],
    ["frontend.asset_set", "frontend.assets", "asset_set_hash"],
    ["HTTP.status", "network.http", "http_status"],
    ["HTTP.headers_availability", "network.headers", "content-type"],
    ["Cloudflare", "network.headers", "cf-mitigated"],
    ["Cloudflare.ray", "network.headers", "cf-ray"],
  ])
    add(name!, chain(left, ns!, f!), chain(right, ns!, f!));
  for (const level of ["A", "B", "C", "D", "N", "E"])
    add(
      `complete_${level}_chain`,
      events(left)
        .filter((e) => e.level === level)
        .map((e) => ({
          namespace: e.field_namespace,
          field: e.field,
          value: e.value,
          scope: e.task_scope,
          source: e.source_path,
          association: e.association,
        })),
      events(right)
        .filter((e) => e.level === level)
        .map((e) => ({
          namespace: e.field_namespace,
          field: e.field,
          value: e.value,
          scope: e.task_scope,
          source: e.source_path,
          association: e.association,
        })),
    );
  add(
    "actual_route",
    left.summary.route_verdict.coverage === "no-A"
      ? null
      : left.summary.route_verdict.actual_route,
    right.summary.route_verdict.coverage === "no-A"
      ? null
      : right.summary.route_verdict.actual_route,
  );
  add(
    "transport",
    left.snapshot.start.transport,
    right.snapshot.start.transport,
  );
  for (const term of ["handoff", "reconnect", "reload"])
    add(
      term,
      events(left)
        .filter(
          (e) =>
            e.field_namespace.startsWith("transport") &&
            JSON.stringify([e.field, e.value]).includes(term),
        )
        .map((e) => ({ field: e.field, value: e.value })),
      events(right)
        .filter(
          (e) =>
            e.field_namespace.startsWith("transport") &&
            JSON.stringify([e.field, e.value]).includes(term),
        )
        .map((e) => ({ field: e.field, value: e.value })),
    );
  for (const f of [
    "browser",
    "browser_major",
    "os",
    "language",
    "timezone",
    "online",
    "user_agent",
  ])
    add(
      `environment.${f}`,
      last(left, "environment.fields", f),
      last(right, "environment.fields", f),
    );
  const finalized = (x: Bundle) =>
    x.summary.capture_health.lifecycle === "Closed" &&
    x.snapshot.start.mode !== "reload";
  const timingComparable =
    compatible &&
    finalized(left) &&
    finalized(right) &&
    left.summary.timing.definition === right.summary.timing.definition;
  for (const f of [
    "first_content_ms",
    "first_visible_output_ms",
    "total_ms",
  ] as const)
    add(
      `timing.${f}`,
      left.summary.timing[f],
      right.summary.timing[f],
      timingComparable,
    );
  add(
    "confirmation",
    left.summary.timing.confirmation,
    right.summary.timing.confirmation,
  );
  add(
    "capture_health",
    left.summary.capture_health.completeness,
    right.summary.capture_health.completeness,
  );
  add(
    "adapter_versions",
    left.manifest.adapter_versions,
    right.manifest.adapter_versions,
    paired,
  );
  add(
    "rule_versions",
    left.manifest.rule_versions,
    right.manifest.rule_versions,
    paired,
  );
  add(
    "schema_version",
    left.manifest.schema_version,
    right.manifest.schema_version,
    paired,
  );
  add(
    "conditions",
    a?.descriptor.conditions ?? null,
    b?.descriptor.conditions ?? null,
    paired,
  );
  add(
    "prompt_association",
    a?.prompt?.hmac ?? null,
    b?.prompt?.hmac ?? null,
    paired &&
      !!a?.prompt &&
      !!b?.prompt &&
      a.prompt.key_id === b.prompt.key_id &&
      a.prompt.rule === b.prompt.rule,
  );
  const durations = [
    left.summary.timing.total_ms,
    right.summary.timing.total_ms,
  ];
  const delta = durations.every((v) => typeof v === "number")
    ? Math.abs(durations[0]! - durations[1]!)
    : null;
  const ratio = durations.every((v) => typeof v === "number" && v > 0)
    ? Math.max(...(durations as number[])) /
      Math.min(...(durations as number[]))
    : null;
  const complete =
    left.summary.capture_health.completeness === "Complete" &&
    right.summary.capture_health.completeness === "Complete";
  const material =
    timingComparable &&
    delta !== null &&
    ratio !== null &&
    Number.isFinite(threshold.ratio) &&
    threshold.ratio >= 1 &&
    Number.isFinite(threshold.absolute_ms) &&
    threshold.absolute_ms >= 0 &&
    delta >= threshold.absolute_ms &&
    ratio >= threshold.ratio;
  const routeSame =
    fields.actual_route!.status === "Equal" &&
    fields.complete_A_chain!.status === "Equal";
  const conditionsSame = fields.conditions!.status === "Equal";
  return {
    schema_version: "comparison-1",
    state: paired ? "compared" : "not_comparable",
    experiment_uuid: a?.descriptor.experiment_uuid ?? null,
    task_id: a?.descriptor.task_id ?? null,
    replicate: a?.descriptor.replicate ?? null,
    run_ids: [a?.run_id ?? null, b?.run_id ?? null],
    fields,
    timing: { delta_ms: delta, ratio, flag: material },
    conclusion: !compatible
      ? "Not comparable"
      : !complete
        ? "Evidence insufficient: capture Partial/Unknown/Failed"
        : fields.actual_route!.status === "Unknown"
          ? "Actual route Unknown; client timing remains descriptive"
          : material &&
              routeSame &&
              conditionsSame &&
              left.summary.route_verdict.coverage === "dual-A" &&
              right.summary.route_verdict.coverage === "dual-A"
            ? "Observed client timing differs materially in this paired sample."
            : "Descriptive paired observations only.",
    limits: [
      "No inference about reasoning budget or server computation.",
      "Prompt association does not establish equal context, memory, tools or service randomness.",
    ],
    baseline_partition: JSON.stringify([
      a?.descriptor.experiment_uuid,
      a?.descriptor.task_id,
      a?.descriptor.conditions,
      b?.descriptor.conditions,
    ]),
    order: [a?.descriptor.conditions.order, b?.descriptor.conditions.order],
  };
}
export function baseline(pairs: ReturnType<typeof compareBundles>[]) {
  const groups = new Map<string, typeof pairs>();
  for (const p of pairs) {
    const key = p.baseline_partition;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const summary = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    return {
      median: s.length
        ? (s[Math.floor((s.length - 1) / 2)]! + s[Math.floor(s.length / 2)]!) /
          2
        : null,
      range: s.length ? [s[0], s.at(-1)] : null,
    };
  };
  return [...groups.entries()].map(([partition, rows]) => {
    const eligible = rows.filter(
      (r) =>
        r.state === "compared" &&
        r.fields.conditions!.status === "Equal" &&
        ["Equal", "Different"].includes(r.fields["timing.total_ms"]!.status),
    );
    return {
      partition,
      pairs: rows.length,
      eligible_pairs: eligible.length,
      each_pair: rows.map((r) => ({
        runs: r.run_ids,
        duration: r.fields["timing.total_ms"],
        order: r.order,
      })),
      left: summary(
        eligible.map((r) => r.fields["timing.total_ms"]!.left as number),
      ),
      right: summary(
        eligible.map((r) => r.fields["timing.total_ms"]!.right as number),
      ),
      interpretation:
        "Descriptive only; no statistical significance or causal claim.",
      recommendation:
        eligible.length < 3
          ? "Collect 3-5 or more paired runs and alternate order."
          : "Report confounders and order; sample size is not an accuracy guarantee.",
    };
  });
}
export function safeAssociation(input: unknown): {
  state: "not_compared";
  run?: Run;
} {
  if (input === null || typeof input !== "object" || Array.isArray(input))
    throw Error("invalid_comparison");
  const c = input as Record<string, unknown>;
  if (
    c.state !== "not_compared" ||
    Object.keys(c).some((k) => !["state", "run"].includes(k))
  )
    throw Error("invalid_comparison");
  return c.run
    ? { state: "not_compared", run: validateRun(c.run) }
    : { state: "not_compared" };
}
