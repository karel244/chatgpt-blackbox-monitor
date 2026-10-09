import { record, type Scalar } from "../core/route.ts";
import { digest, encode, type Store } from "../history/storage.ts";
export const EXPERIMENT_SCHEMA = "experiment-1";
export const PROMPT_RULE = "exact-ordered-parts-json-1";
export const CONDITION_KEYS = [
  "account",
  "attachments",
  "history",
  "memory",
  "tools",
  "mode",
  "browser_profile",
  "order",
] as const;
export interface Condition {
  value: Scalar;
  availability: "observed" | "declared" | "unknown";
}
export interface Descriptor {
  schema_version: typeof EXPERIMENT_SCHEMA;
  experiment_uuid: string;
  display_id: string;
  task_id: string;
  replicate: number;
  browser_label: string;
  conditions: Record<string, Condition>;
}
export interface Run {
  descriptor: Descriptor;
  run_id: string;
  prompt: { rule: typeof PROMPT_RULE; key_id: string; hmac: string } | null;
}
export const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const word = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(v);
const exactKeys = (o: Record<string, unknown>, keys: string[]) =>
  Object.keys(o).length === keys.length &&
  Object.keys(o).every((k) => keys.includes(k));
export function validateDescriptor(input: unknown): Descriptor {
  const d = record(input);
  if (
    !d ||
    !exactKeys(d, [
      "schema_version",
      "experiment_uuid",
      "display_id",
      "task_id",
      "replicate",
      "browser_label",
      "conditions",
    ]) ||
    d.schema_version !== EXPERIMENT_SCHEMA ||
    !uuid(d.experiment_uuid) ||
    !word(d.display_id) ||
    !word(d.task_id) ||
    !word(d.browser_label) ||
    !Number.isSafeInteger(d.replicate) ||
    Number(d.replicate) < 1 ||
    Number(d.replicate) > 10000
  )
    throw Error("invalid_experiment_descriptor");
  const conditions = record(d.conditions);
  if (!conditions || !exactKeys(conditions, [...CONDITION_KEYS]))
    throw Error("invalid_conditions");
  for (const [k, input] of Object.entries(conditions)) {
    const c = record(input);
    if (
      !c ||
      !exactKeys(c, ["value", "availability"]) ||
      !["observed", "declared", "unknown"].includes(String(c.availability)) ||
      !(
        c.value === null ||
        typeof c.value === "boolean" ||
        (typeof c.value === "number" &&
          Number.isFinite(c.value) &&
          Math.abs(c.value) <= 10000) ||
        word(c.value)
      ) ||
      (c.availability === "unknown" && c.value !== null) ||
      (k === "account" &&
        (c.availability === "observed" ||
          ![null, "same", "different", "unknown"].includes(
            c.value as string | null,
          )))
    )
      throw Error("invalid_condition");
  }
  return structuredClone(d) as unknown as Descriptor;
}
export function createDescriptor(
  task_id: string,
  browser_label: string,
  conditions: Partial<Record<(typeof CONDITION_KEYS)[number], Condition>> = {},
): Descriptor {
  return validateDescriptor({
    schema_version: EXPERIMENT_SCHEMA,
    experiment_uuid: crypto.randomUUID(),
    display_id: `AB-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-001`,
    task_id,
    replicate: 1,
    browser_label,
    conditions: Object.fromEntries(
      CONDITION_KEYS.map((k) => [
        k,
        conditions[k] ?? { value: null, availability: "unknown" },
      ]),
    ),
  });
}
export function validateRun(input: unknown): Run {
  const r = record(input);
  if (
    !r ||
    !exactKeys(r, ["descriptor", "run_id", "prompt"]) ||
    !uuid(r.run_id)
  )
    throw Error("invalid_experiment_run");
  const descriptor = validateDescriptor(r.descriptor);
  const p = record(r.prompt);
  if (
    r.prompt !== null &&
    (!p ||
      !exactKeys(p, ["rule", "key_id", "hmac"]) ||
      p.rule !== PROMPT_RULE ||
      ![p.key_id, p.hmac].every(
        (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v),
      ))
  )
    throw Error("invalid_prompt_association");
  return { descriptor, run_id: r.run_id, prompt: r.prompt as Run["prompt"] };
}
export async function associatePrompt(
  key: string,
  parts: string[],
): Promise<NonNullable<Run["prompt"]>> {
  if (
    !/^[a-f0-9]{64}$/.test(key) ||
    parts.length > 128 ||
    parts.some((p) => typeof p !== "string") ||
    parts.reduce((n, p) => n + p.length, 0) > 1048576
  )
    throw Error("invalid_transient_prompt_association");
  const bytes = Uint8Array.from(key.match(/../g)!, (h) => parseInt(h, 16));
  const imported = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    imported,
    encode({ rule: PROMPT_RULE, parts }),
  );
  return {
    rule: PROMPT_RULE,
    key_id: await digest(bytes),
    hmac: [...new Uint8Array(signature)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join(""),
  };
}
export class Experiments {
  private runs = new Map<string, Run>();
  constructor(private store: Store) {}
  async save(descriptor: unknown, key?: string) {
    const d = validateDescriptor(descriptor);
    if (key !== undefined && !/^[a-f0-9]{64}$/.test(key))
      throw Error("invalid_experiment_key");
    await this.store.set(
      `blackbox:experiment:${d.experiment_uuid}:descriptor`,
      d,
    );
    if (key)
      await this.store.set(`blackbox:experiment:${d.experiment_uuid}:key`, {
        schema_version: EXPERIMENT_SCHEMA,
        key,
      });
    return d;
  }
  async bind(capture_id: string, descriptor: unknown, parts?: string[]) {
    const d = validateDescriptor(descriptor);
    const local = record(
      await this.store.get(`blackbox:experiment:${d.experiment_uuid}:key`),
    );
    const run: Run = {
      descriptor: d,
      run_id: crypto.randomUUID(),
      prompt:
        parts && typeof local?.key === "string"
          ? await associatePrompt(local.key, parts)
          : null,
    };
    this.runs.set(capture_id, run);
    await this.store.set(
      `blackbox:experiment:${d.experiment_uuid}:run:${run.run_id}`,
      { schema_version: EXPERIMENT_SCHEMA, capture_id, run },
    );
    return structuredClone(run);
  }
  get(capture_id: string) {
    const r = this.runs.get(capture_id);
    return r ? structuredClone(r) : null;
  }
}
