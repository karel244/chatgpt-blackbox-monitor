export type Realm = Window & typeof globalThis;
export type Capability = "Available" | "Unavailable" | "Partial" | "Failed";
export type Transport =
  "fetch" | "xhr" | "websocket" | "eventsource" | "lifecycle";
export interface Context {
  document_id: string;
  visit_id: string;
  epoch: number;
}
export interface HookEvent extends Context {
  kind: string;
  transport: Transport;
  capture_id: string | null;
  timestamp: string;
  monotonic_ms: number;
  code?: number;
  size?: number;
  data_type?: string;
  failure_kind?: "abort" | "timeout" | "generic";
}
export interface CaptureStart {
  capture_id: string;
  context: Context;
  mode: "live" | "reload" | "requirements" | "network" | "environment";
  endpoint_path?: string;
  transport: "fetch" | "xhr" | "websocket" | "dom";
  conversation_id: string | null;
  started_at: number;
}
export interface HostSink {
  event?(event: HookEvent): void;
  request?(
    capture: CaptureStart,
    input: RequestInfo | URL | Document | XMLHttpRequestBodyInit | null,
    init?: RequestInit,
    requestClone?: Request,
  ): void;
  response?(capture: CaptureStart, response: Response): void;
  xhr?(capture: CaptureStart, xhr: XMLHttpRequest, kind: string): void;
  socket?(
    socket_id: string,
    socket: WebSocket,
    kind: string,
    event: Event,
    context: Context,
  ): void;
  reset?(context: Context, reason: string): void;
}
export interface HostOptions {
  allowedOrigins?: readonly string[];
  sink?: HostSink;
  now?: () => number;
  wall?: () => string;
  uuid?: () => string;
}
