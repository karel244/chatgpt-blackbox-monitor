import { build } from "esbuild";
import { readFile, mkdir } from "node:fs/promises";
const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const synthetic = process.argv.includes("--synthetic");
const header = `// ==UserScript==
// @name         ChatGPT Blackbox Monitor${synthetic ? " Synthetic" : ""}
// @namespace    local.chatgpt-blackbox-monitor
// @version      ${pkg.version}
// @description  Page-observable evidence only; no authentication or chat content storage.
// @homepageURL  https://github.com/karel244/chatgpt-blackbox-monitor
// @supportURL   https://github.com/karel244/chatgpt-blackbox-monitor/issues
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
${synthetic ? "// @match        http://127.0.0.1:43997/*\n" : ""}// @run-at       document-start
// @noframes
// @sandbox      JavaScript
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// ==/UserScript==`;
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/userscript.ts"],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: synthetic
    ? (process.env.BLACKBOX_SYNTHETIC_FILE ?? "test-results/synthetic.user.js")
    : "dist/chatgpt-blackbox-monitor.user.js",
  banner: { js: header },
  legalComments: "inline",
  define: { __SYNTHETIC__: String(synthetic) },
});
