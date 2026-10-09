import type { Snapshot } from "../history/safety.ts";
import { summarize } from "../history/bundle.ts";
import { I18n } from "./i18n.ts";

export function viewportText(width: unknown, height: unknown, dpr?: unknown) {
  if (
    ![width, height].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
    )
  )
    return null;
  return `${width} × ${height}${typeof dpr === "number" && Number.isFinite(dpr) && dpr > 0 ? ` · DPR ${dpr}` : ""}`;
}

// Presentation only: never recompute or overwrite a network verdict.
export function networkDisplay(snapshot: Snapshot | null) {
  const events = snapshot?.events ?? [];
  const last = (ns: string, field: string) =>
    events.filter((e) => e.field_namespace === ns && e.field === field).at(-1)
      ?.value;
  const status = last("network.verdict", "status") ?? "Unknown";
  const http = last("network.http", "http_status");
  const cf = last("network.headers", "cf-mitigated");
  const retry =
    last("network.headers", "retry-after.seconds") ??
    last("network.headers", "retry-after.date");
  const sockets = events.filter((e) =>
    e.field_namespace.startsWith("network.websocket."),
  );
  const wsAlerts = sockets.filter(
    (e) =>
      e.field === "reconnect" ||
      (e.field === "event" && e.value === "error") ||
      (e.field === "wasClean" && e.value === false) ||
      (e.field === "code" &&
        typeof e.value === "number" &&
        ![1000, 1001].includes(e.value)),
  );
  const failure = last("network.failure", "category");
  const fields: [string, unknown][] = [
    ["Cloudflare", cf],
    ["Retry-After", retry],
    [
      "PoW",
      last("pow.association", "association_status") ??
        events
          .filter(
            (e) =>
              e.field === "association_status" &&
              e.field_namespace.startsWith("pow"),
          )
          .at(-1)?.value,
    ],
    ["WebSocket events", sockets.filter((e) => e.field === "event").length],
    [
      "WebSocket diagnostics",
      wsAlerts.length
        ? wsAlerts
            .map((e) => `${e.field}: ${e.value} (${e.association})`)
            .join("; ")
        : null,
    ],
    ["Transport failure", failure],
  ];
  return {
    status,
    http,
    fields,
    alerts: fields.filter(
      ([key]) =>
        (key === "Cloudflare" &&
          (cf === "challenge" || String(status).startsWith("Challenge"))) ||
        (key === "Retry-After" && retry !== null && retry !== undefined) ||
        (key === "WebSocket diagnostics" && wsAlerts.length > 0) ||
        (key === "Transport failure" &&
          failure !== null &&
          failure !== undefined),
    ),
  };
}

export function launcherFacts(snapshot: Snapshot | null) {
  const fields = [
    ["server_ste_metadata", "model_slug"],
    ["resolved", "resolved_model_slug"],
    ["request", "model"],
  ];
  let model = "Unknown",
    modelSource = "Unknown";
  for (const [namespace, field] of fields) {
    const value = snapshot?.events
      .filter((e) => e.field_namespace === namespace && e.field === field)
      .at(-1)?.value;
    if (typeof value === "string" && value && value !== "Unknown") {
      model = value;
      modelSource = `${namespace}.${field}`;
      break;
    }
  }
  const network = networkDisplay(snapshot);
  const abnormal = network.status !== "OK" && network.status !== "Unknown";
  return {
    model,
    modelSource,
    abnormal,
    status: abnormal
      ? network.http
        ? `HTTP ${network.http}`
        : String(network.status)
      : null,
  };
}

export function historyDisplay(
  snapshot: Snapshot,
  i18n: I18n,
  today = new Date(),
) {
  const summary = summarize(snapshot);
  const requested = snapshot.events
    .filter(
      (e) =>
        e.level === "B" &&
        e.field_namespace === "request" &&
        e.field === "model" &&
        e.association === "confirmed",
    )
    .at(-1)?.value;
  const server = summary.route_verdict.coverage !== "no-A";
  const model = server ? summary.route_verdict.actual_route : requested;
  const effort = snapshot.events
    .filter(
      (e) =>
        e.level === "B" &&
        e.field_namespace === "request" &&
        e.field === "thinking_effort" &&
        e.association === "confirmed",
    )
    .at(-1)?.value;
  // started_at is monotonic; use the existing started control's wall clock,
  // falling back to the first valid occurrence timestamp, never a persistence time.
  const timestamps = snapshot.controls
    .filter((c) => c.kind === "started")
    .map((c) => c.timestamp);
  const wall = [...timestamps, ...snapshot.events.map((e) => e.timestamp)]
    .map((timestamp) => Date.parse(timestamp))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  const date = wall === undefined ? null : new Date(wall);
  const hhmm = date
    ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : "";
  const sameDay =
    date &&
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const time = !date
    ? i18n.t("Time unknown")
    : sameDay
      ? hhmm
      : `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${hhmm}`;
  return {
    time,
    model: String(model ?? i18n.enum("Unknown")),
    modelSource: i18n.t(server ? "Server Route" : "Requested"),
    verdict: i18n.enum(summary.route_verdict.verdict),
    effort: i18n.enum(effort ?? "Unknown"),
    duration:
      summary.timing.total_ms === null
        ? i18n.t("Duration unknown")
        : i18n.duration(
            `${(summary.timing.total_ms / 1000).toFixed(1)}s total`,
          ),
    id: snapshot.start.capture_id.slice(0, 8),
  };
}
