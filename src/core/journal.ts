import {
  verdict,
  type Evidence,
  type Scalar,
  type Completeness,
  RULE_VERSION,
} from "./route.ts";
import type { CaptureStart, Context } from "../host/types.ts";
export type Lifecycle = "Capturing" | "Settling" | "Closed";
export interface Occurrence extends Evidence, Context {
  event_id: string;
  event_index: number;
  timestamp: string;
  monotonic_ms: number;
  old_value: Scalar;
  old_value_state: "absent" | Evidence["value_state"];
  new_value: Scalar;
  arrival_index: number | null;
  decode_index: number | null;
  envelope_id: string | null;
  delta_op: string | null;
  request_id: string | null;
  conversation_id: string | null;
  parent_message_id: string | null;
  parser_status: string;
  observed_vs_declared_time: "observed";
  late_metadata: boolean;
  revision: number;
  delta_header: {
    path: string;
    channel: string;
    explicit: { c: boolean; p: boolean; o: boolean };
  } | null;
  envelope_event: string | null;
  envelope_retry: number | null;
}
export interface Control {
  kind:
    | "started"
    | "complete"
    | "health"
    | "closed"
    | "invalidated"
    | "segment_eof";
  monotonic_ms: number;
  timestamp: string;
  code: string;
  health: Completeness;
}
interface Entry {
  start: CaptureStart;
  events: Occurrence[];
  controls: Control[];
  valid: boolean;
  bound: boolean;
  control_dropped: number;
  // Opaque runtime identity; never included in a Snapshot or public revision.
  change: Readonly<object>;
}
export interface Observation {
  arrival_index?: number;
  decode_index?: number;
  envelope_id?: string;
  delta_op?: string;
  request_id?: string | null;
  conversation_id?: string | null;
  parent_message_id?: string | null;
  parser_status?: string;
  delta_header?: Occurrence["delta_header"];
  envelope_event?: string;
  envelope_retry?: number | null;
}
export class Journal {
  private entries = new Map<string, Entry>();
  private bytes = 0;
  constructor(
    private now: () => number = () => performance.now(),
    private wall: () => string = () => new Date().toISOString(),
    private uuid: () => string = () => crypto.randomUUID(),
  ) {}
  private control(
    entry: Entry,
    kind: Control["kind"],
    code: string,
    health: Completeness = "Unknown",
  ) {
    entry.change = Object.freeze({});
    if (entry.controls.length >= 2048) {
      entry.control_dropped++;
      if (entry.controls.length === 2048)
        entry.controls.push(
          Object.freeze({
            kind: "health",
            code: "control_limit",
            health: "Partial",
            monotonic_ms: this.now(),
            timestamp: this.wall(),
          }),
        );
      return;
    }
    entry.controls.push(
      Object.freeze({
        kind,
        code,
        health,
        monotonic_ms: this.now(),
        timestamp: this.wall(),
      }),
    );
  }
  start(capture: CaptureStart) {
    if (this.entries.has(capture.capture_id)) return true;
    if (this.entries.size >= 128) return false;
    if (
      [...this.entries.values()].filter(
        (e) => e.valid && this.state(e.start.capture_id).lifecycle !== "Closed",
      ).length >= 32
    )
      return false;
    const entry: Entry = {
      start: Object.freeze({
        ...capture,
        context: Object.freeze({ ...capture.context }),
      }),
      events: [],
      controls: [],
      valid: true,
      bound: capture.mode === "live",
      control_dropped: 0,
      change: Object.freeze({}),
    };
    this.entries.set(capture.capture_id, entry);
    this.control(entry, "started", capture.mode);
    return true;
  }
  append(evidence: Evidence, observation: Observation = {}): Occurrence | null {
    const entry = this.entries.get(evidence.capture_id);
    if (!entry?.valid) return null;
    this.tick(evidence.capture_id);
    if (!entry.valid) return null;
    if (entry.events.length >= 20000) {
      if (!entry.controls.some((c) => c.code === "journal_limit"))
        this.health(evidence.capture_id, "Partial", "journal_limit");
      return null;
    }
    const same = (e: Evidence) =>
      e.field_namespace === evidence.field_namespace &&
      e.field === evidence.field &&
      e.task_scope === evidence.task_scope &&
      e.message_id === evidence.message_id &&
      e.channel === evidence.channel &&
      e.direction === evidence.direction &&
      e.transport === evidence.transport;
    const previous = [...entry.events].reverse().find(same);
    const state = this.state(evidence.capture_id);
    const late = state.lifecycle === "Closed";
    const event: Occurrence = {
      ...evidence,
      ...entry.start.context,
      event_id: this.uuid(),
      event_index: entry.events.length + 1,
      timestamp: this.wall(),
      monotonic_ms: this.now(),
      old_value: previous?.value ?? null,
      old_value_state: previous?.value_state ?? "absent",
      new_value: evidence.value,
      arrival_index: observation.arrival_index ?? null,
      decode_index: observation.decode_index ?? null,
      envelope_id: observation.envelope_id ?? null,
      delta_op: observation.delta_op ?? null,
      request_id: observation.request_id ?? null,
      conversation_id:
        observation.conversation_id ?? entry.start.conversation_id,
      parent_message_id: observation.parent_message_id ?? null,
      parser_status: observation.parser_status ?? "supported",
      observed_vs_declared_time: "observed",
      late_metadata: late,
      revision: state.revision + (late ? 1 : 0),
      delta_header: observation.delta_header
        ? Object.freeze({
            ...observation.delta_header,
            explicit: Object.freeze({ ...observation.delta_header.explicit }),
          })
        : null,
      envelope_event: observation.envelope_event ?? null,
      envelope_retry: observation.envelope_retry ?? null,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(event)).length;
    if (this.bytes + bytes > 33554432) {
      if (!entry.controls.some((c) => c.code === "journal_byte_limit"))
        this.health(evidence.capture_id, "Partial", "journal_byte_limit");
      return null;
    }
    this.bytes += bytes;
    entry.events.push(Object.freeze(event));
    entry.change = Object.freeze({});
    return event;
  }
  complete(id: string, code = "protocol_done") {
    const entry = this.entries.get(id);
    if (entry?.valid && !entry.controls.some((c) => c.kind === "complete"))
      this.control(entry, "complete", code);
  }
  segmentEof(id: string) {
    const entry = this.entries.get(id);
    if (entry?.valid) this.control(entry, "segment_eof", "transport_eof");
  }
  health(id: string, health: Completeness, code: string) {
    const entry = this.entries.get(id);
    if (entry?.valid) this.control(entry, "health", code, health);
  }
  tick(id?: string) {
    for (const [key, entry] of this.entries) {
      if ((id && key !== id) || !entry.valid) continue;
      const done = entry.controls.find((c) => c.kind === "complete");
      if (
        done &&
        this.now() >= done.monotonic_ms + 30000 &&
        !entry.controls.some((c) => c.kind === "closed")
      )
        this.control(entry, "closed", "confirmation_deadline");
      if (
        this.now() - entry.start.started_at >= 86400000 &&
        this.state(key).lifecycle !== "Closed"
      ) {
        this.health(key, "Partial", "observation_24h_limit");
        this.control(entry, "closed", "safety_limit");
        entry.valid = false;
      }
    }
  }
  reset(context: Context, reason: string) {
    for (const entry of this.entries.values()) {
      const old = entry.start.context;
      if (
        reason === "pause" ||
        reason === "clear" ||
        reason === "dispose" ||
        old.document_id !== context.document_id ||
        !entry.bound
      ) {
        if (entry.valid) {
          this.control(entry, "invalidated", reason, "Partial");
          entry.valid = false;
        }
      }
    }
  }
  // Identity is unique across entries, restarts and separate Journal instances.
  revision(id: string) {
    return this.entries.get(id)?.change;
  }
  snapshot(id: string) {
    const e = this.entries.get(id);
    return e
      ? {
          start: e.start,
          events: [...e.events],
          controls: [...e.controls],
          control_dropped: e.control_dropped,
        }
      : null;
  }
  ids() {
    return [...this.entries.keys()];
  }
  clear() {
    this.entries.clear();
    this.bytes = 0;
  }
  discard(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.bytes = Math.max(
      0,
      this.bytes -
        entry.events.reduce(
          (n, e) => n + new TextEncoder().encode(JSON.stringify(e)).length,
          0,
        ),
    );
    this.entries.delete(id);
  }
  terminate(id: string, reason: string) {
    const entry = this.entries.get(id);
    if (entry?.valid) this.control(entry, "closed", reason, "Failed");
  }
  state(id: string) {
    return projectState(this.snapshot(id));
  }
  route(id: string, scope: string, ruleVersion = RULE_VERSION) {
    const snapshot = this.snapshot(id);
    return verdict(
      snapshot?.events ?? [],
      id,
      scope,
      this.state(id).completeness,
      ruleVersion,
    );
  }
}
export function projectState(snapshot: ReturnType<Journal["snapshot"]>) {
  const controls = snapshot?.controls ?? [];
  const closed = controls.some(
    (c) => c.kind === "closed" || c.kind === "invalidated",
  );
  const done = controls.some((c) => c.kind === "complete");
  const lifecycle: Lifecycle = closed
    ? "Closed"
    : done
      ? "Settling"
      : "Capturing";
  const health = controls
    .filter((c) => c.kind === "health" || c.kind === "invalidated")
    .map((c) => c.health);
  const completeness: Completeness = health.includes("Failed")
    ? "Failed"
    : health.includes("Partial")
      ? "Partial"
      : done
        ? "Complete"
        : "Unknown";
  return {
    lifecycle,
    completeness,
    revision: snapshot?.events.at(-1)?.revision ?? 0,
    confirmation_deadline:
      controls.find((c) => c.kind === "complete")?.monotonic_ms === undefined
        ? null
        : controls.find((c) => c.kind === "complete")!.monotonic_ms + 30000,
  };
}
