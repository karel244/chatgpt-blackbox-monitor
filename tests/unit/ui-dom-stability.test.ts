import assert from "node:assert/strict";
import test from "node:test";
import { reconcileChildren } from "../../src/ui/layers.ts";

class DomNode {
  nodeType = 1;
  childNodes: DomNode[] = [];
  parentNode: DomNode | null = null;
  dataset: { eventId?: string } = {};
  attrs = new Map<string, string>();
  nodeValue: string | null = null;
  open = false;
  value = "";
  constructor(public nodeName: string) {}
  get tagName() {
    return this.nodeName;
  }
  get attributes() {
    return [...this.attrs].map(([name, value]) => ({ name, value }));
  }
  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
  insertBefore(node: DomNode, before: DomNode | null) {
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = before
      ? this.childNodes.indexOf(before)
      : this.childNodes.length;
    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }
  removeChild(node: DomNode) {
    this.childNodes.splice(this.childNodes.indexOf(node), 1);
    node.parentNode = null;
    return node;
  }
}
const append = (parent: DomNode, ...nodes: DomNode[]) => {
  for (const node of nodes) parent.insertBefore(node, null);
  return parent;
};
const patch = (parent: DomNode, nodes: DomNode[]) =>
  reconcileChildren(parent as unknown as Node, nodes as unknown as Node[]);
const row = (key: string) => {
  const node = new DomNode("ARTICLE");
  node.dataset.eventId = key;
  return node;
};
test("keyed rows survive insertion and reordering", () => {
  const a = row("a"),
    b = row("b"),
    parent = append(new DomNode("DIV"), a, b);
  patch(parent, [row("b"), row("c"), row("a")]);
  assert.equal(parent.childNodes[0], b);
  assert.equal(parent.childNodes[2], a);
  assert.equal(a.parentNode, parent);
});
test("details and summary identity retain browser-owned open state", () => {
  const summary = new DomNode("SUMMARY"),
    details = append(new DomNode("DETAILS"), summary);
  details.open = true;
  details.attrs.set("open", "");
  const parent = append(new DomNode("DIV"), details);
  patch(parent, [append(new DomNode("DETAILS"), new DomNode("SUMMARY"))]);
  assert.equal(parent.childNodes[0], details);
  assert.equal(details.childNodes[0], summary);
  assert.equal(details.open, true);
});
test("draft text updates without replacing its live text node", () => {
  const text = new DomNode("#text");
  text.nodeType = 3;
  text.nodeValue = "before";
  const draft = new DomNode("#text");
  draft.nodeType = 3;
  draft.nodeValue = "after";
  const parent = append(new DomNode("DIV"), text);
  patch(parent, [draft]);
  assert.equal(parent.childNodes[0], text);
  assert.equal(text.nodeValue, "after");
});
test("input value and identity are not reset by detached drafts", () => {
  const input = new DomNode("INPUT"),
    draft = new DomNode("INPUT");
  input.value = "user typed";
  input.attrs.set("value", "old");
  draft.attrs.set("value", "default");
  const parent = append(new DomNode("DIV"), input);
  patch(parent, [draft]);
  assert.equal(parent.childNodes[0], input);
  assert.equal(input.value, "user typed");
  assert.equal(input.getAttribute("value"), "old");
});
test("option values follow the current capture inventory", () => {
  const option = new DomNode("OPTION"),
    draft = new DomNode("OPTION");
  option.attrs.set("value", "old-id");
  draft.attrs.set("value", "current-id");
  const parent = append(new DomNode("SELECT"), option);
  patch(parent, [draft]);
  assert.equal(parent.childNodes[0], option);
  assert.equal(option.getAttribute("value"), "current-id");
});
test("removed event rows disconnect while retained rows stay attached", () => {
  const a = row("a"),
    b = row("b"),
    parent = append(new DomNode("DIV"), a, b);
  patch(parent, [row("b")]);
  assert.deepEqual(parent.childNodes, [b]);
  assert.equal(a.parentNode, null);
  assert.equal(b.parentNode, parent);
});
