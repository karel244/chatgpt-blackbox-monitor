import { record, type Scalar } from "./route.ts";
export const ENVIRONMENT_VERSION = "environment-1";
export type EnvironmentAvailability =
  | "observed"
  | "derived"
  | "declared"
  | "unavailable"
  | "not_exposed"
  | "unknown"
  | "invalid";
export interface EnvironmentField {
  value: Scalar;
  source: string;
  availability: EnvironmentAvailability;
  privacy_class: string;
  observed_at: string;
}
export interface EnvironmentInput {
  navigator?: unknown;
  screen?: unknown;
  viewport?: unknown;
  origin?: unknown;
  visibility?: unknown;
  focus?: unknown;
  timezone?: unknown;
  offset?: unknown;
}
export function environmentFields(
  input: EnvironmentInput,
  observed_at: string,
): Record<string, EnvironmentField> {
  const fields: Record<string, EnvironmentField> = {};
  const n = record(input.navigator),
    s = record(input.screen),
    v = record(input.viewport),
    connection = record(n?.connection);
  const add = (
    key: string,
    value: Scalar,
    source: string,
    availability: EnvironmentAvailability = "observed",
    privacy = "local_environment_reduce_on_export",
  ) =>
    (fields[key] = {
      value,
      source,
      availability,
      privacy_class: privacy,
      observed_at,
    });
  const text = (
    key: string,
    raw: unknown,
    source: string,
    pattern: RegExp,
    max = 128,
  ) =>
    add(
      key,
      typeof raw === "string" && raw.length <= max && pattern.test(raw)
        ? raw
        : null,
      source,
      raw === undefined
        ? "not_exposed"
        : typeof raw === "string" && raw.length <= max && pattern.test(raw)
          ? "observed"
          : "invalid",
    );
  const number = (
    key: string,
    raw: unknown,
    source: string,
    min = 0,
    max = 100000,
  ) =>
    add(
      key,
      typeof raw === "number" &&
        Number.isFinite(raw) &&
        raw >= min &&
        raw <= max
        ? raw
        : null,
      source,
      raw === undefined
        ? "not_exposed"
        : typeof raw === "number" &&
            Number.isFinite(raw) &&
            raw >= min &&
            raw <= max
          ? "observed"
          : "invalid",
    );
  const boolean = (key: string, raw: unknown, source: string) =>
    add(
      key,
      typeof raw === "boolean" ? raw : null,
      source,
      raw === undefined
        ? "not_exposed"
        : typeof raw === "boolean"
          ? "observed"
          : "invalid",
    );
  text(
    "user_agent",
    n?.userAgent,
    "navigator.userAgent",
    /^[A-Za-z0-9 .;()/,_:+-]+$/,
    512,
  );
  const ua = fields.user_agent?.value;
  const match =
    typeof ua === "string"
      ? (/(Edg)\/(\d{1,4})/.exec(ua) ??
        /(Firefox|Chrome)\/(\d{1,4})/.exec(ua) ??
        /Version\/(\d{1,4})[^]*Safari\//.exec(ua))
      : null;
  add(
    "browser",
    match
      ? match[1] === "Edg"
        ? "Edge"
        : match[1] === "Chrome"
          ? "Chrome"
          : match[1] === "Firefox"
            ? "Firefox"
            : "Safari"
      : null,
    "derived:navigator.userAgent",
    match ? "derived" : "unknown",
  );
  add(
    "browser_major",
    match ? Number(match[2] ?? match[1]) : null,
    "derived:navigator.userAgent",
    match ? "derived" : "unknown",
  );
  text("platform", n?.platform, "navigator.platform", /^[A-Za-z0-9 _.-]+$/, 64);
  const os =
    typeof ua !== "string"
      ? null
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Windows/.test(ua)
            ? "Windows"
            : /Mac OS X/.test(ua)
              ? "macOS"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  add("os", os, "derived:navigator.userAgent", os ? "derived" : "unknown");
  add(
    "os_uncertainty",
    os ? "UA-derived, spoofable and possibly reduced" : "Unknown",
    "derived:navigator.userAgent",
    "derived",
  );
  const platform =
    typeof fields.platform?.value === "string" ? fields.platform.value : "";
  add(
    "consistency",
    (os === "Windows" && /Linux|Mac/.test(platform)) ||
      (os === "Linux" && /Win|Mac/.test(platform))
      ? "inconsistent"
      : "not_proven",
    "derived:UA/platform",
    "derived",
  );
  add(
    "ua_data_availability",
    n?.userAgentData ? "low_entropy_object_visible" : null,
    "navigator.userAgentData",
    n?.userAgentData ? "observed" : "not_exposed",
  );
  text(
    "language",
    n?.language,
    "navigator.language",
    /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/,
  );
  const languages = n?.languages;
  const validLanguages =
    Array.isArray(languages) &&
    languages.length <= 16 &&
    languages.every(
      (x) =>
        typeof x === "string" &&
        /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(x) &&
        x.length <= 64,
    );
  add(
    "languages",
    validLanguages ? JSON.stringify(languages) : null,
    "navigator.languages",
    languages === undefined
      ? "not_exposed"
      : validLanguages
        ? "observed"
        : "invalid",
  );
  text(
    "timezone",
    input.timezone,
    "Intl.DateTimeFormat.resolvedOptions.timeZone",
    /^[A-Za-z0-9_+/-]+$/,
  );
  number(
    "timezone_offset",
    input.offset,
    "Date.getTimezoneOffset",
    -1440,
    1440,
  );
  for (const key of ["width", "height"]) {
    number(`screen.${key}`, s?.[key], `screen.${key}`);
    number(
      `viewport.${key}`,
      v?.[key],
      `window.inner${key === "width" ? "Width" : "Height"}`,
    );
  }
  number("device_pixel_ratio", v?.dpr, "window.devicePixelRatio", 0.1, 100);
  number(
    "hardware_concurrency",
    n?.hardwareConcurrency,
    "navigator.hardwareConcurrency",
    1,
    4096,
  );
  number("device_memory", n?.deviceMemory, "navigator.deviceMemory", 0.1, 1024);
  text(
    "connection.effective_type",
    connection?.effectiveType,
    "navigator.connection.effectiveType",
    /^(slow-2g|2g|3g|4g)$/,
  );
  number(
    "connection.rtt",
    connection?.rtt,
    "navigator.connection.rtt",
    0,
    1000000,
  );
  number(
    "connection.downlink",
    connection?.downlink,
    "navigator.connection.downlink",
    0,
    1000000,
  );
  boolean(
    "connection.save_data",
    connection?.saveData,
    "navigator.connection.saveData",
  );
  let origin: string | null = null;
  try {
    if (typeof input.origin === "string") {
      const u = new URL(input.origin);
      if (["http:", "https:"].includes(u.protocol) && u.origin === input.origin)
        origin = u.origin;
    }
  } catch {
    /* unavailable */
  }
  add(
    "origin",
    origin,
    "location.origin",
    origin
      ? "observed"
      : input.origin === undefined
        ? "not_exposed"
        : "invalid",
    "safe_metadata",
  );
  text(
    "visibility",
    input.visibility,
    "document.visibilityState",
    /^(visible|hidden|prerender)$/,
  );
  boolean("focus", input.focus, "document.hasFocus");
  boolean("online", n?.onLine, "navigator.onLine");
  add(
    "client_ip",
    null,
    "no_authorized_visible_source",
    "unknown",
    "local_sensitive_omit_on_export",
  );
  return fields;
}
export function readEnvironment(
  page: Window & typeof globalThis,
): EnvironmentInput {
  const safe = <T>(read: () => T): T | undefined => {
    try {
      return read();
    } catch {
      return undefined;
    }
  };
  const navigator: Record<string, unknown> = {};
  for (const key of [
    "userAgent",
    "platform",
    "language",
    "languages",
    "hardwareConcurrency",
    "deviceMemory",
    "userAgentData",
    "onLine",
  ])
    navigator[key] = safe(
      () => (page.navigator as unknown as Record<string, unknown>)[key],
    );
  const connection = record(
    safe(
      () => (page.navigator as unknown as Record<string, unknown>).connection,
    ),
  );
  navigator.connection = connection
    ? Object.fromEntries(
        ["effectiveType", "rtt", "downlink", "saveData"].map((key) => [
          key,
          safe(() => connection[key]),
        ]),
      )
    : undefined;
  return {
    navigator,
    screen: {
      width: safe(() => page.screen.width),
      height: safe(() => page.screen.height),
    },
    viewport: {
      width: safe(() => page.innerWidth),
      height: safe(() => page.innerHeight),
      dpr: safe(() => page.devicePixelRatio),
    },
    origin: safe(() => page.location.origin),
    visibility: safe(() => page.document.visibilityState),
    focus: safe(() => page.document.hasFocus()),
    timezone: safe(
      () => new page.Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    offset: safe(() => new page.Date().getTimezoneOffset()),
  };
}
