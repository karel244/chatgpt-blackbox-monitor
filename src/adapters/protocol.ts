import {
  record,
  identifier,
  responseEvidence,
  type Evidence,
  type Source,
} from "../core/route.ts";
import { Sse, type Envelope } from "./sse.ts";
export interface ProtocolObservation {
  envelope: Envelope;
  channel: string;
  op: string | null;
  path: string;
  explicit: { c: boolean; p: boolean; o: boolean };
}
export interface ProtocolSink {
  evidence(events: Evidence[], observation: ProtocolObservation): void;
  identity(value: unknown, channel: string): void;
  control(
    kind: "done" | "handoff" | "reconnect" | "content",
    value: unknown,
  ): void;
  error(code: string): void;
}
const keys = new Set([
  "message",
  "metadata",
  "server_ste_metadata",
  "author",
  "role",
  "type",
  "id",
  "parent_id",
  "parent",
  "conversation_id",
  "request_id",
  "input_message_id",
  "topic_id",
  "model_slug",
  "resolved_model_slug",
  "thinking_effort",
  "fast_convo",
  "requested_model_experience",
  "task_scope",
]);
export function metadataOnly(
  value: unknown,
  depth = 0,
  budget = { nodes: 0 },
): unknown {
  if (depth > 16 || ++budget.nodes > 4096)
    throw new Error("metadata_depth_limit");
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (typeof value === "string") return identifier(value) ?? undefined;
  if (Array.isArray(value)) {
    if (value.length > 128) throw new Error("metadata_array_limit");
    return value.map((v) => metadataOnly(v, depth + 1, budget));
  }
  const object = record(value);
  if (!object) return undefined;
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, item] of Object.entries(object))
    if (keys.has(key)) {
      const clean = metadataOnly(item, depth + 1, budget);
      if (clean !== undefined) result[key] = clean;
    }
  return result;
}
interface Channel {
  tree: unknown;
  path: string;
  op: string;
}
export class Protocol {
  readonly sse: Sse;
  private encoding: "legacy" | "v1" | "unsupported" = "legacy";
  private channel = "0";
  private channels = new Map<string, Channel>();
  constructor(
    private source: () => Source,
    private sink: ProtocolSink,
  ) {
    this.sse = new Sse(
      (e) => this.envelope(e),
      (code) => sink.error(code),
    );
  }
  text(text: string) {
    this.sse.text(text);
  }
  push(bytes: Uint8Array) {
    this.sse.push(bytes);
  }
  finish() {
    this.sse.finish();
  }
  json(
    value: unknown,
    envelope: Envelope = {
      data: "",
      event: "json",
      id: null,
      retry: null,
      index: 0,
    },
  ) {
    const root = record(value);
    if (
      !root ||
      (root.type !== undefined &&
        ![
          "server_ste_metadata",
          "message",
          "response_metadata",
          "stream_handoff",
          "subscribe_ws_topic",
          "stream_resume",
          "reconnect",
          "completed",
          "response_completed",
        ].includes(String(root.type))) ||
      ![
        "type",
        "message",
        "resolved_model_slug",
        "request_id",
        "conversation_id",
        "input_message_id",
      ].some((key) => Object.hasOwn(root, key))
    ) {
      this.sink.error("unsupported_json_envelope");
      return;
    }
    this.sink.identity(value, "0");
    if (root?.type === "stream_handoff" || root?.type === "subscribe_ws_topic")
      this.sink.control("handoff", value);
    if (root?.type === "stream_resume" || root?.type === "reconnect")
      this.sink.control("reconnect", value);
    if (root?.type === "completed" || root?.type === "response_completed")
      this.sink.control("done", value);
    if (
      record(record(root?.message)?.author)?.role === "assistant" &&
      record(root?.message)?.content !== undefined
    )
      this.sink.control("content", null);
    this.sink.evidence(responseEvidence(value, this.source()), {
      envelope,
      channel: "0",
      op: null,
      path: "",
      explicit: { c: false, p: false, o: false },
    });
  }
  private envelope(envelope: Envelope) {
    if (envelope.data === "[DONE]") {
      if (this.encoding !== "unsupported") this.sink.control("done", null);
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(envelope.data);
    } catch {
      this.sink.error("malformed_json");
      return;
    }
    if (envelope.event === "delta_encoding") {
      this.encoding = value === "v1" ? "v1" : "unsupported";
      this.channels.clear();
      this.channel = "0";
      if (this.encoding === "unsupported")
        this.sink.error("unsupported_delta_encoding");
      return;
    }
    if (this.encoding === "unsupported") {
      this.sink.error("unsupported_delta_payload");
      return;
    }
    const object = record(value);
    if (
      envelope.event === "delta" &&
      object &&
      ["c", "p", "o", "v"].some((k) => Object.hasOwn(object, k))
    ) {
      if (this.encoding !== "v1") {
        this.sink.error("delta_without_version");
        return;
      }
      try {
        this.delta(object, envelope);
      } catch (error) {
        this.sink.error(
          error instanceof Error && /^\w+$/.test(error.message)
            ? error.message
            : "invalid_delta",
        );
      }
      return;
    }
    if (envelope.event === "delta" && this.encoding === "v1") {
      this.sink.error("invalid_delta");
      return;
    }
    this.json(value, envelope);
  }
  private delta(item: Record<string, unknown>, envelope: Envelope) {
    const c = Object.hasOwn(item, "c") ? item.c : Number(this.channel);
    if (typeof c !== "number" || !Number.isSafeInteger(c) || c < 0)
      throw new Error("invalid_channel");
    const channel = String(c);
    let state = this.channels.get(channel);
    if (!state) {
      if (this.channels.size >= 32) throw new Error("channel_limit");
      state = { tree: undefined, path: "", op: "add" };
      this.channels.set(channel, state);
    }
    const path = Object.hasOwn(item, "p") ? item.p : state.path;
    const op = Object.hasOwn(item, "o") ? item.o : state.op;
    if (typeof path !== "string" || typeof op !== "string")
      throw new Error("invalid_delta");
    const observation: ProtocolObservation = {
      envelope,
      channel,
      op,
      path,
      explicit: {
        c: Object.hasOwn(item, "c"),
        p: Object.hasOwn(item, "p"),
        o: Object.hasOwn(item, "o"),
      },
    };
    this.channel = channel;
    state.path = path;
    state.op = op;
    const budget = { ops: 0 };
    this.apply(state, path, op, item.v, observation, budget);
  }
  private apply(
    state: Channel,
    path: string,
    op: string,
    value: unknown,
    observation: ProtocolObservation,
    budget: { ops: number },
    depth = 0,
  ) {
    if (++budget.ops > 512 || depth > 16) throw new Error("patch_limit");
    if (
      !["add", "replace", "append", "remove", "truncate", "patch"].includes(
        op,
      ) ||
      path.length > 512 ||
      (path !== "" && !path.startsWith("/"))
    )
      throw new Error("invalid_delta");
    const tokens =
      path === ""
        ? []
        : path
            .slice(1)
            .split("/")
            .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
    if (tokens.length > 16) throw new Error("metadata_depth_limit");
    if (
      tokens.some((t) => ["__proto__", "prototype", "constructor"].includes(t))
    )
      throw new Error("dangerous_delta_path");
    if (
      tokens.some((t) =>
        ["content", "parts", "text", "reasoning", "output", "input"].includes(
          t,
        ),
      )
    ) {
      this.sink.control("content", null);
      return;
    }
    if (
      tokens.some(
        (t) => !keys.has(t) && t !== "-" && !/^(0|[1-9]\d{0,2})$/.test(t),
      )
    ) {
      this.sink.error("unsupported_delta_path");
      return;
    }
    if (op === "patch") {
      if (!Array.isArray(value) || value.length > 512)
        throw new Error("patch_limit");
      for (const raw of value) {
        const item = record(raw);
        if (
          !item ||
          typeof item.o !== "string" ||
          (item.p !== undefined && typeof item.p !== "string")
        )
          throw new Error("invalid_patch");
        this.apply(
          state,
          `${path}${item.p ?? ""}`,
          item.o,
          item.v,
          { ...observation, op: item.o, path: `${path}${item.p ?? ""}` },
          budget,
          depth + 1,
        );
      }
      return;
    }
    const source = { ...this.source(), channel: observation.channel };
    const before = responseEvidence(state.tree, source);
    const box: Record<string, unknown> = { root: state.tree };
    let parent = box;
    let key = "root";
    for (const token of tokens) {
      let next = parent[key];
      if (next === undefined) {
        next = Object.create(null);
        parent[key] = next;
      }
      const nextRecord = Array.isArray(next)
        ? (next as unknown as Record<string, unknown>)
        : record(next);
      if (!nextRecord) throw new Error("invalid_delta_target");
      parent = nextRecord;
      key =
        token === "-" && Array.isArray(parent) ? String(parent.length) : token;
      if (
        Array.isArray(parent) &&
        (!/^\d+$/.test(key) ||
          Number(key) > parent.length ||
          Number(key) >= 128)
      )
        throw new Error("invalid_array_index");
    }
    const previous = parent[key];
    if (op === "remove") {
      if (!Object.hasOwn(parent, key)) throw new Error("invalid_remove");
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete parent[key];
    } else if (op === "truncate") {
      if (
        !Number.isSafeInteger(value) ||
        Number(value) < 0 ||
        (typeof previous !== "string" && !Array.isArray(previous))
      )
        throw new Error("invalid_truncate");
      parent[key] = (previous as string | unknown[]).slice(0, Number(value));
    } else {
      const next = metadataOnly(value);
      if (op === "append") {
        if (typeof previous === "string" && typeof next === "string") {
          if (previous.length + next.length > 128)
            throw new Error("metadata_string_limit");
          parent[key] = previous + next;
        } else if (Array.isArray(previous)) {
          const items = Array.isArray(next) ? next : [next];
          if (previous.length + items.length > 128)
            throw new Error("metadata_array_limit");
          previous.push(...items);
        } else if (record(previous) && record(next))
          Object.assign(record(previous)!, record(next));
        else throw new Error("invalid_append");
      } else {
        if (op === "replace" && tokens.length && !Object.hasOwn(parent, key))
          throw new Error("invalid_replace");
        if (op === "add" && Array.isArray(parent)) {
          if (parent.length >= 128) throw new Error("metadata_array_limit");
          parent.splice(Number(key), 0, next);
        } else parent[key] = next;
      }
    }
    state.tree = box.root;
    if ((JSON.stringify(state.tree)?.length ?? 0) > 65536)
      throw new Error("metadata_tree_limit");
    this.sink.identity(state.tree, observation.channel);
    const after = responseEvidence(state.tree, {
      ...source,
      ...this.source(),
      channel: observation.channel,
    });
    const touched = (e: Evidence) =>
      path === "" ||
      e.source_path === path ||
      e.source_path.startsWith(`${path}/`);
    const output = after.filter(touched);
    for (const old of before.filter(touched))
      if (!after.some((e) => e.source_path === old.source_path))
        output.push({ ...old, value: null, value_state: "removed" });
    this.sink.evidence(output, { ...observation, path, op });
  }
}
