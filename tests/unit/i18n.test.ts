import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import {
  I18n,
  messages,
  enums,
  englishConfirmations,
} from "../../src/ui/i18n.ts";

test("all audited UI/menu keys have zh-CN and original en-US; no empty/missing translations", () => {
  const zh = new I18n();
  const en = new I18n({ get: () => "en-US", set: () => {} });
  for (const [key, value] of Object.entries(messages)) {
    assert.ok(key && value && /[\u3400-\u9fff]/.test(value), key);
    assert.equal(zh.t(key), value);
    assert.equal(en.t(key), englishConfirmations[key] ?? key);
  }
  for (const path of ["../../src/ui/panel.ts", "../../src/userscript.ts"]) {
    const code = readFileSync(new URL(path, import.meta.url), "utf8");
    const source = ts.createSourceFile(
      path,
      code,
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source);
        const position = name === "labelAttribute" ? 2 : 0;
        const arg = node.arguments[position];
        if (
          [
            "button",
            "notice",
            "text",
            "labelAttribute",
            "i18n.t",
            "menus.add",
          ].includes(name) &&
          arg &&
          ts.isStringLiteral(arg)
        ) {
          assert.ok(Object.hasOwn(messages, arg.text), `${path}: ${arg.text}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
test("zh-CN defaults and invalid persisted locale defaults; English is allowlisted", () => {
  for (const value of [undefined, "zh-CN", "zh-TW", "<script>", null])
    assert.equal(new I18n({ get: () => value, set: () => {} }).locale, "zh-CN");
  assert.equal(new I18n({ get: () => "en-US", set: () => {} }).locale, "en-US");
});
test("all enums translate only known values; unknown and prototype-like enums stay raw", () => {
  const i = new I18n();
  for (const [value, translation] of Object.entries(enums))
    assert.equal(i.enum(value), translation);
  for (const value of [
    "brand-new",
    "constructor",
    "toString",
    "gpt-5-6-thinking",
    "fetch",
    "xhr",
    "ws",
  ])
    assert.equal(i.enum(value), value);
});
test("route mapping is presentation-only", () => {
  const i = new I18n();
  assert.deepEqual(
    ["Route Match", "Route Mismatch", "Route Conflict"].map((x) => i.enum(x)),
    ["路由一致", "路由不一致", "路由冲突"],
  );
});
test("network mapping is presentation-only", () => {
  const i = new I18n();
  assert.deepEqual(
    [
      "OK",
      "HTTP Error",
      "Challenge Confirmed",
      "Rate Limited",
      "Server Error",
      "Transport Failure",
      "Aborted",
    ].map((x) => i.enum(x)),
    [
      "正常",
      "HTTP 错误",
      "已确认挑战",
      "请求受限",
      "服务器错误",
      "传输失败",
      "已中止",
    ],
  );
});
test("capture health, effort and lifecycle mappings preserve raw input", () => {
  const i = new I18n();
  assert.equal(i.enum("Partial"), "部分完整");
  assert.equal(i.enum("Settling"), "收尾确认中");
  assert.deepEqual(
    ["minimal", "low", "medium", "high", "extended"].map((x) => i.enum(x)),
    ["最低", "低", "中", "高", "扩展"],
  );
});
test("duration formatter translates existing rounded display without recalculation", () => {
  const i = new I18n();
  assert.equal(i.duration("30.1s total"), "30.1 秒");
  assert.equal(i.duration("30.1s elapsed"), "30.1 秒（进行中）");
  assert.equal(i.duration("new-duration-format"), "new-duration-format");
  i.setLocale("en-US");
  assert.equal(i.duration("30.1s total"), "30.1s total");
});
test("composite status has localized separators and English compatibility", () => {
  const i = new I18n();
  assert.equal(
    i.composite("Partial", "Route Match", false),
    "部分完整；路由一致",
  );
  assert.equal(
    i.composite("Partial", "Route Match", true),
    "已暂停；部分完整；路由一致",
  );
  i.setLocale("en-US");
  assert.equal(
    i.composite("Partial", "Route Match", true),
    "Paused; Partial; Route Match",
  );
});
test("locale persistence/notifiers are isolated and failed writes do not promise persistence", () => {
  let persisted: unknown,
    calls = 0;
  const i = new I18n({
    get: () => persisted,
    set: (x) => {
      persisted = x;
    },
  });
  const unsubscribe = i.subscribe(() => calls++);
  i.setLocale("en-US");
  i.setLocale("en-US");
  i.setLocale("bad");
  assert.equal(calls, 1);
  assert.equal(
    new I18n({ get: () => persisted, set: () => {} }).locale,
    "en-US",
  );
  unsubscribe();
  i.setLocale("zh-CN");
  assert.equal(calls, 1);
  const bad = new I18n({
    get: () => undefined,
    set: () => {
      throw Error("quota");
    },
  });
  assert.throws(() => bad.setLocale("en-US"));
  assert.equal(bad.locale, "zh-CN");
});
test("display wrappers never mutate machine data or translate raw model/value/descriptor strings", () => {
  const input = {
    capture_id: "gpt-5-6-thinking",
    schema_version: "evidence-1",
    completeness: "Partial",
    value: "high",
    old_value: "History",
    actual_route: "History",
    descriptor: { browser_label: "History" },
    fields: { model: { status: "Equal", left: [{ value: "Unknown" }] } },
  };
  const bytes = JSON.stringify(input);
  const i = new I18n();
  const display = i.display(input) as Record<string, unknown>;
  assert.equal(JSON.stringify(input), bytes);
  assert.equal(display.capture_id, input.capture_id);
  assert.equal(display["完整性"], "部分完整");
  assert.equal(display["原始值"], "high");
  assert.equal(display.actual_route, "History");
  assert.deepEqual(display.descriptor, input.descriptor);
  i.setLocale("en-US");
  assert.deepEqual(i.display(input), input);
});
test("Public release freezes the reviewed production source inventory", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../fixtures/public-source-hashes.json", import.meta.url),
      "utf8",
    ),
  ) as { files: Record<string, string> };
  const authorized = new Set<string>();
  const frozen = Object.entries(manifest.files).filter(([path]) =>
    path.startsWith("src/"),
  );
  function inventory(directory: URL, prefix = "src/"): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? inventory(
            new URL(entry.name + "/", directory),
            prefix + entry.name + "/",
          )
        : [prefix + entry.name],
    );
  }
  assert.deepEqual(
    new Set(inventory(new URL("../../src/", import.meta.url))),
    new Set(frozen.map(([path]) => path)),
    "no production source additions/deletions outside frozen inventory",
  );
  const changed = new Set<string>();
  for (const [path, digest] of frozen) {
    const hash = createHash("sha256")
      .update(readFileSync(new URL("../../" + path, import.meta.url)))
      .digest("hex");
    if (hash !== digest) changed.add(path);
    if (!authorized.has(path)) assert.equal(hash, digest, path);
  }
  assert.deepEqual(
    changed,
    authorized,
    "public production files match the reviewed release inventory",
  );
});
