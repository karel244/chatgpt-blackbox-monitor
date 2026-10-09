import type { Context } from "../host/types.ts";
import type { Snapshot } from "../history/safety.ts";
export function currentCaptures(snapshots: Snapshot[], context: Context) {
  return snapshots
    .filter(
      (s) =>
        ["live", "reload"].includes(s.start.mode) &&
        s.start.context.document_id === context.document_id &&
        s.start.context.visit_id === context.visit_id &&
        s.start.context.epoch === context.epoch,
    )
    .sort((a, b) => b.start.started_at - a.start.started_at);
}
export function chooseCapture(
  snapshots: Snapshot[],
  context: Context,
  manual: string | null = null,
) {
  const current = currentCaptures(snapshots, context);
  return (
    current.find((s) => s.start.capture_id === manual) ?? current[0] ?? null
  );
}
// Display provenance only. Current selection and evidence actions remain scoped.
export function meaningfulConversation(snapshot: Snapshot) {
  return (
    ["live", "reload"].includes(snapshot.start.mode) &&
    snapshot.events.some(
      (e) =>
        e.association === "confirmed" &&
        ["request", "server_ste_metadata", "resolved"].includes(
          e.field_namespace,
        ) &&
        [
          "model",
          "model_slug",
          "resolved_model_slug",
          "thinking_effort",
        ].includes(e.field) &&
        typeof e.value === "string" &&
        e.value !== "Unknown" &&
        e.value.length > 0,
    )
  );
}
export function displayConversation(
  snapshots: Snapshot[],
  context: Context,
  manual: string | null = null,
) {
  const selected = chooseCapture(snapshots, context, manual);
  const snapshot =
    selected &&
    (selected.start.capture_id === manual || meaningfulConversation(selected))
      ? selected
      : (currentCaptures(snapshots, context).find(meaningfulConversation) ??
        snapshots
          .filter(
            (s) =>
              s.start.context.document_id === context.document_id &&
              meaningfulConversation(s),
          )
          .sort((a, b) => b.start.started_at - a.start.started_at)[0] ??
        selected);
  return {
    snapshot,
    source: snapshot && snapshot !== selected ? "recent" : "current",
  } as const;
}
export function timelinePage(snapshot: Snapshot, page: number, size = 50) {
  const bounded = Math.max(1, Math.min(100, size)),
    pages = Math.max(1, Math.ceil(snapshot.events.length / bounded));
  const actual = Math.max(0, Math.min(pages - 1, Math.floor(page)));
  return {
    events: snapshot.events.slice(actual * bounded, (actual + 1) * bounded),
    page: actual,
    pages,
    total: snapshot.events.length,
  };
}
