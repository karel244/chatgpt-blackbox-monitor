import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validPosition,
  clampPosition,
  POSITION_KEY,
} from "../../src/ui/preferences.ts";
import { QUICK_TABS } from "../../src/ui/layers.ts";
test("zero menu runtime registrations or menu-only helper/grant", () => {
  const source = readFileSync(
    new URL("../../src/userscript.ts", import.meta.url),
    "utf8",
  );
  const build = readFileSync(
    new URL("../../scripts/build.mjs", import.meta.url),
    "utf8",
  );
  const locale = readFileSync(
    new URL("../../src/ui/i18n.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source + build, /GM_registerMenuCommand/);
  assert.doesNotMatch(locale, /function localizedMenus/);
});
test("position preference rejects malformed, nonfinite and extreme values", () => {
  for (const value of [
    null,
    "50,50",
    { x: -1, y: 2 },
    { x: Infinity, y: 0 },
    { x: NaN, y: 1 },
    { x: 0, y: "1" },
    { x: 1e9, y: 1 },
  ])
    assert.equal(validPosition(value), null);
  assert.deepEqual(validPosition({ x: 20, y: 30 }), { x: 20, y: 30 });
  assert.ok(
    !POSITION_KEY.startsWith("blackbox:history") &&
      !POSITION_KEY.startsWith("blackbox:experiment"),
  );
});
test("clamp handles resize, huge saved coordinates and small viewport while preserving visible window", () => {
  assert.deepEqual(clampPosition(99999, 99999, 300, 420, 620, 200), {
    x: 112,
    y: 412,
  });
  assert.deepEqual(clampPosition(-50, -30, 300, 420, 620), { x: 0, y: 0 });
  const original = { x: 80, y: 90 };
  assert.deepEqual(
    clampPosition(original.x, original.y, 300, 1366, 768, 260),
    original,
  );
});
test("quick tabs are exactly the four human categories", () => {
  assert.deepEqual(QUICK_TABS, ["Route", "Network", "Environment", "History"]);
});
test("UI removes position buttons, title drag excludes interactive controls, saves on pointerup", () => {
  const panel = readFileSync(
    new URL("../../src/ui/panel.ts", import.meta.url),
    "utf8",
  );
  const prefs = readFileSync(
    new URL("../../src/ui/preferences.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(panel, /button\("(?:Move|Reset position)"/);
  assert.match(prefs, /closest\("button,input,select,a"\)/);
  assert.match(prefs, /pointerup/);
  assert.match(prefs, /prefs\?\.set\(key/);
  assert.match(prefs, /visualViewport/);
});
test("dangerous clear requires confirmation before invoking unchanged actions", () => {
  const panel = readFileSync(
    new URL("../../src/ui/panel.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    panel,
    /confirm\(i18n\.t\("Confirm clear history"\)\)\)[\s\S]*?actions\.clearHistory/,
  );
  assert.match(
    panel,
    /confirm\(i18n\.t\("Confirm clear all"\)\)\)[\s\S]*?actions\.clearAll/,
  );
});
test("restore has its own tiny pointer area and hiding only affects presentation", () => {
  const panel = readFileSync(
    new URL("../../src/ui/panel.ts", import.meta.url),
    "utf8",
  );
  assert.match(panel, /restore\.style/);
  assert.match(panel, /width: "16px"/);
  const hide = panel.slice(
    panel.indexOf('const hide = button("Hide"'),
    panel.indexOf("const pause = button"),
  );
  assert.match(hide, /layers\.close\(\)/);
  assert.match(hide, /setSurfaceVisible\(open, false, "launcher"\)/);
  assert.match(hide, /restore\.hidden = false/);
  assert.doesNotMatch(hide, /actions\.pause|journal\.|history\./);
});
test("raw audit fields are native details default-closed, history quick DOM bounded at twenty", () => {
  const panel = readFileSync(
    new URL("../../src/ui/panel.ts", import.meta.url),
    "utf8",
  );
  assert.match(panel, /createElement\("details"\)/);
  assert.doesNotMatch(panel, /\.open = true/);
  assert.match(panel, /view\.rows\.slice\(0, 20\)/);
});
