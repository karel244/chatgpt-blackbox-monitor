import { exportBundle } from "../history/bundle.ts";
import {
  conversationHistory,
  relatedHistory,
  type Recovered,
} from "../history/storage.ts";
import type { Snapshot } from "../history/safety.ts";

type Stage =
  | "history_view_open"
  | "flush"
  | "history_list_begin"
  | "history_list_end"
  | "rows_rendered"
  | "history_button_click"
  | "related_source_begin"
  | "related_filter_end"
  | "export_bundle_begin"
  | "export_bundle_end"
  | "download_helper_called"
  | "guard_success";
interface Details {
  total_records?: number;
  conversation_rows?: number;
  auxiliary_records?: number;
  related_count?: number;
  related_modes?: string[];
  zip_bytes?: number;
}
export class HistoryOperation {
  private state = {
    operation: "history_view" as "history_view" | "history_export",
    stage: "history_view_open" as Stage,
    status: "Idle" as "Idle" | "Running" | "Success" | "Failed",
    safe_error_code: null as string | null,
  };
  private timeline: { stage: Stage; monotonic_ms: number; details: Details }[] =
    [];
  constructor(private readonly now: () => number) {}
  begin(operation: "history_view" | "history_export", stage: Stage) {
    this.state = { operation, stage, status: "Running", safe_error_code: null };
    this.timeline = [];
    this.mark(stage);
  }
  mark(stage: Stage, details: Details = {}) {
    this.state.stage = stage;
    if (this.timeline.length < 16)
      this.timeline.push({ stage, monotonic_ms: this.now(), details });
  }
  success() {
    this.mark("guard_success");
    this.state.status = "Success";
  }
  fail(error: unknown) {
    const code = error instanceof Error ? error.message : "";
    this.state.status = "Failed";
    this.state.safe_error_code = [
      "invalid_manifest",
      "invalid_snapshot",
      "invalid_timeline_sequence_or_source",
      "no_capture",
      "history_view_changed",
    ].includes(code)
      ? code
      : "history_operation_failed";
  }
  get snapshot() {
    return structuredClone({ ...this.state, timeline: this.timeline });
  }
}
export async function recoverHistoryView(
  flush: () => Promise<void>,
  list: () => Promise<Recovered[]>,
  health: HistoryOperation,
) {
  health.begin("history_view", "history_view_open");
  try {
    health.mark("flush");
    await flush();
    health.mark("history_list_begin");
    const records = await list(),
      rows = conversationHistory(records);
    health.mark("history_list_end", {
      total_records: records.length,
      conversation_rows: rows.length,
      auxiliary_records: records.filter((r) => r.snapshot.start.mode !== "live")
        .length,
    });
    return {
      rows,
      related: (snapshot: Snapshot) => relatedHistory(records, snapshot),
    };
  } catch (error) {
    health.fail(error);
    throw error;
  }
}
export async function exportHistoryRecord(
  view: Awaited<ReturnType<typeof recoverHistoryView>>,
  record: Recovered,
  download: (bytes: Uint8Array) => void,
  health: HistoryOperation,
  isCurrent: () => boolean = () => true,
) {
  health.begin("history_export", "history_button_click");
  try {
    if (!isCurrent()) throw Error("history_view_changed");
    health.mark("related_source_begin");
    const related = view.related(record.snapshot);
    health.mark("related_filter_end", {
      related_count: related.length,
      related_modes: related.map((s) => s.start.mode),
    });
    health.mark("export_bundle_begin");
    const bundle = await exportBundle(
      record.snapshot,
      "1.1.0",
      {},
      { state: "not_compared" },
      related,
    );
    health.mark("export_bundle_end", { zip_bytes: bundle.bytes.length });
    if (!isCurrent()) throw Error("history_view_changed");
    health.mark("download_helper_called", { zip_bytes: bundle.bytes.length });
    download(bundle.bytes);
    health.success();
    return { related_available: related.length > 0 };
  } catch (error) {
    health.fail(error);
    return null;
  }
}
