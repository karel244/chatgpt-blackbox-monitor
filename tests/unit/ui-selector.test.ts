import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installLayers } from "../../src/ui/layers.ts";
import { I18n } from "../../src/ui/i18n.ts";
import { chooseCapture } from "../../src/ui/projection.ts";
import { sample } from "../fixtures/history.ts";
class Node {
  children: Node[] = [];
  parent: Node | null = null;
  hidden = false;
  className = "";
  style: Record<string, string> = {};
  textContent = "";
  dataset: Record<string, string> = {};
  value = "A";
  get parentElement() {
    return this.parent;
  }
  prepend(n: Node) {
    this.append(n);
    this.children.pop();
    this.children.unshift(n);
  }
  querySelector(selector: string): Node | null {
    for (const c of this.children) {
      if ("." + c.className === selector) return c;
      const found = c.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  selectedOptions = [{ textContent: "fetch: A" }];
  get childNodes() {
    return this.children;
  }
  append(...nodes: Node[]) {
    for (const n of nodes) {
      if (n.parent)
        n.parent.children = n.parent.children.filter((x) => x !== n);
      n.parent = this;
      this.children.push(n);
    }
  }
  insertBefore(n: Node, reference: Node) {
    this.append(n);
    this.children.pop();
    this.children.splice(this.children.indexOf(reference), 0, n);
  }
  replaceChildren() {
    this.children = [];
  }
  setAttribute() {}
  addEventListener() {}
  focus() {}
}
function fixture() {
  const shell = new Node(),
    panel = new Node(),
    selector = new Node(),
    settings = new Node();
  panel.hidden = true;
  const workSlot = new Node();
  workSlot.className = "context-slot";
  panel.append(workSlot);
  shell.append(panel);
  const clicks = new Map<string, () => void>(),
    i18n = new I18n();
  const layers = installLayers(
    { createElement: () => new Node() } as unknown as Document,
    shell as unknown as HTMLElement,
    panel as unknown as HTMLElement,
    selector as unknown as HTMLElement,
    [],
    settings as unknown as HTMLElement,
    i18n,
    (label, parent, run) => {
      const b = new Node();
      (parent as unknown as Node).append(b);
      clicks.set(label, run);
      return b as unknown as HTMLButtonElement;
    },
    () => {
      panel.hidden = false;
      layers.update([], null, null, []);
    },
    () => {},
  );
  layers.update([], null, null, []);
  return { shell, panel, selector, layers, clicks };
}
test("shared neutral context follows visible surface and never duplicates selector", () => {
  const f = fixture();
  assert.equal(f.selector.parent, f.layers.context);
  assert.equal((f.layers.context as unknown as Node).parent, f.shell);
  assert.notEqual(f.selector.parent, f.layers.quick);
  assert.notEqual(f.selector.parent, f.panel);
  f.layers.dispose();
});
test("daily hides only full selector; Quick and Advanced show same node while quick stays hidden in Advanced", () => {
  const f = fixture();
  assert.equal(f.selector.hidden, true);
  f.layers.show();
  assert.equal(f.selector.hidden, false);
  assert.equal(
    (f.layers.context as unknown as Node).parent?.parent,
    f.layers.quick,
  );
  f.clicks.get("Advanced evidence")!();
  assert.equal(f.layers.quick.hidden, true);
  assert.equal(f.panel.hidden, false);
  assert.equal((f.layers.context as unknown as Node).parent?.parent, f.panel);
  assert.equal(f.selector.hidden, false);
  f.layers.close();
  assert.equal(f.selector.hidden, true);
  f.layers.dispose();
});
test("Quick to Advanced to Quick retains single selector value and never reconstructs node", () => {
  const f = fixture(),
    original = f.selector;
  f.layers.show();
  f.selector.value = "A";
  f.clicks.get("Advanced evidence")!();
  assert.equal(f.selector.value, "A");
  f.selector.value = "B";
  f.layers.show();
  assert.equal(f.selector.value, "B");
  assert.equal(original, f.selector);
  assert.equal(
    (f.layers.context as unknown as Node).children.filter((n) => n === original)
      .length,
    1,
  );
  f.layers.dispose();
});
test("context ownership adds no authoritative state or second option path to panel", () => {
  const panel = readFileSync(
      new URL("../../src/ui/panel.ts", import.meta.url),
      "utf8",
    ),
    layers = readFileSync(
      new URL("../../src/ui/layers.ts", import.meta.url),
      "utf8",
    );
  assert.equal(panel.match(/selected: Snapshot \| null/g)?.length, 1);
  assert.equal(
    panel.match(/const select = doc.createElement\("select"\)/g)?.length,
    1,
  );
  assert.doesNotMatch(
    layers,
    /selected\s*=|manual\s*=|createElement\("select"\)/,
  );
  assert.match(panel, /selected = chooseCapture\(snapshots, context, manual\)/);
});
test("shared selector is outside title drag subtree; existing guard still excludes select pointerdown", () => {
  const prefs = readFileSync(
    new URL("../../src/ui/preferences.ts", import.meta.url),
    "utf8",
  );
  const f = fixture();
  assert.equal((f.layers.context as unknown as Node).parent, f.shell);
  assert.match(prefs, /closest\("button,input,select,a"\)/);
  f.layers.dispose();
});
test("option refresh preserves manual capture despite newer request and late metadata, only missing selection falls back", () => {
  const a = structuredClone(sample("A").snapshot),
    b = structuredClone(sample("B").snapshot);
  b.start.started_at = 100;
  a.events.at(-1)!.monotonic_ms = 99999;
  assert.equal(
    chooseCapture([a, b], a.start.context, "A")?.start.capture_id,
    "A",
  );
  assert.equal(
    chooseCapture([a, b], a.start.context, "B")?.start.capture_id,
    "B",
  );
  assert.equal(chooseCapture([b], a.start.context, "A")?.start.capture_id, "B");
});
