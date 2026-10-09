import {
  projectState,
  type Journal,
  type Occurrence,
} from "../core/journal.ts";
import { HISTORY_SCHEMA, safeSnapshot, type Snapshot } from "./safety.ts";
export interface Store {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  listen?(key: string, callback: () => void): () => void;
}
export const LIMITS = {
  history: 200,
  age_ms: 30 * 86400000,
  total: 50 * 1048576,
  capture: 2 * 1048576,
  occurrences: 20000,
  chunk: 128 * 1024,
  pending: 256 * 1024,
  active: 8 * 1048576,
};
export async function digest(bytes: Uint8Array): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export const encode = (v: unknown) =>
  new TextEncoder().encode(JSON.stringify(v));
export interface RedactionGap {
  after: number;
  before: number;
  dropped: number;
}
interface Chunk {
  schema_version: string;
  sequence: number;
  first: number;
  last: number;
  events: Occurrence[];
  redaction_gaps: RedactionGap[];
}
interface ChunkRef {
  key: string;
  sequence: number;
  first: number;
  last: number;
  bytes: number;
  sha256: string;
}
export interface HistoryManifest {
  schema_version: string;
  clear_epoch: string;
  capture_id: string;
  writer_id: string;
  created_at: number;
  updated_at: number;
  committed_sequence: number;
  chunks: ChunkRef[];
  bytes: number;
  count: number;
  status: "Saved" | "Partial" | "Failed";
  notes: string[];
  redaction_gaps: RedactionGap[];
  snapshot: Omit<Snapshot, "events">;
}
export interface Recovered {
  manifest: HistoryManifest;
  snapshot: Snapshot;
  completeness: "Complete" | "Partial" | "Failed" | "Unknown";
  notes: string[];
  read_only: boolean;
}
export function conversationHistory(records: Recovered[]) {
  return records
    .filter((r) => r.snapshot.start.mode === "live")
    .sort((a, b) => b.manifest.created_at - a.manifest.created_at)
    .slice(0, LIMITS.history);
}
export function relatedHistory(records: Recovered[], snapshot: Snapshot) {
  return records
    .filter(
      (r) =>
        ["environment", "network", "requirements"].includes(
          r.snapshot.start.mode,
        ) &&
        r.snapshot.start.context.document_id ===
          snapshot.start.context.document_id &&
        r.snapshot.start.context.epoch === snapshot.start.context.epoch,
    )
    .slice(0, 32)
    .map((r) => r.snapshot);
}
export function migrateManifest(
  value: HistoryManifest,
  target = HISTORY_SCHEMA,
): HistoryManifest {
  if (
    !["history-0", "history-1", HISTORY_SCHEMA].includes(
      value.schema_version,
    ) ||
    target !== HISTORY_SCHEMA
  )
    throw Error("unsupported_migration");
  return {
    ...structuredClone(value),
    schema_version: target,
    redaction_gaps:
      value.schema_version === HISTORY_SCHEMA
        ? structuredClone(value.redaction_gaps)
        : [],
  };
}
const ROOT = "blackbox:history:";
const EPOCH = ROOT + "clear_epoch";
export class HistoryStore {
  onEpochChanged: (() => void) | undefined;
  private epoch = "";
  private chains = new Map<string, Promise<void>>();
  private pending = new Map<string, number>();
  private pendingTotal = 0;
  private owned = new Map<string, string>();
  private failed = new Set<string>();
  private positions = new Map<string, number>();
  private persistedRevisions = new Map<string, Readonly<object>>();
  private removeListener: (() => void) | undefined;
  readonly health = {
    status: "Unknown",
    queued_bytes: 0,
    saved: 0,
    dropped: 0,
  };
  constructor(
    readonly store: Store,
    readonly writer_id: string,
    private now = () => Date.now(),
    readonly limits = { ...LIMITS },
  ) {}
  async init() {
    const current = await this.store.get(EPOCH);
    // Missing key is the implicit initial epoch. No bootstrap write can race and overwrite Clear.
    this.epoch = typeof current === "string" ? current : "initial";
    this.removeListener = this.store.listen?.(EPOCH, () => {
      void this.syncEpoch().catch(() => {
        this.health.status = "Failed";
      });
    });
    this.health.status = "Ready";
  }
  private async syncEpoch() {
    const value = await this.store.get(EPOCH);
    const e = typeof value === "string" ? value : "initial";
    if (e !== this.epoch) {
      this.epoch = e;
      for (const id of [
        ...this.owned.keys(),
        ...this.positions.keys(),
        ...this.pending.keys(),
      ])
        this.failed.add(id);
      this.owned.clear();
      this.positions.clear();
      this.persistedRevisions.clear();
      this.onEpochChanged?.();
    }
    return e;
  }
  private prefix(epoch = this.epoch, schema = HISTORY_SCHEMA) {
    return `${ROOT}${schema}:${epoch}:`;
  }
  private key(id: string) {
    return (
      this.prefix() +
      encodeURIComponent(this.writer_id) +
      ":" +
      encodeURIComponent(id)
    );
  }
  queue(
    snapshot: Snapshot,
    committed?: (target: number) => void,
  ): Promise<void> {
    const id = snapshot.start.capture_id;
    this.persistedRevisions.delete(id);
    if (this.failed.has(id)) return Promise.resolve();
    if (this.pending.has(id)) return this.chains.get(id) ?? Promise.resolve();
    const safe = safeSnapshot(snapshot),
      metadata = { ...safe, events: [] };
    // Only indices actually present in the raw Journal and removed by safeSnapshot
    // can authorize a gap. A pre-existing hole cannot become a redaction declaration.
    const rawIndices = new Set(snapshot.events.map((e) => e.event_index));
    const safeIndices = new Set(safe.events.map((e) => e.event_index));
    const gaps: RedactionGap[] = [];
    let prior = 0;
    for (const e of safe.events) {
      if (e.event_index > prior + 1) {
        const dropped = e.event_index - prior - 1;
        if (
          dropped <= this.limits.occurrences &&
          Array.from({ length: dropped }, (_, i) => prior + i + 1).every(
            (i) => rawIndices.has(i) && !safeIndices.has(i),
          )
        )
          gaps.push({ after: prior, before: e.event_index, dropped });
      }
      prior = e.event_index;
    }
    let tail = encode(metadata).length + encode(gaps).length;
    const batch: Occurrence[] = [];
    for (const e of safe.events.filter(
      (e) => e.event_index > (this.positions.get(id) ?? 0),
    )) {
      const size = encode(e).length + 1;
      if (tail + size > this.limits.pending) break;
      batch.push(e);
      tail += size;
    }
    const unsaved = safe.events.some(
      (e) => e.event_index > (this.positions.get(id) ?? 0),
    );
    const target = safe.events.at(-1)?.event_index ?? 0;
    safe.events = batch;
    if (
      tail > this.limits.pending ||
      (unsaved && !batch.length) ||
      this.pendingTotal + tail > this.limits.active
    ) {
      this.health.dropped++;
      this.health.status = "Partial";
      this.failed.add(id);
      return this.markFailure({ ...safe, events: [] }, "pending_queue_limit");
    }
    const epoch = this.epoch;
    this.pending.set(id, tail);
    this.pendingTotal += tail;
    this.health.queued_bytes = this.pendingTotal;
    const previous = this.chains.get(id) ?? Promise.resolve();
    const chain = previous
      .then(async () => {
        const saved = await this.persist(safe, epoch, undefined, gaps);
        if (saved && this.epoch === epoch && !this.failed.has(id))
          committed?.(target);
      })
      .catch(() => {
        this.failed.add(id);
        this.health.status = "Failed";
      })
      .finally(() => {
        this.pending.delete(id);
        this.pendingTotal -= tail;
        this.health.queued_bytes = this.pendingTotal;
      });
    this.chains.set(id, chain);
    return chain;
  }
  async flush(journal: Journal) {
    const epoch = await this.syncEpoch();
    const ids = new Set(journal.ids());
    for (const id of this.persistedRevisions.keys())
      if (!ids.has(id)) this.persistedRevisions.delete(id);
    for (const id of ids) {
      const revision = journal.revision(id);
      if (
        revision &&
        this.persistedRevisions.get(id) === revision &&
        !this.pending.has(id) &&
        !this.failed.has(id)
      )
        continue;
      const s = journal.snapshot(id);
      if (!s || !revision) continue;
      for (let round = 0; round < 32; round++) {
        const before = this.positions.get(id) ?? 0;
        let target: number | undefined;
        await this.queue(s, (committed) => {
          target = committed;
        });
        const after = this.positions.get(id) ?? 0;
        // A pending caller cannot acknowledge this snapshot. All safe events and
        // metadata must be committed; acknowledge the captured token, not a newer one.
        if (
          target !== undefined &&
          after >= target &&
          !this.pending.has(id) &&
          !this.failed.has(id) &&
          this.epoch === epoch &&
          journal.revision(id) !== undefined
        ) {
          this.persistedRevisions.set(id, revision);
          break;
        }
        if (
          this.failed.has(id) ||
          after >= (s.events.at(-1)?.event_index ?? 0) ||
          after === before
        )
          break;
      }
    }
  }

  private async markFailure(snapshot: Snapshot, note: string) {
    try {
      await this.persist(snapshot, this.epoch, note);
    } catch {
      this.health.status = "Failed";
    }
  }
  private async persist(
    snapshot: Snapshot,
    epoch: string,
    forced?: string,
    gaps: RedactionGap[] = [],
  ) {
    if ((await this.syncEpoch()) !== epoch) return;
    const base = this.key(snapshot.start.capture_id),
      key = base + ":manifest";
    const old = (await this.store.get(key)) as HistoryManifest | undefined;
    if (
      old &&
      (old.schema_version !== HISTORY_SCHEMA ||
        old.writer_id !== this.writer_id)
    )
      throw Error("writer_or_schema_conflict");
    const { events, ...metadata } = snapshot;
    const manifest: HistoryManifest = old
      ? structuredClone(old)
      : {
          schema_version: HISTORY_SCHEMA,
          clear_epoch: epoch,
          capture_id: snapshot.start.capture_id,
          writer_id: this.writer_id,
          created_at: this.now(),
          updated_at: this.now(),
          committed_sequence: 0,
          chunks: [],
          bytes: 0,
          count: 0,
          status: "Saved",
          notes: [],
          redaction_gaps: [],
          snapshot: metadata,
        };
    manifest.snapshot = metadata;
    manifest.updated_at = this.now();
    if (forced) {
      manifest.status = "Partial";
      manifest.notes.push(forced);
    }
    let batch: Occurrence[] = [];
    let size = 2;
    let manifestWrittenByCommit = false;
    const commit = async () => {
      if (!batch.length) return;
      const sequence = manifest.committed_sequence + 1,
        chunk: Chunk = {
          schema_version: HISTORY_SCHEMA,
          sequence,
          first: batch[0]!.event_index,
          last: batch.at(-1)!.event_index,
          events: batch,
          redaction_gaps: gaps.filter((g) =>
            batch.some((e) => e.event_index === g.before),
          ),
        };
      const data = encode(chunk);
      if (
        data.length > this.limits.chunk ||
        manifest.bytes + data.length + encode(metadata).length >
          this.limits.capture ||
        manifest.count + batch.length > this.limits.occurrences
      ) {
        manifest.status = "Partial";
        manifest.notes.push("capture_storage_limit");
        manifestWrittenByCommit = false;
        return false;
      }
      const chunkKey = base + `:chunk:${sequence}`;
      await this.store.set(chunkKey, chunk);
      if ((await this.syncEpoch()) !== epoch) return false;
      manifest.chunks.push({
        key: chunkKey,
        sequence,
        first: chunk.first,
        last: chunk.last,
        bytes: data.length,
        sha256: await digest(data),
      });
      manifest.redaction_gaps.push(...chunk.redaction_gaps);
      if (chunk.redaction_gaps.length) {
        manifest.status = "Partial";
        if (!manifest.notes.includes("storage_redaction_drop"))
          manifest.notes.push("storage_redaction_drop");
      }
      manifest.committed_sequence = sequence;
      manifest.bytes += data.length;
      manifest.count += batch.length;
      await this.store.set(key, manifest);
      manifestWrittenByCommit = true;
      batch = [];
      size = 2;
      return true;
    };
    try {
      if (!forced)
        for (const e of events.filter(
          (e) => e.event_index > (manifest.chunks.at(-1)?.last ?? 0),
        )) {
          const length = encode(e).length + 1;
          if (length + 256 > this.limits.chunk) {
            manifest.status = "Partial";
            manifest.notes.push("occurrence_storage_limit");
            manifestWrittenByCommit = false;
            break;
          }
          if (
            size + length + 256 > this.limits.chunk &&
            (await commit()) === false
          )
            break;
          batch.push(e);
          size += length;
        }
      await commit();
      if ((await this.syncEpoch()) !== epoch) return;
      // Keep metadata-only/failure writes; a successful final chunk already
      // committed this exact manifest unless a later limit changed its status.
      if (!manifestWrittenByCommit) await this.store.set(key, manifest);
      this.owned.set(snapshot.start.capture_id, key);
      this.health.saved++;
      this.positions.set(
        snapshot.start.capture_id,
        manifest.chunks.at(-1)?.last ?? 0,
      );
      if (
        manifest.status === "Partial" &&
        manifest.notes.includes("capture_storage_limit")
      )
        this.failed.add(snapshot.start.capture_id);
      if (manifest.status === "Partial") this.health.status = "Partial";
      return this.epoch === epoch;
    } catch {
      this.health.status = "Failed";
      this.failed.add(snapshot.start.capture_id);
      throw Error("persistent_storage_failed");
    }
  }
  // Read back committed bytes, including every chunk hash and final Closed metadata.
  // An existing key/position alone is never an eviction certificate.
  async committedThrough(snapshot: Snapshot): Promise<boolean> {
    const id = snapshot.start.capture_id;
    if (this.failed.has(id) || this.pending.has(id)) return false;
    const key = this.owned.get(id);
    if (!key) return false;
    try {
      const epoch = await this.store.get(EPOCH);
      if ((typeof epoch === "string" ? epoch : "initial") !== this.epoch)
        return false;
      const recovered = await this.recover(key);
      const safe = safeSnapshot(snapshot);
      return (
        recovered.manifest.writer_id === this.writer_id &&
        recovered.manifest.clear_epoch === this.epoch &&
        recovered.manifest.status === "Saved" &&
        recovered.completeness === "Complete" &&
        !recovered.read_only &&
        recovered.notes.length === 0 &&
        projectState(snapshot).lifecycle === "Closed" &&
        safe.events.length === snapshot.events.length &&
        JSON.stringify(recovered.snapshot) === JSON.stringify(safe)
      );
    } catch {
      return false;
    }
  }
  releaseCommitted(id: string) {
    if (this.pending.has(id)) return;
    this.chains.delete(id);
    this.positions.delete(id);
    this.owned.delete(id);
    this.failed.delete(id);
    this.persistedRevisions.delete(id);
  }
  async drain() {
    await Promise.all(this.chains.values());
  }
  async list(): Promise<Recovered[]> {
    await this.syncEpoch();
    const keys = (await this.store.keys()).filter(
      (k) =>
        [HISTORY_SCHEMA, "history-0", "history-1"].some((schema) =>
          k.startsWith(this.prefix(this.epoch, schema)),
        ) && k.endsWith(":manifest"),
    );
    const active = (await this.store.get(ROOT + "active_schema")) as
      | { schema_version: string; manifest_key: string; previous_key: string }
      | undefined;
    if (
      active &&
      typeof active.manifest_key === "string" &&
      active.manifest_key.startsWith(ROOT)
    ) {
      const selected = (await this.store.get(active.manifest_key)) as
        HistoryManifest | undefined;
      if (selected?.clear_epoch === this.epoch) {
        const i = keys.indexOf(active.previous_key);
        if (i >= 0) keys.splice(i, 1);
        keys.push(active.manifest_key);
      }
    }
    const out: Recovered[] = [];
    for (const k of keys) {
      try {
        out.push(await this.recover(k));
      } catch {
        this.health.status = "Partial";
      }
    }
    return out.sort((a, b) => b.manifest.created_at - a.manifest.created_at);
  }
  async recover(key: string): Promise<Recovered> {
    const m = (await this.store.get(key)) as HistoryManifest;
    if (!m || typeof m !== "object" || !Array.isArray(m.chunks) || !m.snapshot)
      throw Error("invalid_manifest");
    const notes = [...m.notes],
      events: Occurrence[] = [];
    let previous = 0;
    const read_only = m.schema_version !== HISTORY_SCHEMA;
    if (read_only) notes.push("unsupported_schema_read_only");
    const declared: RedactionGap[] = [];
    for (const [i, ref] of m.chunks.entries()) {
      if (ref.sequence !== i + 1) {
        notes.push("sequence_gap");
      }
      const c = (await this.store.get(ref.key)) as Chunk | undefined;
      if (!c) {
        notes.push("missing_chunk");
        continue;
      }
      if (
        (await digest(encode(c))) !== ref.sha256 ||
        encode(c).length !== ref.bytes
      ) {
        notes.push("hash_mismatch");
        continue;
      }
      if (
        c.schema_version !== m.schema_version ||
        c.sequence !== ref.sequence ||
        !Array.isArray(c.events) ||
        c.first !== ref.first ||
        c.last !== ref.last
      ) {
        notes.push("chunk_manifest_mismatch");
        continue;
      }
      const chunkGaps =
        !read_only && Array.isArray(c.redaction_gaps) ? c.redaction_gaps : [];
      declared.push(...chunkGaps);
      const used = new Set<RedactionGap>();
      for (const e of c.events) {
        if (
          !Number.isSafeInteger(e.event_index) ||
          e.event_index < 1 ||
          e.event_index <= previous
        )
          notes.push("sequence_gap");
        else if (e.event_index !== previous + 1) {
          const matching = chunkGaps.filter(
            (g) =>
              Number.isSafeInteger(g.after) &&
              Number.isSafeInteger(g.before) &&
              Number.isSafeInteger(g.dropped) &&
              g.after === previous &&
              g.before === e.event_index &&
              g.dropped === e.event_index - previous - 1 &&
              g.dropped > 0 &&
              g.dropped <= this.limits.occurrences,
          );
          if (matching.length === 1) used.add(matching[0]!);
          else notes.push("sequence_gap");
        }
        events.push(e);
        previous = e.event_index;
      }
      if (used.size !== chunkGaps.length)
        notes.push("redaction_metadata_mismatch");
      if (
        c.events[0]?.event_index !== c.first ||
        c.events.at(-1)?.event_index !== c.last
      )
        notes.push("chunk_manifest_mismatch");
    }
    if (
      !read_only &&
      JSON.stringify(declared) !== JSON.stringify(m.redaction_gaps)
    )
      notes.push("redaction_metadata_mismatch");
    if (m.committed_sequence !== m.chunks.length || m.count !== events.length)
      notes.push("commit_count_gap");
    const base = key.slice(0, -":manifest".length);
    const known = new Set(m.chunks.map((c) => c.key));
    if (
      (await this.store.keys()).some(
        (k) => k.startsWith(base + ":chunk:") && !known.has(k),
      )
    )
      notes.push("orphan_chunk");
    const safe = safeSnapshot({ ...m.snapshot, events });
    if (safe.events.length !== events.length) notes.push("redaction_drop");
    const partial = notes.length > 0 || m.status !== "Saved";
    const corruption =
      notes.some((n) => n !== "storage_redaction_drop") ||
      m.status === "Failed" ||
      (m.status === "Partial" && !notes.includes("storage_redaction_drop"));
    // Recovery is a projection of committed bytes, never a fresh wall-clock event.
    for (const control of safe.controls)
      if (
        control.code === "storage_redaction_drop" &&
        !m.snapshot.controls.some((c) => c.code === "storage_redaction_drop")
      )
        control.timestamp = new Date(m.updated_at).toISOString();
    if (corruption)
      safe.controls.push({
        kind: "health",
        code: "storage_recovery_gap",
        health: "Partial",
        timestamp: new Date(m.updated_at).toISOString(),
        monotonic_ms: safe.start.started_at,
      });
    return {
      manifest: m,
      snapshot: safe,
      notes: [...new Set(notes)],
      completeness: partial ? "Partial" : projectState(safe).completeness,
      read_only,
    };
  }
  async clearCurrent(id: string) {
    await this.drain();
    const key = this.owned.get(id) ?? this.key(id) + ":manifest";
    this.failed.add(id);
    if (key) await this.removeCapture(key);
  }
  private async removeCapture(key: string) {
    for (const id of this.persistedRevisions.keys())
      if (this.key(id) + ":manifest" === key)
        this.persistedRevisions.delete(id);
    const base = key.slice(0, -":manifest".length);
    for (const k of await this.store.keys())
      if (k === key || k.startsWith(base + ":chunk:"))
        await this.store.delete(k);
  }
  async clearHistory() {
    await this.drain();
    for (const r of await this.list())
      if (projectState(r.snapshot).lifecycle === "Closed") {
        const key =
          r.manifest.chunks[0]?.key.replace(/:chunk:\d+$/, ":manifest") ??
          this.prefix() +
            encodeURIComponent(r.manifest.writer_id) +
            ":" +
            encodeURIComponent(r.manifest.capture_id) +
            ":manifest";
        await this.removeCapture(key);
      }
    await this.deletionNote("clear_history");
  }
  async clearExperiment(uuid: string) {
    if (!/^[a-f0-9-]{36}$/i.test(uuid)) throw Error("invalid_experiment_uuid");
    for (const key of await this.store.keys())
      if (key.startsWith(`blackbox:experiment:${uuid}:`))
        await this.store.delete(key);
    await this.deletionNote("clear_experiment");
  }
  private async deletionNote(scope: string) {
    await this.store.set(`${ROOT}management:${crypto.randomUUID()}`, {
      schema_version: HISTORY_SCHEMA,
      scope,
      at: this.now(),
      clear_epoch: this.epoch,
    });
  }
  async clearAll() {
    const next = crypto.randomUUID();
    await this.store.set(EPOCH, next);
    await this.syncEpoch();
    await this.drain();
    for (const k of await this.store.keys())
      if (
        (k.startsWith(ROOT) && k !== EPOCH) ||
        k.startsWith("blackbox:experiment:")
      )
        await this.store.delete(k);
    await this.deletionNote("clear_all");
  }
  // Retention discovery needs committed metadata, not occurrence bodies. UI,
  // export and eviction certificates continue to use full list/recover validation.
  private async retentionMetadata() {
    const epoch = await this.syncEpoch();
    const schemas = [HISTORY_SCHEMA, "history-0", "history-1"];
    const keys = (await this.store.keys()).filter(
      (k) =>
        schemas.some((schema) => k.startsWith(this.prefix(epoch, schema))) &&
        k.endsWith(":manifest"),
    );
    const active = (await this.store.get(ROOT + "active_schema")) as
      { manifest_key?: string; previous_key?: string } | undefined;
    if (
      active &&
      typeof active.manifest_key === "string" &&
      active.manifest_key.startsWith(ROOT)
    ) {
      const selected = (await this.store.get(active.manifest_key)) as
        HistoryManifest | undefined;
      if (selected?.clear_epoch === epoch) {
        const i = keys.indexOf(active.previous_key ?? "");
        if (i >= 0) keys.splice(i, 1);
        keys.push(active.manifest_key);
      }
    }
    const records: { manifest: HistoryManifest; snapshot: Snapshot }[] = [];
    for (const key of keys) {
      const m = (await this.store.get(key)) as HistoryManifest | undefined;
      const start = m?.snapshot?.start,
        controls = m?.snapshot?.controls;
      if (
        !m ||
        !schemas.includes(m.schema_version) ||
        m.clear_epoch !== epoch ||
        typeof m.capture_id !== "string" ||
        typeof m.writer_id !== "string" ||
        !Number.isFinite(m.created_at) ||
        !Number.isFinite(m.updated_at) ||
        !Number.isSafeInteger(m.bytes) ||
        m.bytes < 0 ||
        !Number.isSafeInteger(m.count) ||
        m.count < 0 ||
        !Array.isArray(m.chunks) ||
        m.committed_sequence !== m.chunks.length ||
        !m.chunks.every(
          (c, i) =>
            c &&
            c.sequence === i + 1 &&
            typeof c.key === "string" &&
            c.key.startsWith(ROOT) &&
            Number.isSafeInteger(c.bytes) &&
            c.bytes >= 0 &&
            Number.isSafeInteger(c.first) &&
            c.first >= 1 &&
            Number.isSafeInteger(c.last) &&
            c.last >= c.first &&
            typeof c.sha256 === "string" &&
            /^[a-f0-9]{64}$/.test(c.sha256),
        ) ||
        !["Saved", "Partial", "Failed"].includes(m.status) ||
        !Array.isArray(m.notes) ||
        !m.notes.every((n) => typeof n === "string") ||
        !start ||
        start.capture_id !== m.capture_id ||
        !Number.isFinite(start.started_at) ||
        !["live", "reload", "environment", "requirements", "network"].includes(
          start.mode,
        ) ||
        !start.context ||
        typeof start.context.document_id !== "string" ||
        typeof start.context.visit_id !== "string" ||
        !Number.isSafeInteger(start.context.epoch) ||
        !Array.isArray(controls) ||
        !controls.every(
          (c) =>
            c &&
            [
              "started",
              "complete",
              "health",
              "closed",
              "invalidated",
              "segment_eof",
            ].includes(c.kind) &&
            Number.isFinite(c.monotonic_ms) &&
            typeof c.timestamp === "string" &&
            typeof c.code === "string" &&
            ["Complete", "Partial", "Failed", "Unknown"].includes(c.health),
        ) ||
        !Number.isSafeInteger(m.snapshot.control_dropped) ||
        m.snapshot.control_dropped < 0
      ) {
        // Malformed/unsupported metadata never becomes a deletion candidate.
        this.health.status = "Partial";
        continue;
      }
      records.push({ manifest: m, snapshot: { ...m.snapshot, events: [] } });
    }
    if ((await this.syncEpoch()) !== epoch) return [];
    return records.sort(
      (a, b) => b.manifest.created_at - a.manifest.created_at,
    );
  }
  async cleanup() {
    const records = await this.retentionMetadata();
    const remaining = new Set(records),
      oldest = [...records].sort(
        (a, b) => a.manifest.created_at - b.manifest.created_at,
      ),
      closed = (r: (typeof records)[number]) =>
        projectState(r.snapshot).lifecycle === "Closed",
      live = (r: (typeof records)[number]) => r.snapshot.start.mode === "live",
      removed = {
        age: 0,
        conversation_limit: 0,
        byte_budget: 0,
        auxiliary: 0,
        live: 0,
      };
    let total = records.reduce(
        (n, r) => n + r.manifest.bytes + encode(r.manifest).length,
        0,
      ),
      closedRounds = records.filter((r) => closed(r) && live(r)).length;
    const remove = async (
      r: (typeof records)[number],
      reason: "age" | "conversation_limit" | "byte_budget",
    ) => {
      const key =
        this.prefix() +
        encodeURIComponent(r.manifest.writer_id) +
        ":" +
        encodeURIComponent(r.manifest.capture_id) +
        ":manifest";
      await this.removeCapture(key);
      total -= r.manifest.bytes + encode(r.manifest).length;
      remaining.delete(r);
      if (live(r)) closedRounds--;
      removed[reason]++;
      removed[live(r) ? "live" : "auxiliary"]++;
    };
    for (const r of oldest)
      if (closed(r) && this.now() - r.manifest.created_at > this.limits.age_ms)
        await remove(r, "age");
    for (const r of oldest)
      if (
        closedRounds > this.limits.history &&
        remaining.has(r) &&
        closed(r) &&
        live(r)
      )
        await remove(r, "conversation_limit");
    for (const isLive of [false, true])
      for (const r of oldest)
        if (
          total > this.limits.total &&
          remaining.has(r) &&
          closed(r) &&
          live(r) === isLive
        )
          await remove(r, "byte_budget");
    if (closedRounds > this.limits.history || total > this.limits.total)
      this.health.status = "Partial";
    const conversationRounds = [...remaining].filter(live).length;
    return {
      count: remaining.size,
      total_records: remaining.size,
      conversation_rounds: conversationRounds,
      closed_conversation_rounds: closedRounds,
      auxiliary_records: remaining.size - conversationRounds,
      bytes: total,
      active_retained: records.filter(
        (r) => projectState(r.snapshot).lifecycle !== "Closed",
      ).length,
      removed,
    };
  }
  async migrate(key: string, target = HISTORY_SCHEMA) {
    const old = (await this.store.get(key)) as HistoryManifest;
    const next = migrateManifest(old, target);
    const newBase = `${ROOT}${target}:migration-${crypto.randomUUID()}`;
    for (const ref of next.chunks) {
      const c = (await this.store.get(ref.key)) as Chunk;
      if (!c || (await digest(encode(c))) !== ref.sha256)
        throw Error("migration_source_corrupt");
      const migrated = {
        ...structuredClone(c),
        schema_version: target,
        redaction_gaps:
          old.schema_version === HISTORY_SCHEMA ? c.redaction_gaps : [],
      };
      ref.key = newBase + `:chunk:${ref.sequence}`;
      ref.sha256 = await digest(encode(migrated));
      ref.bytes = encode(migrated).length;
      await this.store.set(ref.key, migrated);
    }
    next.bytes = next.chunks.reduce((n, c) => n + c.bytes, 0);
    await this.store.set(newBase + ":manifest", next);
    const recovered = await this.recover(newBase + ":manifest");
    if (recovered.notes.length) throw Error("migration_validation_failed");
    await this.store.set(ROOT + "active_schema", {
      schema_version: target,
      manifest_key: newBase + ":manifest",
      previous_key: key,
    });
    return recovered;
  }
  dispose() {
    this.removeListener?.();
  }
}
