import { Journal } from "../../src/core/journal.ts";
import {
  requestEvidence,
  responseEvidence,
  type Source,
} from "../../src/core/route.ts";
import type { Store } from "../../src/history/storage.ts";
export class MemoryStore implements Store {
  readonly data = new Map<string, unknown>();
  readonly listeners = new Map<string, Set<() => void>>();
  fail: (key: string, value: unknown) => boolean = () => false;
  async get(k: string) {
    return structuredClone(this.data.get(k));
  }
  async set(k: string, v: unknown) {
    if (this.fail(k, v)) throw Error("simulated_quota_or_interruption");
    this.data.set(k, structuredClone(v));
    for (const cb of this.listeners.get(k) ?? []) cb();
  }
  async delete(k: string) {
    this.data.delete(k);
  }
  async keys() {
    return [...this.data.keys()];
  }
  listen(k: string, cb: () => void) {
    if (!this.listeners.has(k)) this.listeners.set(k, new Set());
    this.listeners.get(k)!.add(cb);
    return () => {
      this.listeners.get(k)!.delete(cb);
    };
  }
}
export function sample(id = "capture-real", count = 3) {
  let t = 0,
    n = 0;
  const j = new Journal(
    () => t,
    () => new Date(t).toISOString(),
    () => `${id}-event-${++n}`,
  );
  j.start({
    capture_id: id,
    context: { document_id: "doc-real", visit_id: "visit-real", epoch: 0 },
    mode: "live",
    transport: "fetch",
    conversation_id: "conv-real",
    started_at: 0,
  });
  const source: Source = {
    capture_id: id,
    task_scope: "answer",
    message_id: "msg-real",
    transport: "fetch",
    direction: "outbound",
    association: "confirmed",
    association_proof: "same_request",
    endpoint_verified: true,
    channel: "0",
    transport_segment_id: "segment-real",
  };
  for (const e of requestEvidence(
    {
      model: "model-one",
      thinking_effort: "high",
      messages: [{ content: "SECRET_PROMPT" }],
      Authorization: "SECRET_AUTH",
    },
    source,
  ))
    j.append(e, { request_id: "request-real" });
  for (let k = 0; k < count; k++)
    for (const e of responseEvidence(
      {
        type: "server_ste_metadata",
        metadata: { model_slug: "model-one", resolved_model_slug: "model-one" },
        answer: "SECRET_ANSWER",
      },
      { ...source, direction: "inbound" },
    ))
      j.append(e);
  t = 1000;
  j.complete(id);
  t = 32000;
  j.tick();
  return {
    j,
    snapshot: j.snapshot(id)!,
    time: (v: number) => {
      t = v;
    },
  };
}
