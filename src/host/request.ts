// P1 whitelist: transient parsing; never retains a body, headers or chat content.
export function projectRequest(body: unknown): Record<string, string> {
  if (typeof body !== "string" || body.length > 1024 * 1024) return {};
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Record<string, string> = {};
    for (const key of [
      "model",
      "thinking_effort",
      "requested_model_experience",
    ]) {
      const item = (value as Record<string, unknown>)[key];
      if (typeof item === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(item))
        result[key] = item;
    }
    return result;
  } catch {
    return {};
  }
}
