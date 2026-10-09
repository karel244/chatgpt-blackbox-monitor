import test from "node:test";
import assert from "node:assert/strict";
import { I18n, englishConfirmations } from "../../src/ui/i18n.ts";
import { launcherFacts } from "../../src/ui/cleanup.ts";
import { CSS_TEXT } from "../../src/ui/style.ts";
import { sample } from "../fixtures/history.ts";

test("missing model is a localized UI sentinel; real model slugs and future values stay raw", () => {
  const i = new I18n();
  assert.equal(launcherFacts(null).modelSource, "Unknown");
  assert.equal(i.enum(launcherFacts(null).model), "未知");
  i.setLocale("en-US");
  assert.equal(i.enum(launcherFacts(null).model), "Unknown");
  const s = sample().snapshot;
  const bytes = JSON.stringify(s);
  assert.equal(launcherFacts(s).model, "model-one");
  assert.equal(JSON.stringify(s), bytes);
  for (const locale of ["zh-CN", "en-US"]) {
    i.setLocale(locale);
    for (const raw of ["gpt-5-6-thinking", "future-model", "future-route"])
      assert.equal(i.enum(raw), raw);
  }
});

test("first-use and recent-summary explanations have complete bilingual wording", () => {
  const i = new I18n();
  const first =
    "No conversation evidence yet. Send a new message to inspect it. Click the capsule to open the panel.";
  const recent =
    "Showing a recent conversation summary. Export ZIP uses Current capture above; export older rounds from History.";
  assert.match(i.t(first), /暂无本轮对话证据.*发送一条新消息.*点击胶囊/);
  assert.match(i.t(recent), /最近有效对话摘要.*顶部“当前捕获”.*“历史”导出/);
  i.setLocale("en-US");
  assert.equal(i.t(first), first);
  assert.equal(i.t(recent), recent);
});

test("clear confirmations describe current memory plus history, Closed-only history, and ongoing monitoring", () => {
  const i = new I18n();
  assert.match(
    i.t("Confirm clear current"),
    /内存证据和该轮已保存历史.*无法撤销/,
  );
  assert.match(i.t("Confirm clear history"), /Closed.*正在捕获的证据不受影响/);
  assert.match(
    i.t("Confirm clear all"),
    /不会暂停.*新记录.*界面偏好和已下载 ZIP/,
  );
  i.setLocale("en-US");
  assert.match(
    i.t("Confirm clear current"),
    /in-memory evidence and its saved history/,
  );
  assert.match(
    i.t("Confirm clear history"),
    /ended \(Closed\).*Active captures are unaffected/,
  );
  assert.match(
    i.t("Confirm clear all"),
    /Monitoring continues.*new records.*UI preferences and downloaded ZIPs remain/,
  );
  assert.deepEqual(Object.keys(englishConfirmations).sort(), [
    "Confirm clear all",
    "Confirm clear current",
    "Confirm clear history",
  ]);
  assert.equal(i.t("constructor"), "constructor");
});

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((part) => {
        const c = parseInt(part, 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
test("light conclusion small meets 4.5 using existing text token, dark keeps its original muted token", () => {
  const light = CSS_TEXT.match(/:host\{([^}]+)\}/)![1]!;
  const dark = CSS_TEXT.match(/:host\(\[data-theme=dark\]\)\{([^}]+)\}/)![1]!;
  const token = (rule: string, name: string) =>
    rule.match(new RegExp(`--bb-${name}:(#[a-f0-9]{6})`))![1]!;
  assert.match(
    CSS_TEXT,
    /:host\(:not\(\[data-theme=dark\]\)\) \.cards>\.conclusion small\{color:var\(--bb-text\)\}/,
  );
  assert.match(
    CSS_TEXT,
    /\.card small\{display:block;color:var\(--bb-muted\);font-size:11px/,
  );
  assert.ok(contrast(token(light, "text"), token(light, "tint")) >= 4.5);
  assert.ok(contrast(token(dark, "muted"), token(dark, "tint")) >= 4.5);
  assert.equal(token(light, "muted"), "#64737e");
  assert.equal(token(dark, "muted"), "#9caeb9");
});
