import { record } from "./route.ts";
export const BUILD_VERSION = "build-1";
export const NORMALIZATION_VERSION = "asset-normalization-1";
export interface Asset {
  url: string;
  asset_url_token: string | null;
  category: string;
  source: string;
  observed_at: string;
  availability: "observed";
}
export function normalizeAsset(
  raw: unknown,
  origin: string,
  source: string,
  observed_at: string,
): { asset: Asset | null; overflow: boolean } {
  if (typeof raw !== "string") return { asset: null, overflow: false };
  if (raw.length > 2048 || new TextEncoder().encode(raw).byteLength > 2048)
    return { asset: null, overflow: true };
  try {
    const u = new URL(raw, origin || undefined);
    if (!["http:", "https:"].includes(u.protocol))
      return { asset: null, overflow: false };
    const script = /\.m?js$/i.test(u.pathname),
      style = /\.css$/i.test(u.pathname),
      category = script ? "script" : style ? "style" : "resource";
    const registered =
      /^\/(?:_next\/static\/|assets\/|static\/|first\.js$)/.test(u.pathname);
    // Unknown paths and token/user/session identifiers are never retained verbatim.
    const sensitive =
      /(?:secret|session|account|token|auth|email)|\/(?:c|conversation|user)(?:\/|[-_])/i.test(
        u.pathname,
      ) || /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{20,}/i.test(u.pathname);
    let path = registered && !sensitive ? u.pathname : `/[${category}]`;
    if (registered && !sensitive) {
      const parts = path.split("/");
      if (
        parts.some(
          (part, index) =>
            part.length > 96 ||
            (index < parts.length - 1 &&
              /(?:token|secret|session)|[a-zA-Z0-9_-]{32,}/i.test(part)),
        )
      )
        path = `/[${category}]`;
      const filename = parts.at(-1) ?? "";
      if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(filename)) path = `/[${category}]`;
    }
    const token = path.startsWith("/[")
      ? null
      : (/(?:[.-])([0-9a-f]{8,64})(?=\.(?:m?js|css)$)/i.exec(path)?.[1] ??
        null);
    if (new TextEncoder().encode(u.origin + path).byteLength > 2048)
      return { asset: null, overflow: true };
    return {
      asset: {
        url: u.origin + path,
        asset_url_token: token,
        category,
        source,
        observed_at,
        availability: "observed",
      },
      overflow: false,
    };
  } catch {
    return { asset: null, overflow: false };
  }
}
export async function assetSetHash(
  urls: readonly string[],
  digest: (bytes: Uint8Array) => Promise<ArrayBuffer> = (bytes) =>
    crypto.subtle.digest("SHA-256", bytes as BufferSource),
) {
  const sorted = [...new Set(urls)].sort();
  const bytes = new TextEncoder().encode(JSON.stringify(sorted));
  return [...new Uint8Array(await digest(bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export class AssetSet {
  private values = new Map<string, Asset>();
  overflow = false;
  add(raw: unknown, origin: string, source: string, observed_at: string) {
    const { asset, overflow } = normalizeAsset(
      raw,
      origin,
      source,
      observed_at,
    );
    this.overflow ||= overflow;
    if (!asset || this.values.has(asset.url)) return false;
    if (this.values.size >= 500) {
      this.overflow = true;
      return false;
    }
    this.values.set(asset.url, asset);
    return true;
  }
  all() {
    return [...this.values.values()].sort((a, b) => a.url.localeCompare(b.url));
  }
}
export function publicMarkers(next: unknown, declared: unknown) {
  const scalar = (value: unknown) =>
    typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value)
      ? value
      : null;
  const build_id = scalar(record(next)?.buildId),
    deployment_marker = scalar(declared);
  return {
    build_id,
    deployment_marker,
    availability: build_id || deployment_marker ? "observed" : "unknown",
    conflict:
      !!build_id && !!deployment_marker && build_id !== deployment_marker,
  };
}
