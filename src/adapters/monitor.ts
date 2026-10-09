import { Journal, type Observation } from "../core/journal.ts";
import {
  record,
  identifier,
  requestEvidence,
  responseEvidence,
  type Source,
  type Evidence,
} from "../core/route.ts";
import { Protocol, type ProtocolObservation } from "./protocol.ts";
import type { CaptureStart, Context, HostSink } from "../host/types.ts";
interface Identity {
  request: string | null;
  conversation: string | null;
  input: string | null;
  parent: string | null;
  message: string | null;
  topics: Set<string>;
  capture: CaptureStart;
  valid: boolean;
}
interface Diagnostic {
  code: string;
  count: number;
  capture_id: string | null;
  socket_id: string | null;
}
export class Monitor {
  readonly journal: Journal;
  readonly diagnostics: Diagnostic[] = [];
  readonly counters = {
    ws_message_events: 0,
    malformed: 0,
    dropped: 0,
    unsupported: 0,
    quarantine: 0,
    content_fragments: 0,
  };
  private captures = new Map<string, Identity>();
  private readers = new Map<string, ReadableStreamDefaultReader<Uint8Array>>();
  private xhrs = new WeakMap<
    XMLHttpRequest,
    { offset: number; parser: Protocol }
  >();
  private socketQueues = new Map<
    string,
    { chain: Promise<void>; pending: number; bytes: number; generation: number }
  >();
  private socketParsers = new Map<string, Protocol>();
  private parserOwners = new Map<string, string>();
  private evicted = new Map<string, Identity>();
  private topicSockets = new Map<string, string>();
  private generation = 0;
  private arrivals = new Map<string, number>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private complete(id: string, code = "protocol_done") {
    this.journal.complete(id, code);
    if (!this.timers.has(id)) {
      const generation = this.generation;
      this.timers.set(
        id,
        setTimeout(() => {
          if (generation === this.generation) this.journal.tick(id);
          this.timers.delete(id);
        }, 30000),
      );
    }
  }
  constructor(
    private now: () => number = () => performance.now(),
    private wall: () => string = () => new Date().toISOString(),
  ) {
    this.journal = new Journal(now, wall);
  }
  private diagnostic(
    code: string,
    capture: string | null = null,
    socket: string | null = null,
  ) {
    const found = this.diagnostics.find(
      (d) =>
        d.code === code && d.capture_id === capture && d.socket_id === socket,
    );
    if (found) found.count++;
    else if (this.diagnostics.length < 512)
      this.diagnostics.push({
        code,
        count: 1,
        capture_id: capture,
        socket_id: socket,
      });
    else this.counters.dropped++;
    if (code.includes("malformed") || code.includes("invalid"))
      this.counters.malformed++;
    if (code.includes("unsupported")) this.counters.unsupported++;
    if (code.includes("limit") || code.includes("dropped"))
      this.counters.dropped++;
    if (
      code.includes("quarantine") ||
      code.includes("contradiction") ||
      code.includes("ambiguous")
    )
      this.counters.quarantine++;
    if (capture) this.journal.health(capture, "Partial", code);
    else if (socket && !["ws_open", "ws_close", "ws_error"].includes(code)) {
      for (const identity of this.captures.values())
        if (
          identity.valid &&
          [...identity.topics].some((t) => this.topicSockets.get(t) === socket)
        )
          this.journal.health(identity.capture.capture_id, "Partial", code);
    }
  }
  private source(
    identity: Identity,
    transport: Source["transport"],
    segment: string,
    channel = "0",
  ): Source {
    return {
      capture_id: identity.capture.capture_id,
      task_scope: "answer",
      message_id: identity.message,
      transport,
      direction: "inbound",
      association: "confirmed",
      association_proof:
        transport === "websocket"
          ? "strong_identity_or_explicit_handoff"
          : "same_observed_request",
      endpoint_verified: true,
      channel,
      transport_segment_id: segment,
    };
  }
  request(capture: CaptureStart, body: unknown) {
    if (!this.journal.start(capture)) {
      this.diagnostic("capture_limit");
      return;
    }
    const identity: Identity = this.captures.get(capture.capture_id) ?? {
      capture,
      request: null,
      conversation: capture.conversation_id,
      input: null,
      parent: null,
      message: null,
      topics: new Set(),
      valid: true,
    };
    this.captures.set(capture.capture_id, identity);
    if (typeof body !== "string") {
      if (body !== null && body !== undefined)
        this.diagnostic("unsupported_request_body", capture.capture_id);
      return;
    }
    if (new TextEncoder().encode(body).length > 1048576) {
      this.diagnostic("request_body_limit", capture.capture_id);
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      this.diagnostic("malformed_request_json", capture.capture_id);
      return;
    }
    const root = record(value);
    identity.request = identifier(root?.request_id);
    identity.conversation =
      identifier(root?.conversation_id) ?? identity.conversation;
    identity.parent = identifier(root?.parent_message_id);
    const messages = Array.isArray(root?.messages) ? root.messages : [];
    identity.input = identifier(record(messages[0])?.id);
    for (const event of requestEvidence(value, {
      ...this.source(identity, capture.transport, capture.capture_id),
      direction: "outbound",
    }))
      this.journal.append(event, {
        request_id: identity.request,
        conversation_id: identity.conversation,
        parent_message_id: identity.parent,
      });
  }
  private ids(value: unknown) {
    const root = record(value),
      metadata = record(root?.metadata),
      message = record(root?.message),
      meta = record(message?.metadata);
    return {
      request:
        identifier(root?.request_id) ??
        identifier(metadata?.request_id) ??
        identifier(meta?.request_id),
      conversation:
        identifier(root?.conversation_id) ??
        identifier(metadata?.conversation_id) ??
        identifier(meta?.conversation_id),
      input: identifier(root?.input_message_id),
      parent:
        identifier(root?.parent_message_id) ?? identifier(message?.parent_id),
      message:
        record(message?.author)?.role === "assistant"
          ? identifier(message?.id)
          : identifier(root?.message_id),
    };
  }
  private compatible(identity: Identity, ids: ReturnType<Monitor["ids"]>) {
    for (const key of ["request", "conversation", "input", "message"] as const)
      if (identity[key] && ids[key] && identity[key] !== ids[key]) return false;
    return true;
  }
  private learn(identity: Identity, value: unknown) {
    const root = record(value),
      scope =
        root?.task_scope ??
        record(root?.metadata)?.task_scope ??
        record(record(root?.message)?.metadata)?.task_scope;
    if (scope !== undefined && scope !== "answer") {
      this.diagnostic("unsupported_task_scope", identity.capture.capture_id);
      return false;
    }
    const ids = this.ids(value);
    if (!this.compatible(identity, ids)) {
      this.diagnostic("identity_contradiction", identity.capture.capture_id);
      return false;
    }
    for (const key of [
      "request",
      "conversation",
      "input",
      "parent",
      "message",
    ] as const)
      if (!identity[key] && ids[key]) identity[key] = ids[key];
    return true;
  }
  private protocol(
    identity: Identity,
    transport: Source["transport"],
    segment: string,
    socket: string | null = null,
    proof: string = "confirmed_handoff_topic",
  ) {
    let accepted = true;
    return new Protocol(
      () => ({
        ...this.source(identity, transport, segment),
        association: accepted ? "confirmed" : "ambiguous",
        association_proof: socket ? proof : "same_observed_request",
      }),
      {
        identity: (value) => {
          accepted = this.learn(identity, value);
        },
        evidence: (events, observation) => {
          if (!identity.valid || !accepted) return;
          this.commit(
            identity,
            events,
            observation,
            transport === "websocket" ? this.arrivals.get(segment) : undefined,
          );
        },
        control: (kind, value) => {
          if (!identity.valid || !accepted) return;
          if (kind === "done") {
            this.complete(identity.capture.capture_id);
            return;
          }
          if (kind === "content") {
            this.counters.content_fragments++;
            return;
          }
          const topic = identifier(record(value)?.topic_id);
          if (kind === "handoff") {
            if (!topic) {
              this.diagnostic(
                "handoff_topic_unavailable",
                identity.capture.capture_id,
              );
              return;
            }
            if (identity.topics.size >= 32) {
              this.diagnostic("topic_limit", identity.capture.capture_id);
              return;
            }
            identity.topics.add(topic);
          }
          if (
            kind === "reconnect" &&
            socket &&
            topic &&
            identity.topics.has(topic)
          )
            this.diagnostics.push({
              code: "confirmed_reconnect",
              count: 1,
              capture_id: identity.capture.capture_id,
              socket_id: socket,
            });
        },
        error: (code) =>
          this.diagnostic(code, identity.capture.capture_id, socket),
      },
    );
  }
  private commit(
    identity: Identity,
    events: Evidence[],
    observation: ProtocolObservation,
    arrival?: number,
  ) {
    const info: Observation = {
      arrival_index: arrival,
      envelope_id: observation.envelope.id ?? undefined,
      envelope_event: observation.envelope.event,
      envelope_retry: observation.envelope.retry,
      delta_header: observation.op
        ? {
            path: observation.path,
            channel: observation.channel,
            explicit: observation.explicit,
          }
        : null,
      delta_op: observation.op ?? undefined,
      request_id: identity.request,
      conversation_id: identity.conversation,
      parent_message_id: identity.parent,
    };
    for (const event of events) {
      if (event.value_state === "invalid")
        this.diagnostic("invalid_route_field", identity.capture.capture_id);
      this.journal.append(event, {
        ...info,
        decode_index: observation.envelope.index,
      });
    }
  }
  async response(capture: CaptureStart, response: Response) {
    const identity = this.captures.get(capture.capture_id);
    if (!identity?.valid) {
      void response.body?.cancel().catch(() => {});
      return;
    }
    if (!response.body) {
      this.diagnostic("body_unavailable", capture.capture_id);
      return;
    }
    const reader = response.body.getReader();
    this.readers.set(capture.capture_id, reader);
    const parser = this.protocol(
      identity,
      capture.mode === "reload" ? "reload" : capture.transport,
      capture.capture_id,
    );
    const type = response.headers.get("content-type") ?? "";
    const sse = type.includes("text/event-stream");
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (identity.valid) {
        const next = await reader.read();
        if (next.done) break;
        if (!identity.valid) break;
        if (sse) parser.push(next.value);
        else {
          size += next.value.byteLength;
          if (size > (capture.mode === "reload" ? 8388608 : 1048576)) {
            this.diagnostic("json_body_limit", capture.capture_id);
            void reader.cancel().catch(() => {});
            return;
          }
          chunks.push(next.value);
        }
      }
      if (!identity.valid) return;
      if (sse) parser.finish();
      else {
        const merged = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        let value: unknown;
        try {
          value = JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(merged),
          );
        } catch {
          this.diagnostic("malformed_json", capture.capture_id);
          return;
        }
        if (capture.mode === "reload") this.reload(identity, value);
        else parser.json(value);
      }
      this.journal.segmentEof(capture.capture_id);
      if (
        !identity.topics.size &&
        sse &&
        this.journal.state(capture.capture_id).lifecycle === "Capturing"
      )
        this.diagnostic("completion_unavailable", capture.capture_id);
    } catch {
      if (identity.valid)
        this.diagnostic("observer_read_failed", capture.capture_id);
    } finally {
      this.readers.delete(capture.capture_id);
      reader.releaseLock();
    }
  }
  private reload(identity: Identity, value: unknown) {
    const root = record(value),
      mapping = record(root?.mapping),
      current = identifier(root?.current_node),
      conversation = identifier(root?.conversation_id) ?? identifier(root?.id);
    if (
      !mapping ||
      !current ||
      !conversation ||
      conversation !== identity.capture.conversation_id
    ) {
      this.diagnostic("reload_branch_unavailable", identity.capture.capture_id);
      return;
    }
    const visited = new Set<string>();
    let nodeId: string | null = current;
    let selected: Record<string, unknown> | null = null;
    while (nodeId) {
      if (visited.has(nodeId) || visited.size >= 64) {
        this.diagnostic("reload_branch_invalid", identity.capture.capture_id);
        return;
      }
      visited.add(nodeId);
      const node = record(mapping[nodeId]);
      if (!node) {
        this.diagnostic("reload_parent_missing", identity.capture.capture_id);
        return;
      }
      const message = record(node.message);
      if (!selected && record(message?.author)?.role === "assistant")
        selected = message;
      const parent = node.parent;
      if (parent !== null && typeof parent !== "string") {
        this.diagnostic("reload_parent_missing", identity.capture.capture_id);
        return;
      }
      nodeId = identifier(parent);
    }
    if (!selected) {
      this.diagnostic(
        "reload_assistant_unavailable",
        identity.capture.capture_id,
      );
      return;
    }
    identity.message = identifier(selected.id);
    identity.conversation = conversation;
    for (const event of responseEvidence(
      { message: selected },
      this.source(identity, "reload", identity.capture.capture_id),
    ))
      this.journal.append(event, {
        conversation_id: conversation,
        parser_status: "supported_reload_current_branch",
      });
    this.complete(identity.capture.capture_id, "reload_record_observed");
  }
  xhr(capture: CaptureStart, xhr: XMLHttpRequest, kind: string) {
    const identity = this.captures.get(capture.capture_id);
    if (!identity?.valid) return;
    if (["error", "abort", "timeout"].includes(kind)) {
      this.diagnostic(`xhr_${kind}`, capture.capture_id);
      return;
    }
    if (!["progress", "load"].includes(kind)) return;
    if (
      xhr.responseType !== "" &&
      xhr.responseType !== "text" &&
      xhr.responseType !== "json"
    ) {
      this.diagnostic("unsupported_xhr_response_type", capture.capture_id);
      return;
    }
    const isSse = (xhr.getResponseHeader("content-type") ?? "").includes(
      "text/event-stream",
    );
    if (!isSse) {
      if (kind === "load") {
        let value: unknown;
        try {
          value =
            xhr.responseType === "json"
              ? xhr.response
              : JSON.parse(xhr.responseText);
        } catch {
          this.diagnostic("malformed_xhr_json", capture.capture_id);
          return;
        }
        if (capture.mode === "reload") this.reload(identity, value);
        else this.protocol(identity, "xhr", capture.capture_id).json(value);
      }
      return;
    }
    let state = this.xhrs.get(xhr);
    if (!state) {
      state = {
        offset: 0,
        parser: this.protocol(identity, "xhr", capture.capture_id),
      };
      this.xhrs.set(xhr, state);
    }
    const text = xhr.responseText;
    if (text.length < state.offset) {
      this.diagnostic("xhr_offset_reversal", capture.capture_id);
      return;
    }
    state.parser.text(text.slice(state.offset));
    state.offset = text.length;
    if (kind === "load") {
      state.parser.finish();
      this.journal.segmentEof(capture.capture_id);
      this.xhrs.delete(xhr);
    }
  }
  private resolve(
    topic: string,
    value: unknown,
    context: Context,
  ): Identity | null {
    const ids = this.ids(value);
    const candidates = [...this.captures.values()].filter(
      (i) =>
        i.valid &&
        i.capture.context.document_id === context.document_id &&
        i.capture.context.epoch === context.epoch,
    );
    const lost = [...this.evicted.values()].find(
      (i) =>
        i.capture.context.document_id === context.document_id &&
        i.capture.context.epoch === context.epoch &&
        (ids.request
          ? i.request === ids.request
          : ids.input && ids.parent
            ? i.input === ids.input && i.parent === ids.parent
            : i.topics.has(topic)),
    );
    if (lost) {
      this.diagnostic("late_event_association_lost", lost.capture.capture_id);
      return null;
    }
    const owners = candidates.filter((i) => i.topics.has(topic));
    let matches = ids.request
      ? candidates.filter((i) => i.request === ids.request)
      : ids.input && ids.parent
        ? candidates.filter(
            (i) => i.input === ids.input && i.parent === ids.parent,
          )
        : owners;
    matches = matches.filter((i) => this.compatible(i, ids));
    if (
      matches.length !== 1 ||
      (owners.length && !owners.includes(matches[0]!))
    ) {
      this.diagnostic(
        matches.length > 1
          ? "ambiguous_ws_quarantine"
          : "orphan_or_contradiction_quarantine",
      );
      return null;
    }
    if (!ids.request && !ids.input && !owners.length) {
      this.diagnostic("candidate_ws_quarantine");
      return null;
    }
    return matches[0]!;
  }
  async socketMessage(
    socket: string,
    data: unknown,
    context: Context,
    arrival: number,
  ) {
    let queue = this.socketQueues.get(socket);
    if (!queue) {
      if (this.socketQueues.size >= 32) {
        this.diagnostic("socket_limit", null, socket);
        return;
      }
      queue = {
        chain: Promise.resolve(),
        pending: 0,
        bytes: 0,
        generation: this.generation,
      };
      this.socketQueues.set(socket, queue);
    }
    const size =
      typeof data === "string"
        ? new TextEncoder().encode(data).length
        : data instanceof Blob
          ? data.size
          : data instanceof ArrayBuffer
            ? data.byteLength
            : 0;
    this.counters.ws_message_events++;
    if (
      !size ||
      size > 2097152 ||
      queue.pending >= 64 ||
      queue.bytes + size > 8388608
    ) {
      this.diagnostic(
        size ? "ws_queue_limit" : "unsupported_ws_binary",
        null,
        socket,
      );
      for (const i of this.captures.values())
        if (i.valid && i.topics.size)
          this.journal.health(
            i.capture.capture_id,
            "Partial",
            "ws_known_drop_or_unsupported",
          );
      return;
    }
    queue.pending++;
    queue.bytes += size;
    const active = queue;
    active.chain = active.chain
      .then(async () => {
        if (active.generation !== this.generation) return;
        let text: string;
        try {
          text =
            typeof data === "string"
              ? data
              : new TextDecoder("utf-8", { fatal: true }).decode(
                  data instanceof Blob
                    ? await data.arrayBuffer()
                    : (data as ArrayBuffer),
                );
        } catch {
          this.diagnostic("invalid_ws_utf8", null, socket);
          return;
        }
        if (active.generation !== this.generation) return;
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch {
          this.diagnostic("malformed_ws_json", null, socket);
          return;
        }
        if (!Array.isArray(value) || value.length > 16) {
          this.diagnostic("unsupported_ws_envelope", null, socket);
          return;
        }
        for (const raw of value) {
          const envelope = record(raw),
            topic = identifier(envelope?.topic_id),
            encoded = record(record(envelope?.payload)?.payload)?.encoded_item;
          if (!topic || typeof encoded !== "string") {
            this.diagnostic("unsupported_ws_envelope", null, socket);
            continue;
          }
          if (new TextEncoder().encode(encoded).length > 1048576) {
            this.diagnostic("ws_encoded_limit", null, socket);
            continue;
          }
          const key = `${socket}:${topic}`;
          let parser = this.socketParsers.get(key);
          if (!parser) {
            // Resolve only from a registered envelope root, never from recursive body text.
            const probe = new SseProbe(encoded);
            const identity = this.resolve(topic, probe.first, context);
            if (!identity) continue;
            if (this.socketParsers.size >= 1024) {
              this.diagnostic(
                "topic_limit",
                identity.capture.capture_id,
                socket,
              );
              continue;
            }
            const previous = this.topicSockets.get(topic);
            if (previous && previous !== socket)
              this.diagnostic(
                "candidate_reconnect",
                identity.capture.capture_id,
                socket,
              );
            this.topicSockets.set(topic, socket);
            const ids = this.ids(probe.first);
            parser = this.protocol(
              identity,
              "websocket",
              socket,
              socket,
              ids.request
                ? "confirmed_request_id"
                : ids.input && ids.parent
                  ? "confirmed_input_parent"
                  : "confirmed_handoff_topic",
            );
            this.socketParsers.set(key, parser);
            this.parserOwners.set(key, identity.capture.capture_id);
          }
          this.arrivals.set(socket, arrival);
          parser.text(encoded);
          // encoded_item is an SSE fragment; incomplete data carries across items.
        }
      })
      .catch(() => this.diagnostic("ws_observer_failed", null, socket))
      .finally(() => {
        active.pending--;
        active.bytes -= size;
      });
    await active.chain;
  }
  canReleaseClosed(id: string) {
    return (
      this.journal.state(id).lifecycle === "Closed" &&
      !this.readers.has(id) &&
      !this.readers.has(`${id}:request`) &&
      !this.timers.has(id) &&
      ![...this.socketQueues.values()].some((q) => q.pending > 0) &&
      ![...this.parserOwners].some(
        ([key, owner]) =>
          owner === id && this.socketParsers.get(key)?.sse.pending,
      )
    );
  }
  releaseClosedCapture(id: string) {
    if (!this.canReleaseClosed(id)) return false;
    const identity = this.captures.get(id);
    if (identity) {
      identity.valid = false;
      this.evicted.set(id, identity);
      while (this.evicted.size > 128)
        this.evicted.delete(this.evicted.keys().next().value!);
      this.captures.delete(id);
      for (const [key, owner] of this.parserOwners)
        if (owner === id) {
          this.parserOwners.delete(key);
          this.socketParsers.delete(key);
        }
      for (const topic of identity.topics) {
        if ([...this.captures.values()].some((i) => i.topics.has(topic)))
          continue;
        const socket = this.topicSockets.get(topic);
        this.topicSockets.delete(topic);
        if (socket && ![...this.topicSockets.values()].includes(socket)) {
          this.socketQueues.delete(socket);
          this.arrivals.delete(socket);
        }
      }
    }
    return true;
  }
  discardCapture(id: string) {
    const identity = this.captures.get(id);
    if (identity) identity.valid = false;
    const reader = this.readers.get(id);
    if (reader) void reader.cancel().catch(() => {});
    this.readers.delete(id);
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.journal.discard(id);
  }
  reset(context: Context, reason: string) {
    this.journal.reset(context, reason);
    if (["pause", "clear", "dispose"].includes(reason)) {
      this.generation++;
      for (const identity of this.captures.values()) identity.valid = false;
      for (const reader of this.readers.values())
        void reader.cancel().catch(() => {});
      this.readers.clear();
      this.socketQueues.clear();
      this.socketParsers.clear();
      this.parserOwners.clear();
      this.topicSockets.clear();
      this.arrivals.clear();
      for (const timer of this.timers.values()) clearTimeout(timer);
      this.timers.clear();
      this.xhrs = new WeakMap();
      if (reason === "clear") {
        this.captures.clear();
        this.evicted.clear();
        this.diagnostics.length = 0;
        this.journal.clear();
      }
    }
  }
  sink(): HostSink {
    return {
      request: (capture, input, init, requestClone) => {
        this.request(
          capture,
          capture.transport === "fetch" ? init?.body : input,
        );
        if (requestClone) void this.requestClone(capture, requestClone);
      },
      event: (event) => {
        if (
          event.capture_id &&
          ["request_rejected", "request_throw"].includes(event.kind)
        ) {
          this.journal.health(event.capture_id, "Failed", event.kind);
          this.journal.terminate(event.capture_id, event.kind);
        }
        if (event.kind === "hook_replaced")
          for (const identity of this.captures.values())
            if (identity.valid)
              this.journal.health(
                identity.capture.capture_id,
                "Partial",
                "hook_replaced",
              );
      },
      response: (capture, response) => {
        void this.response(capture, response);
      },
      xhr: (capture, xhr, kind) => this.xhr(capture, xhr, kind),
      socket: (id, _socket, kind, event, context) => {
        if (kind === "message")
          void this.socketMessage(
            id,
            (event as MessageEvent).data,
            context,
            this.counters.ws_message_events + 1,
          );
        else {
          this.diagnostic(`ws_${kind}`, null, id);
          if (kind === "close" || kind === "error")
            void this.closeSocket(id, kind);
        }
      },
      reset: (context, reason) => this.reset(context, reason),
    };
  }
  private async closeSocket(id: string, kind: string) {
    const generation = this.generation;
    const queue = this.socketQueues.get(id);
    await queue?.chain;
    if (generation !== this.generation) return;
    for (const [key, parser] of this.socketParsers)
      if (key.startsWith(`${id}:`)) {
        parser.finish();
        this.socketParsers.delete(key);
        this.parserOwners.delete(key);
      }
    for (const identity of this.captures.values())
      if (
        identity.valid &&
        [...identity.topics].some((t) => this.topicSockets.get(t) === id) &&
        this.journal.state(identity.capture.capture_id).lifecycle ===
          "Capturing"
      )
        this.journal.health(
          identity.capture.capture_id,
          "Partial",
          `ws_${kind}_before_completion`,
        );
    if (kind === "close") {
      this.socketQueues.delete(id);
      this.arrivals.delete(id);
    }
  }
  private async requestClone(capture: CaptureStart, request: Request) {
    if (!request.body) return;
    const identity = this.captures.get(capture.capture_id);
    if (!identity?.valid) return;
    const reader = request.body.getReader();
    const key = `${capture.capture_id}:request`;
    this.readers.set(key, reader);
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (identity.valid) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > 1048576) {
          this.diagnostic("request_body_limit", capture.capture_id);
          void reader.cancel().catch(() => {});
          return;
        }
        chunks.push(next.value);
      }
      if (!identity.valid) return;
      const merged = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.request(
        capture,
        new TextDecoder("utf-8", { fatal: true }).decode(merged),
      );
    } catch {
      if (identity.valid)
        this.diagnostic("request_clone_failed", capture.capture_id);
    } finally {
      this.readers.delete(key);
      reader.releaseLock();
    }
  }
}
// Only one complete supported SSE JSON envelope is inspected for association.
class SseProbe {
  first: unknown = null;
  constructor(text: string) {
    const parser = new Protocol(() => ({}) as Source, {
      identity: (value) => {
        if (this.first === null) this.first = value;
      },
      evidence() {},
      control() {},
      error() {},
    });
    parser.text(text);
  }
}
