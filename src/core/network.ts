import { identifier, record, type Scalar } from "./route.ts";

export const NETWORK_VERSION = "network-1";
export const AUX_SCHEMA_VERSION = "1.1";
export type Availability =
  | "observed"
  | "not_exposed"
  | "absent"
  | "absent_in_observed_payload"
  | "invalid"
  | "explicit_null"
  | "not_captured"
  | "unsupported"
  | "unknown";
export interface Available<T> {
  value: T | null;
  availability: Availability;
  source: string;
}
export type NetworkVerdict =
  | "OK"
  | "HTTP Error"
  | "Challenge Confirmed"
  | "Challenge Suspected"
  | "Rate Limited"
  | "Server Error"
  | "Transport Failure"
  | "Aborted"
  | "Unknown";
export const SAFE_HEADERS = [
  "content-type",
  "cf-mitigated",
  "cf-ray",
  "server",
  "retry-after",
  "server-timing",
] as const;
export type SafeHeader = (typeof SAFE_HEADERS)[number];
export interface TimingMetric {
  name: string;
  dur: number | null;
}
export interface RetryAfter {
  seconds: number | null;
  date: string | null;
}
export interface HttpEvidence {
  status: Available<number>;
  headers: Record<SafeHeader, Available<string | RetryAfter | TimingMetric[]>>;
  indicators: {
    html: boolean;
    challenge_resource_template: boolean;
    registered_html_structure: boolean;
  };
  network_version: string;
}
const result = <T>(
  value: T | null,
  availability: Availability,
  source: string,
): Available<T> => ({ value, availability, source });
export function retryAfter(raw: string): RetryAfter | null {
  if (/^\d{1,10}$/.test(raw)) return { seconds: Number(raw), date: null };
  if (
    !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      raw,
    )
  )
    return null;
  const date = Date.parse(raw);
  return Number.isFinite(date)
    ? { seconds: null, date: new Date(date).toISOString() }
    : null;
}
export function serverTiming(raw: string): TimingMetric[] | null {
  if (raw.length > 4096) return null;
  // Quoted descriptions can contain commas. They are discarded, never retained.
  const clean = raw.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const parts = clean.split(",");
  if (parts.length > 32) return null;
  const metrics: TimingMetric[] = [];
  for (const part of parts) {
    const [nameRaw, ...params] = part.trim().split(";");
    const name = nameRaw?.trim();
    if (!name || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return null;
    let dur: number | null = null;
    for (const param of params) {
      if (!/^\s*dur\s*=/i.test(param)) continue;
      const value = /^\s*dur\s*=\s*(\d+(?:\.\d+)?)\s*$/i.exec(param)?.[1];
      if (!value || !Number.isFinite(Number(value))) return null;
      dur = Number(value);
    }
    metrics.push({ name, dur });
  }
  return metrics;
}
export function readSafeHeaders(
  get: (name: SafeHeader) => string | null,
  visibility: "readable" | "cors" | "opaque",
) {
  const headers = {} as HttpEvidence["headers"];
  for (const name of SAFE_HEADERS) {
    const source = `response.headers/${name}`;
    let raw: string | null;
    try {
      raw = visibility === "opaque" ? null : get(name);
    } catch {
      headers[name] = result<string | RetryAfter | TimingMetric[]>(
        null,
        "not_exposed",
        source,
      );
      continue;
    }
    if (raw === null) {
      headers[name] = result<string | RetryAfter | TimingMetric[]>(
        null,
        visibility === "opaque" ||
          (visibility === "cors" && name !== "content-type")
          ? "not_exposed"
          : "absent",
        source,
      );
      continue;
    }
    if (
      raw.length > (name === "server-timing" ? 4096 : 256) ||
      /[\r\n\0]/.test(raw)
    ) {
      headers[name] = result<string | RetryAfter | TimingMetric[]>(
        null,
        "invalid",
        source,
      );
      continue;
    }
    let value: string | RetryAfter | TimingMetric[] | null = null;
    if (name === "content-type") {
      const mime = raw.split(";")[0]?.trim().toLowerCase();
      if (mime && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime))
        value = mime;
    }
    if (name === "cf-mitigated" && raw.trim().toLowerCase() === "challenge")
      value = "challenge";
    if (
      name === "cf-ray" &&
      /^[0-9a-fA-F]{8,64}(?:-[A-Z]{3})?$/.test(raw.trim())
    )
      value = raw.trim();
    if (name === "server" && /^[a-zA-Z0-9_./-]{1,64}$/.test(raw.trim()))
      value = raw.trim();
    if (name === "retry-after") value = retryAfter(raw.trim());
    if (name === "server-timing") value = serverTiming(raw);
    headers[name] = result(
      value,
      value === null ? "invalid" : "observed",
      source,
    );
  }
  return headers;
}
export function httpEvidence(
  status: number,
  get: (name: SafeHeader) => string | null,
  visibility: "readable" | "cors" | "opaque" = "readable",
): HttpEvidence {
  const headers = readSafeHeaders(get, visibility);
  return {
    status: result(
      status >= 100 && status <= 599 && visibility !== "opaque" ? status : null,
      visibility === "opaque" || status === 0
        ? "not_exposed"
        : status >= 100 && status <= 599
          ? "observed"
          : "invalid",
      "response.status",
    ),
    headers,
    indicators: {
      html: headers["content-type"].value === "text/html",
      challenge_resource_template: false,
      registered_html_structure: false,
    },
    network_version: NETWORK_VERSION,
  };
}
export function htmlIndicators(text: string) {
  // Input is an already bounded transient prefix. No HTML or token leaves this function.
  const prefix = text.slice(0, 65536);
  return {
    challenge_resource_template:
      /(?:src|href)\s*=\s*["'][^"']*\/cdn-cgi\/challenge-platform\//i.test(
        prefix,
      ),
    registered_html_structure:
      /\bid\s*=\s*["']challenge-form["']/i.test(prefix) &&
      /\/cdn-cgi\/challenge-platform\//.test(prefix),
  };
}
export function networkVerdict(
  evidence: HttpEvidence | null,
  failure?: "abort" | "timeout" | "generic",
): NetworkVerdict {
  if (failure === "abort") return "Aborted";
  if (failure) return "Transport Failure";
  if (!evidence) return "Unknown";
  if (evidence.headers["cf-mitigated"].value === "challenge")
    return "Challenge Confirmed";
  if (
    evidence.indicators.html &&
    (evidence.indicators.challenge_resource_template ||
      evidence.indicators.registered_html_structure)
  )
    return "Challenge Suspected";
  const status = evidence.status.value;
  if (status === null) return "Unknown";
  if (status === 429) return "Rate Limited";
  if (status >= 500) return "Server Error";
  if (status >= 400) return "HTTP Error";
  if (status >= 200 && status < 400) return "OK";
  return "Unknown";
}
export interface PowEvidence {
  raw_hex: string | null;
  decimal: string | null;
  validity: Availability;
  request_id: string | null;
  source_path: string;
}
export function powEvidence(value: unknown): PowEvidence {
  const root = record(value);
  let container = root;
  let path = "/difficulty";
  outer: for (const [prefix, candidate] of [
    ["", root],
    ["/chat_requirements", record(root?.chat_requirements)],
    ["/requirements", record(root?.requirements)],
  ] as const) {
    for (const key of ["proofofwork", "proof_of_work", "pow"]) {
      const proof = record(candidate?.[key]);
      if (proof && Object.hasOwn(proof, "difficulty")) {
        container = proof;
        path = `${prefix}/${key}/difficulty`;
        break outer;
      }
    }
  }
  const exists = !!container && Object.hasOwn(container, "difficulty");
  const raw = container?.difficulty;
  const base = {
    raw_hex: null,
    decimal: null,
    validity: !exists
      ? "absent_in_observed_payload"
      : raw === null
        ? "explicit_null"
        : "invalid",
    request_id: identifier(root?.request_id),
    source_path: path,
  } as PowEvidence;
  if (
    typeof raw !== "string" ||
    raw.length > 256 ||
    !/^(?:0[xX])?[0-9a-fA-F]{1,256}$/.test(raw)
  )
    return base;
  const digits = raw.replace(/^0x/i, "");
  return {
    ...base,
    raw_hex: raw,
    decimal: BigInt(`0x${digits}`).toString(10),
    validity: "observed",
  };
}
export function powAssociation(
  pow: {
    request_id: string | null;
    document_id: string;
    epoch: number;
    monotonic_ms: number;
  },
  capture: {
    request_id: string | null;
    document_id: string;
    epoch: number;
    monotonic_ms: number;
  },
  maxDelta = 30000,
) {
  const delta = capture.monotonic_ms - pow.monotonic_ms;
  if (pow.document_id !== capture.document_id || pow.epoch !== capture.epoch)
    return {
      status: "unassociated",
      proof: "context_mismatch",
      delta_ms: null,
    };
  if (pow.request_id && capture.request_id)
    return pow.request_id === capture.request_id
      ? { status: "confirmed", proof: "exact_request_id", delta_ms: null }
      : {
          status: "unassociated",
          proof: "contradictory_request_id",
          delta_ms: null,
        };
  return delta >= 0 && delta <= maxDelta
    ? {
        status: "candidate",
        proof: "same_document_epoch_time_only",
        delta_ms: delta,
      }
    : {
        status: "unassociated",
        proof: "no_association_evidence",
        delta_ms: null,
      };
}
// P7 can call this projection; no persistence/export implementation is introduced here.
export function redactNetworkScalar(field: string, value: Scalar): Scalar {
  return field === "cf-ray" ? null : value;
}
