export function endpoint(
  raw: string,
  method: string,
  origin: string,
  allowed: readonly string[],
) {
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin || !allowed.includes(origin)) return null;
    const path = url.pathname.replace(/\/$/, "");
    if (
      method === "POST" &&
      [
        "/backend-api/sentinel/chat-requirements",
        "/backend-anon/sentinel/chat-requirements",
        "/api/sentinel/chat-requirements",
        "/backend-api/sentinel/chat-requirements/prepare",
        "/backend-anon/sentinel/chat-requirements/prepare",
        "/api/sentinel/chat-requirements/prepare",
      ].includes(path)
    )
      return {
        mode: "requirements" as const,
        conversation_id: null,
        endpoint_path: path,
      };
    if (
      method === "POST" &&
      [
        "/backend-api/conversation",
        "/backend-api/f/conversation",
        "/backend-api/f/conversations",
      ].includes(url.pathname)
    ) {
      return { mode: "live" as const, conversation_id: null };
    }
    const record = /^\/backend-api\/conversations?\/([^/]+)$/.exec(
      url.pathname,
    );
    if (
      method === "GET" &&
      record?.[1] &&
      record[1] !== "init" &&
      !["cursor", "offset", "before", "after"].some((k) =>
        url.searchParams.has(k),
      )
    ) {
      return {
        mode: "reload" as const,
        conversation_id: decodeURIComponent(record[1]),
      };
    }
  } catch {
    /* invalid URLs are not a supported capture endpoint */
  }
  return null;
}
