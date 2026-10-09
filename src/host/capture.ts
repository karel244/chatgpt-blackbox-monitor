import { endpoint } from "./endpoints.ts";
import type {
  Capability,
  CaptureStart,
  Context,
  HookEvent,
  HostOptions,
  Realm,
  Transport,
} from "./types.ts";

const instances = new WeakMap<object, CaptureHost>();
export class CaptureHost {
  readonly health: Record<string, Capability> = {};
  readonly events: HookEvent[] = [];
  readonly readyTimes: Record<string, number> = {};
  context: Context;
  active = true;
  private disposed = false;
  private minimumEpoch = 0;
  private cleanup = new Set<() => void>();
  private checks: (() => void)[] = [];
  private allowed: readonly string[];
  private sink: NonNullable<HostOptions["sink"]>;
  private now: () => number;
  private wall: () => string;
  private uuid: () => string;

  constructor(
    private page: Realm,
    options: HostOptions = {},
  ) {
    this.allowed = options.allowedOrigins ?? [
      "https://chatgpt.com",
      "https://chat.openai.com",
    ];
    this.sink = options.sink ?? {};
    this.now = options.now ?? (() => page.performance.now());
    this.wall = options.wall ?? (() => new Date().toISOString());
    this.uuid = options.uuid ?? (() => page.crypto.randomUUID());
    this.context = {
      document_id: this.uuid(),
      visit_id: this.uuid(),
      epoch: 0,
    };
  }
  private safe(fn: () => void) {
    try {
      fn();
    } catch {
      this.health.observer = "Failed";
    }
  }
  private emit(
    kind: string,
    transport: Transport,
    capture?: CaptureStart,
    extra: Partial<HookEvent> = {},
  ) {
    if (
      !this.active ||
      this.disposed ||
      (capture && capture.context.epoch < this.minimumEpoch)
    )
      return;
    this.safe(() => {
      const event: HookEvent = {
        ...(capture?.context ?? this.context),
        kind,
        transport,
        capture_id: capture?.capture_id ?? null,
        timestamp: this.wall(),
        monotonic_ms: this.now(),
        ...extra,
      };
      if (this.events.length === 512) {
        this.events.shift();
        this.health.diagnostics = "Partial";
      }
      this.events.push(Object.freeze(event));
      this.sink.event?.(event);
    });
  }
  private start(
    raw: string,
    method: string,
    transport: "fetch" | "xhr",
  ): CaptureStart | null {
    if (!this.active || this.disposed) return null;
    const match = endpoint(
      raw,
      method,
      this.page.location.origin,
      this.allowed,
    );
    if (!match) return null;
    return this.begin(match, transport);
  }
  private begin(
    match: NonNullable<ReturnType<typeof endpoint>>,
    transport: "fetch" | "xhr",
  ): CaptureStart | null {
    if (!this.active || this.disposed) return null;
    return {
      capture_id: this.uuid(),
      context: { ...this.context },
      ...match,
      transport,
      started_at: this.now(),
    };
  }
  private replace<T extends object, K extends keyof T>(
    target: T,
    key: K,
    wrapper: T[K],
    transport: Transport,
  ) {
    const original = target[key];
    try {
      target[key] = wrapper;
      if (target[key] !== wrapper) throw new Error("unavailable");
      this.health[transport] = "Available";
      this.readyTimes[transport] = this.now();
      this.cleanup.add(() => {
        if (target[key] === wrapper) target[key] = original;
      });
      let reported = false;
      this.checks.push(() => {
        if (target[key] !== wrapper && !reported) {
          reported = true;
          this.health[transport] = "Partial";
          this.emit("hook_replaced", transport);
        }
      });
    } catch {
      this.health[transport] = "Unavailable";
    }
  }
  install() {
    this.installFetch();
    this.installXhr();
    this.installWebSocket();
    this.installEventSource();
    this.installLifecycle();
    return this;
  }
  private installFetch() {
    const original = this.page.fetch;
    if (typeof original !== "function") {
      this.health.fetch = "Unavailable";
      return;
    }
    const host = this;
    const wrapper: typeof fetch = function (this: unknown, ...args) {
      const [input, init] = args;
      let capture: CaptureStart | null = null;
      let requestClone: Request | undefined;
      host.safe(() => {
        const raw =
          typeof input === "string"
            ? input
            : input instanceof host.page.URL
              ? input.href
              : input.url;
        const method = (
          init?.method ??
          (typeof input === "object" && "method" in input
            ? input.method
            : "GET")
        ).toUpperCase();
        capture = host.start(raw, method, "fetch");
        if (
          capture &&
          host.page.Request &&
          input instanceof host.page.Request &&
          init?.body === undefined &&
          host.sink.request
        )
          requestClone = input.clone();
      });
      let promise: Promise<Response>;
      try {
        promise = Reflect.apply(original, this, args);
      } catch (error) {
        if (capture) host.emit("request_throw", "fetch", capture);
        throw error;
      }
      const started = capture as CaptureStart | null;
      if (started) {
        host.emit("request_start", "fetch", started);
        host.safe(() =>
          host.sink.request?.(started, input, init, requestClone),
        );
        void promise.then(
          (response) => {
            if (
              !host.active ||
              host.disposed ||
              started.context.epoch < host.minimumEpoch
            )
              return;
            host.emit("response_visible", "fetch", started);
            if (!host.sink.response) return;
            host.safe(() => {
              const clone = response.clone();
              host.page.queueMicrotask(() => {
                if (
                  host.active &&
                  !host.disposed &&
                  started.context.epoch >= host.minimumEpoch
                )
                  host.safe(() => host.sink.response?.(started, clone));
                else void clone.body?.cancel().catch(() => {});
              });
            });
          },
          (error: unknown) =>
            host.safe(() =>
              host.emit("request_rejected", "fetch", started, {
                failure_kind:
                  init?.signal?.aborted ||
                  (host.page.Request &&
                    input instanceof host.page.Request &&
                    input.signal.aborted) ||
                  ((error instanceof host.page.Error ||
                    error instanceof host.page.DOMException) &&
                    error.name === "AbortError")
                    ? "abort"
                    : "generic",
              }),
            ),
        );
      }
      return promise;
    };
    this.replace(this.page, "fetch", wrapper, "fetch");
  }
  private installXhr() {
    const ctor = this.page.XMLHttpRequest;
    if (!ctor) {
      this.health.xhr = "Unavailable";
      return;
    }
    const host = this;
    const proto = ctor.prototype;
    const originalOpen = proto.open;
    const originalSend = proto.send;
    const contexts = new WeakMap<
      XMLHttpRequest,
      { match: ReturnType<typeof endpoint>; capture: CaptureStart | null }
    >();
    const watched = new WeakSet<XMLHttpRequest>();
    const open = function (
      this: XMLHttpRequest,
      ...args: Parameters<XMLHttpRequest["open"]>
    ) {
      const result = Reflect.apply(originalOpen, this, args);
      contexts.set(this, {
        match: endpoint(
          String(args[1]),
          String(args[0]).toUpperCase(),
          host.page.location.origin,
          host.allowed,
        ),
        capture: null,
      });
      return result;
    } as XMLHttpRequest["open"];
    const send: XMLHttpRequest["send"] = function (this: XMLHttpRequest, body) {
      const ctx = contexts.get(this);
      if (ctx)
        host.safe(() => {
          ctx.capture = ctx.match ? host.begin(ctx.match, "xhr") : null;
        });
      const capture = ctx?.capture;
      if (capture && !watched.has(this)) {
        watched.add(this);
        const releases: (() => void)[] = [];
        for (const kind of [
          "loadstart",
          "readystatechange",
          "progress",
          "load",
          "error",
          "abort",
          "timeout",
          "loadend",
        ]) {
          const listener = () => {
            const current = contexts.get(this)?.capture;
            if (
              current &&
              host.active &&
              !host.disposed &&
              current.context.epoch >= host.minimumEpoch
            ) {
              host.emit(kind, "xhr", current);
              host.safe(() => host.sink.xhr?.(current, this, kind));
            }
            if (kind === "loadend") {
              for (const release of releases) release();
              watched.delete(this);
            }
          };
          this.addEventListener(kind, listener);
          const release = () => {
            this.removeEventListener(kind, listener);
            host.cleanup.delete(release);
          };
          releases.push(release);
          host.cleanup.add(release);
        }
      }
      if (capture) {
        host.emit("request_start", "xhr", capture);
        host.safe(() => host.sink.request?.(capture, body ?? null));
      }
      return Reflect.apply(originalSend, this, [body]);
    };
    this.replace(proto, "open", open, "xhr");
    this.replace(proto, "send", send, "xhr");
  }
  private allowedSocket(raw: string) {
    try {
      const url = new this.page.URL(raw, this.page.location.href);
      return (
        this.allowed.some(
          (origin) => new URL(origin).hostname === url.hostname,
        ) && ["wss:", "ws:"].includes(url.protocol)
      );
    } catch {
      return false;
    }
  }
  private installWebSocket() {
    const Native = this.page.WebSocket;
    if (!Native) {
      this.health.websocket = "Unavailable";
      return;
    }
    const host = this;
    const wrapper = new Proxy(Native, {
      construct(target, args, newTarget) {
        const socket: WebSocket = Reflect.construct(
          target,
          args,
          newTarget === wrapper ? target : newTarget,
        );
        host.safe(() => {
          if (!host.active || !host.allowedSocket(socket.url)) return;
          const socketId = host.uuid();
          const context = { ...host.context };
          const releases: (() => void)[] = [];
          for (const kind of ["open", "message", "close", "error"]) {
            const listener = (event: Event) => {
              if (kind === "close") for (const release of releases) release();
              if (
                !host.active ||
                host.disposed ||
                context.epoch < host.minimumEpoch
              )
                return;
              const extra: Partial<HookEvent> = {};
              if (kind === "message") {
                const data: unknown = (event as MessageEvent).data;
                extra.data_type =
                  typeof data === "string"
                    ? "string"
                    : data instanceof host.page.Blob
                      ? "Blob"
                      : data instanceof host.page.ArrayBuffer
                        ? "ArrayBuffer"
                        : "unsupported";
                extra.size =
                  typeof data === "string"
                    ? new host.page.TextEncoder().encode(data).byteLength
                    : data instanceof host.page.Blob
                      ? data.size
                      : data instanceof host.page.ArrayBuffer
                        ? data.byteLength
                        : 0;
              }
              if (kind === "close") extra.code = (event as CloseEvent).code;
              host.emit(kind, "websocket", undefined, extra);
              host.safe(() =>
                host.sink.socket?.(socketId, socket, kind, event, context),
              );
            };
            socket.addEventListener(kind, listener);
            const release = () => {
              socket.removeEventListener(kind, listener);
              host.cleanup.delete(release);
            };
            releases.push(release);
            host.cleanup.add(release);
          }
        });
        return socket;
      },
    });
    this.replace(this.page, "WebSocket", wrapper, "websocket");
  }
  private installEventSource() {
    const Native = this.page.EventSource;
    if (!Native) {
      this.health.eventsource = "Unavailable";
      return;
    }
    const host = this;
    const wrapper = new Proxy(Native, {
      construct(target, args, newTarget) {
        const source: EventSource = Reflect.construct(
          target,
          args,
          newTarget === wrapper ? target : newTarget,
        );
        host.safe(() => {
          const url = new URL(source.url, host.page.location.href);
          if (url.origin !== host.page.location.origin) return;
          for (const kind of ["open", "message", "error"]) {
            const listener = () => host.emit(kind, "eventsource");
            source.addEventListener(kind, listener);
            host.cleanup.add(() => source.removeEventListener(kind, listener));
          }
          // Arbitrary named events and native HTTP headers are not visible here.
          host.health.eventsource = "Partial";
        });
        return source;
      },
    });
    this.replace(this.page, "EventSource", wrapper, "eventsource");
  }
  private installLifecycle() {
    for (const key of ["pushState", "replaceState"] as const) {
      const original = this.page.history[key];
      const host = this;
      const wrapper: History[typeof key] = function (this: History, ...args) {
        const result = Reflect.apply(original, this, args);
        host.newVisit(key);
        return result;
      };
      this.replace(this.page.history, key, wrapper, "lifecycle");
    }
    for (const kind of ["popstate", "pageshow"] as const) {
      const listener = (event: Event) => {
        if (kind === "popstate" || (event as PageTransitionEvent).persisted)
          this.newVisit(kind);
        this.checkHooks();
      };
      this.page.addEventListener(kind, listener);
      this.cleanup.add(() => this.page.removeEventListener(kind, listener));
    }
  }
  newVisit(reason: string) {
    if (this.disposed) return;
    this.context = {
      ...this.context,
      visit_id: this.uuid(),
      epoch: this.context.epoch + 1,
    };
    this.emit(reason, "lifecycle");
    this.safe(() => this.sink.reset?.({ ...this.context }, reason));
    this.checkHooks();
  }
  checkHooks() {
    for (const check of this.checks) this.safe(check);
  }
  pause() {
    this.active = false;
    this.context = { ...this.context, epoch: this.context.epoch + 1 };
    this.minimumEpoch = this.context.epoch;
    this.safe(() => this.sink.reset?.({ ...this.context }, "pause"));
  }
  resume() {
    if (!this.disposed) {
      this.active = true;
      this.newVisit("resume");
    }
  }
  clear() {
    this.events.length = 0;
    this.newVisit("clear");
    this.minimumEpoch = this.context.epoch;
  }
  dispose() {
    if (this.disposed) return;
    this.pause();
    this.disposed = true;
    for (const cleanup of [...this.cleanup].reverse()) this.safe(cleanup);
    this.cleanup.clear();
    this.checks.length = 0;
    instances.delete(this.page);
  }
}
export function installHost(page: Realm, options: HostOptions = {}) {
  const previous = instances.get(page);
  if (previous) return previous;
  const host = new CaptureHost(page, options).install();
  instances.set(page, host);
  return host;
}
