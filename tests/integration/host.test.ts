import test from "node:test";
import assert from "node:assert/strict";
import { installHost } from "../../src/host/capture.ts";
import type { Realm } from "../../src/host/types.ts";

class FakeXhr extends EventTarget {
  open() {}
  send() {
    this.dispatchEvent(new Event("loadstart"));
  }
}
class FakeSocket extends EventTarget {
  static OPEN = 1;
  url: string;
  constructor(url: string) {
    super();
    this.url = url;
  }
}
class FakeEventSource extends EventTarget {
  constructor(public url: string) {
    super();
  }
}
function realm(fetchFn: typeof fetch): Realm {
  const events = new EventTarget();
  return {
    fetch: fetchFn,
    XMLHttpRequest: FakeXhr,
    WebSocket: FakeSocket,
    EventSource: FakeEventSource,
    URL,
    Blob,
    ArrayBuffer,
    TextEncoder,
    crypto,
    performance,
    queueMicrotask,
    location: {
      origin: "https://chatgpt.com",
      href: "https://chatgpt.com/c/test",
    },
    history: { pushState() {}, replaceState() {} },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  } as unknown as Realm;
}
test("fetch returns original promise, calls once, does not await observer/body", async () => {
  let calls = 0;
  const response = new Response("original");
  const promise = Promise.resolve(response);
  const page = realm((() => {
    calls++;
    return promise;
  }) as typeof fetch);
  const host = installHost(page, {
    sink: {
      request() {
        throw new Error("observer failure");
      },
      response() {
        throw new Error("observer failure");
      },
    },
  });
  const returned = page.fetch("/backend-api/f/conversation", {
    method: "POST",
    body: "synthetic-private-body",
  });
  assert.equal(returned, promise);
  assert.equal(calls, 1);
  assert.equal(await returned, response);
  assert.equal(await response.text(), "original");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(host.health.observer, "Failed");
  assert.ok(!JSON.stringify(host.events).includes("synthetic-private-body"));
  host.dispose();
});
test("rejection and synchronous throw remain identical", async () => {
  const error = new Error("original-error");
  const promise = Promise.reject(error);
  const page = realm((() => promise) as typeof fetch);
  const host = installHost(page);
  assert.equal(
    page.fetch("/backend-api/f/conversation", { method: "POST" }),
    promise,
  );
  await assert.rejects(promise, (e) => e === error);
  host.dispose();
  const throwing = realm((() => {
    throw error;
  }) as typeof fetch);
  const other = installHost(throwing);
  assert.throws(
    () => throwing.fetch("/backend-api/f/conversation", { method: "POST" }),
    (e) => e === error,
  );
  other.dispose();
});
test("duplicate init, replacement, disposal and rebuilding do not stack wrappers", () => {
  const original = (async () => new Response("ok")) as typeof fetch;
  const page = realm(original);
  const host = installHost(page);
  const wrapper = page.fetch;
  assert.equal(installHost(page), host);
  assert.equal(page.fetch, wrapper);
  const thirdParty = (async () => new Response("third")) as typeof fetch;
  page.fetch = thirdParty;
  host.checkHooks();
  host.checkHooks();
  assert.equal(host.events.filter((x) => x.kind === "hook_replaced").length, 1);
  assert.equal(host.health.fetch, "Partial");
  assert.equal(page.fetch, thirdParty);
  host.dispose();
  assert.equal(page.fetch, thirdParty);
  const next = installHost(page);
  assert.notEqual(next, host);
  next.dispose();
  assert.equal(page.fetch, thirdParty);
});
test("XHR and WS event hooks preserve native instance, values and exceptions", () => {
  const page = realm((async () => new Response("ok")) as typeof fetch);
  const Native = page.WebSocket;
  const host = installHost(page);
  const xhr = new page.XMLHttpRequest();
  xhr.open("POST", "/backend-api/f/conversation");
  xhr.send("secret-canary");
  for (const kind of ["load", "error", "abort", "timeout", "loadend"])
    xhr.dispatchEvent(new Event(kind));
  const socket = new page.WebSocket("wss://chatgpt.com/synthetic");
  assert.ok(socket instanceof Native);
  assert.equal(page.WebSocket.OPEN, Native.OPEN);
  let seen: unknown;
  socket.addEventListener("message", (event) => {
    seen = (event as MessageEvent).data;
  });
  const data = "ws-secret-canary";
  socket.dispatchEvent(new MessageEvent("message", { data }));
  socket.dispatchEvent(new Event("open"));
  socket.dispatchEvent(new Event("error"));
  assert.equal(seen, data);
  assert.ok(!JSON.stringify(host.events).includes("canary"));
  for (const kind of ["load", "error", "abort", "timeout", "message", "open"])
    assert.ok(host.events.some((x) => x.kind === kind));
  host.dispose();
});
test("SPA, BFCache, pause and clear create boundaries without stale callbacks", async () => {
  let resolveResponse!: (r: Response) => void;
  const page = realm(
    (() =>
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      })) as typeof fetch,
  );
  let observed = 0;
  const host = installHost(page, {
    sink: {
      response() {
        observed++;
      },
    },
  });
  const visit = host.context.visit_id;
  page.history.pushState({}, "", "/c/next");
  assert.notEqual(host.context.visit_id, visit);
  const epoch = host.context.epoch;
  page.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  assert.equal(host.context.epoch, epoch + 1);
  const pending = page.fetch("/backend-api/f/conversation", { method: "POST" });
  host.pause();
  host.clear();
  resolveResponse(new Response("still original"));
  assert.equal(await (await pending).text(), "still original");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(observed, 0);
  host.resume();
  assert.ok(host.active);
  host.dispose();
});
