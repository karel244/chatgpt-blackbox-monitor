export interface Envelope {
  data: string;
  event: string;
  id: string | null;
  retry: number | null;
  index: number;
}
export class Sse {
  private decoder = new TextDecoder("utf-8", { fatal: true });
  private line = "";
  private data: string[] = [];
  private name = "";
  private id: string | null = null;
  private retry: number | null = null;
  private skipLf = false;
  private first = true;
  private bytes = 0;
  private index = 0;
  private dropping = false;
  readonly counts = { envelopes: 0, malformed: 0, dropped: 0 };
  constructor(
    private accept: (envelope: Envelope) => void,
    private error: (code: string) => void,
    private limit = 1024 * 1024,
  ) {}
  get pending() {
    return this.line.length > 0 || this.data.length > 0 || this.dropping;
  }
  push(bytes: Uint8Array) {
    try {
      this.text(this.decoder.decode(bytes, { stream: true }));
    } catch {
      this.counts.malformed++;
      this.error("invalid_utf8");
    }
  }
  text(text: string) {
    for (const char of text) {
      if (this.first) {
        this.first = false;
        if (char === "\uFEFF") continue;
      }
      if (this.skipLf) {
        this.skipLf = false;
        if (char === "\n") continue;
      }
      if (char === "\r" || char === "\n") {
        this.readLine();
        if (char === "\r") this.skipLf = true;
        continue;
      }
      this.bytes += new TextEncoder().encode(char).length;
      if (this.bytes > this.limit) {
        if (!this.dropping) {
          this.dropping = true;
          this.counts.dropped++;
          this.error("sse_envelope_limit");
          this.line = "";
          this.data = [];
        }
        continue;
      }
      if (!this.dropping) this.line += char;
    }
  }
  private readLine() {
    const line = this.line;
    this.line = "";
    if (line === "") {
      if (!this.dropping && this.data.length) {
        this.counts.envelopes++;
        this.accept({
          data: this.data.join("\n"),
          event: this.name || "message",
          id: this.id,
          retry: this.retry,
          index: ++this.index,
        });
      }
      this.data = [];
      this.name = "";
      this.bytes = 0;
      this.dropping = false;
      return;
    }
    if (this.dropping || line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const key = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (key === "data") this.data.push(value);
    else if (key === "event")
      this.name = value.length <= 128 ? value : "unsupported";
    else if (key === "id" && !value.includes("\0"))
      this.id = /^[a-zA-Z0-9_.:-]{0,128}$/.test(value) ? value : null;
    else if (
      key === "retry" &&
      /^\d+$/.test(value) &&
      Number.isSafeInteger(Number(value))
    )
      this.retry = Number(value);
  }
  finish() {
    try {
      this.text(this.decoder.decode());
    } catch {
      this.error("incomplete_utf8");
      this.counts.malformed++;
    }
    if (this.line || this.data.length || this.dropping) {
      this.counts.dropped++;
      this.error("incomplete_sse_envelope");
    }
    this.line = "";
    this.data = [];
  }
}
