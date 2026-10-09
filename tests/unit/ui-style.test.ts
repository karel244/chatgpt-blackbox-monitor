import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyHostCriticalStyle,
  applyShellCriticalStyle,
  applySurfaceCriticalStyle,
  setSurfaceVisible,
  applyElementStyle,
  installVisualStyles,
  CSS_TEXT,
  IA_CSS,
} from "../../src/ui/style.ts";
test("production UI has no cssText, style attribute setter or inline stylesheet path; hidden style cannot reset visibility", () => {
  const panel = readFileSync(
    new URL("../../src/ui/panel.ts", import.meta.url),
    "utf8",
  );
  const style = readFileSync(
    new URL("../../src/ui/style.ts", import.meta.url),
    "utf8",
  );
  for (const code of [panel, style]) {
    assert.doesNotMatch(code, /\.cssText\s*=/);
    assert.doesNotMatch(code, /setAttribute\(["']style["']/);
    assert.doesNotMatch(code, /createElement\(["']style["']/);
  }
  assert.match(CSS_TEXT, /:host\(\[hidden\]\)\{display:none!important\}/);
});
test("critical property setters work even when cssText and inline style attributes reject; fallback preserves control layout", () => {
  const properties: Record<string, string> = {};
  const el = {
    style: new Proxy(properties, {
      set(target, key, value) {
        if (key === "cssText") throw Error("inline_blocked");
        target[String(key)] = value;
        return true;
      },
    }),
  } as unknown as HTMLElement;
  applyHostCriticalStyle(el);
  assert.equal(properties.position, "fixed");
  assert.equal(properties.pointerEvents, "none");
  assert.equal(properties.zIndex, "2147483000");
  applyShellCriticalStyle(el);
  assert.equal(properties.pointerEvents, "none");
  assert.equal(properties.display, "contents");
  applySurfaceCriticalStyle(el, "main");
  assert.equal(properties.pointerEvents, "auto");
  assert.equal(properties.display, "flex");
  assert.equal(properties.width, "460px");
  assert.equal(properties.height, "560px");
  setSurfaceVisible(el, false, "main");
  assert.equal(el.hidden, true);
  assert.equal(properties.display, "none");
  applyElementStyle(el, "bar");
  assert.equal(properties.flexWrap, "wrap");
  applyElementStyle(el, "panel");
  assert.equal(properties.resize, "none");
  applyElementStyle(el, "textarea");
  assert.equal(properties.width, "100%");
});
test("constructed stylesheet health covers successful adoption, missing API, rejection and ineffective adoption; never inline fallback", () => {
  const success = { adoptedStyleSheets: [] } as unknown as ShadowRoot;
  class Sheet {
    cssRules = [{}];
    replaceSync(value: string) {
      assert.equal(value, CSS_TEXT + IA_CSS);
    }
  }
  const win = { CSSStyleSheet: Sheet } as unknown as Window;
  assert.deepEqual(installVisualStyles(success, win), {
    method: "adoptedStyleSheets",
    status: "Complete",
    reason: "same_document_stylesheet_installed",
  });
  assert.equal(success.adoptedStyleSheets.length, 1);
  assert.equal(installVisualStyles(success, {} as Window).status, "Partial");
  class Rejected {
    constructor() {
      throw Error("rejected");
    }
  }
  assert.equal(
    installVisualStyles(success, {
      CSSStyleSheet: Rejected,
    } as unknown as Window).method,
    "property-fallback",
  );
  const ineffective = {
    get adoptedStyleSheets() {
      return [];
    },
    set adoptedStyleSheets(_value: unknown) {},
  } as unknown as ShadowRoot;
  assert.equal(installVisualStyles(ineffective, win).status, "Partial");
});
