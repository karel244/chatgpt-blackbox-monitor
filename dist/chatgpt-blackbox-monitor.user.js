// ==UserScript==
// @name         ChatGPT Blackbox Monitor
// @namespace    local.chatgpt-blackbox-monitor
// @version      1.1.0
// @description  Page-observable evidence only; no authentication or chat content storage.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-start
// @noframes
// @sandbox      JavaScript
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// ==/UserScript==
"use strict";
(() => {
  // src/ui/i18n.ts
  var LOCALE_KEY = "blackbox.ui.locale";
  var messages = {
    "Scale Main": "\u7B49\u6BD4\u4F8B\u7F29\u653E\u4E3B\u9762\u677F",
    "Scale Workbench": "\u7B49\u6BD4\u4F8B\u7F29\u653E\u5DE5\u4F5C\u53F0",
    "No capture in current scope": "\u5F53\u524D\u8303\u56F4\u6682\u65E0\u6355\u83B7",
    "Recent meaningful conversation": "\u6700\u8FD1\u6709\u6548\u5BF9\u8BDD",
    "No conversation evidence yet. Send a new message to inspect it. Click the capsule to open the panel.": "\u6682\u65E0\u672C\u8F6E\u5BF9\u8BDD\u8BC1\u636E\u3002\u53D1\u9001\u4E00\u6761\u65B0\u6D88\u606F\u540E\u67E5\u770B\u3002\u70B9\u51FB\u80F6\u56CA\u6253\u5F00\u9762\u677F\u3002",
    "Showing a recent conversation summary. Export ZIP uses Current capture above; export older rounds from History.": "\u5F53\u524D\u663E\u793A\u7684\u662F\u6700\u8FD1\u6709\u6548\u5BF9\u8BDD\u6458\u8981\u3002\u5BFC\u51FA ZIP \u4EE5\u9876\u90E8\u201C\u5F53\u524D\u6355\u83B7\u201D\u4E3A\u51C6\uFF1B\u65E7\u8F6E\u8BF7\u5230\u201C\u5386\u53F2\u201D\u5BFC\u51FA\u3002",
    "Evidence details": "\u8BC1\u636E\u8BE6\u60C5",
    "Detailed diagnostics": "\u8BE6\u7EC6\u8BCA\u65AD",
    "Technical details": "\u6280\u672F\u8BE6\u60C5",
    "Time unknown": "\u65F6\u95F4\u672A\u77E5",
    "Duration unknown": "\u8017\u65F6\u672A\u77E5",
    "Export this history round": "\u5BFC\u51FA\u8BE5\u8F6E\u5386\u53F2",
    "WebSocket diagnostics": "WebSocket \u8BCA\u65AD",
    "Transport failure": "\u4F20\u8F93\u6545\u969C",
    Online: "\u5728\u7EBF",
    Offline: "\u79BB\u7EBF",
    "More options": "\u66F4\u591A\u9009\u9879",
    "Evidence Workbench": "\u5B8C\u6574\u53D6\u8BC1\u5DE5\u4F5C\u53F0",
    "Workbench navigation": "\u5DE5\u4F5C\u53F0\u5BFC\u822A",
    "Back to controls": "\u8FD4\u56DE\u4E3B\u9762\u677F",
    "Route evidence": "\u8DEF\u7531\u8BC1\u636E",
    "A/B compare": "A/B \u5BF9\u6BD4",
    "System / Health": "\u7CFB\u7EDF / \u5065\u5EB7",
    "Advanced settings": "\u9AD8\u7EA7\u8BBE\u7F6E",
    "More evidence": "\u66F4\u591A\u8BC1\u636E",
    "Confirm clear current": "\u786E\u5B9A\u5220\u9664\u5F53\u524D\u6355\u83B7\u7684\u5185\u5B58\u8BC1\u636E\u548C\u8BE5\u8F6E\u5DF2\u4FDD\u5B58\u5386\u53F2\u5417\uFF1F\u6B64\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\u3002",
    "View details": "\u67E5\u770B\u8BE6\u60C5",
    "Quick controls": "\u5FEB\u901F\u63A7\u5236\u9762\u677F",
    "Advanced evidence": "\u9AD8\u7EA7\u53D6\u8BC1",
    "Monitor title": "\u9ED1\u76D2\u76D1\u63A7",
    "Restore monitor": "\u6062\u590D\u76D1\u63A7\u5668",
    "Drag header": "\u62D6\u52A8\u6807\u9898\u680F",
    Overview: "\u6982\u89C8",
    Route: "\u8DEF\u7531",
    Network: "\u7F51\u7EDC",
    Environment: "\u73AF\u5883",
    "Raw fields": "\u67E5\u770B\u539F\u59CB\u5B57\u6BB5",
    "Route verdict": "\u8DEF\u7531\u5224\u5B9A",
    "Response effort": "\u54CD\u5E94\u601D\u8003\u5F3A\u5EA6",
    Transport: "\u4F20\u8F93\u65B9\u5F0F",
    Source: "\u6765\u6E90",
    "HTTP status": "HTTP \u72B6\u6001",
    Cloudflare: "Cloudflare \u72B6\u6001",
    "Retry-After": "\u91CD\u8BD5\u7B49\u5F85\uFF08Retry-After\uFF09",
    PoW: "PoW \u6458\u8981",
    "WebSocket events": "WebSocket \u4E8B\u4EF6\u6570",
    "All history": "\u67E5\u770B\u5168\u90E8\u5386\u53F2",
    Settings: "\u8BBE\u7F6E",
    "Data management": "\u6570\u636E\u7BA1\u7406",
    Diagnostics: "\u8BCA\u65AD",
    "Check hook health": "\u68C0\u67E5\u6355\u83B7\u6302\u94A9\u72B6\u6001",
    "Capture status": "\u67E5\u770B\u6355\u83B7\u72B6\u6001\uFF08P1-P6\uFF09",
    "Confirm clear history": "\u786E\u5B9A\u5220\u9664\u5DF2\u7ED3\u675F\uFF08Closed\uFF09\u7684\u5DF2\u4FDD\u5B58\u5386\u53F2\u8BB0\u5F55\u5417\uFF1F\u6B63\u5728\u6355\u83B7\u7684\u8BC1\u636E\u4E0D\u53D7\u5F71\u54CD\uFF1B\u6B64\u64CD\u4F5C\u65E0\u6CD5\u64A4\u9500\u3002",
    "Confirm clear all": "\u786E\u5B9A\u6E05\u9664\u73B0\u6709\u672C\u5730\u8BC1\u636E\u5417\uFF1F\u65E0\u6CD5\u64A4\u9500\u3002\u76D1\u6D4B\u4E0D\u4F1A\u6682\u505C\uFF0C\u4E4B\u540E\u4ECD\u53EF\u4EA7\u751F\u65B0\u8BB0\u5F55\uFF1B\u754C\u9762\u504F\u597D\u548C\u5DF2\u4E0B\u8F7D ZIP \u5C06\u4FDD\u7559\u3002",
    browser: "\u6D4F\u89C8\u5668",
    browser_version: "\u6D4F\u89C8\u5668\u7248\u672C",
    os: "\u64CD\u4F5C\u7CFB\u7EDF",
    viewport: "\u53EF\u89C6\u533A",
    timezone: "\u65F6\u533A",
    online: "\u5728\u7EBF\u72B6\u6001",
    build_marker: "\u6784\u5EFA\u6807\u8BB0",
    asset_set: "\u8D44\u6E90\u96C6",
    fast_convo: "\u5FEB\u901F\u5BF9\u8BDD\u6807\u8BB0\uFF08fast_convo\uFF09",
    Evidence: "\u8BC1\u636E",
    Page: "\u9875\u7801",
    Details: "\u8BE6\u60C5",
    "Request start": "\u8BF7\u6C42\u5F00\u59CB",
    model: "\u8BF7\u6C42\u6A21\u578B",
    model_slug: "\u670D\u52A1\u5668\u8DEF\u7531",
    resolved_model_slug: "\u89E3\u6790\u8DEF\u7531",
    thinking_effort: "\u601D\u8003\u5F3A\u5EA6",
    first_content: "\u9996\u4E2A\u5185\u5BB9",
    "ChatGPT Blackbox Monitor": "ChatGPT \u9ED1\u76D2\u76D1\u63A7\u5668",
    "Open evidence": "\u6253\u5F00\u53D6\u8BC1\u9762\u677F",
    Hide: "\u9690\u85CF",
    Pause: "\u6682\u505C\u76D1\u6D4B",
    Resume: "\u7EE7\u7EED\u76D1\u6D4B",
    Move: "\u79FB\u52A8",
    "Reset position": "\u91CD\u7F6E\u4F4D\u7F6E",
    "Current capture": "\u5F53\u524D\u6355\u83B7",
    "Daily capsule": "\u65E5\u5E38\u5C0F\u80F6\u56CA",
    Requested: "\u8BF7\u6C42\u6A21\u578B",
    "Server Route": "\u670D\u52A1\u5668\u8DEF\u7531",
    "Resolved Route": "\u89E3\u6790\u8DEF\u7531",
    "Thinking Effort": "\u601D\u8003\u5F3A\u5EA6",
    "Capture Health": "\u6355\u83B7\u72B6\u6001",
    Duration: "\u603B\u8017\u65F6",
    "Network Status": "\u7F51\u7EDC\u72B6\u6001",
    "Forensic evidence": "\u53D6\u8BC1\u9762\u677F",
    Close: "\u5173\u95ED",
    "Evidence section": "\u8BC1\u636E\u5206\u7C7B",
    Timeline: "\u65F6\u95F4\u7EBF",
    "A/B/C/D": "A/B/C/D \u8BC1\u636E",
    "Transport / Timing": "\u4F20\u8F93 / \u65F6\u5E8F",
    "Network / Cloudflare / PoW / IP": "\u7F51\u7EDC / Cloudflare / PoW / IP",
    "Environment / Frontend Build": "\u73AF\u5883 / \u524D\u7AEF\u6784\u5EFA",
    "Capture Health / Storage": "\u6355\u83B7\u72B6\u6001 / \u5B58\u50A8",
    History: "\u5386\u53F2",
    "Redaction preview": "\u8131\u654F\u9884\u89C8",
    Experiment: "\u5B9E\u9A8C",
    Compare: "\u5BF9\u6BD4",
    "Previous page": "\u4E0A\u4E00\u9875",
    "Next page": "\u4E0B\u4E00\u9875",
    "Export ZIP": "\u5BFC\u51FA ZIP",
    "Export history": "\u5BFC\u51FA\u5386\u53F2",
    "Clear current": "\u6E05\u9664\u5F53\u524D\u6355\u83B7",
    "Clear history": "\u6E05\u9664\u5386\u53F2",
    "Clear all": "\u6E05\u9664\u5168\u90E8\u8BC1\u636E",
    "Import evidence ZIPs for local comparison": "\u5BFC\u5165\u8BC1\u636E ZIP \u8FDB\u884C\u672C\u5730\u5BF9\u6BD4",
    "Evidence content": "\u8BC1\u636E\u5185\u5BB9",
    "Local experiment descriptor JSON": "\u672C\u5730\u5B9E\u9A8C\u63CF\u8FF0 JSON",
    "Create experiment": "\u521B\u5EFA\u5B9E\u9A8C",
    "Save descriptor": "\u4FDD\u5B58\u5B9E\u9A8C\u63CF\u8FF0",
    "Import local experiment descriptor": "\u5BFC\u5165\u672C\u5730\u5B9E\u9A8C\u63CF\u8FF0",
    "Export descriptor": "\u5BFC\u51FA\u5B9E\u9A8C\u63CF\u8FF0",
    "Optional shared 64 hex key": "\u53EF\u9009\uFF1A\u5171\u4EAB\u7684 64 \u4F4D\u5341\u516D\u8FDB\u5236\u5BC6\u94A5",
    "Optional shared local experiment key": "\u53EF\u9009\uFF1A\u672C\u5730\u5171\u4EAB\u5B9E\u9A8C\u5BC6\u94A5",
    "Save local key": "\u4FDD\u5B58\u672C\u5730\u5BC6\u94A5",
    "Optional transient exact user content": "\u53EF\u9009\uFF1A\u4EC5\u4E34\u65F6\u4F7F\u7528\u7684\u51C6\u786E\u7528\u6237\u5185\u5BB9",
    "Optional transient user content for HMAC association": "\u53EF\u9009\uFF1A\u7528\u4E8E HMAC \u5173\u8054\u7684\u4E34\u65F6\u7528\u6237\u5185\u5BB9",
    "Bind current run": "\u7ED1\u5B9A\u5F53\u524D\u8FD0\u884C",
    "Clear experiment": "\u6E05\u9664\u5B9E\u9A8C",
    "Timing ratio flag threshold": "\u65F6\u957F\u6BD4\u503C\u63D0\u793A\u9608\u503C",
    "Timing absolute difference threshold in ms": "\u65F6\u957F\u7EDD\u5BF9\u5DEE\u63D0\u793A\u9608\u503C\uFF08\u6BEB\u79D2\uFF09",
    "Compare / add pair": "\u5BF9\u6BD4 / \u6DFB\u52A0\u914D\u5BF9",
    Language: "\u8BED\u8A00",
    "Operation failed or unsupported input. History remains available.": "\u64CD\u4F5C\u5931\u8D25\u6216\u8F93\u5165\u4E0D\u53D7\u652F\u6301\uFF1B\u5386\u53F2\u4ECD\u53EF\u67E5\u770B\u3002",
    "Use arrow keys on Move or drag it. Reset position restores the corner.": "\u805A\u7126\u201C\u79FB\u52A8\u201D\u540E\u4F7F\u7528\u65B9\u5411\u952E\uFF0C\u6216\u62D6\u52A8\u6309\u94AE\u3002\u201C\u91CD\u7F6E\u4F4D\u7F6E\u201D\u6062\u590D\u5230\u89D2\u843D\u3002",
    "Sanitized local ZIP exported. Review it before sharing.": "\u5DF2\u5BFC\u51FA\u8131\u654F\u7684\u672C\u5730 ZIP\uFF1B\u5206\u4EAB\u524D\u8BF7\u68C0\u67E5\u5185\u5BB9\u3002",
    "Local import validated; no history writes or upload.": "\u672C\u5730\u5BFC\u5165\u5DF2\u9A8C\u8BC1\uFF1B\u6CA1\u6709\u5199\u5165\u5386\u53F2\u6216\u4E0A\u4F20\u3002",
    "Edit task, replicate, browser label and declared conditions; share the same UUID with the second browser.": "\u7F16\u8F91 task\u3001replicate\u3001\u6D4F\u89C8\u5668\u6807\u7B7E\u53CA\u58F0\u660E\u6761\u4EF6\uFF1B\u4E0E\u53E6\u4E00\u6D4F\u89C8\u5668\u5171\u4EAB\u540C\u4E00 UUID\u3002",
    "Descriptor saved locally. Account condition is manual declaration only.": "\u5B9E\u9A8C\u63CF\u8FF0\u5DF2\u4FDD\u5B58\u5230\u672C\u5730\uFF1B\u8D26\u53F7\u6761\u4EF6\u4EC5\u4E3A\u624B\u52A8\u58F0\u660E\u3002",
    "Descriptor imported locally.": "\u5B9E\u9A8C\u63CF\u8FF0\u5DF2\u5BFC\u5165\u672C\u5730\u3002",
    "Shared key stored only locally; absent from evidence exports.": "\u5171\u4EAB\u5BC6\u94A5\u4EC5\u4FDD\u5B58\u5728\u672C\u5730\uFF0C\u4E0D\u8FDB\u5165\u5BFC\u51FA\u7684\u8BC1\u636E\u3002",
    "Independent run bound. Content discarded; hash does not prove equal context.": "\u5DF2\u7ED1\u5B9A\u72EC\u7ACB\u8FD0\u884C\uFF1B\u6B63\u6587\u5DF2\u4E22\u5F03\uFF0C\u6458\u8981\u4E0D\u80FD\u8BC1\u660E\u4E0A\u4E0B\u6587\u76F8\u540C\u3002",
    "Local experiment cleared.": "\u5DF2\u6E05\u9664\u672C\u5730\u5B9E\u9A8C\u3002",
    "Import two local evidence ZIPs. Explicit UUID/task/replicate required; display IDs do not pair runs.": "\u8BF7\u5BFC\u5165\u4E24\u4EFD\u672C\u5730\u8BC1\u636E ZIP\uFF1B\u5FC5\u987B\u5339\u914D\u660E\u786E\u7684 UUID/task/replicate\uFF0C\u663E\u793A ID \u4E0D\u7528\u4E8E\u914D\u5BF9\u3002",
    "History export failed. Check operation health.": "\u5386\u53F2\u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u64CD\u4F5C\u72B6\u6001\u3002",
    " Related context unavailable; exported evidence remains conversation-only.": " \u76F8\u5173\u4E0A\u4E0B\u6587\u4E0D\u53EF\u7528\uFF1B\u5BFC\u51FA\u8BC1\u636E\u4EC5\u5305\u542B\u8BE5\u5BF9\u8BDD\u8F6E\u6B21\u3002",
    "Unknown: no bound capture in this visit.": "\u672A\u77E5\uFF1A\u672C\u6B21\u8BBF\u95EE\u6CA1\u6709\u5DF2\u5173\u8054\u7684\u6355\u83B7\u3002",
    "Blackbox: Hook Unavailable (page realm)": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u6355\u83B7\u6302\u94A9\u4E0D\u53EF\u7528\uFF08\u9875\u9762\u57DF\uFF09",
    "Hook Unavailable: unsafeWindow page realm not accessible.": "\u6355\u83B7\u6302\u94A9\u4E0D\u53EF\u7528\uFF1A\u65E0\u6CD5\u8BBF\u95EE unsafeWindow \u9875\u9762\u57DF\u3002",
    "Blackbox: Show monitor": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u663E\u793A\u76D1\u63A7\u5668",
    "Blackbox: Pause / Resume": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u6682\u505C / \u7EE7\u7EED",
    "Blackbox: Clear current memory": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u6E05\u9664\u5F53\u524D\u5185\u5B58",
    "Blackbox: Clear saved history": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u6E05\u9664\u5DF2\u4FDD\u5B58\u5386\u53F2",
    "Blackbox: Clear all local evidence": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u6E05\u9664\u5168\u90E8\u672C\u5730\u8BC1\u636E",
    "Blackbox: Export current evidence ZIP": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u5BFC\u51FA\u5F53\u524D\u8BC1\u636E ZIP",
    "Blackbox: Check hook health": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u68C0\u67E5\u6355\u83B7\u6302\u94A9\u72B6\u6001",
    "Blackbox: Capture status (P1-P6)": "\u9ED1\u76D2\u76D1\u63A7\uFF1A\u67E5\u770B\u6355\u83B7\u72B6\u6001\uFF08P1-P6\uFF09",
    "No capture available": "\u6CA1\u6709\u53EF\u7528\u7684\u6355\u83B7",
    "Evidence export failed; no file saved.": "\u8BC1\u636E\u5BFC\u51FA\u5931\u8D25\uFF0C\u672A\u4FDD\u5B58\u6587\u4EF6\u3002"
  };
  var englishConfirmations = {
    "Confirm clear current": "Delete the current capture's in-memory evidence and its saved history? This cannot be undone.",
    "Confirm clear history": "Delete saved history records that have ended (Closed)? Active captures are unaffected. This cannot be undone.",
    "Confirm clear all": "Clear existing local evidence? This cannot be undone. Monitoring continues and may create new records; UI preferences and downloaded ZIPs remain."
  };
  var enums = {
    Unknown: "\u672A\u77E5",
    Complete: "\u5B8C\u6574",
    Partial: "\u90E8\u5206\u5B8C\u6574",
    Failed: "\u5931\u8D25",
    "Route Match": "\u8DEF\u7531\u4E00\u81F4",
    "Route Mismatch": "\u8DEF\u7531\u4E0D\u4E00\u81F4",
    "Route Conflict": "\u8DEF\u7531\u51B2\u7A81",
    Conflict: "\u51B2\u7A81",
    OK: "\u6B63\u5E38",
    "HTTP Error": "HTTP \u9519\u8BEF",
    "Challenge Confirmed": "\u5DF2\u786E\u8BA4\u6311\u6218",
    "Challenge Suspected": "\u7591\u4F3C\u6311\u6218",
    "Rate Limited": "\u8BF7\u6C42\u53D7\u9650",
    "Server Error": "\u670D\u52A1\u5668\u9519\u8BEF",
    "Transport Failure": "\u4F20\u8F93\u5931\u8D25",
    Aborted: "\u5DF2\u4E2D\u6B62",
    Capturing: "\u6355\u83B7\u4E2D",
    Settling: "\u6536\u5C3E\u786E\u8BA4\u4E2D",
    Closed: "\u5DF2\u7ED3\u675F",
    Equal: "\u76F8\u540C",
    Different: "\u4E0D\u540C",
    "Not comparable": "\u4E0D\u53EF\u6BD4\u8F83",
    Paused: "\u5DF2\u6682\u505C",
    Ready: "\u5DF2\u5C31\u7EEA",
    Available: "\u53EF\u7528",
    Unavailable: "\u4E0D\u53EF\u7528",
    Disabled: "\u5DF2\u7981\u7528",
    Idle: "\u7A7A\u95F2",
    Running: "\u8FD0\u884C\u4E2D",
    Success: "\u6210\u529F",
    Pending: "\u5F85\u5904\u7406",
    "read-only": "\u53EA\u8BFB",
    not_compared: "\u672A\u5BF9\u6BD4",
    compared: "\u5DF2\u5BF9\u6BD4",
    minimal: "\u6700\u4F4E",
    low: "\u4F4E",
    medium: "\u4E2D",
    high: "\u9AD8",
    extended: "\u6269\u5C55",
    "Evidence insufficient: capture Partial/Unknown/Failed": "\u8BC1\u636E\u4E0D\u8DB3\uFF1A\u6355\u83B7\u4E3A\u90E8\u5206\u5B8C\u6574\u3001\u672A\u77E5\u6216\u5931\u8D25",
    observed: "\u5DF2\u89C2\u5BDF",
    absent: "\u7F3A\u5931",
    not_exposed: "\u672A\u516C\u5F00",
    unavailable: "\u4E0D\u53EF\u7528",
    inferred: "\u63A8\u65AD",
    unknown: "\u672A\u77E5",
    confirmed: "\u5DF2\u786E\u8BA4",
    candidate: "\u5019\u9009"
  };
  var displayLabels = {
    health: "\u6355\u83B7\u72B6\u6001",
    controls: "\u63A7\u5236\u8BB0\u5F55",
    storage: "\u5B58\u50A8",
    ui_style: "\u754C\u9762\u6837\u5F0F",
    ui_operation: "\u754C\u9762\u64CD\u4F5C",
    completeness: "\u5B8C\u6574\u6027",
    lifecycle: "\u751F\u547D\u5468\u671F",
    status: "\u72B6\u6001",
    method: "\u65B9\u5F0F",
    reason: "\u539F\u56E0",
    stage: "\u9636\u6BB5",
    operation: "\u64CD\u4F5C",
    verdict: "\u5224\u5B9A",
    page: "\u9875\u7801",
    pages: "\u603B\u9875\u6570",
    total: "\u603B\u6570",
    level: "\u7B49\u7EA7",
    index: "\u7D22\u5F15",
    field: "\u5B57\u6BB5",
    value: "\u539F\u59CB\u503C",
    old_value: "\u539F\u59CB\u65E7\u503C",
    new_value: "\u539F\u59CB\u65B0\u503C",
    scope: "\u8303\u56F4",
    source: "\u6765\u6E90",
    transport: "\u4F20\u8F93\u65B9\u5F0F",
    channel: "\u901A\u9053",
    observed: "\u89C2\u5BDF\u65F6\u95F4",
    availability: "\u53EF\u7528\u6027",
    association: "\u5173\u8054",
    late: "\u8FDF\u5230",
    revision: "\u4FEE\u8BA2",
    timing: "\u65F6\u5E8F",
    fields: "\u5B57\u6BB5\u5BF9\u6BD4",
    timing_flag: "\u65F6\u957F\u63D0\u793A",
    conclusion: "\u7ED3\u8BBA",
    limits: "\u9650\u5236",
    order: "\u6B21\u5E8F",
    left: "\u5DE6\u4FA7",
    right: "\u53F3\u4FA7"
  };
  var enumFields = /* @__PURE__ */ new Set([
    "status",
    "completeness",
    "lifecycle",
    "verdict",
    "availability",
    "state",
    "conclusion",
    "effort",
    "thinking_effort"
  ]);
  var rawFields = /* @__PURE__ */ new Set([
    "value",
    "old_value",
    "new_value",
    "raw",
    "descriptor",
    "conditions",
    "browser_label",
    "source",
    "source_path"
  ]);
  var I18n = class {
    constructor(preference) {
      this.preference = preference;
      let value2;
      try {
        value2 = preference?.get();
      } catch {
      }
      this.current = value2 === "en-US" ? "en-US" : "zh-CN";
    }
    preference;
    current;
    listeners = /* @__PURE__ */ new Set();
    get locale() {
      return this.current;
    }
    setLocale(value2) {
      if (value2 !== "zh-CN" && value2 !== "en-US" || value2 === this.current)
        return;
      this.preference?.set(value2);
      this.current = value2;
      for (const fn of this.listeners) fn();
    }
    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }
    t(key) {
      if (this.current === "en-US")
        return Object.hasOwn(englishConfirmations, key) ? englishConfirmations[key] : key;
      if (key.startsWith("Export history "))
        return messages["Export history"] + key.slice("Export history".length);
      return Object.hasOwn(messages, key) ? messages[key] : key;
    }
    enum(value2) {
      const raw = String(value2);
      return this.current === "zh-CN" && Object.hasOwn(enums, raw) ? enums[raw] : raw;
    }
    duration(value2) {
      if (this.current === "en-US") return value2;
      return value2.replace(
        /^(\d+\.\d+)s (total|elapsed)$/,
        (_, n, kind) => kind === "total" ? `${n} \u79D2` : `${n} \u79D2\uFF08\u8FDB\u884C\u4E2D\uFF09`
      );
    }
    composite(health, verdict2, paused) {
      const separator = this.current === "zh-CN" ? "\uFF1B" : "; ";
      return `${paused ? this.enum("Paused") + separator : ""}${this.enum(health)}${separator}${this.enum(verdict2)}`;
    }
    display(value2, key = "") {
      if (this.current === "en-US" || rawFields.has(key)) return value2;
      if (Array.isArray(value2)) return value2.map((v) => this.display(v, key));
      if (value2 && typeof value2 === "object")
        return Object.fromEntries(
          Object.entries(value2).map(([k, v]) => [
            displayLabels[k] ?? k,
            this.display(v, k)
          ])
        );
      if (typeof value2 === "string")
        return enumFields.has(key) ? this.enum(value2) : key === "" ? this.t(value2) : value2;
      return value2;
    }
  };

  // src/history/retention.ts
  var COMPACT_TARGET = 96;
  async function compactClosed(monitor, network, history, selected) {
    const journal = monitor.journal;
    const latest = () => journal.ids().filter((id2) => journal.snapshot(id2)?.start.mode === "live").at(-1);
    const eligible = (id2) => id2 !== selected() && id2 !== latest() && monitor.canReleaseClosed(id2) && network.canReleaseClosed(id2);
    for (const id2 of journal.ids()) {
      if (journal.ids().length <= COMPACT_TARGET) break;
      if (!eligible(id2)) continue;
      const snapshot = journal.snapshot(id2);
      if (!snapshot || !await history.committedThrough(snapshot)) continue;
      if (!eligible(id2) || JSON.stringify(journal.snapshot(id2)) !== JSON.stringify(snapshot))
        continue;
      network.releaseClosedCapture(id2);
      monitor.releaseClosedCapture(id2);
      journal.discard(id2);
      history.releaseCommitted(id2);
    }
  }

  // src/ui/preferences.ts
  var POSITION_KEY = "blackbox.ui.position";
  function validPosition(value2) {
    if (!value2 || typeof value2 !== "object") return null;
    const { x, y } = value2;
    return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= 1e7 && y <= 1e7 ? { x, y } : null;
  }
  function clampPosition(x, y, width, vw, vh, height = 44) {
    return {
      x: Math.max(0, Math.min(x, Math.max(0, vw - width - 8))),
      y: Math.max(
        0,
        Math.min(y, Math.max(0, vh - Math.min(Math.max(44, height), vh) - 8))
      )
    };
  }
  function installPosition(host, shell, title, restore, prefs, key = POSITION_KEY, beforeMeasure) {
    const win = host.ownerDocument.defaultView;
    let stored;
    try {
      stored = prefs?.get(key);
    } catch {
    }
    let position = validPosition(stored), dragging = false, dx = 0, dy = 0, startX = 0, startY = 0, moved = false;
    let suppressClick = false;
    const refresh = () => {
      if (shell.hidden) return;
      const viewport = win.visualViewport;
      const vw = viewport?.width ?? win.innerWidth, vh = viewport?.height ?? win.innerHeight;
      if (beforeMeasure) beforeMeasure();
      else {
        shell.style.maxWidth = Math.max(120, vw - 16) + "px";
        shell.style.maxHeight = Math.max(44, vh - 16) + "px";
      }
      const r = shell.getBoundingClientRect();
      const centered = key === "blackbox.ui.workbench.position";
      const p = clampPosition(
        position?.x ?? Math.max(
          0,
          centered ? (vw - (r.width || 960)) / 2 : vw - (r.width || 300) - 28
        ),
        position?.y ?? (centered ? 70 : key === POSITION_KEY ? 96 : 88),
        r.width || 300,
        vw,
        vh,
        r.height
      );
      position = p;
      host.style.right = "auto";
      host.style.left = p.x + (viewport?.offsetLeft ?? 0) + "px";
      host.style.top = p.y + (viewport?.offsetTop ?? 0) + "px";
      restore.style.left = p.x + (r.width || 300) / 2 < vw / 2 ? "0px" : "auto";
      restore.style.right = restore.style.left === "auto" ? "0px" : "auto";
      restore.style.top = Math.min(Math.max(8, p.y), Math.max(8, vh - 40)) + "px";
    };
    const down = (e) => {
      if (e.button !== 0 || e.target !== title && e.target.closest("button,input,select,a"))
        return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      dx = e.clientX - host.getBoundingClientRect().left;
      dy = e.clientY - host.getBoundingClientRect().top;
      title.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 5)
        return;
      moved = true;
      suppressClick = true;
      position = { x: e.clientX - dx, y: e.clientY - dy };
      refresh();
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      win.setTimeout(() => {
        suppressClick = false;
      }, 0);
      refresh();
      try {
        prefs?.set(key, position);
      } catch {
      }
    };
    const click = (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    title.addEventListener("click", click, true);
    title.addEventListener("pointerdown", down);
    title.addEventListener("pointermove", move);
    title.addEventListener("pointerup", end);
    title.addEventListener("pointercancel", end);
    win.addEventListener("resize", refresh);
    win.visualViewport?.addEventListener("resize", refresh);
    win.visualViewport?.addEventListener("scroll", refresh);
    const Constructor = win.ResizeObserver;
    const observer = typeof Constructor === "function" ? new Constructor(refresh) : null;
    observer?.observe(shell);
    return {
      refresh,
      get position() {
        return position;
      },
      dispose() {
        observer?.disconnect();
        title.removeEventListener("click", click, true);
        title.removeEventListener("pointerdown", down);
        title.removeEventListener("pointermove", move);
        title.removeEventListener("pointerup", end);
        title.removeEventListener("pointercancel", end);
        win.removeEventListener("resize", refresh);
        win.visualViewport?.removeEventListener("resize", refresh);
        win.visualViewport?.removeEventListener("scroll", refresh);
      }
    };
  }

  // src/ui/scale.ts
  var MAIN_SCALE_KEY = "blackbox.ui.mainScale";
  var WORKBENCH_SCALE_KEY = "blackbox.ui.workbenchScale";
  function validScale(value2) {
    return typeof value2 === "number" && Number.isFinite(value2) && value2 >= 0.75 && value2 <= 1.4 ? value2 : 1;
  }
  function boundedScale(value2) {
    return Math.max(0.75, Math.min(1.4, value2));
  }
  function scaleGeometry(scale, width, height, vw, vh) {
    const availableWidth = Math.max(1, vw - 16), availableHeight = Math.max(1, vh - 16);
    const baseWidth = Math.min(width, availableWidth), baseHeight = Math.min(height, availableHeight);
    return {
      baseWidth,
      baseHeight,
      effective: Math.min(
        validScale(scale),
        availableWidth / baseWidth,
        availableHeight / baseHeight
      )
    };
  }
  function installScale(surface, width, height, key, label, changed, prefs) {
    const doc = surface.ownerDocument, win = doc.defaultView;
    let stored;
    try {
      stored = prefs?.get(key);
    } catch {
    }
    let requested = validScale(stored), geometry = scaleGeometry(
      requested,
      width,
      height,
      win.innerWidth,
      win.innerHeight
    );
    const grip = doc.createElement("button");
    grip.type = "button";
    grip.className = "scale-handle";
    const icon = doc.createElement("span");
    icon.textContent = "\u25E2";
    icon.setAttribute("aria-hidden", "true");
    grip.append(icon);
    Object.assign(grip.style, {
      position: "absolute",
      right: "0",
      bottom: "0",
      width: "24px",
      height: "24px",
      minHeight: "24px",
      padding: "0",
      border: "0",
      background: "transparent",
      cursor: "nwse-resize",
      touchAction: "none",
      zIndex: "3"
    });
    surface.append(grip);
    const refresh = () => {
      const viewport = win.visualViewport;
      geometry = scaleGeometry(
        requested,
        width,
        height,
        viewport?.width ?? win.innerWidth,
        viewport?.height ?? win.innerHeight
      );
      const properties = {
        width: geometry.baseWidth + "px",
        height: geometry.baseHeight + "px",
        maxWidth: geometry.baseWidth + "px",
        maxHeight: geometry.baseHeight + "px",
        transform: `scale(${geometry.effective})`,
        transformOrigin: "top left",
        resize: "none"
      };
      for (const [name, value2] of Object.entries(properties)) {
        const property = name;
        if (surface.style[property] !== value2) surface.style[property] = value2;
      }
      surface.dataset.scale = String(requested);
      surface.dataset.effectiveScale = String(geometry.effective);
      surface.dataset.baseWidth = String(geometry.baseWidth);
      surface.dataset.baseHeight = String(geometry.baseHeight);
      if (grip.getAttribute("aria-label") !== label()) {
        grip.setAttribute("aria-label", label());
        grip.title = label();
      }
    };
    const save = () => {
      try {
        prefs?.set(key, requested);
      } catch {
      }
    };
    let start = null;
    const down = (e) => {
      if (e.button !== 0) return;
      start = {
        x: e.clientX,
        y: e.clientY,
        scale: geometry.effective,
        width: geometry.baseWidth,
        height: geometry.baseHeight
      };
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };
    const move = (e) => {
      if (!start) return;
      requested = boundedScale(
        start.scale + ((e.clientX - start.x) * start.width + (e.clientY - start.y) * start.height) / (start.width ** 2 + start.height ** 2)
      );
      refresh();
      changed();
      e.preventDefault();
    };
    const end = () => {
      if (!start) return;
      start = null;
      save();
    };
    const keyboard = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      e.stopPropagation();
      requested = boundedScale(
        requested + (["ArrowRight", "ArrowUp"].includes(e.key) ? 0.05 : -0.05)
      );
      refresh();
      changed();
      save();
    };
    grip.addEventListener("pointerdown", down);
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    grip.addEventListener("keydown", keyboard);
    refresh();
    return {
      refresh,
      get scale() {
        return requested;
      },
      dispose() {
        grip.removeEventListener("pointerdown", down);
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", end);
        grip.removeEventListener("pointercancel", end);
        grip.removeEventListener("keydown", keyboard);
        grip.remove();
      }
    };
  }

  // src/core/route.ts
  var SCHEMA_VERSION = "1.0";
  var RULE_VERSION = "route-1";
  var ADAPTER_VERSION = "metadata-1";
  function record(value2) {
    return value2 !== null && typeof value2 === "object" && !Array.isArray(value2) ? value2 : null;
  }
  function identifier(value2) {
    return typeof value2 === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value2) ? value2 : null;
  }
  function field(source, namespace, key, value2, level, path) {
    const scalar = value2 === null || key === "fast_convo" && typeof value2 === "boolean" ? value2 : identifier(value2);
    return {
      ...source,
      field_namespace: namespace,
      field: key,
      level,
      value: scalar,
      value_state: value2 === null ? "explicit_null" : scalar === null ? "invalid" : "value",
      source_path: path,
      source_type: level === "B" ? "request" : level === "D" ? "dom_label" : "supported_metadata",
      raw_source_type: source.transport,
      schema_version: SCHEMA_VERSION,
      adapter_version: ADAPTER_VERSION,
      rule_version: RULE_VERSION
    };
  }
  function take(output, source, container, entries, prefix) {
    const object = record(container);
    if (!object) return;
    for (const [key, namespace, level] of entries)
      if (Object.hasOwn(object, key))
        output.push(
          field(source, namespace, key, object[key], level, `${prefix}/${key}`)
        );
  }
  function requestEvidence(value2, source) {
    if (!source.endpoint_verified || source.direction !== "outbound") return [];
    const result2 = [];
    take(
      result2,
      source,
      value2,
      [
        ["model", "request", "B"],
        ["thinking_effort", "request", "B"],
        ["requested_model_experience", "request", "B"]
      ],
      ""
    );
    const config = record(record(value2)?.model_configuration);
    take(
      result2,
      source,
      config,
      [["reasoning_effort", "request", "B"]],
      "/model_configuration"
    );
    take(
      result2,
      source,
      record(value2)?.reasoning_options,
      [
        ["reasoning_effort", "request.reasoning_options", "B"],
        ["thinking_effort", "request.reasoning_options", "B"]
      ],
      "/reasoning_options"
    );
    return result2;
  }
  function responseEvidence(value2, source) {
    if (!source.endpoint_verified || source.direction !== "inbound") return [];
    const root = record(value2);
    if (!root) return [];
    if (root.type !== void 0 && !["server_ste_metadata", "message", "response_metadata"].includes(
      String(root.type)
    ))
      return [];
    if (["user", "tool"].includes(String(record(root.author)?.role))) return [];
    const result2 = [];
    if (root.type === "server_ste_metadata") {
      take(
        result2,
        source,
        root.metadata,
        [
          ["model_slug", "server_ste_metadata", "A"],
          ["resolved_model_slug", "resolved", "A"]
        ],
        "/metadata"
      );
    }
    take(result2, source, root, [["resolved_model_slug", "resolved", "A"]], "");
    const message = record(root.message);
    if (record(message?.author)?.role === "assistant") {
      const scoped = {
        ...source,
        message_id: identifier(message?.id) ?? source.message_id
      };
      const metadata = record(message?.metadata);
      take(
        result2,
        scoped,
        metadata,
        [
          ["model_slug", "assistant.metadata", "C"],
          ["thinking_effort", "response", "C"],
          ["fast_convo", "response", "C"],
          ["requested_model_experience", "response.echo", "C"],
          ["resolved_model_slug", "resolved", "A"]
        ],
        "/message/metadata"
      );
      take(
        result2,
        scoped,
        metadata?.server_ste_metadata,
        [["model_slug", "server_ste_metadata", "A"]],
        "/message/metadata/server_ste_metadata"
      );
    }
    return result2;
  }
  function verdict(events, capture, scope, completeness = "Unknown", ruleVersion = RULE_VERSION) {
    const selected = events.filter(
      (e) => e.capture_id === capture && e.task_scope === scope && e.association === "confirmed"
    );
    const a = selected.filter(
      (e) => e.level === "A" && e.value_state === "value" && typeof e.value === "string"
    );
    const candidates = [...new Set(a.map((e) => String(e.value)))];
    const result2 = {
      actual_route: "Unknown",
      verdict: "Unknown",
      coverage: "no-A",
      candidates,
      label_mismatch: false,
      evidence_completeness: completeness,
      scope_limit: completeness === "Complete" ? "supported associated observed segments only" : "based on partial or unconfirmed capture coverage",
      rule_version: ruleVersion
    };
    if (!candidates.length) return result2;
    if (candidates.length > 1)
      return {
        ...result2,
        actual_route: "Conflict",
        verdict: "Conflict",
        coverage: "conflict"
      };
    const actual = candidates[0];
    result2.actual_route = actual;
    result2.coverage = new Set(a.map((e) => e.field_namespace)).size > 1 ? "dual-A" : "single-A";
    const requested = [
      ...new Set(
        selected.filter(
          (e) => e.level === "B" && e.field_namespace === "request" && e.field === "model" && e.value_state === "value"
        ).map((e) => String(e.value))
      )
    ];
    const nonComparable = /* @__PURE__ */ new Set([
      "auto",
      "default",
      "latest",
      "thinking",
      "fast",
      "instant",
      "chatgpt"
    ]);
    result2.verdict = requested.length !== 1 || nonComparable.has(requested[0]) ? "Not comparable" : requested[0] === actual ? "Route Match" : "Route Mismatch";
    result2.label_mismatch = selected.some(
      (e) => (e.level === "C" || e.level === "D") && e.field === "model_slug" && e.value_state === "value" && e.value !== actual
    );
    return result2;
  }

  // src/core/journal.ts
  var Journal = class {
    constructor(now = () => performance.now(), wall = () => (/* @__PURE__ */ new Date()).toISOString(), uuid2 = () => crypto.randomUUID()) {
      this.now = now;
      this.wall = wall;
      this.uuid = uuid2;
    }
    now;
    wall;
    uuid;
    entries = /* @__PURE__ */ new Map();
    bytes = 0;
    control(entry, kind, code, health = "Unknown") {
      entry.change = Object.freeze({});
      if (entry.controls.length >= 2048) {
        entry.control_dropped++;
        if (entry.controls.length === 2048)
          entry.controls.push(
            Object.freeze({
              kind: "health",
              code: "control_limit",
              health: "Partial",
              monotonic_ms: this.now(),
              timestamp: this.wall()
            })
          );
        return;
      }
      entry.controls.push(
        Object.freeze({
          kind,
          code,
          health,
          monotonic_ms: this.now(),
          timestamp: this.wall()
        })
      );
    }
    start(capture) {
      if (this.entries.has(capture.capture_id)) return true;
      if (this.entries.size >= 128) return false;
      if ([...this.entries.values()].filter(
        (e) => e.valid && this.state(e.start.capture_id).lifecycle !== "Closed"
      ).length >= 32)
        return false;
      const entry = {
        start: Object.freeze({
          ...capture,
          context: Object.freeze({ ...capture.context })
        }),
        events: [],
        controls: [],
        valid: true,
        bound: capture.mode === "live",
        control_dropped: 0,
        change: Object.freeze({})
      };
      this.entries.set(capture.capture_id, entry);
      this.control(entry, "started", capture.mode);
      return true;
    }
    append(evidence, observation = {}) {
      const entry = this.entries.get(evidence.capture_id);
      if (!entry?.valid) return null;
      this.tick(evidence.capture_id);
      if (!entry.valid) return null;
      if (entry.events.length >= 2e4) {
        if (!entry.controls.some((c) => c.code === "journal_limit"))
          this.health(evidence.capture_id, "Partial", "journal_limit");
        return null;
      }
      const same2 = (e) => e.field_namespace === evidence.field_namespace && e.field === evidence.field && e.task_scope === evidence.task_scope && e.message_id === evidence.message_id && e.channel === evidence.channel && e.direction === evidence.direction && e.transport === evidence.transport;
      const previous = [...entry.events].reverse().find(same2);
      const state = this.state(evidence.capture_id);
      const late = state.lifecycle === "Closed";
      const event = {
        ...evidence,
        ...entry.start.context,
        event_id: this.uuid(),
        event_index: entry.events.length + 1,
        timestamp: this.wall(),
        monotonic_ms: this.now(),
        old_value: previous?.value ?? null,
        old_value_state: previous?.value_state ?? "absent",
        new_value: evidence.value,
        arrival_index: observation.arrival_index ?? null,
        decode_index: observation.decode_index ?? null,
        envelope_id: observation.envelope_id ?? null,
        delta_op: observation.delta_op ?? null,
        request_id: observation.request_id ?? null,
        conversation_id: observation.conversation_id ?? entry.start.conversation_id,
        parent_message_id: observation.parent_message_id ?? null,
        parser_status: observation.parser_status ?? "supported",
        observed_vs_declared_time: "observed",
        late_metadata: late,
        revision: state.revision + (late ? 1 : 0),
        delta_header: observation.delta_header ? Object.freeze({
          ...observation.delta_header,
          explicit: Object.freeze({ ...observation.delta_header.explicit })
        }) : null,
        envelope_event: observation.envelope_event ?? null,
        envelope_retry: observation.envelope_retry ?? null
      };
      const bytes = new TextEncoder().encode(JSON.stringify(event)).length;
      if (this.bytes + bytes > 33554432) {
        if (!entry.controls.some((c) => c.code === "journal_byte_limit"))
          this.health(evidence.capture_id, "Partial", "journal_byte_limit");
        return null;
      }
      this.bytes += bytes;
      entry.events.push(Object.freeze(event));
      entry.change = Object.freeze({});
      return event;
    }
    complete(id2, code = "protocol_done") {
      const entry = this.entries.get(id2);
      if (entry?.valid && !entry.controls.some((c) => c.kind === "complete"))
        this.control(entry, "complete", code);
    }
    segmentEof(id2) {
      const entry = this.entries.get(id2);
      if (entry?.valid) this.control(entry, "segment_eof", "transport_eof");
    }
    health(id2, health, code) {
      const entry = this.entries.get(id2);
      if (entry?.valid) this.control(entry, "health", code, health);
    }
    tick(id2) {
      for (const [key, entry] of this.entries) {
        if (id2 && key !== id2 || !entry.valid) continue;
        const done = entry.controls.find((c) => c.kind === "complete");
        if (done && this.now() >= done.monotonic_ms + 3e4 && !entry.controls.some((c) => c.kind === "closed"))
          this.control(entry, "closed", "confirmation_deadline");
        if (this.now() - entry.start.started_at >= 864e5 && this.state(key).lifecycle !== "Closed") {
          this.health(key, "Partial", "observation_24h_limit");
          this.control(entry, "closed", "safety_limit");
          entry.valid = false;
        }
      }
    }
    reset(context, reason) {
      for (const entry of this.entries.values()) {
        const old = entry.start.context;
        if (reason === "pause" || reason === "clear" || reason === "dispose" || old.document_id !== context.document_id || !entry.bound) {
          if (entry.valid) {
            this.control(entry, "invalidated", reason, "Partial");
            entry.valid = false;
          }
        }
      }
    }
    // Identity is unique across entries, restarts and separate Journal instances.
    revision(id2) {
      return this.entries.get(id2)?.change;
    }
    snapshot(id2) {
      const e = this.entries.get(id2);
      return e ? {
        start: e.start,
        events: [...e.events],
        controls: [...e.controls],
        control_dropped: e.control_dropped
      } : null;
    }
    ids() {
      return [...this.entries.keys()];
    }
    clear() {
      this.entries.clear();
      this.bytes = 0;
    }
    discard(id2) {
      const entry = this.entries.get(id2);
      if (!entry) return;
      this.bytes = Math.max(
        0,
        this.bytes - entry.events.reduce(
          (n, e) => n + new TextEncoder().encode(JSON.stringify(e)).length,
          0
        )
      );
      this.entries.delete(id2);
    }
    terminate(id2, reason) {
      const entry = this.entries.get(id2);
      if (entry?.valid) this.control(entry, "closed", reason, "Failed");
    }
    state(id2) {
      return projectState(this.snapshot(id2));
    }
    route(id2, scope, ruleVersion = RULE_VERSION) {
      const snapshot = this.snapshot(id2);
      return verdict(
        snapshot?.events ?? [],
        id2,
        scope,
        this.state(id2).completeness,
        ruleVersion
      );
    }
  };
  function projectState(snapshot) {
    const controls = snapshot?.controls ?? [];
    const closed = controls.some(
      (c) => c.kind === "closed" || c.kind === "invalidated"
    );
    const done = controls.some((c) => c.kind === "complete");
    const lifecycle = closed ? "Closed" : done ? "Settling" : "Capturing";
    const health = controls.filter((c) => c.kind === "health" || c.kind === "invalidated").map((c) => c.health);
    const completeness = health.includes("Failed") ? "Failed" : health.includes("Partial") ? "Partial" : done ? "Complete" : "Unknown";
    return {
      lifecycle,
      completeness,
      revision: snapshot?.events.at(-1)?.revision ?? 0,
      confirmation_deadline: controls.find((c) => c.kind === "complete")?.monotonic_ms === void 0 ? null : controls.find((c) => c.kind === "complete").monotonic_ms + 3e4
    };
  }

  // src/core/assets.ts
  var BUILD_VERSION = "build-1";
  var NORMALIZATION_VERSION = "asset-normalization-1";
  function normalizeAsset(raw, origin, source, observed_at) {
    if (typeof raw !== "string") return { asset: null, overflow: false };
    if (raw.length > 2048 || new TextEncoder().encode(raw).byteLength > 2048)
      return { asset: null, overflow: true };
    try {
      const u = new URL(raw, origin || void 0);
      if (!["http:", "https:"].includes(u.protocol))
        return { asset: null, overflow: false };
      const script = /\.m?js$/i.test(u.pathname), style = /\.css$/i.test(u.pathname), category = script ? "script" : style ? "style" : "resource";
      const registered = /^\/(?:_next\/static\/|assets\/|static\/|first\.js$)/.test(u.pathname);
      const sensitive = /(?:secret|session|account|token|auth|email)|\/(?:c|conversation|user)(?:\/|[-_])/i.test(
        u.pathname
      ) || /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{20,}/i.test(u.pathname);
      let path = registered && !sensitive ? u.pathname : `/[${category}]`;
      if (registered && !sensitive) {
        const parts = path.split("/");
        if (parts.some(
          (part, index) => part.length > 96 || index < parts.length - 1 && /(?:token|secret|session)|[a-zA-Z0-9_-]{32,}/i.test(part)
        ))
          path = `/[${category}]`;
        const filename = parts.at(-1) ?? "";
        if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(filename)) path = `/[${category}]`;
      }
      const token = path.startsWith("/[") ? null : /(?:[.-])([0-9a-f]{8,64})(?=\.(?:m?js|css)$)/i.exec(path)?.[1] ?? null;
      if (new TextEncoder().encode(u.origin + path).byteLength > 2048)
        return { asset: null, overflow: true };
      return {
        asset: {
          url: u.origin + path,
          asset_url_token: token,
          category,
          source,
          observed_at,
          availability: "observed"
        },
        overflow: false
      };
    } catch {
      return { asset: null, overflow: false };
    }
  }
  async function assetSetHash(urls, digest2 = (bytes) => crypto.subtle.digest("SHA-256", bytes)) {
    const sorted = [...new Set(urls)].sort();
    const bytes = new TextEncoder().encode(JSON.stringify(sorted));
    return [...new Uint8Array(await digest2(bytes))].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  var AssetSet = class {
    values = /* @__PURE__ */ new Map();
    overflow = false;
    add(raw, origin, source, observed_at) {
      const { asset, overflow } = normalizeAsset(
        raw,
        origin,
        source,
        observed_at
      );
      this.overflow ||= overflow;
      if (!asset || this.values.has(asset.url)) return false;
      if (this.values.size >= 500) {
        this.overflow = true;
        return false;
      }
      this.values.set(asset.url, asset);
      return true;
    }
    all() {
      return [...this.values.values()].sort((a, b) => a.url.localeCompare(b.url));
    }
  };
  function publicMarkers(next, declared) {
    const scalar = (value2) => typeof value2 === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value2) ? value2 : null;
    const build_id = scalar(record(next)?.buildId), deployment_marker = scalar(declared);
    return {
      build_id,
      deployment_marker,
      availability: build_id || deployment_marker ? "observed" : "unknown",
      conflict: !!build_id && !!deployment_marker && build_id !== deployment_marker
    };
  }

  // src/history/safety.ts
  var HISTORY_SCHEMA = "history-2";
  var REDACTION_VERSION = "redaction-1";
  var secret = /(?:secret|canary|access.?token|session.?token|authorization|cookie|csrf|password|credential|payment|bearer)/i;
  function safeWord(v, limit = 128) {
    return typeof v === "string" && v.length <= limit && !secret.test(v) && /^[a-zA-Z0-9_.: /@#=[\](),-]+$/.test(v) ? v : null;
  }
  function id(v) {
    return identifier(v) && !secret.test(String(v)) ? String(v) : null;
  }
  function registeredLevel(e) {
    const ns = e.field_namespace, f = e.field, path = e.source_path;
    if (e.direction === "outbound" && e.endpoint_verified && ["request", "request.reasoning_options"].includes(ns) && [
      "model",
      "thinking_effort",
      "reasoning_effort",
      "requested_model_experience"
    ].includes(f) && [
      "/model",
      "/thinking_effort",
      "/requested_model_experience",
      "/model_configuration/reasoning_effort",
      "/reasoning_options/reasoning_effort",
      "/reasoning_options/thinking_effort"
    ].includes(path))
      return "B";
    if (e.direction === "inbound" && e.endpoint_verified) {
      if (ns === "server_ste_metadata" && f === "model_slug" && [
        "/metadata/model_slug",
        "/message/metadata/server_ste_metadata/model_slug"
      ].includes(path))
        return "A";
      if (ns === "resolved" && f === "resolved_model_slug" && [
        "/metadata/resolved_model_slug",
        "/resolved_model_slug",
        "/message/metadata/resolved_model_slug"
      ].includes(path))
        return "A";
      if (ns === "assistant.metadata" && f === "model_slug" && path === "/message/metadata/model_slug")
        return "C";
      if (["response", "response.echo"].includes(ns) && ["thinking_effort", "fast_convo", "requested_model_experience"].includes(
        f
      ) && path === `/message/metadata/${f}`)
        return "C";
    }
    if (ns === "dom" && f === "model_slug" && path === "/@data-message-model-slug" && e.transport === "dom" && e.direction === "local")
      return "D";
    const fields = {
      "network.http": ["http_status"],
      "network.headers": [
        "content-type",
        "cf-mitigated",
        "cf-ray",
        "server",
        "server-timing.availability",
        "retry-after.seconds",
        "retry-after.date"
      ],
      "network.verdict": ["status"],
      "network.failure": ["category", "cause"],
      "network.challenge": [
        "html",
        "challenge_resource_template",
        "registered_html_structure"
      ],
      "network.observer": ["body"],
      pow: [
        "raw_hex",
        "decimal",
        "source_path",
        "request_id",
        "association_status",
        "validity"
      ],
      "pow.association": [
        "association_status",
        "proof",
        "delta_ms",
        "requirements_capture_id"
      ],
      "pow.observer": ["body", "byte_budget"],
      "environment.reference": ["snapshot_id", "reason"],
      "environment.snapshot": ["snapshot_id", "reason"],
      "environment.fields": [
        "user_agent",
        "browser",
        "browser_major",
        "platform",
        "os",
        "os_uncertainty",
        "consistency",
        "ua_data_availability",
        "language",
        "languages",
        "timezone",
        "timezone_offset",
        "screen.width",
        "screen.height",
        "viewport.width",
        "viewport.height",
        "device_pixel_ratio",
        "hardware_concurrency",
        "device_memory",
        "connection.effective_type",
        "connection.rtt",
        "connection.downlink",
        "connection.save_data",
        "origin",
        "visibility",
        "focus",
        "online",
        "client_ip"
      ],
      "frontend.assets": [
        "asset_set_hash",
        "normalization_version",
        "resource_count",
        "overflow",
        "completeness",
        "window_start_ms",
        "window_end_ms",
        "resource_timing_availability",
        "performance_observer_availability"
      ],
      "frontend.markers": ["build_id", "deployment_marker", "conflict"],
      "frontend.service_worker": [
        "availability",
        "controller_url",
        "controller_state"
      ]
    };
    const allowed = fields[ns]?.includes(f) || ns === "network.challenge.resource" && f === "path_template" || ns === "pow.association" && /^target\.[a-zA-Z0-9_.:-]{1,128}$/.test(f) || /^network\.server-timing\.\d{1,2}$/.test(ns) && ["metric_name", "dur"].includes(f) || /^frontend\.asset\.\d{1,3}$/.test(ns) && ["url", "asset_url_token"].includes(f) || ns === "frontend.service_worker" && /^registration\.\d{1,2}\.(url|state)$/.test(f) || /^network\.websocket\.[a-zA-Z0-9_.:-]{1,128}$/.test(ns) && [
      "segment_id",
      "event",
      "code",
      "wasClean",
      "reconnect",
      "association_status",
      "proof"
    ].includes(f);
    if (!allowed) return null;
    if (ns.startsWith("network.")) return "N";
    if (ns.startsWith("pow") || ns.startsWith("environment.") || ns.startsWith("frontend."))
      return "E";
    return null;
  }
  function value(e, v) {
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v !== "string" || secret.test(v) || [...v].some((c) => c.charCodeAt(0) < 32) || /[<>`\\]|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(v))
      return null;
    if (e.field === "url" || e.field.endsWith("_url") || /\.url$/.test(e.field))
      return normalizeAsset(v, "", "storage", "").asset?.url ?? null;
    if (e.field === "origin") {
      try {
        const u = new URL(v);
        return ["https:", "http:"].includes(u.protocol) && u.origin === v ? v : null;
      } catch {
        return null;
      }
    }
    if (e.field === "user_agent") return v.length <= 512 ? v : null;
    if (e.field === "content-type")
      return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(v) ? v : null;
    if (e.field === "timezone")
      return /^[a-zA-Z_]+(?:\/[a-zA-Z_+-]+){0,2}$/.test(v) ? v : null;
    if (e.field === "languages")
      try {
        const a = JSON.parse(v);
        return Array.isArray(a) && a.length <= 16 && a.every(
          (x) => typeof x === "string" && /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(x)
        ) ? JSON.stringify(a) : null;
      } catch {
        return null;
      }
    if (e.field.endsWith(".date"))
      return /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(v) ? v : null;
    return safeWord(v, e.field === "decimal" ? 1024 : 256);
  }
  function safeOccurrence(input) {
    const level = registeredLevel(input);
    if (!level || level !== input.level) return null;
    const capture = id(input.capture_id), event = id(input.event_id), doc = id(input.document_id), visit = id(input.visit_id);
    if (!capture || !event || !doc || !visit || !Number.isInteger(input.event_index) || input.event_index < 1)
      return null;
    const v = value(input, input.value);
    const out = {
      capture_id: capture,
      event_id: event,
      document_id: doc,
      visit_id: visit,
      epoch: input.epoch,
      event_index: input.event_index,
      timestamp: /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(input.timestamp) ? input.timestamp : "",
      monotonic_ms: input.monotonic_ms,
      task_scope: safeWord(input.task_scope) ?? "unknown",
      message_id: id(input.message_id),
      transport: input.transport,
      direction: input.direction,
      association: input.association,
      association_proof: safeWord(input.association_proof) ?? "unknown",
      endpoint_verified: input.endpoint_verified,
      channel: safeWord(input.channel) ?? "unknown",
      transport_segment_id: id(input.transport_segment_id) ?? capture,
      field_namespace: input.field_namespace,
      field: input.field,
      level,
      value: v,
      value_state: input.value !== null && v === null ? "invalid" : input.value_state,
      source_path: safeWord(input.source_path, 512) ?? "unknown",
      source_type: safeWord(input.source_type) ?? "unknown",
      raw_source_type: safeWord(input.raw_source_type) ?? "unknown",
      schema_version: safeWord(input.schema_version) ?? "unknown",
      adapter_version: safeWord(input.adapter_version) ?? "unknown",
      rule_version: safeWord(input.rule_version) ?? "unknown",
      old_value: value(input, input.old_value),
      old_value_state: input.old_value_state,
      new_value: v,
      arrival_index: input.arrival_index,
      decode_index: input.decode_index,
      envelope_id: id(input.envelope_id),
      delta_op: safeWord(input.delta_op),
      request_id: id(input.request_id),
      conversation_id: id(input.conversation_id),
      parent_message_id: id(input.parent_message_id),
      parser_status: safeWord(input.parser_status) ?? "unknown",
      observed_vs_declared_time: "observed",
      late_metadata: input.late_metadata,
      revision: input.revision,
      delta_header: input.delta_header ? {
        path: safeWord(input.delta_header.path, 512) ?? "unknown",
        channel: safeWord(input.delta_header.channel) ?? "unknown",
        explicit: {
          c: input.delta_header.explicit.c,
          p: input.delta_header.explicit.p,
          o: input.delta_header.explicit.o
        }
      } : null,
      envelope_event: safeWord(input.envelope_event),
      envelope_retry: input.envelope_retry,
      availability: safeWord(input.availability) ?? "unknown",
      privacy_class: safeWord(input.privacy_class) ?? "safe_metadata",
      observed_at: input.timestamp
    };
    return out;
  }
  function safeSnapshot(s) {
    const events = s.events.map(safeOccurrence).filter((e) => e !== null);
    const controls = s.controls.slice(0, 2049).map((c) => ({
      kind: [
        "started",
        "complete",
        "health",
        "closed",
        "invalidated",
        "segment_eof"
      ].includes(c.kind) ? c.kind : "health",
      monotonic_ms: c.monotonic_ms,
      timestamp: /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(c.timestamp) ? c.timestamp : "",
      code: safeWord(c.code) ?? "redacted",
      health: ["Complete", "Partial", "Failed", "Unknown"].includes(c.health) ? c.health : "Partial"
    }));
    if (events.length !== s.events.length)
      controls.push({
        kind: "health",
        monotonic_ms: s.start.started_at,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        code: "storage_redaction_drop",
        health: "Partial"
      });
    return {
      start: {
        capture_id: id(s.start.capture_id) ?? "invalid",
        context: {
          document_id: id(s.start.context.document_id) ?? "invalid",
          visit_id: id(s.start.context.visit_id) ?? "invalid",
          epoch: s.start.context.epoch
        },
        mode: s.start.mode,
        endpoint_path: safeWord(s.start.endpoint_path) ?? void 0,
        transport: s.start.transport,
        conversation_id: id(s.start.conversation_id),
        started_at: s.start.started_at
      },
      events,
      controls,
      control_dropped: s.control_dropped
    };
  }
  var ExportRedactor = class {
    ids = /* @__PURE__ */ new Map();
    pseudonym(kind, v) {
      if (!v) return null;
      const key = `${kind}:${v}`;
      if (!this.ids.has(key))
        this.ids.set(
          key,
          `${kind}-${[...this.ids.keys()].filter((k) => k.startsWith(kind + ":")).length + 1}`
        );
      return this.ids.get(key);
    }
    snapshot(s) {
      const safe = safeSnapshot(s);
      const events = safe.events.map((e) => {
        const out = { ...e };
        if (e.field_namespace.startsWith("network.websocket."))
          out.field_namespace = "network.websocket." + this.pseudonym(
            "segment",
            e.field_namespace.slice("network.websocket.".length)
          );
        if (e.field_namespace === "pow.association" && e.field.startsWith("target."))
          out.field = "target." + this.pseudonym("capture", e.field.slice(7));
        for (const [key, kind] of [
          ["capture_id", "capture"],
          ["event_id", "event"],
          ["document_id", "document"],
          ["visit_id", "visit"],
          ["message_id", "message"],
          ["request_id", "request"],
          ["conversation_id", "conversation"],
          ["parent_message_id", "message"],
          ["transport_segment_id", "segment"],
          ["envelope_id", "envelope"]
        ]) {
          const mapped = this.pseudonym(kind, e[key]);
          if (mapped !== null) out[key] = mapped;
        }
        if (e.field === "cf-ray" || e.field === "request_id" || e.field === "requirements_capture_id" || e.field === "snapshot_id" || e.field === "segment_id") {
          const kind = e.field === "cf-ray" ? "ray" : e.field === "request_id" ? "request" : e.field === "requirements_capture_id" ? "capture" : "segment";
          out.value = this.pseudonym(
            kind,
            typeof e.value === "string" ? e.value : null
          );
          out.new_value = out.value;
          out.old_value = this.pseudonym(
            kind,
            typeof e.old_value === "string" ? e.old_value : null
          );
        }
        if (e.field_namespace === "environment.fields") {
          const coarse = (v) => e.field === "user_agent" || e.field === "origin" || e.field === "client_ip" ? null : typeof v === "number" && /(width|height)/.test(e.field) ? Math.round(v / 200) * 200 : typeof v === "number" && /(memory|concurrency)/.test(e.field) ? 2 ** Math.floor(Math.log2(Math.max(1, v))) : v;
          out.value = coarse(out.value);
          out.old_value = coarse(out.old_value);
          out.new_value = out.value;
          if (out.value === null) out.availability = "redacted";
        }
        return out;
      });
      return {
        ...safe,
        start: {
          ...safe.start,
          capture_id: this.pseudonym("capture", safe.start.capture_id),
          conversation_id: this.pseudonym(
            "conversation",
            safe.start.conversation_id
          ),
          context: {
            ...safe.start.context,
            document_id: this.pseudonym(
              "document",
              safe.start.context.document_id
            ),
            visit_id: this.pseudonym("visit", safe.start.context.visit_id)
          }
        },
        events
      };
    }
  };

  // src/history/storage.ts
  var LIMITS = {
    history: 200,
    age_ms: 30 * 864e5,
    total: 50 * 1048576,
    capture: 2 * 1048576,
    occurrences: 2e4,
    chunk: 128 * 1024,
    pending: 256 * 1024,
    active: 8 * 1048576
  };
  async function digest(bytes) {
    return [
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))
      )
    ].map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  var encode = (v) => new TextEncoder().encode(JSON.stringify(v));
  function conversationHistory(records) {
    return records.filter((r) => r.snapshot.start.mode === "live").sort((a, b) => b.manifest.created_at - a.manifest.created_at).slice(0, LIMITS.history);
  }
  function relatedHistory(records, snapshot) {
    return records.filter(
      (r) => ["environment", "network", "requirements"].includes(
        r.snapshot.start.mode
      ) && r.snapshot.start.context.document_id === snapshot.start.context.document_id && r.snapshot.start.context.epoch === snapshot.start.context.epoch
    ).slice(0, 32).map((r) => r.snapshot);
  }
  function migrateManifest(value2, target = HISTORY_SCHEMA) {
    if (!["history-0", "history-1", HISTORY_SCHEMA].includes(
      value2.schema_version
    ) || target !== HISTORY_SCHEMA)
      throw Error("unsupported_migration");
    return {
      ...structuredClone(value2),
      schema_version: target,
      redaction_gaps: value2.schema_version === HISTORY_SCHEMA ? structuredClone(value2.redaction_gaps) : []
    };
  }
  var ROOT = "blackbox:history:";
  var EPOCH = ROOT + "clear_epoch";
  var HistoryStore = class {
    constructor(store, writer_id, now = () => Date.now(), limits = { ...LIMITS }) {
      this.store = store;
      this.writer_id = writer_id;
      this.now = now;
      this.limits = limits;
    }
    store;
    writer_id;
    now;
    limits;
    onEpochChanged;
    epoch = "";
    chains = /* @__PURE__ */ new Map();
    pending = /* @__PURE__ */ new Map();
    pendingTotal = 0;
    owned = /* @__PURE__ */ new Map();
    failed = /* @__PURE__ */ new Set();
    positions = /* @__PURE__ */ new Map();
    persistedRevisions = /* @__PURE__ */ new Map();
    removeListener;
    health = {
      status: "Unknown",
      queued_bytes: 0,
      saved: 0,
      dropped: 0
    };
    async init() {
      const current = await this.store.get(EPOCH);
      this.epoch = typeof current === "string" ? current : "initial";
      this.removeListener = this.store.listen?.(EPOCH, () => {
        void this.syncEpoch().catch(() => {
          this.health.status = "Failed";
        });
      });
      this.health.status = "Ready";
    }
    async syncEpoch() {
      const value2 = await this.store.get(EPOCH);
      const e = typeof value2 === "string" ? value2 : "initial";
      if (e !== this.epoch) {
        this.epoch = e;
        for (const id2 of [
          ...this.owned.keys(),
          ...this.positions.keys(),
          ...this.pending.keys()
        ])
          this.failed.add(id2);
        this.owned.clear();
        this.positions.clear();
        this.persistedRevisions.clear();
        this.onEpochChanged?.();
      }
      return e;
    }
    prefix(epoch = this.epoch, schema = HISTORY_SCHEMA) {
      return `${ROOT}${schema}:${epoch}:`;
    }
    key(id2) {
      return this.prefix() + encodeURIComponent(this.writer_id) + ":" + encodeURIComponent(id2);
    }
    queue(snapshot, committed) {
      const id2 = snapshot.start.capture_id;
      this.persistedRevisions.delete(id2);
      if (this.failed.has(id2)) return Promise.resolve();
      if (this.pending.has(id2)) return this.chains.get(id2) ?? Promise.resolve();
      const safe = safeSnapshot(snapshot), metadata = { ...safe, events: [] };
      const rawIndices = new Set(snapshot.events.map((e) => e.event_index));
      const safeIndices = new Set(safe.events.map((e) => e.event_index));
      const gaps = [];
      let prior = 0;
      for (const e of safe.events) {
        if (e.event_index > prior + 1) {
          const dropped = e.event_index - prior - 1;
          if (dropped <= this.limits.occurrences && Array.from({ length: dropped }, (_, i) => prior + i + 1).every(
            (i) => rawIndices.has(i) && !safeIndices.has(i)
          ))
            gaps.push({ after: prior, before: e.event_index, dropped });
        }
        prior = e.event_index;
      }
      let tail = encode(metadata).length + encode(gaps).length;
      const batch = [];
      for (const e of safe.events.filter(
        (e2) => e2.event_index > (this.positions.get(id2) ?? 0)
      )) {
        const size = encode(e).length + 1;
        if (tail + size > this.limits.pending) break;
        batch.push(e);
        tail += size;
      }
      const unsaved = safe.events.some(
        (e) => e.event_index > (this.positions.get(id2) ?? 0)
      );
      const target = safe.events.at(-1)?.event_index ?? 0;
      safe.events = batch;
      if (tail > this.limits.pending || unsaved && !batch.length || this.pendingTotal + tail > this.limits.active) {
        this.health.dropped++;
        this.health.status = "Partial";
        this.failed.add(id2);
        return this.markFailure({ ...safe, events: [] }, "pending_queue_limit");
      }
      const epoch = this.epoch;
      this.pending.set(id2, tail);
      this.pendingTotal += tail;
      this.health.queued_bytes = this.pendingTotal;
      const previous = this.chains.get(id2) ?? Promise.resolve();
      const chain = previous.then(async () => {
        const saved = await this.persist(safe, epoch, void 0, gaps);
        if (saved && this.epoch === epoch && !this.failed.has(id2))
          committed?.(target);
      }).catch(() => {
        this.failed.add(id2);
        this.health.status = "Failed";
      }).finally(() => {
        this.pending.delete(id2);
        this.pendingTotal -= tail;
        this.health.queued_bytes = this.pendingTotal;
      });
      this.chains.set(id2, chain);
      return chain;
    }
    async flush(journal) {
      const epoch = await this.syncEpoch();
      const ids = new Set(journal.ids());
      for (const id2 of this.persistedRevisions.keys())
        if (!ids.has(id2)) this.persistedRevisions.delete(id2);
      for (const id2 of ids) {
        const revision = journal.revision(id2);
        if (revision && this.persistedRevisions.get(id2) === revision && !this.pending.has(id2) && !this.failed.has(id2))
          continue;
        const s = journal.snapshot(id2);
        if (!s || !revision) continue;
        for (let round = 0; round < 32; round++) {
          const before = this.positions.get(id2) ?? 0;
          let target;
          await this.queue(s, (committed) => {
            target = committed;
          });
          const after = this.positions.get(id2) ?? 0;
          if (target !== void 0 && after >= target && !this.pending.has(id2) && !this.failed.has(id2) && this.epoch === epoch && journal.revision(id2) !== void 0) {
            this.persistedRevisions.set(id2, revision);
            break;
          }
          if (this.failed.has(id2) || after >= (s.events.at(-1)?.event_index ?? 0) || after === before)
            break;
        }
      }
    }
    async markFailure(snapshot, note) {
      try {
        await this.persist(snapshot, this.epoch, note);
      } catch {
        this.health.status = "Failed";
      }
    }
    async persist(snapshot, epoch, forced, gaps = []) {
      if (await this.syncEpoch() !== epoch) return;
      const base = this.key(snapshot.start.capture_id), key = base + ":manifest";
      const old = await this.store.get(key);
      if (old && (old.schema_version !== HISTORY_SCHEMA || old.writer_id !== this.writer_id))
        throw Error("writer_or_schema_conflict");
      const { events, ...metadata } = snapshot;
      const manifest = old ? structuredClone(old) : {
        schema_version: HISTORY_SCHEMA,
        clear_epoch: epoch,
        capture_id: snapshot.start.capture_id,
        writer_id: this.writer_id,
        created_at: this.now(),
        updated_at: this.now(),
        committed_sequence: 0,
        chunks: [],
        bytes: 0,
        count: 0,
        status: "Saved",
        notes: [],
        redaction_gaps: [],
        snapshot: metadata
      };
      manifest.snapshot = metadata;
      manifest.updated_at = this.now();
      if (forced) {
        manifest.status = "Partial";
        manifest.notes.push(forced);
      }
      let batch = [];
      let size = 2;
      let manifestWrittenByCommit = false;
      const commit = async () => {
        if (!batch.length) return;
        const sequence = manifest.committed_sequence + 1, chunk = {
          schema_version: HISTORY_SCHEMA,
          sequence,
          first: batch[0].event_index,
          last: batch.at(-1).event_index,
          events: batch,
          redaction_gaps: gaps.filter(
            (g) => batch.some((e) => e.event_index === g.before)
          )
        };
        const data = encode(chunk);
        if (data.length > this.limits.chunk || manifest.bytes + data.length + encode(metadata).length > this.limits.capture || manifest.count + batch.length > this.limits.occurrences) {
          manifest.status = "Partial";
          manifest.notes.push("capture_storage_limit");
          manifestWrittenByCommit = false;
          return false;
        }
        const chunkKey = base + `:chunk:${sequence}`;
        await this.store.set(chunkKey, chunk);
        if (await this.syncEpoch() !== epoch) return false;
        manifest.chunks.push({
          key: chunkKey,
          sequence,
          first: chunk.first,
          last: chunk.last,
          bytes: data.length,
          sha256: await digest(data)
        });
        manifest.redaction_gaps.push(...chunk.redaction_gaps);
        if (chunk.redaction_gaps.length) {
          manifest.status = "Partial";
          if (!manifest.notes.includes("storage_redaction_drop"))
            manifest.notes.push("storage_redaction_drop");
        }
        manifest.committed_sequence = sequence;
        manifest.bytes += data.length;
        manifest.count += batch.length;
        await this.store.set(key, manifest);
        manifestWrittenByCommit = true;
        batch = [];
        size = 2;
        return true;
      };
      try {
        if (!forced)
          for (const e of events.filter(
            (e2) => e2.event_index > (manifest.chunks.at(-1)?.last ?? 0)
          )) {
            const length = encode(e).length + 1;
            if (length + 256 > this.limits.chunk) {
              manifest.status = "Partial";
              manifest.notes.push("occurrence_storage_limit");
              manifestWrittenByCommit = false;
              break;
            }
            if (size + length + 256 > this.limits.chunk && await commit() === false)
              break;
            batch.push(e);
            size += length;
          }
        await commit();
        if (await this.syncEpoch() !== epoch) return;
        if (!manifestWrittenByCommit) await this.store.set(key, manifest);
        this.owned.set(snapshot.start.capture_id, key);
        this.health.saved++;
        this.positions.set(
          snapshot.start.capture_id,
          manifest.chunks.at(-1)?.last ?? 0
        );
        if (manifest.status === "Partial" && manifest.notes.includes("capture_storage_limit"))
          this.failed.add(snapshot.start.capture_id);
        if (manifest.status === "Partial") this.health.status = "Partial";
        return this.epoch === epoch;
      } catch {
        this.health.status = "Failed";
        this.failed.add(snapshot.start.capture_id);
        throw Error("persistent_storage_failed");
      }
    }
    // Read back committed bytes, including every chunk hash and final Closed metadata.
    // An existing key/position alone is never an eviction certificate.
    async committedThrough(snapshot) {
      const id2 = snapshot.start.capture_id;
      if (this.failed.has(id2) || this.pending.has(id2)) return false;
      const key = this.owned.get(id2);
      if (!key) return false;
      try {
        const epoch = await this.store.get(EPOCH);
        if ((typeof epoch === "string" ? epoch : "initial") !== this.epoch)
          return false;
        const recovered = await this.recover(key);
        const safe = safeSnapshot(snapshot);
        return recovered.manifest.writer_id === this.writer_id && recovered.manifest.clear_epoch === this.epoch && recovered.manifest.status === "Saved" && recovered.completeness === "Complete" && !recovered.read_only && recovered.notes.length === 0 && projectState(snapshot).lifecycle === "Closed" && safe.events.length === snapshot.events.length && JSON.stringify(recovered.snapshot) === JSON.stringify(safe);
      } catch {
        return false;
      }
    }
    releaseCommitted(id2) {
      if (this.pending.has(id2)) return;
      this.chains.delete(id2);
      this.positions.delete(id2);
      this.owned.delete(id2);
      this.failed.delete(id2);
      this.persistedRevisions.delete(id2);
    }
    async drain() {
      await Promise.all(this.chains.values());
    }
    async list() {
      await this.syncEpoch();
      const keys2 = (await this.store.keys()).filter(
        (k) => [HISTORY_SCHEMA, "history-0", "history-1"].some(
          (schema) => k.startsWith(this.prefix(this.epoch, schema))
        ) && k.endsWith(":manifest")
      );
      const active = await this.store.get(ROOT + "active_schema");
      if (active && typeof active.manifest_key === "string" && active.manifest_key.startsWith(ROOT)) {
        const selected = await this.store.get(active.manifest_key);
        if (selected?.clear_epoch === this.epoch) {
          const i = keys2.indexOf(active.previous_key);
          if (i >= 0) keys2.splice(i, 1);
          keys2.push(active.manifest_key);
        }
      }
      const out = [];
      for (const k of keys2) {
        try {
          out.push(await this.recover(k));
        } catch {
          this.health.status = "Partial";
        }
      }
      return out.sort((a, b) => b.manifest.created_at - a.manifest.created_at);
    }
    async recover(key) {
      const m = await this.store.get(key);
      if (!m || typeof m !== "object" || !Array.isArray(m.chunks) || !m.snapshot)
        throw Error("invalid_manifest");
      const notes = [...m.notes], events = [];
      let previous = 0;
      const read_only = m.schema_version !== HISTORY_SCHEMA;
      if (read_only) notes.push("unsupported_schema_read_only");
      const declared = [];
      for (const [i, ref] of m.chunks.entries()) {
        if (ref.sequence !== i + 1) {
          notes.push("sequence_gap");
        }
        const c = await this.store.get(ref.key);
        if (!c) {
          notes.push("missing_chunk");
          continue;
        }
        if (await digest(encode(c)) !== ref.sha256 || encode(c).length !== ref.bytes) {
          notes.push("hash_mismatch");
          continue;
        }
        if (c.schema_version !== m.schema_version || c.sequence !== ref.sequence || !Array.isArray(c.events) || c.first !== ref.first || c.last !== ref.last) {
          notes.push("chunk_manifest_mismatch");
          continue;
        }
        const chunkGaps = !read_only && Array.isArray(c.redaction_gaps) ? c.redaction_gaps : [];
        declared.push(...chunkGaps);
        const used = /* @__PURE__ */ new Set();
        for (const e of c.events) {
          if (!Number.isSafeInteger(e.event_index) || e.event_index < 1 || e.event_index <= previous)
            notes.push("sequence_gap");
          else if (e.event_index !== previous + 1) {
            const matching = chunkGaps.filter(
              (g) => Number.isSafeInteger(g.after) && Number.isSafeInteger(g.before) && Number.isSafeInteger(g.dropped) && g.after === previous && g.before === e.event_index && g.dropped === e.event_index - previous - 1 && g.dropped > 0 && g.dropped <= this.limits.occurrences
            );
            if (matching.length === 1) used.add(matching[0]);
            else notes.push("sequence_gap");
          }
          events.push(e);
          previous = e.event_index;
        }
        if (used.size !== chunkGaps.length)
          notes.push("redaction_metadata_mismatch");
        if (c.events[0]?.event_index !== c.first || c.events.at(-1)?.event_index !== c.last)
          notes.push("chunk_manifest_mismatch");
      }
      if (!read_only && JSON.stringify(declared) !== JSON.stringify(m.redaction_gaps))
        notes.push("redaction_metadata_mismatch");
      if (m.committed_sequence !== m.chunks.length || m.count !== events.length)
        notes.push("commit_count_gap");
      const base = key.slice(0, -":manifest".length);
      const known = new Set(m.chunks.map((c) => c.key));
      if ((await this.store.keys()).some(
        (k) => k.startsWith(base + ":chunk:") && !known.has(k)
      ))
        notes.push("orphan_chunk");
      const safe = safeSnapshot({ ...m.snapshot, events });
      if (safe.events.length !== events.length) notes.push("redaction_drop");
      const partial = notes.length > 0 || m.status !== "Saved";
      const corruption = notes.some((n) => n !== "storage_redaction_drop") || m.status === "Failed" || m.status === "Partial" && !notes.includes("storage_redaction_drop");
      for (const control of safe.controls)
        if (control.code === "storage_redaction_drop" && !m.snapshot.controls.some((c) => c.code === "storage_redaction_drop"))
          control.timestamp = new Date(m.updated_at).toISOString();
      if (corruption)
        safe.controls.push({
          kind: "health",
          code: "storage_recovery_gap",
          health: "Partial",
          timestamp: new Date(m.updated_at).toISOString(),
          monotonic_ms: safe.start.started_at
        });
      return {
        manifest: m,
        snapshot: safe,
        notes: [...new Set(notes)],
        completeness: partial ? "Partial" : projectState(safe).completeness,
        read_only
      };
    }
    async clearCurrent(id2) {
      await this.drain();
      const key = this.owned.get(id2) ?? this.key(id2) + ":manifest";
      this.failed.add(id2);
      if (key) await this.removeCapture(key);
    }
    async removeCapture(key) {
      for (const id2 of this.persistedRevisions.keys())
        if (this.key(id2) + ":manifest" === key)
          this.persistedRevisions.delete(id2);
      const base = key.slice(0, -":manifest".length);
      for (const k of await this.store.keys())
        if (k === key || k.startsWith(base + ":chunk:"))
          await this.store.delete(k);
    }
    async clearHistory() {
      await this.drain();
      for (const r of await this.list())
        if (projectState(r.snapshot).lifecycle === "Closed") {
          const key = r.manifest.chunks[0]?.key.replace(/:chunk:\d+$/, ":manifest") ?? this.prefix() + encodeURIComponent(r.manifest.writer_id) + ":" + encodeURIComponent(r.manifest.capture_id) + ":manifest";
          await this.removeCapture(key);
        }
      await this.deletionNote("clear_history");
    }
    async clearExperiment(uuid2) {
      if (!/^[a-f0-9-]{36}$/i.test(uuid2)) throw Error("invalid_experiment_uuid");
      for (const key of await this.store.keys())
        if (key.startsWith(`blackbox:experiment:${uuid2}:`))
          await this.store.delete(key);
      await this.deletionNote("clear_experiment");
    }
    async deletionNote(scope) {
      await this.store.set(`${ROOT}management:${crypto.randomUUID()}`, {
        schema_version: HISTORY_SCHEMA,
        scope,
        at: this.now(),
        clear_epoch: this.epoch
      });
    }
    async clearAll() {
      const next = crypto.randomUUID();
      await this.store.set(EPOCH, next);
      await this.syncEpoch();
      await this.drain();
      for (const k of await this.store.keys())
        if (k.startsWith(ROOT) && k !== EPOCH || k.startsWith("blackbox:experiment:"))
          await this.store.delete(k);
      await this.deletionNote("clear_all");
    }
    // Retention discovery needs committed metadata, not occurrence bodies. UI,
    // export and eviction certificates continue to use full list/recover validation.
    async retentionMetadata() {
      const epoch = await this.syncEpoch();
      const schemas = [HISTORY_SCHEMA, "history-0", "history-1"];
      const keys2 = (await this.store.keys()).filter(
        (k) => schemas.some((schema) => k.startsWith(this.prefix(epoch, schema))) && k.endsWith(":manifest")
      );
      const active = await this.store.get(ROOT + "active_schema");
      if (active && typeof active.manifest_key === "string" && active.manifest_key.startsWith(ROOT)) {
        const selected = await this.store.get(active.manifest_key);
        if (selected?.clear_epoch === epoch) {
          const i = keys2.indexOf(active.previous_key ?? "");
          if (i >= 0) keys2.splice(i, 1);
          keys2.push(active.manifest_key);
        }
      }
      const records = [];
      for (const key of keys2) {
        const m = await this.store.get(key);
        const start = m?.snapshot?.start, controls = m?.snapshot?.controls;
        if (!m || !schemas.includes(m.schema_version) || m.clear_epoch !== epoch || typeof m.capture_id !== "string" || typeof m.writer_id !== "string" || !Number.isFinite(m.created_at) || !Number.isFinite(m.updated_at) || !Number.isSafeInteger(m.bytes) || m.bytes < 0 || !Number.isSafeInteger(m.count) || m.count < 0 || !Array.isArray(m.chunks) || m.committed_sequence !== m.chunks.length || !m.chunks.every(
          (c, i) => c && c.sequence === i + 1 && typeof c.key === "string" && c.key.startsWith(ROOT) && Number.isSafeInteger(c.bytes) && c.bytes >= 0 && Number.isSafeInteger(c.first) && c.first >= 1 && Number.isSafeInteger(c.last) && c.last >= c.first && typeof c.sha256 === "string" && /^[a-f0-9]{64}$/.test(c.sha256)
        ) || !["Saved", "Partial", "Failed"].includes(m.status) || !Array.isArray(m.notes) || !m.notes.every((n) => typeof n === "string") || !start || start.capture_id !== m.capture_id || !Number.isFinite(start.started_at) || !["live", "reload", "environment", "requirements", "network"].includes(
          start.mode
        ) || !start.context || typeof start.context.document_id !== "string" || typeof start.context.visit_id !== "string" || !Number.isSafeInteger(start.context.epoch) || !Array.isArray(controls) || !controls.every(
          (c) => c && [
            "started",
            "complete",
            "health",
            "closed",
            "invalidated",
            "segment_eof"
          ].includes(c.kind) && Number.isFinite(c.monotonic_ms) && typeof c.timestamp === "string" && typeof c.code === "string" && ["Complete", "Partial", "Failed", "Unknown"].includes(c.health)
        ) || !Number.isSafeInteger(m.snapshot.control_dropped) || m.snapshot.control_dropped < 0) {
          this.health.status = "Partial";
          continue;
        }
        records.push({ manifest: m, snapshot: { ...m.snapshot, events: [] } });
      }
      if (await this.syncEpoch() !== epoch) return [];
      return records.sort(
        (a, b) => b.manifest.created_at - a.manifest.created_at
      );
    }
    async cleanup() {
      const records = await this.retentionMetadata();
      const remaining = new Set(records), oldest = [...records].sort(
        (a, b) => a.manifest.created_at - b.manifest.created_at
      ), closed = (r) => projectState(r.snapshot).lifecycle === "Closed", live = (r) => r.snapshot.start.mode === "live", removed = {
        age: 0,
        conversation_limit: 0,
        byte_budget: 0,
        auxiliary: 0,
        live: 0
      };
      let total = records.reduce(
        (n, r) => n + r.manifest.bytes + encode(r.manifest).length,
        0
      ), closedRounds = records.filter((r) => closed(r) && live(r)).length;
      const remove = async (r, reason) => {
        const key = this.prefix() + encodeURIComponent(r.manifest.writer_id) + ":" + encodeURIComponent(r.manifest.capture_id) + ":manifest";
        await this.removeCapture(key);
        total -= r.manifest.bytes + encode(r.manifest).length;
        remaining.delete(r);
        if (live(r)) closedRounds--;
        removed[reason]++;
        removed[live(r) ? "live" : "auxiliary"]++;
      };
      for (const r of oldest)
        if (closed(r) && this.now() - r.manifest.created_at > this.limits.age_ms)
          await remove(r, "age");
      for (const r of oldest)
        if (closedRounds > this.limits.history && remaining.has(r) && closed(r) && live(r))
          await remove(r, "conversation_limit");
      for (const isLive of [false, true])
        for (const r of oldest)
          if (total > this.limits.total && remaining.has(r) && closed(r) && live(r) === isLive)
            await remove(r, "byte_budget");
      if (closedRounds > this.limits.history || total > this.limits.total)
        this.health.status = "Partial";
      const conversationRounds = [...remaining].filter(live).length;
      return {
        count: remaining.size,
        total_records: remaining.size,
        conversation_rounds: conversationRounds,
        closed_conversation_rounds: closedRounds,
        auxiliary_records: remaining.size - conversationRounds,
        bytes: total,
        active_retained: records.filter(
          (r) => projectState(r.snapshot).lifecycle !== "Closed"
        ).length,
        removed
      };
    }
    async migrate(key, target = HISTORY_SCHEMA) {
      const old = await this.store.get(key);
      const next = migrateManifest(old, target);
      const newBase = `${ROOT}${target}:migration-${crypto.randomUUID()}`;
      for (const ref of next.chunks) {
        const c = await this.store.get(ref.key);
        if (!c || await digest(encode(c)) !== ref.sha256)
          throw Error("migration_source_corrupt");
        const migrated = {
          ...structuredClone(c),
          schema_version: target,
          redaction_gaps: old.schema_version === HISTORY_SCHEMA ? c.redaction_gaps : []
        };
        ref.key = newBase + `:chunk:${ref.sequence}`;
        ref.sha256 = await digest(encode(migrated));
        ref.bytes = encode(migrated).length;
        await this.store.set(ref.key, migrated);
      }
      next.bytes = next.chunks.reduce((n, c) => n + c.bytes, 0);
      await this.store.set(newBase + ":manifest", next);
      const recovered = await this.recover(newBase + ":manifest");
      if (recovered.notes.length) throw Error("migration_validation_failed");
      await this.store.set(ROOT + "active_schema", {
        schema_version: target,
        manifest_key: newBase + ":manifest",
        previous_key: key
      });
      return recovered;
    }
    dispose() {
      this.removeListener?.();
    }
  };

  // src/compare/experiment.ts
  var EXPERIMENT_SCHEMA = "experiment-1";
  var PROMPT_RULE = "exact-ordered-parts-json-1";
  var CONDITION_KEYS = [
    "account",
    "attachments",
    "history",
    "memory",
    "tools",
    "mode",
    "browser_profile",
    "order"
  ];
  var uuid = (v) => typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
  var word = (v) => typeof v === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(v);
  var exactKeys = (o, keys2) => Object.keys(o).length === keys2.length && Object.keys(o).every((k) => keys2.includes(k));
  function validateDescriptor(input) {
    const d = record(input);
    if (!d || !exactKeys(d, [
      "schema_version",
      "experiment_uuid",
      "display_id",
      "task_id",
      "replicate",
      "browser_label",
      "conditions"
    ]) || d.schema_version !== EXPERIMENT_SCHEMA || !uuid(d.experiment_uuid) || !word(d.display_id) || !word(d.task_id) || !word(d.browser_label) || !Number.isSafeInteger(d.replicate) || Number(d.replicate) < 1 || Number(d.replicate) > 1e4)
      throw Error("invalid_experiment_descriptor");
    const conditions = record(d.conditions);
    if (!conditions || !exactKeys(conditions, [...CONDITION_KEYS]))
      throw Error("invalid_conditions");
    for (const [k, input2] of Object.entries(conditions)) {
      const c = record(input2);
      if (!c || !exactKeys(c, ["value", "availability"]) || !["observed", "declared", "unknown"].includes(String(c.availability)) || !(c.value === null || typeof c.value === "boolean" || typeof c.value === "number" && Number.isFinite(c.value) && Math.abs(c.value) <= 1e4 || word(c.value)) || c.availability === "unknown" && c.value !== null || k === "account" && (c.availability === "observed" || ![null, "same", "different", "unknown"].includes(
        c.value
      )))
        throw Error("invalid_condition");
    }
    return structuredClone(d);
  }
  function createDescriptor(task_id, browser_label, conditions = {}) {
    return validateDescriptor({
      schema_version: EXPERIMENT_SCHEMA,
      experiment_uuid: crypto.randomUUID(),
      display_id: `AB-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replaceAll("-", "")}-001`,
      task_id,
      replicate: 1,
      browser_label,
      conditions: Object.fromEntries(
        CONDITION_KEYS.map((k) => [
          k,
          conditions[k] ?? { value: null, availability: "unknown" }
        ])
      )
    });
  }
  function validateRun(input) {
    const r = record(input);
    if (!r || !exactKeys(r, ["descriptor", "run_id", "prompt"]) || !uuid(r.run_id))
      throw Error("invalid_experiment_run");
    const descriptor = validateDescriptor(r.descriptor);
    const p = record(r.prompt);
    if (r.prompt !== null && (!p || !exactKeys(p, ["rule", "key_id", "hmac"]) || p.rule !== PROMPT_RULE || ![p.key_id, p.hmac].every(
      (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v)
    )))
      throw Error("invalid_prompt_association");
    return { descriptor, run_id: r.run_id, prompt: r.prompt };
  }
  async function associatePrompt(key, parts) {
    if (!/^[a-f0-9]{64}$/.test(key) || parts.length > 128 || parts.some((p) => typeof p !== "string") || parts.reduce((n, p) => n + p.length, 0) > 1048576)
      throw Error("invalid_transient_prompt_association");
    const bytes = Uint8Array.from(key.match(/../g), (h) => parseInt(h, 16));
    const imported = await crypto.subtle.importKey(
      "raw",
      bytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      imported,
      encode({ rule: PROMPT_RULE, parts })
    );
    return {
      rule: PROMPT_RULE,
      key_id: await digest(bytes),
      hmac: [...new Uint8Array(signature)].map((n) => n.toString(16).padStart(2, "0")).join("")
    };
  }
  var Experiments = class {
    constructor(store) {
      this.store = store;
    }
    store;
    runs = /* @__PURE__ */ new Map();
    async save(descriptor, key) {
      const d = validateDescriptor(descriptor);
      if (key !== void 0 && !/^[a-f0-9]{64}$/.test(key))
        throw Error("invalid_experiment_key");
      await this.store.set(
        `blackbox:experiment:${d.experiment_uuid}:descriptor`,
        d
      );
      if (key)
        await this.store.set(`blackbox:experiment:${d.experiment_uuid}:key`, {
          schema_version: EXPERIMENT_SCHEMA,
          key
        });
      return d;
    }
    async bind(capture_id, descriptor, parts) {
      const d = validateDescriptor(descriptor);
      const local = record(
        await this.store.get(`blackbox:experiment:${d.experiment_uuid}:key`)
      );
      const run = {
        descriptor: d,
        run_id: crypto.randomUUID(),
        prompt: parts && typeof local?.key === "string" ? await associatePrompt(local.key, parts) : null
      };
      this.runs.set(capture_id, run);
      await this.store.set(
        `blackbox:experiment:${d.experiment_uuid}:run:${run.run_id}`,
        { schema_version: EXPERIMENT_SCHEMA, capture_id, run }
      );
      return structuredClone(run);
    }
    get(capture_id) {
      const r = this.runs.get(capture_id);
      return r ? structuredClone(r) : null;
    }
  };

  // src/compare/compare.ts
  function compareValue(left, right, compatible = true) {
    const missing = (v) => v === null || v === void 0 || Array.isArray(v) && (v.length === 0 || v.some(missing)) || typeof v === "object" && v !== null && "value" in v && missing(v.value);
    return {
      status: !compatible ? "Not comparable" : missing(left) || missing(right) ? "Unknown" : JSON.stringify(left) === JSON.stringify(right) ? "Equal" : "Different",
      left: left ?? null,
      right: right ?? null,
      reason: !compatible ? "incompatible_semantics" : missing(left) || missing(right) ? "not_observed" : "observed_values"
    };
  }
  function bundleRun(bundle) {
    const c = bundle.comparison;
    return c?.run ? validateRun(c.run) : null;
  }
  function compareBundles(left, right, threshold = { ratio: 10, absolute_ms: 1e4 }) {
    const a = bundleRun(left), b = bundleRun(right);
    const paired = !!a && !!b && a.descriptor.experiment_uuid === b.descriptor.experiment_uuid && a.descriptor.task_id === b.descriptor.task_id && a.descriptor.replicate === b.descriptor.replicate && a.run_id !== b.run_id;
    const compatible = paired && !left.read_only && !right.read_only && left.manifest.schema_version === right.manifest.schema_version && JSON.stringify([...left.manifest.adapter_versions].sort()) === JSON.stringify([...right.manifest.adapter_versions].sort()) && JSON.stringify([...left.manifest.rule_versions].sort()) === JSON.stringify([...right.manifest.rule_versions].sort()) && left.manifest.redaction_version === right.manifest.redaction_version;
    const fields = {};
    const add = (name, l, r, can = compatible) => {
      fields[name] = compareValue(l, r, can);
    };
    const events = (x) => [
      ...x.snapshot.events,
      ...x.related.flatMap((r) => r.events)
    ];
    const chain = (x, ns, f) => events(x).filter((e) => e.field_namespace === ns && e.field === f).map((e) => ({
      value: e.value,
      level: e.level,
      scope: e.task_scope,
      source: e.source_path,
      availability: e.availability ?? e.value_state
    }));
    const last = (x, ns, f) => events(x).filter((e) => e.field_namespace === ns && e.field === f).at(-1)?.value ?? null;
    for (const [name, ns, f] of [
      ["request.model", "request", "model"],
      ["thinking_effort", "request", "thinking_effort"],
      ["request.reasoning_effort", "request", "reasoning_effort"],
      ["requested_experience", "request", "requested_model_experience"],
      ["server_STE_chain", "server_ste_metadata", "model_slug"],
      ["resolved_route_chain", "resolved", "resolved_model_slug"],
      ["response_effort", "response", "thinking_effort"],
      ["fast_convo", "response", "fast_convo"],
      ["PoW.difficulty", "pow", "raw_hex"],
      ["PoW.decimal", "pow", "decimal"],
      ["PoW.validity", "pow", "validity"],
      ["PoW.association", "pow.association", "association_status"],
      ["IP.source", "environment.fields", "client_ip"],
      ["frontend.build", "frontend.markers", "build_id"],
      ["frontend.marker", "frontend.markers", "deployment_marker"],
      ["frontend.asset_set", "frontend.assets", "asset_set_hash"],
      ["HTTP.status", "network.http", "http_status"],
      ["HTTP.headers_availability", "network.headers", "content-type"],
      ["Cloudflare", "network.headers", "cf-mitigated"],
      ["Cloudflare.ray", "network.headers", "cf-ray"]
    ])
      add(name, chain(left, ns, f), chain(right, ns, f));
    for (const level of ["A", "B", "C", "D", "N", "E"])
      add(
        `complete_${level}_chain`,
        events(left).filter((e) => e.level === level).map((e) => ({
          namespace: e.field_namespace,
          field: e.field,
          value: e.value,
          scope: e.task_scope,
          source: e.source_path,
          association: e.association
        })),
        events(right).filter((e) => e.level === level).map((e) => ({
          namespace: e.field_namespace,
          field: e.field,
          value: e.value,
          scope: e.task_scope,
          source: e.source_path,
          association: e.association
        }))
      );
    add(
      "actual_route",
      left.summary.route_verdict.coverage === "no-A" ? null : left.summary.route_verdict.actual_route,
      right.summary.route_verdict.coverage === "no-A" ? null : right.summary.route_verdict.actual_route
    );
    add(
      "transport",
      left.snapshot.start.transport,
      right.snapshot.start.transport
    );
    for (const term of ["handoff", "reconnect", "reload"])
      add(
        term,
        events(left).filter(
          (e) => e.field_namespace.startsWith("transport") && JSON.stringify([e.field, e.value]).includes(term)
        ).map((e) => ({ field: e.field, value: e.value })),
        events(right).filter(
          (e) => e.field_namespace.startsWith("transport") && JSON.stringify([e.field, e.value]).includes(term)
        ).map((e) => ({ field: e.field, value: e.value }))
      );
    for (const f of [
      "browser",
      "browser_major",
      "os",
      "language",
      "timezone",
      "online",
      "user_agent"
    ])
      add(
        `environment.${f}`,
        last(left, "environment.fields", f),
        last(right, "environment.fields", f)
      );
    const finalized = (x) => x.summary.capture_health.lifecycle === "Closed" && x.snapshot.start.mode !== "reload";
    const timingComparable = compatible && finalized(left) && finalized(right) && left.summary.timing.definition === right.summary.timing.definition;
    for (const f of [
      "first_content_ms",
      "first_visible_output_ms",
      "total_ms"
    ])
      add(
        `timing.${f}`,
        left.summary.timing[f],
        right.summary.timing[f],
        timingComparable
      );
    add(
      "confirmation",
      left.summary.timing.confirmation,
      right.summary.timing.confirmation
    );
    add(
      "capture_health",
      left.summary.capture_health.completeness,
      right.summary.capture_health.completeness
    );
    add(
      "adapter_versions",
      left.manifest.adapter_versions,
      right.manifest.adapter_versions,
      paired
    );
    add(
      "rule_versions",
      left.manifest.rule_versions,
      right.manifest.rule_versions,
      paired
    );
    add(
      "schema_version",
      left.manifest.schema_version,
      right.manifest.schema_version,
      paired
    );
    add(
      "conditions",
      a?.descriptor.conditions ?? null,
      b?.descriptor.conditions ?? null,
      paired
    );
    add(
      "prompt_association",
      a?.prompt?.hmac ?? null,
      b?.prompt?.hmac ?? null,
      paired && !!a?.prompt && !!b?.prompt && a.prompt.key_id === b.prompt.key_id && a.prompt.rule === b.prompt.rule
    );
    const durations = [
      left.summary.timing.total_ms,
      right.summary.timing.total_ms
    ];
    const delta = durations.every((v) => typeof v === "number") ? Math.abs(durations[0] - durations[1]) : null;
    const ratio = durations.every((v) => typeof v === "number" && v > 0) ? Math.max(...durations) / Math.min(...durations) : null;
    const complete = left.summary.capture_health.completeness === "Complete" && right.summary.capture_health.completeness === "Complete";
    const material = timingComparable && delta !== null && ratio !== null && Number.isFinite(threshold.ratio) && threshold.ratio >= 1 && Number.isFinite(threshold.absolute_ms) && threshold.absolute_ms >= 0 && delta >= threshold.absolute_ms && ratio >= threshold.ratio;
    const routeSame = fields.actual_route.status === "Equal" && fields.complete_A_chain.status === "Equal";
    const conditionsSame = fields.conditions.status === "Equal";
    return {
      schema_version: "comparison-1",
      state: paired ? "compared" : "not_comparable",
      experiment_uuid: a?.descriptor.experiment_uuid ?? null,
      task_id: a?.descriptor.task_id ?? null,
      replicate: a?.descriptor.replicate ?? null,
      run_ids: [a?.run_id ?? null, b?.run_id ?? null],
      fields,
      timing: { delta_ms: delta, ratio, flag: material },
      conclusion: !compatible ? "Not comparable" : !complete ? "Evidence insufficient: capture Partial/Unknown/Failed" : fields.actual_route.status === "Unknown" ? "Actual route Unknown; client timing remains descriptive" : material && routeSame && conditionsSame && left.summary.route_verdict.coverage === "dual-A" && right.summary.route_verdict.coverage === "dual-A" ? "Observed client timing differs materially in this paired sample." : "Descriptive paired observations only.",
      limits: [
        "No inference about reasoning budget or server computation.",
        "Prompt association does not establish equal context, memory, tools or service randomness."
      ],
      baseline_partition: JSON.stringify([
        a?.descriptor.experiment_uuid,
        a?.descriptor.task_id,
        a?.descriptor.conditions,
        b?.descriptor.conditions
      ]),
      order: [a?.descriptor.conditions.order, b?.descriptor.conditions.order]
    };
  }
  function baseline(pairs) {
    const groups = /* @__PURE__ */ new Map();
    for (const p of pairs) {
      const key = p.baseline_partition;
      groups.set(key, [...groups.get(key) ?? [], p]);
    }
    const summary = (v) => {
      const s = [...v].sort((a, b) => a - b);
      return {
        median: s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2 : null,
        range: s.length ? [s[0], s.at(-1)] : null
      };
    };
    return [...groups.entries()].map(([partition, rows]) => {
      const eligible = rows.filter(
        (r) => r.state === "compared" && r.fields.conditions.status === "Equal" && ["Equal", "Different"].includes(r.fields["timing.total_ms"].status)
      );
      return {
        partition,
        pairs: rows.length,
        eligible_pairs: eligible.length,
        each_pair: rows.map((r) => ({
          runs: r.run_ids,
          duration: r.fields["timing.total_ms"],
          order: r.order
        })),
        left: summary(
          eligible.map((r) => r.fields["timing.total_ms"].left)
        ),
        right: summary(
          eligible.map((r) => r.fields["timing.total_ms"].right)
        ),
        interpretation: "Descriptive only; no statistical significance or causal claim.",
        recommendation: eligible.length < 3 ? "Collect 3-5 or more paired runs and alternate order." : "Report confounders and order; sample size is not an accuracy guarantee."
      };
    });
  }
  function safeAssociation(input) {
    if (input === null || typeof input !== "object" || Array.isArray(input))
      throw Error("invalid_comparison");
    const c = input;
    if (c.state !== "not_compared" || Object.keys(c).some((k) => !["state", "run"].includes(k)))
      throw Error("invalid_comparison");
    return c.run ? { state: "not_compared", run: validateRun(c.run) } : { state: "not_compared" };
  }

  // src/history/zip.ts
  var MAX_COMPRESSED = 20 * 1048576;
  var MAX_EXPANDED = 50 * 1048576;
  function crc32(bytes) {
    let c = 4294967295;
    for (const b of bytes) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c >>> 1 ^ (c & 1 ? 3988292384 : 0);
    }
    return (c ^ 4294967295) >>> 0;
  }
  function u16(b, o, n) {
    new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true);
  }
  function u32(b, o, n) {
    new DataView(b.buffer, b.byteOffset, b.byteLength).setUint32(o, n, true);
  }
  function concat(parts) {
    const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
    let i = 0;
    for (const b of parts) {
      out.set(b, i);
      i += b.length;
    }
    return out;
  }
  function zipFiles(files) {
    const local = [], central = [];
    let offset = 0;
    for (const [path, data] of files) {
      const name = new TextEncoder().encode(path), l = new Uint8Array(30 + name.length), c = new Uint8Array(46 + name.length), crc = crc32(data);
      u32(l, 0, 67324752);
      u16(l, 4, 20);
      u16(l, 6, 2048);
      u32(l, 14, crc);
      u32(l, 18, data.length);
      u32(l, 22, data.length);
      u16(l, 26, name.length);
      l.set(name, 30);
      u32(c, 0, 33639248);
      u16(c, 4, 20);
      u16(c, 6, 20);
      u16(c, 8, 2048);
      u32(c, 16, crc);
      u32(c, 20, data.length);
      u32(c, 24, data.length);
      u16(c, 28, name.length);
      u32(c, 42, offset);
      c.set(name, 46);
      local.push(l, data);
      central.push(c);
      offset += l.length + data.length;
    }
    const directory = concat(central), end = new Uint8Array(22);
    u32(end, 0, 101010256);
    u16(end, 8, files.size);
    u16(end, 10, files.size);
    u32(end, 12, directory.length);
    u32(end, 16, offset);
    const out = concat([...local, directory, end]);
    if (out.length > MAX_COMPRESSED) throw Error("export_zip_size_limit");
    return out;
  }
  async function unzipFiles(bytes, allowlist) {
    if (bytes.length > MAX_COMPRESSED || bytes.length < 22)
      throw Error("zip_size_limit");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), r16 = (o) => view.getUint16(o, true), r32 = (o) => view.getUint32(o, true);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
      if (r32(i) === 101010256 && i + 22 + r16(i + 20) === bytes.length) {
        end = i;
        break;
      }
    if (end < 0 || r16(end + 4) !== 0 || r16(end + 6) !== 0 || r16(end + 8) !== r16(end + 10))
      throw Error("invalid_zip_directory");
    const count = r16(end + 10), size = r32(end + 12), start = r32(end + 16);
    if (count !== allowlist.length || start + size !== end)
      throw Error("zip_file_count_or_directory");
    const output = /* @__PURE__ */ new Map(), decoder = new TextDecoder("utf-8", { fatal: true });
    let offset = start, total = 0;
    const ranges = [];
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || r32(offset) !== 33639248)
        throw Error("invalid_zip_entry");
      const flags = r16(offset + 8), method = r16(offset + 10), compressed = r32(offset + 20), expanded = r32(offset + 24), n = r16(offset + 28), extra = r16(offset + 30), comment = r16(offset + 32), local = r32(offset + 42), attrs = r32(offset + 38);
      if (offset + 46 + n + extra + comment > end || ![0, 2048].includes(flags) || ![0, 8].includes(method) || (attrs >>> 16 & 61440) === 40960 || r16(offset + 34) !== 0)
        throw Error("unsupported_zip_entry");
      const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + n));
      if (!allowlist.includes(path) || output.has(path) || path.includes("..") || path.includes("\\") || path.startsWith("/"))
        throw Error("zip_path_or_duplicate");
      total += expanded;
      if (total > MAX_EXPANDED || expanded > MAX_EXPANDED || expanded > Math.max(1, compressed) * 100)
        throw Error("zip_bomb_limit");
      if (local + 30 > start || r32(local) !== 67324752 || r16(local + 6) !== flags || r16(local + 8) !== method || r32(local + 14) !== r32(offset + 16) || r32(local + 18) !== compressed || r32(local + 22) !== expanded || r16(local + 26) !== n)
        throw Error("zip_local_mismatch");
      const from = local + 30 + n + r16(local + 28), to = from + compressed;
      if (to > start || decoder.decode(bytes.subarray(local + 30, local + 30 + n)) !== path || ranges.some((r) => local < r.end && to > r.start))
        throw Error("zip_overlap_or_name");
      ranges.push({ start: local, end: to });
      let data = bytes.slice(from, to);
      if (method === 8) {
        const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        const reader = stream.getReader();
        const parts = [];
        let used = 0;
        try {
          for (; ; ) {
            const next = await reader.read();
            if (next.done) break;
            used += next.value.length;
            if (used > expanded || used > MAX_EXPANDED) {
              await reader.cancel();
              throw Error("zip_inflation_limit");
            }
            parts.push(next.value);
          }
          data = concat(parts);
        } finally {
          reader.releaseLock();
        }
      }
      if (data.length !== expanded || crc32(data) !== r32(offset + 16))
        throw Error("zip_crc_or_size");
      output.set(path, data);
      offset += 46 + n + extra + comment;
    }
    if (offset !== end || output.size !== allowlist.length)
      throw Error("zip_directory_end");
    return output;
  }

  // src/history/bundle.ts
  var BUNDLE_SCHEMA = "bundle-1";
  var BUNDLE_FILES = [
    "manifest.json",
    "summary.json",
    "timeline.jsonl",
    "network_metadata.json",
    "environment.json",
    "comparison.json",
    "report.md"
  ].map((n) => "evidence/" + n);
  function summarize(s, related = []) {
    const health = projectState(s), route = verdict(
      s.events,
      s.start.capture_id,
      "answer",
      health.completeness
    );
    const final = s.controls.find((c) => c.kind === "complete");
    const content = s.events.find(
      (e) => e.field_namespace === "timing" && e.field === "first_content"
    );
    const network = s.events.filter(
      (e) => e.level === "N" && e.field_namespace === "network.verdict" && e.field === "status"
    ).at(-1)?.value ?? "Unknown";
    return {
      schema_version: BUNDLE_SCHEMA,
      start: s.start,
      controls: s.controls,
      control_dropped: s.control_dropped,
      related_contexts: related.map(
        ({ events: _events, ...metadata }) => metadata
      ),
      A: s.events.filter((e) => e.level === "A"),
      B: s.events.filter((e) => e.level === "B"),
      C: s.events.filter((e) => e.level === "C"),
      D: s.events.filter((e) => e.level === "D"),
      availability: {
        A: route.coverage === "no-A" ? "unknown" : "observed",
        N: network === "Unknown" ? "unknown" : "observed"
      },
      route_verdict: route,
      network_verdict: network,
      display_mismatch: route.label_mismatch,
      timing: {
        definition: "client_request_start_to_protocol_done",
        total_ms: s.start.mode === "reload" || !final ? null : Math.max(0, final.monotonic_ms - s.start.started_at),
        elapsed_ms: null,
        first_content_ms: content ? content.monotonic_ms - s.start.started_at : null,
        first_visible_output_ms: null,
        confirmation: health.lifecycle
      },
      capture_health: health,
      supporting_event_ids: s.events.filter((e) => ["A", "B", "N"].includes(e.level)).map((e) => e.event_id)
    };
  }
  function escapeMarkdown(v) {
    return String(v).replace(/[&<>`[\]()|\\*_#!]/g, (c) => `&#${c.charCodeAt(0)};`).replace(/[\r\n]/g, " ").slice(0, 1024);
  }
  function report(summary) {
    return `# Local Evidence Report

Digest verifies package integrity, not a server signature.

Route: ${escapeMarkdown(summary.route_verdict.verdict)}
Server-reported route: ${escapeMarkdown(summary.route_verdict.actual_route)}
Network: ${escapeMarkdown(summary.network_verdict)}
Capture: ${escapeMarkdown(summary.capture_health.completeness)}
Client total ms: ${escapeMarkdown(summary.timing.total_ms ?? "Unknown")}

No client timing inference about reasoning budget.
`;
  }
  async function exportBundle(snapshot, toolVersion, association = {}, comparison = { state: "not_compared" }, related = []) {
    const redactor = new ExportRedactor();
    const s = redactor.snapshot(snapshot), contexts = related.slice(0, 32).map((x) => redactor.snapshot(x)), all = [...s.events, ...contexts.flatMap((x) => x.events)], summary = summarize(s, contexts), files = /* @__PURE__ */ new Map();
    const timeline = new TextEncoder().encode(
      all.map((e) => JSON.stringify(e)).join("\n") + (all.length ? "\n" : "")
    );
    files.set("evidence/summary.json", encode(summary));
    files.set("evidence/timeline.jsonl", timeline);
    files.set(
      "evidence/network_metadata.json",
      encode(
        all.filter((e) => e.level === "N" || e.field_namespace.startsWith("pow"))
      )
    );
    files.set(
      "evidence/environment.json",
      encode(
        all.filter(
          (e) => e.level === "E" && !e.field_namespace.startsWith("pow")
        )
      )
    );
    const runAssociation = safeAssociation(comparison);
    files.set("evidence/comparison.json", encode(runAssociation));
    files.set("evidence/report.md", new TextEncoder().encode(report(summary)));
    const manifest = {
      schema_version: BUNDLE_SCHEMA,
      tool_version: toolVersion,
      adapter_versions: [...new Set(all.map((e) => e.adapter_version))],
      rule_versions: [...new Set(all.map((e) => e.rule_version))],
      redaction_version: REDACTION_VERSION,
      export_id: crypto.randomUUID(),
      experiment_id: association.experiment_id && /^[a-f0-9-]{36}$/i.test(association.experiment_id) ? association.experiment_id : null,
      run_id: association.run_id && /^[a-f0-9-]{36}$/i.test(association.run_id) ? association.run_id : null,
      revision: summary.capture_health.revision,
      export_time: (/* @__PURE__ */ new Date()).toISOString(),
      as_of: s.events.at(-1)?.timestamp ?? s.controls.at(-1)?.timestamp ?? (/* @__PURE__ */ new Date()).toISOString(),
      scope: [...new Set(all.map((e) => e.task_scope))],
      files: [],
      source_completeness: summary.capture_health.completeness,
      notes: [
        ...new Set(
          s.controls.filter((c) => c.kind === "health").map((c) => c.code)
        ),
        ...s.control_dropped ? ["control_drop"] : []
      ]
    };
    for (const [path, data] of files)
      manifest.files.push({
        path,
        sha256: await digest(data),
        bytes: data.length,
        records: path.endsWith("timeline.jsonl") ? all.length : path.endsWith("network_metadata.json") ? all.filter(
          (e) => e.level === "N" || e.field_namespace.startsWith("pow")
        ).length : path.endsWith("environment.json") ? all.filter(
          (e) => e.level === "E" && !e.field_namespace.startsWith("pow")
        ).length : 1
      });
    files.set("evidence/manifest.json", encode(manifest));
    return {
      bytes: zipFiles(files),
      manifest,
      summary,
      preview: {
        source_events: snapshot.events.length + related.reduce((n, r) => n + r.events.length, 0),
        export_events: all.length,
        id_mapping: "bundle-local",
        removed: ["full UA", "origin", "client IP", "authentication", "content"],
        coarsened: ["screen/viewport", "hardware"],
        as_of: manifest.as_of,
        revision: manifest.revision
      }
    };
  }
  function parse(data) {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(data),
      (key, value2) => {
        if (["__proto__", "prototype", "constructor"].includes(key))
          throw Error("unsafe_json_key");
        return value2;
      }
    );
  }
  function same(a, b) {
    const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v !== null && typeof v === "object" ? Object.fromEntries(
      Object.entries(v).filter(([, value2]) => value2 !== void 0).sort(([a2], [b2]) => a2.localeCompare(b2)).map(([key, value2]) => [key, canonical(value2)])
    ) : v;
    return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  }
  async function importBundle(bytes) {
    const files = await unzipFiles(bytes, BUNDLE_FILES), m = parse(files.get("evidence/manifest.json"));
    if (m.schema_version !== BUNDLE_SCHEMA || m.redaction_version !== REDACTION_VERSION)
      throw Error("unsupported_bundle_schema");
    const uuid2 = (v) => typeof v === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
    const allowed = [
      "schema_version",
      "tool_version",
      "adapter_versions",
      "rule_versions",
      "redaction_version",
      "export_id",
      "experiment_id",
      "run_id",
      "revision",
      "export_time",
      "as_of",
      "scope",
      "files",
      "source_completeness",
      "notes"
    ];
    if (Object.keys(m).some((k) => !allowed.includes(k)) || !uuid2(m.export_id) || m.experiment_id !== null && !uuid2(m.experiment_id) || m.run_id !== null && !uuid2(m.run_id) || !safeWord(m.tool_version) || ![m.adapter_versions, m.rule_versions, m.notes, m.scope].every(
      (a) => Array.isArray(a) && a.length <= 256 && a.every((x) => safeWord(x) !== null)
    ) || ![m.export_time, m.as_of].every(
      (x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(x)
    ))
      throw Error("invalid_manifest_metadata");
    if (!Array.isArray(m.files) || m.files.length !== 6 || new Set(m.files.map((f) => f.path)).size !== 6)
      throw Error("invalid_file_manifest");
    for (const ref of m.files) {
      const b = files.get(ref.path);
      if (!b || ref.path === "evidence/manifest.json" || ref.bytes !== b.length || ref.sha256 !== await digest(b))
        throw Error("bundle_digest_mismatch");
    }
    const summary = parse(files.get("evidence/summary.json"));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      files.get("evidence/timeline.jsonl")
    );
    const lines = text ? (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n") : [];
    if (lines.length > 64e4) throw Error("timeline_count_limit");
    const events = lines.map((line) => {
      if (new TextEncoder().encode(line).length > 65536)
        throw Error("jsonl_line_limit");
      return parse(new TextEncoder().encode(line));
    });
    if (!summary.start || !Array.isArray(summary.controls) || summary.controls.length > 2050)
      throw Error("invalid_summary");
    const metadata = summary.related_contexts;
    if (!Array.isArray(metadata) || metadata.length > 32)
      throw Error("related_context_limit");
    const captureIDs = [
      summary.start.capture_id,
      ...metadata.map((s) => s.start.capture_id)
    ];
    if (new Set(captureIDs).size !== captureIDs.length)
      throw Error("duplicate_capture_id");
    const previous = /* @__PURE__ */ new Map();
    const ids = /* @__PURE__ */ new Set();
    const declaredRedaction = new Set(
      [{ start: summary.start, controls: summary.controls }, ...metadata].filter(
        (s) => s.controls?.some(
          (c) => c.kind === "health" && c.code === "storage_redaction_drop" && c.health === "Partial" && Number.isFinite(c.monotonic_ms)
        )
      ).map((s) => s.start.capture_id)
    );
    for (const e of events) {
      const before = previous.get(e.capture_id) ?? 0;
      if (!Number.isSafeInteger(e.event_index) || e.event_index <= before || e.event_index !== before + 1 && !declaredRedaction.has(e.capture_id) || ids.has(e.event_id) || !captureIDs.includes(e.capture_id) || !Number.isFinite(e.monotonic_ms) || !["fetch", "xhr", "websocket", "reload", "dom"].includes(e.transport) || !["inbound", "outbound", "local"].includes(e.direction) || !["confirmed", "candidate", "ambiguous", "orphan"].includes(
        e.association
      ) || !["value", "invalid", "removed", "explicit_null"].includes(e.value_state))
        throw Error("invalid_timeline_sequence_or_source");
      previous.set(e.capture_id, e.event_index);
      ids.add(e.event_id);
    }
    const snapshot = {
      start: summary.start,
      events: events.filter((e) => e.capture_id === summary.start.capture_id),
      controls: summary.controls,
      control_dropped: summary.control_dropped
    };
    const related = metadata.map((meta) => ({
      ...meta,
      events: events.filter((e) => e.capture_id === meta.start.capture_id)
    }));
    for (const context of related) {
      if (!same(safeSnapshot(context), context) || !["environment", "network", "requirements"].includes(
        context.start.mode
      ) || context.events.some((e) => !["N", "E"].includes(e.level)))
        throw Error("unsafe_related_context");
    }
    const safe = safeSnapshot(snapshot);
    if (!same(safe, snapshot)) throw Error("unsafe_or_unregistered_projection");
    const recomputed = summarize(safe, related);
    if (!same(summary, recomputed)) throw Error("summary_projection_mismatch");
    if (!same(
      parse(files.get("evidence/network_metadata.json")),
      events.filter(
        (e) => e.level === "N" || e.field_namespace.startsWith("pow")
      )
    ) || !same(
      parse(files.get("evidence/environment.json")),
      events.filter(
        (e) => e.level === "E" && !e.field_namespace.startsWith("pow")
      )
    ))
      throw Error("auxiliary_projection_mismatch");
    for (const ref of m.files) {
      const expected = ref.path.endsWith("timeline.jsonl") ? events.length : ref.path.endsWith("network_metadata.json") ? events.filter(
        (e) => e.level === "N" || e.field_namespace.startsWith("pow")
      ).length : ref.path.endsWith("environment.json") ? events.filter(
        (e) => e.level === "E" && !e.field_namespace.startsWith("pow")
      ).length : 1;
      if (ref.records !== expected) throw Error("record_count_mismatch");
    }
    if (m.revision !== recomputed.capture_health.revision || m.source_completeness !== recomputed.capture_health.completeness || !same(m.adapter_versions, [
      ...new Set(events.map((e) => e.adapter_version))
    ]) || !same(m.rule_versions, [...new Set(events.map((e) => e.rule_version))]))
      throw Error("manifest_projection_mismatch");
    if (new TextDecoder().decode(files.get("evidence/report.md")) !== report(recomputed))
      throw Error("unsafe_report");
    const rawComparison = parse(files.get("evidence/comparison.json"));
    const comparison = safeAssociation(rawComparison);
    if (!same(comparison, rawComparison))
      throw Error("unsupported_comparison_schema");
    if (comparison.run && (comparison.run.descriptor.experiment_uuid !== m.experiment_id || comparison.run.run_id !== m.run_id))
      throw Error("experiment_manifest_mismatch");
    return {
      manifest: m,
      summary: recomputed,
      snapshot: safe,
      related,
      comparison,
      verified: true,
      read_only: events.some(
        (e) => !["metadata-1", "network-1", "environment-1", "build-1"].includes(
          e.adapter_version
        )
      )
    };
  }

  // src/ui/cleanup.ts
  function viewportText(width, height, dpr) {
    if (![width, height].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v > 0
    ))
      return null;
    return `${width} \xD7 ${height}${typeof dpr === "number" && Number.isFinite(dpr) && dpr > 0 ? ` \xB7 DPR ${dpr}` : ""}`;
  }
  function networkDisplay(snapshot) {
    const events = snapshot?.events ?? [];
    const last = (ns, field2) => events.filter((e) => e.field_namespace === ns && e.field === field2).at(-1)?.value;
    const status = last("network.verdict", "status") ?? "Unknown";
    const http = last("network.http", "http_status");
    const cf = last("network.headers", "cf-mitigated");
    const retry = last("network.headers", "retry-after.seconds") ?? last("network.headers", "retry-after.date");
    const sockets = events.filter(
      (e) => e.field_namespace.startsWith("network.websocket.")
    );
    const wsAlerts = sockets.filter(
      (e) => e.field === "reconnect" || e.field === "event" && e.value === "error" || e.field === "wasClean" && e.value === false || e.field === "code" && typeof e.value === "number" && ![1e3, 1001].includes(e.value)
    );
    const failure = last("network.failure", "category");
    const fields = [
      ["Cloudflare", cf],
      ["Retry-After", retry],
      [
        "PoW",
        last("pow.association", "association_status") ?? events.filter(
          (e) => e.field === "association_status" && e.field_namespace.startsWith("pow")
        ).at(-1)?.value
      ],
      ["WebSocket events", sockets.filter((e) => e.field === "event").length],
      [
        "WebSocket diagnostics",
        wsAlerts.length ? wsAlerts.map((e) => `${e.field}: ${e.value} (${e.association})`).join("; ") : null
      ],
      ["Transport failure", failure]
    ];
    return {
      status,
      http,
      fields,
      alerts: fields.filter(
        ([key]) => key === "Cloudflare" && (cf === "challenge" || String(status).startsWith("Challenge")) || key === "Retry-After" && retry !== null && retry !== void 0 || key === "WebSocket diagnostics" && wsAlerts.length > 0 || key === "Transport failure" && failure !== null && failure !== void 0
      )
    };
  }
  function launcherFacts(snapshot) {
    const fields = [
      ["server_ste_metadata", "model_slug"],
      ["resolved", "resolved_model_slug"],
      ["request", "model"]
    ];
    let model = "Unknown", modelSource = "Unknown";
    for (const [namespace, field2] of fields) {
      const value2 = snapshot?.events.filter((e) => e.field_namespace === namespace && e.field === field2).at(-1)?.value;
      if (typeof value2 === "string" && value2 && value2 !== "Unknown") {
        model = value2;
        modelSource = `${namespace}.${field2}`;
        break;
      }
    }
    const network = networkDisplay(snapshot);
    const abnormal = network.status !== "OK" && network.status !== "Unknown";
    return {
      model,
      modelSource,
      abnormal,
      status: abnormal ? network.http ? `HTTP ${network.http}` : String(network.status) : null
    };
  }
  function historyDisplay(snapshot, i18n, today = /* @__PURE__ */ new Date()) {
    const summary = summarize(snapshot);
    const requested = snapshot.events.filter(
      (e) => e.level === "B" && e.field_namespace === "request" && e.field === "model" && e.association === "confirmed"
    ).at(-1)?.value;
    const server = summary.route_verdict.coverage !== "no-A";
    const model = server ? summary.route_verdict.actual_route : requested;
    const effort = snapshot.events.filter(
      (e) => e.level === "B" && e.field_namespace === "request" && e.field === "thinking_effort" && e.association === "confirmed"
    ).at(-1)?.value;
    const timestamps = snapshot.controls.filter((c) => c.kind === "started").map((c) => c.timestamp);
    const wall = [...timestamps, ...snapshot.events.map((e) => e.timestamp)].map((timestamp) => Date.parse(timestamp)).filter(Number.isFinite).sort((a, b) => a - b)[0];
    const date = wall === void 0 ? null : new Date(wall);
    const hhmm = date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "";
    const sameDay = date && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    const time = !date ? i18n.t("Time unknown") : sameDay ? hhmm : `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${hhmm}`;
    return {
      time,
      model: String(model ?? i18n.enum("Unknown")),
      modelSource: i18n.t(server ? "Server Route" : "Requested"),
      verdict: i18n.enum(summary.route_verdict.verdict),
      effort: i18n.enum(effort ?? "Unknown"),
      duration: summary.timing.total_ms === null ? i18n.t("Duration unknown") : i18n.duration(
        `${(summary.timing.total_ms / 1e3).toFixed(1)}s total`
      ),
      id: snapshot.start.capture_id.slice(0, 8)
    };
  }

  // src/ui/layers.ts
  function reconcileChildren(parent, desired) {
    const existing = [...parent.childNodes];
    const key = (node) => node.nodeType === 1 ? node.dataset.eventId ?? null : null;
    const keyed = new Map(existing.filter((n) => key(n)).map((n) => [key(n), n]));
    const retained = /* @__PURE__ */ new Set();
    desired.forEach((candidate, index) => {
      const candidateKey = key(candidate);
      const old = candidateKey ? keyed.get(candidateKey) : existing[index];
      const compatible = old && old.nodeType === candidate.nodeType && old.nodeName === candidate.nodeName && key(old) === candidateKey;
      const live = compatible ? old : candidate;
      if (compatible && live !== candidate) {
        if (live.nodeType === 3) {
          if (live.nodeValue !== candidate.nodeValue)
            live.nodeValue = candidate.nodeValue;
        } else if (live.nodeType === 1) {
          const a = live, b = candidate;
          for (const attr of [...b.attributes]) {
            if (["open", "style"].includes(attr.name) || attr.name === "value" && a.tagName !== "OPTION")
              continue;
            if (a.getAttribute(attr.name) !== attr.value)
              a.setAttribute(attr.name, attr.value);
          }
          reconcileChildren(live, [...candidate.childNodes]);
        }
      }
      retained.add(live);
      if (parent.childNodes[index] !== live)
        parent.insertBefore(live, parent.childNodes[index] ?? null);
    });
    for (const old of existing)
      if (!retained.has(old) && old.parentNode === parent)
        parent.removeChild(old);
  }
  var QUICK_TABS = [
    "Route",
    "Network",
    "Environment",
    "History"
  ];
  function setButtonIcon(doc, button, glyph) {
    button.dataset.icon = glyph;
    const icon = doc.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = glyph;
    button.replaceChildren(icon);
  }
  function installLayers(doc, shell, workbench, selector, controls, settings, i18n, button, advanced, loadHistory, onLayer = () => {
  }) {
    const quick = doc.createElement("section");
    quick.className = "quick";
    quick.id = "blackbox-main";
    quick.setAttribute("role", "dialog");
    quick.setAttribute("aria-modal", "false");
    quick.hidden = true;
    const top = doc.createElement("div");
    top.className = "main-title surface-header";
    const heading = doc.createElement("strong");
    top.append(heading);
    const menu = button("More options", top, () => {
      settings.hidden = !settings.hidden;
    });
    menu.className = "icon more";
    setButtonIcon(doc, menu, "\xB7\xB7\xB7");
    const contextSlot = doc.createElement("div");
    contextSlot.className = "context-slot";
    const context = doc.createElement("div");
    context.className = "capture-context";
    Object.assign(context.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "4px",
      alignItems: "center",
      maxWidth: "100%"
    });
    const contextLabel = doc.createElement("span"), brief = doc.createElement("small");
    context.append(contextLabel, selector, brief);
    quick.append(contextSlot);
    shell.insertBefore(context, workbench);
    const syncContext = () => {
      const daily = quick.hidden && workbench.hidden;
      context.hidden = daily;
      if (!daily) {
        const slot = quick.hidden ? workbench.querySelector(".context-slot") : contextSlot;
        if (slot && context.parentElement !== slot) slot.append(context);
      }
      selector.hidden = daily;
      contextLabel.hidden = daily;
      brief.hidden = !daily;
      contextLabel.textContent = i18n.t("Current capture");
      brief.textContent = selector.selectedOptions?.[0]?.textContent ?? i18n.enum("Unknown");
    };
    const close = () => {
      quick.hidden = true;
      workbench.hidden = true;
      onLayer("launcher");
      syncContext();
    };
    const closeButton = button("Close", top, close);
    closeButton.className = "icon";
    setButtonIcon(doc, closeButton, "\xD7");
    quick.prepend(top);
    const tabs = doc.createElement("div");
    tabs.className = "tabs";
    tabs.setAttribute("role", "tablist");
    const content = doc.createElement("div");
    let cardsTarget = content, structuralKey = "", presentationKey = "";
    content.className = "cards";
    content.tabIndex = -1;
    const displayContext = doc.createElement("small");
    displayContext.className = "display-context";
    quick.append(displayContext);
    let current = "Route", data = null;
    const tabButtons = /* @__PURE__ */ new Map();
    for (const name of QUICK_TABS) {
      const b = button(name, tabs, () => {
        current = name;
        render(true);
      });
      b.setAttribute("role", "tab");
      tabButtons.set(name, b);
    }
    quick.append(tabs, content);
    tabs.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const index = QUICK_TABS.indexOf(current);
      current = e.key === "Home" ? QUICK_TABS[0] : e.key === "End" ? QUICK_TABS[QUICK_TABS.length - 1] : QUICK_TABS[(index + (e.key === "ArrowRight" ? 1 : QUICK_TABS.length - 1)) % QUICK_TABS.length];
      render(true);
      tabButtons.get(current)?.focus();
    });
    const operations = doc.createElement("div");
    operations.className = "surface-footer";
    operations.append(...controls);
    const openWorkbench = (name = "Timeline") => {
      quick.hidden = true;
      settings.hidden = true;
      workbench.hidden = false;
      syncContext();
      onLayer("workbench");
      advanced(name);
    };
    button("Advanced evidence", operations, () => openWorkbench()).className = "primary";
    settings.className = "settings-popover";
    settings.hidden = true;
    quick.append(operations, settings);
    shell.append(quick);
    const card = (name, value2) => {
      const c = doc.createElement("div");
      c.className = "card";
      const label = doc.createElement("small"), body = doc.createElement("strong");
      label.textContent = i18n.t(name);
      body.textContent = String(value2 ?? i18n.enum("Unknown"));
      body.title = body.textContent;
      c.append(label, body);
      cardsTarget.append(c);
      return c;
    };
    const details = (name, fields) => {
      const container = doc.createElement("details"), title = doc.createElement("summary"), grid = doc.createElement("div");
      title.textContent = i18n.t(name);
      title.setAttribute("aria-label", i18n.t(name));
      grid.className = "detail-grid";
      const previous = cardsTarget;
      cardsTarget = grid;
      for (const [name2, value2] of fields) card(name2, value2);
      cardsTarget = previous;
      container.append(title, grid);
      cardsTarget.append(container);
    };
    function render(fresh = false) {
      syncContext();
      if (quick.hidden) return;
      if (heading.textContent !== i18n.t("Monitor title"))
        heading.textContent = i18n.t("Monitor title");
      if (quick.getAttribute?.("aria-label") !== i18n.t("Quick controls"))
        quick.setAttribute("aria-label", i18n.t("Quick controls"));
      for (const [name, b] of tabButtons)
        if (b.getAttribute?.("aria-selected") !== String(current === name))
          b.setAttribute("aria-selected", String(current === name));
      if (current === "History") {
        structuralKey = "";
        if (fresh || !content.childNodes.length) {
          content.replaceChildren();
          loadHistory(content);
          button("All history", content, () => {
            openWorkbench("History");
          });
        }
        return;
      }
      if (!data) return;
      const viewKey = JSON.stringify([
        current,
        data.safe?.start.capture_id,
        i18n.locale
      ]);
      const nextPresentation = JSON.stringify([viewKey, data]);
      if (!fresh && presentationKey === nextPresentation) return;
      presentationKey = nextPresentation;
      if (structuralKey !== viewKey) content.replaceChildren();
      structuralKey = viewKey;
      const draft = doc.createElement("div");
      cardsTarget = draft;
      try {
        const last = (namespace, field2) => [
          ...data.safe?.events ?? [],
          ...data.related.flatMap((s) => s.events)
        ].filter(
          (e) => e.field_namespace.includes(namespace) && e.field === field2
        ).at(-1)?.value;
        if (current === "Route") {
          card(
            "Route verdict",
            i18n.enum(data.summary?.route_verdict.verdict ?? "Unknown")
          ).className += " conclusion";
          ["Requested", "Server Route", "Resolved Route"].forEach(
            (name, index) => card(name, data.values[index])
          );
          card("Thinking Effort", data.values[3]);
          details("Evidence details", [
            [
              "Response effort",
              i18n.enum(last("response", "thinking_effort") ?? "Unknown")
            ],
            ["fast_convo", last("response", "fast_convo")],
            ...["A", "B", "C", "D"].map((level) => [
              level,
              data.safe?.events.filter((e) => e.level === level).length ?? 0
            ])
          ]);
        } else if (current === "Network") {
          const network = networkDisplay(data.safe);
          card("Network Status", i18n.enum(network.status)).className += " conclusion";
          card("HTTP status", network.http);
          for (const [name, value2] of network.alerts) card(name, value2);
          details(
            "Detailed diagnostics",
            network.fields.map(([name, value2]) => [
              name,
              name === "PoW" ? value2 ?? last("pow", "association_status") : value2
            ])
          );
        } else {
          const events = data.related.flatMap((s) => s.events).filter((e) => e.level === "E");
          for (const field2 of [
            "browser",
            "browser_version",
            "os",
            "viewport",
            "timezone",
            "online"
          ]) {
            const rawField = {
              browser_version: "browser_major",
              build_marker: "build_id",
              asset_set: "asset_set_hash"
            }[field2] ?? field2;
            const value2 = field2 === "viewport" ? viewportText(
              events.filter((e) => e.field === "viewport.width").at(-1)?.value,
              events.filter((e) => e.field === "viewport.height").at(-1)?.value,
              events.filter((e) => e.field === "device_pixel_ratio").at(-1)?.value
            ) : events.filter((e) => e.field === rawField).at(-1)?.value;
            card(
              field2,
              field2 === "online" && typeof value2 === "boolean" ? i18n.t(value2 ? "Online" : "Offline") : value2
            );
          }
          details("Technical details", [
            [
              "build_marker",
              events.filter((e) => e.field === "build_id").at(-1)?.value
            ],
            [
              "asset_set",
              events.filter((e) => e.field === "asset_set_hash").at(-1)?.value
            ]
          ]);
        }
        const raw = doc.createElement("details"), label = doc.createElement("summary"), pre = doc.createElement("pre");
        label.textContent = i18n.t("Raw fields");
        pre.textContent = JSON.stringify(
          {
            events: data.safe?.events.slice(-20),
            related: data.related.map((s) => ({
              mode: s.start.mode,
              events: s.events.slice(-5)
            }))
          },
          null,
          2
        ).slice(0, 5e4);
        raw.append(label, pre);
        cardsTarget.append(raw);
      } finally {
        cardsTarget = content;
        reconcileChildren(content, [...draft.childNodes]);
      }
    }
    const unsubscribe = i18n.subscribe(() => render(true));
    return {
      quick,
      context,
      content,
      close,
      openWorkbench,
      show() {
        current = "Route";
        quick.hidden = false;
        workbench.hidden = true;
        settings.hidden = true;
        quick.append(settings);
        onLayer("main");
        render(true);
        content.focus();
      },
      update(values, safe, summary, related, provenance = "") {
        data = { values, safe, summary, related };
        if (displayContext.textContent !== provenance)
          displayContext.textContent = provenance;
        displayContext.hidden = !provenance;
        quick.dataset.captureId = safe?.start.capture_id ?? "";
        render();
      },
      dispose() {
        unsubscribe();
      }
    };
  }

  // src/ui/style.ts
  var CSS_TEXT = `
:host{all:initial;color-scheme:light;--bb-surface:#fff;--bb-subtle:#f3f6f6;--bb-text:#19242e;--bb-muted:#64737e;--bb-border:#dbe2e6;--bb-accent:#14786b;--bb-tint:#eaf4f0;--bb-danger:#a23d39;font:13px/1.5 "Segoe UI","Microsoft YaHei",system-ui,sans-serif;color:var(--bb-text)}
:host([data-theme=dark]){color-scheme:dark;--bb-surface:#1d2932;--bb-subtle:#263540;--bb-text:#e8eff3;--bb-muted:#9caeb9;--bb-border:#3e505c;--bb-accent:#a1d9c5;--bb-tint:#253e37;--bb-danger:#ffa8a0}
:host([hidden]){display:none!important}*{box-sizing:border-box}[hidden]{display:none!important}.shell{display:contents;pointer-events:none}
button,input,select,textarea{font:inherit;color:inherit;max-width:100%;box-sizing:border-box}button,summary,select{cursor:pointer}
button{min-height:32px;padding:7px 10px;border:1px solid var(--bb-border);border-radius:8px;background:var(--bb-surface)}button:hover{background:var(--bb-subtle);border-color:var(--bb-accent)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--bb-accent);outline-offset:2px}
select,input,textarea{background:var(--bb-surface);border:1px solid var(--bb-border);border-radius:7px;padding:5px 8px}select{min-height:32px}textarea{width:100%;height:70px}
.launcher{display:block;border-radius:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 12px;font-size:12px;text-align:left;box-shadow:0 3px 14px #12243218;cursor:grab;touch-action:none;user-select:none}.launcher[data-tone=match]{color:var(--bb-accent)}.launcher[data-tone=error]{color:var(--bb-danger)}
.quick,.panel{background:var(--bb-surface);color:var(--bb-text);border:1px solid var(--bb-border);border-radius:18px;box-shadow:0 20px 70px #12243224;overflow:hidden;padding:0;font:13px/1.5 "Segoe UI","Microsoft YaHei",system-ui,sans-serif}.panel{border-radius:20px;resize:none;min-width:240px;min-height:240px}
.surface-header{display:flex;align-items:center;gap:8px;min-height:56px;flex-shrink:0;padding:12px 16px;border-bottom:1px solid var(--bb-border);cursor:grab;touch-action:none;user-select:none}.surface-header>strong{font-size:15px;font-weight:650;margin-right:auto}.surface-header button{font-size:12px}.surface-header .icon{border:0;background:none;width:32px;height:32px;min-width:32px;padding:0;display:inline-grid;place-items:center;font-size:20px}.work-title>strong{order:1}.work-title button:first-of-type{order:0}.work-title button:last-of-type{order:2}
.capture-context{padding:10px 16px;min-height:48px;border-bottom:1px solid var(--bb-border);display:flex;gap:10px!important;flex-wrap:nowrap!important;flex-shrink:0}.capture-context span{font-size:11px;color:var(--bb-muted);white-space:nowrap}.capture-context select{font-size:12px;flex:1;min-width:0}.context-slot{flex-shrink:0}
.tabs{display:flex;padding:0 16px;border-bottom:1px solid var(--bb-border);min-height:44px;flex-shrink:0}.tabs button{flex:1;border:0;border-radius:0;background:none;color:var(--bb-muted);border-bottom:2px solid transparent;font-size:12px;white-space:nowrap;padding:6px}.tabs [aria-selected=true]{border-bottom-color:var(--bb-accent);color:var(--bb-accent);font-weight:650}
.cards:focus{outline:none}.cards{flex:1;min-height:0;overflow:auto;padding:16px 20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}.card{padding:0 0 8px;min-width:0;overflow-wrap:anywhere}.card small{display:block;color:var(--bb-muted);font-size:11px;margin-bottom:4px}.card strong{display:block;font-size:13px;font-weight:600}.cards>details,.cards>.history-row,.cards>button{grid-column:1/-1}.cards .history-row{font-size:12px}.cards>details{font-size:12px}
.surface-footer,.panel>.bar{min-height:62px;display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--bb-border);flex-shrink:0}.surface-footer button{font-size:12px;white-space:nowrap}.primary{margin-left:auto;background:var(--bb-accent);color:var(--bb-surface);border-color:var(--bb-accent)}.primary:hover{background:var(--bb-accent);filter:brightness(.94)}
.cards>.conclusion{grid-column:1/-1;background:var(--bb-tint);border:1px solid var(--bb-border);border-radius:10px;padding:10px 12px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:8px 0}.history-row{display:flex;align-items:center;gap:8px}.history-caption{flex:1;min-width:0;overflow-wrap:anywhere}.history-caption strong,.history-caption span,.history-caption small{display:block}.history-caption small{color:var(--bb-muted);font-size:10px}.history-row .history-export{width:28px;min-width:28px;min-height:28px;padding:2px;margin:0;flex-shrink:0;background:none;border-color:transparent}
:host(:not([data-theme=dark])) .cards>.conclusion small{color:var(--bb-text)}
.settings-popover{position:absolute;top:52px;right:12px;width:min(320px,calc(100% - 24px));max-height:380px;overflow:auto;z-index:2;padding:12px;background:var(--bb-surface);border:1px solid var(--bb-border);border-radius:12px;box-shadow:0 8px 30px #12243224}.settings-popover label{display:flex;gap:8px;align-items:center}.settings-popover button{margin:4px}.evidence-content>.settings-popover{position:static;width:auto;box-shadow:none;max-height:none}
.work-row{display:flex;flex:1;min-height:0}.work-nav{width:160px;flex-shrink:0;border-right:1px solid var(--bb-border);background:var(--bb-subtle);padding:14px 10px;overflow:auto}.work-nav button{display:block;width:100%;margin-bottom:4px;text-align:left;border:0;background:none;color:var(--bb-muted);font-size:12px}.work-nav [aria-current=page]{color:var(--bb-accent);background:var(--bb-tint);font-weight:650}.work-nav details{font-size:11px}.import-controls{font-size:11px;padding:8px 0}.import-controls input{width:100%;font-size:10px}
.evidence-content{flex:1;min-width:0;min-height:0;overflow:auto;padding:20px 24px}.evidence-content>.badge{display:block;padding:12px;margin-bottom:12px;background:var(--bb-tint);border:1px solid var(--bb-border);border-radius:10px;font-size:13px}.evidence-content p{font-size:12px;color:var(--bb-muted)}.timeline-row{padding:10px 12px;margin:8px 0;border:1px solid var(--bb-border);border-radius:10px;font-size:12px;overflow-wrap:anywhere}.timeline-row>div{font-family:Consolas,monospace}.timeline-row summary{font-size:11px}
summary{padding:6px 0;color:var(--bb-muted)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 Consolas,monospace;padding:12px;background:var(--bb-subtle);border-radius:8px}.history-row,.evidence-content>div{padding:8px 0;border-bottom:1px solid var(--bb-border)}.history-row button,.evidence-content>div>button{font-size:11px;margin-left:8px}.status{font-size:11px;color:var(--bb-muted);overflow-wrap:anywhere;max-height:44px;overflow:auto;padding:0 16px;flex-shrink:0}.status:empty{display:none}
.restore{position:fixed;width:16px;height:32px;padding:0;min-width:16px;min-height:32px;opacity:.55;background:var(--bb-accent);color:var(--bb-surface);border:0;border-radius:8px;pointer-events:auto;z-index:2147483001}.restore:hover,.restore:focus-visible{opacity:1}
@media(max-width:760px){.work-row{flex-direction:column}.work-nav{width:100%;display:flex;overflow:auto;flex-shrink:0;border-right:0;border-bottom:1px solid var(--bb-border);padding:6px}.work-nav button{width:auto;white-space:nowrap;margin:0}.work-nav details,.import-controls{min-width:130px}.evidence-content{padding:12px}.surface-header{padding:10px 12px}.surface-header>strong{font-size:13px}.surface-footer{padding:10px 12px;gap:4px}.surface-footer button{font-size:11px;padding:5px}.cards{padding:14px;gap:10px}}
`;
  var IA_CSS = "";
  function setSurfaceVisible(el, visible, kind) {
    el.hidden = !visible;
    el.style.display = visible ? kind === "launcher" ? "block" : "flex" : "none";
  }
  function applySurfaceCriticalStyle(el, kind) {
    Object.assign(el.style, {
      position: "fixed",
      pointerEvents: "auto",
      flexDirection: "column",
      width: kind === "launcher" ? "380px" : kind === "main" ? "460px" : "960px",
      height: kind === "launcher" ? "36px" : kind === "main" ? "560px" : "680px",
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "calc(100dvh - 24px)",
      boxSizing: "border-box",
      overflow: "hidden"
    });
    setSurfaceVisible(el, !el.hidden, kind);
  }
  function applyFallbackStructure(el) {
    for (const header of el.querySelectorAll(".surface-header"))
      Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        minHeight: "56px",
        flexShrink: "0",
        touchAction: "none",
        cursor: "grab"
      });
    for (const footer of el.querySelectorAll(".surface-footer,.bar"))
      Object.assign(footer.style, {
        display: "flex",
        gap: "8px",
        flexShrink: "0",
        padding: "12px"
      });
    for (const body of el.querySelectorAll(
      ".cards,.evidence-content"
    ))
      Object.assign(body.style, {
        flex: "1",
        minHeight: "0",
        minWidth: "0",
        overflow: "auto",
        padding: "12px"
      });
    for (const row of el.querySelectorAll(".work-row"))
      Object.assign(row.style, { display: "flex", flex: "1", minHeight: "0" });
    for (const nav of el.querySelectorAll(".work-nav"))
      Object.assign(nav.style, {
        width: "160px",
        flexShrink: "0",
        overflow: "auto"
      });
    for (const menu of el.querySelectorAll(".settings-popover"))
      Object.assign(menu.style, {
        position: "absolute",
        right: "12px",
        top: "52px",
        maxHeight: "380px",
        overflow: "auto",
        zIndex: "2",
        background: "Canvas",
        color: "CanvasText",
        border: "1px solid GrayText",
        padding: "12px"
      });
  }
  function applyHostCriticalStyle(host) {
    host.style.position = "fixed";
    host.style.right = "8px";
    host.style.top = "8px";
    host.style.zIndex = "2147483000";
    host.style.maxWidth = "calc(100vw - 16px)";
    host.style.pointerEvents = "none";
  }
  function applyShellCriticalStyle(shell) {
    shell.style.display = "contents";
    shell.style.pointerEvents = "none";
  }
  function applyElementStyle(el, role) {
    const styles = {
      shell: {
        font: "12px system-ui",
        background: "Canvas",
        color: "CanvasText",
        border: "1px solid GrayText",
        borderRadius: "8px",
        padding: "8px",
        boxShadow: "0 2px 9px #0003"
      },
      bar: { display: "flex", gap: "4px", flexWrap: "wrap" },
      control: { font: "inherit", maxWidth: "100%", boxSizing: "border-box" },
      daily: {
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: "2px",
        margin: "8px 0"
      },
      cell: { margin: "0", overflowWrap: "anywhere" },
      panel: {
        resize: "none",
        overflow: "auto",
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "calc(100dvh - 24px)",
        minWidth: "160px",
        minHeight: "100px"
      },
      pre: {
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        font: "11px ui-monospace"
      },
      textarea: { width: "100%", height: "70px" },
      drag: { touchAction: "none" },
      status: { overflowWrap: "anywhere" }
    };
    Object.assign(el.style, styles[role]);
  }
  function installVisualStyles(shadow, win) {
    try {
      const Constructor = win.CSSStyleSheet;
      if (typeof Constructor !== "function" || !("adoptedStyleSheets" in shadow))
        return {
          method: "property-fallback",
          status: "Partial",
          reason: "constructed_stylesheet_unavailable"
        };
      const sheet = new Constructor();
      sheet.replaceSync(CSS_TEXT + IA_CSS);
      shadow.adoptedStyleSheets = [sheet];
      if (shadow.adoptedStyleSheets[0] !== sheet || !sheet.cssRules.length)
        throw Error("ineffective");
      return {
        method: "adoptedStyleSheets",
        status: "Complete",
        reason: "same_document_stylesheet_installed"
      };
    } catch {
      return {
        method: "property-fallback",
        status: "Partial",
        reason: "constructed_stylesheet_rejected"
      };
    }
  }

  // src/ui/history-view.ts
  var HistoryOperation = class {
    constructor(now) {
      this.now = now;
    }
    now;
    state = {
      operation: "history_view",
      stage: "history_view_open",
      status: "Idle",
      safe_error_code: null
    };
    timeline = [];
    begin(operation, stage) {
      this.state = { operation, stage, status: "Running", safe_error_code: null };
      this.timeline = [];
      this.mark(stage);
    }
    mark(stage, details = {}) {
      this.state.stage = stage;
      if (this.timeline.length < 16)
        this.timeline.push({ stage, monotonic_ms: this.now(), details });
    }
    success() {
      this.mark("guard_success");
      this.state.status = "Success";
    }
    fail(error) {
      const code = error instanceof Error ? error.message : "";
      this.state.status = "Failed";
      this.state.safe_error_code = [
        "invalid_manifest",
        "invalid_snapshot",
        "invalid_timeline_sequence_or_source",
        "no_capture",
        "history_view_changed"
      ].includes(code) ? code : "history_operation_failed";
    }
    get snapshot() {
      return structuredClone({ ...this.state, timeline: this.timeline });
    }
  };
  async function recoverHistoryView(flush, list, health) {
    health.begin("history_view", "history_view_open");
    try {
      health.mark("flush");
      await flush();
      health.mark("history_list_begin");
      const records = await list(), rows = conversationHistory(records);
      health.mark("history_list_end", {
        total_records: records.length,
        conversation_rows: rows.length,
        auxiliary_records: records.filter((r) => r.snapshot.start.mode !== "live").length
      });
      return {
        rows,
        related: (snapshot) => relatedHistory(records, snapshot)
      };
    } catch (error) {
      health.fail(error);
      throw error;
    }
  }
  async function exportHistoryRecord(view, record2, download, health, isCurrent = () => true) {
    health.begin("history_export", "history_button_click");
    try {
      if (!isCurrent()) throw Error("history_view_changed");
      health.mark("related_source_begin");
      const related = view.related(record2.snapshot);
      health.mark("related_filter_end", {
        related_count: related.length,
        related_modes: related.map((s) => s.start.mode)
      });
      health.mark("export_bundle_begin");
      const bundle = await exportBundle(
        record2.snapshot,
        "1.1.0",
        {},
        { state: "not_compared" },
        related
      );
      health.mark("export_bundle_end", { zip_bytes: bundle.bytes.length });
      if (!isCurrent()) throw Error("history_view_changed");
      health.mark("download_helper_called", { zip_bytes: bundle.bytes.length });
      download(bundle.bytes);
      health.success();
      return { related_available: related.length > 0 };
    } catch (error) {
      health.fail(error);
      return null;
    }
  }

  // src/ui/projection.ts
  function currentCaptures(snapshots, context) {
    return snapshots.filter(
      (s) => ["live", "reload"].includes(s.start.mode) && s.start.context.document_id === context.document_id && s.start.context.visit_id === context.visit_id && s.start.context.epoch === context.epoch
    ).sort((a, b) => b.start.started_at - a.start.started_at);
  }
  function chooseCapture(snapshots, context, manual = null) {
    const current = currentCaptures(snapshots, context);
    return current.find((s) => s.start.capture_id === manual) ?? current[0] ?? null;
  }
  function meaningfulConversation(snapshot) {
    return ["live", "reload"].includes(snapshot.start.mode) && snapshot.events.some(
      (e) => e.association === "confirmed" && ["request", "server_ste_metadata", "resolved"].includes(
        e.field_namespace
      ) && [
        "model",
        "model_slug",
        "resolved_model_slug",
        "thinking_effort"
      ].includes(e.field) && typeof e.value === "string" && e.value !== "Unknown" && e.value.length > 0
    );
  }
  function displayConversation(snapshots, context, manual = null) {
    const selected = chooseCapture(snapshots, context, manual);
    const snapshot = selected && (selected.start.capture_id === manual || meaningfulConversation(selected)) ? selected : currentCaptures(snapshots, context).find(meaningfulConversation) ?? snapshots.filter(
      (s) => s.start.context.document_id === context.document_id && meaningfulConversation(s)
    ).sort((a, b) => b.start.started_at - a.start.started_at)[0] ?? selected;
    return {
      snapshot,
      source: snapshot && snapshot !== selected ? "recent" : "current"
    };
  }
  function timelinePage(snapshot, page, size = 50) {
    const bounded = Math.max(1, Math.min(100, size)), pages = Math.max(1, Math.ceil(snapshot.events.length / bounded));
    const actual = Math.max(0, Math.min(pages - 1, Math.floor(page)));
    return {
      events: snapshot.events.slice(actual * bounded, (actual + 1) * bounded),
      page: actual,
      pages,
      total: snapshot.events.length
    };
  }

  // src/ui/panel.ts
  function installPanel(doc, journal, history, experiments, actions, i18n = new I18n()) {
    const win = doc.defaultView;
    const bindings = /* @__PURE__ */ new Set();
    const historyBindings = /* @__PURE__ */ new Set();
    const bind = (update, transient = false) => {
      (transient ? historyBindings : bindings).add(update);
      update();
    };
    const labelAttribute = (el, attribute, label) => bind(() => el.setAttribute(attribute, i18n.t(label)));
    const labelText = (el, label, transient = false) => bind(() => {
      el.textContent = i18n.t(label);
    }, transient);
    const historyOperation = new HistoryOperation(() => win.performance.now());
    let historyView = null, historyReading = false, historyGeneration = 0, historyScope = "";
    const invalidateHistoryView = () => {
      historyBindings.clear();
      historyGeneration++;
      historyView = null;
      historyReading = false;
    };
    const host = doc.createElement("div");
    host.id = "chatgpt-blackbox-monitor";
    applyHostCriticalStyle(host);
    const shadow = host.attachShadow({ mode: "open" });
    const styleHealth = installVisualStyles(shadow, win);
    const styled = (el, role) => {
      if (styleHealth.method === "property-fallback") applyElementStyle(el, role);
    };
    const shell = doc.createElement("section");
    shell.className = "shell";
    applyShellCriticalStyle(shell);
    styled(shell, "shell");
    labelAttribute(shell, "aria-label", "ChatGPT Blackbox Monitor");
    shadow.append(shell);
    const bar = doc.createElement("div");
    bar.className = "bar";
    styled(bar, "bar");
    shell.append(bar);
    const button = (label, parent, run, transient = false) => {
      const b = doc.createElement("button");
      bind(() => {
        if (!b.dataset.icon) b.textContent = i18n.t(label);
        b.setAttribute("aria-label", i18n.t(label));
        b.title = i18n.t(label);
      }, transient);
      styled(b, "control");
      b.addEventListener("click", run);
      parent.append(b);
      return b;
    };
    const status = doc.createElement("div");
    status.className = "status";
    styled(status, "status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    let currentNotice = "";
    const notice = (text2) => {
      currentNotice = text2;
      status.textContent = i18n.t(text2).slice(0, 512);
      workStatus.textContent = status.textContent;
    };
    const guard = (fn) => {
      void fn().catch(
        () => notice(
          "Operation failed or unsupported input. History remains available."
        )
      );
    };
    let hidden = false, manual = null, lastVisit = "", optionInventory = "", pageIndex = 0, selected = null, descriptor = null;
    const imported = [];
    const pairs = [];
    const open = button("View details", shell, () => {
      layers.show();
      open.setAttribute("aria-expanded", "true");
      render();
      position.refresh();
    });
    open.className = "launcher title";
    open.setAttribute("aria-controls", "blackbox-main");
    applySurfaceCriticalStyle(open, "launcher");
    open.setAttribute("aria-expanded", "false");
    const hide = button("Hide", bar, () => {
      hidden = true;
      layers.close();
      setSurfaceVisible(open, false, "launcher");
      restore.hidden = false;
      position.refresh();
    });
    const pause = button("Pause", bar, () => {
      if (actions.active()) actions.pause();
      else actions.resume();
      render();
    });
    const restore = button(
      "Restore monitor",
      shadow,
      () => {
        hidden = false;
        layers.close();
        restore.hidden = true;
        render();
        position.refresh();
        open.focus();
      }
    );
    restore.className = "restore";
    restore.hidden = true;
    Object.assign(restore.style, {
      position: "fixed",
      width: "16px",
      height: "32px",
      padding: "0",
      opacity: "0.65",
      pointerEvents: "auto",
      zIndex: "2147483001"
    });
    bind(() => {
      restore.textContent = "\u25CF";
    });
    const position = installPosition(
      open,
      open,
      open,
      restore,
      actions.preferences
    );
    const select = doc.createElement("select");
    styled(select, "control");
    labelAttribute(select, "aria-label", "Current capture");
    select.addEventListener("change", () => {
      manual = select.value;
      pageIndex = 0;
      render();
    });
    const panel = doc.createElement("section");
    panel.className = "panel";
    panel.id = "blackbox-workbench";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    styled(panel, "panel");
    applySurfaceCriticalStyle(panel, "workbench");
    panel.hidden = true;
    labelAttribute(panel, "aria-label", "Forensic evidence");
    shell.append(panel);
    const toolbar = doc.createElement("div");
    toolbar.className = "bar";
    styled(toolbar, "bar");
    const workHeader = doc.createElement("header");
    workHeader.className = "work-title surface-header";
    const workHeading = doc.createElement("strong");
    labelText(workHeading, "Evidence Workbench");
    workHeader.append(workHeading);
    const workContext = doc.createElement("div");
    workContext.className = "context-slot";
    const workRow = doc.createElement("div");
    workRow.className = "work-row";
    const navigation = doc.createElement("nav");
    navigation.className = "work-nav";
    labelAttribute(navigation, "aria-label", "Workbench navigation");
    panel.append(workHeader, workContext, workRow, toolbar);
    workRow.append(navigation);
    const close = () => {
      invalidateHistoryView();
      panel.hidden = true;
      layers.close();
      position.refresh();
      open.setAttribute("aria-expanded", "false");
      open.focus();
    };
    button("Back to controls", workHeader, () => {
      layers.show();
      render();
    });
    const workClose = button("Close", workHeader, close);
    workClose.className = "icon";
    setButtonIcon(doc, workClose, "\xD7");
    const category = doc.createElement("select");
    styled(category, "control");
    labelAttribute(category, "aria-label", "Evidence section");
    for (const name of [
      "Advanced settings",
      "Timeline",
      "A/B/C/D",
      "Transport / Timing",
      "Network / Cloudflare / PoW / IP",
      "Environment / Frontend Build",
      "Capture Health / Storage",
      "History",
      "Redaction preview",
      "Experiment",
      "Compare"
    ]) {
      const o = doc.createElement("option");
      o.value = name;
      labelText(o, name);
      category.append(o);
    }
    category.hidden = true;
    toolbar.append(category);
    const navigationLabels = [
      ["Route evidence", "A/B/C/D"],
      ["Timeline", "Timeline"],
      ["Network", "Network / Cloudflare / PoW / IP"],
      ["Environment", "Environment / Frontend Build"],
      ["History", "History"],
      ["A/B compare", "Compare"],
      ["System / Health", "Capture Health / Storage"],
      ["Advanced settings", "Advanced settings"]
    ];
    for (const [label, value2] of navigationLabels) {
      const b = button(label, navigation, () => {
        category.value = value2;
        invalidateHistoryView();
        pageIndex = 0;
        render();
      });
      b.dataset.category = value2;
    }
    const secondaryNav = doc.createElement("details");
    const secondaryLabel = doc.createElement("summary");
    labelText(secondaryLabel, "More evidence");
    secondaryNav.append(secondaryLabel);
    for (const name of [
      "Transport / Timing",
      "Redaction preview",
      "Experiment"
    ]) {
      const b = button(name, secondaryNav, () => {
        category.value = name;
        invalidateHistoryView();
        pageIndex = 0;
        render();
      });
      b.dataset.category = name;
    }
    navigation.append(secondaryNav);
    const languageLabel = doc.createElement("label");
    const languageText = doc.createElement("span");
    labelText(languageText, "Language");
    const language = doc.createElement("select");
    styled(language, "control");
    labelAttribute(language, "aria-label", "Language");
    for (const [value2, label] of [
      ["zh-CN", "\u7B80\u4F53\u4E2D\u6587"],
      ["en-US", "English"]
    ]) {
      const option = doc.createElement("option");
      option.value = value2;
      option.textContent = label;
      language.append(option);
    }
    language.value = i18n.locale;
    languageLabel.append(languageText, language);
    toolbar.append(languageLabel);
    language.addEventListener("change", () => {
      try {
        i18n.setLocale(language.value);
      } catch {
        notice(
          "Operation failed or unsupported input. History remains available."
        );
        language.value = i18n.locale;
      }
    });
    category.addEventListener("change", () => {
      invalidateHistoryView();
      pageIndex = 0;
      render();
    });
    button("Previous page", toolbar, () => {
      pageIndex = Math.max(0, pageIndex - 1);
      render();
    });
    button("Next page", toolbar, () => {
      pageIndex++;
      render();
    });
    button(
      "Export ZIP",
      toolbar,
      () => guard(async () => {
        if (!selected) throw Error("no_capture");
        const r = await actions.export(selected.start.capture_id);
        download(r.bytes, "blackbox-evidence.zip");
        notice("Sanitized local ZIP exported. Review it before sharing.");
      })
    );
    button(
      "Clear current",
      toolbar,
      () => guard(async () => {
        if (!win.confirm(i18n.t("Confirm clear current"))) return;
        if (selected) await actions.clearCurrent(selected.start.capture_id);
        invalidateHistoryView();
        manual = null;
        render();
      })
    );
    button(
      "Clear history",
      toolbar,
      () => guard(async () => {
        if (!win.confirm(i18n.t("Confirm clear history"))) return;
        await actions.clearHistory();
        invalidateHistoryView();
        render();
      })
    );
    button(
      "Clear all",
      toolbar,
      () => guard(async () => {
        if (!win.confirm(i18n.t("Confirm clear all"))) return;
        await actions.clearAll();
        invalidateHistoryView();
        manual = null;
        render();
      })
    );
    const file = doc.createElement("input");
    styled(file, "control");
    file.type = "file";
    file.accept = ".zip";
    file.multiple = true;
    labelAttribute(
      file,
      "aria-label",
      "Import evidence ZIPs for local comparison"
    );
    const importControls = doc.createElement("div");
    importControls.className = "import-controls";
    const importLabel = doc.createElement("span");
    labelText(importLabel, "Import evidence ZIPs for local comparison");
    importControls.append(importLabel, file);
    navigation.append(importControls);
    file.addEventListener(
      "change",
      () => guard(async () => {
        const files = [...file.files ?? []];
        file.value = "";
        if (files.length > 2) throw Error("pair_limit");
        const bundles = [];
        for (const f of files) {
          if (f.size > 20 * 1048576) throw Error("file_limit");
          bundles.push(
            await actions.import(new Uint8Array(await f.arrayBuffer()))
          );
        }
        imported.push(...bundles);
        while (imported.length > 2) imported.shift();
        category.value = "Compare";
        render();
        notice("Local import validated; no history writes or upload.");
      })
    );
    const section = doc.createElement("div");
    let contentTarget = section, structuralKey = "", redactionRevision = "";
    section.tabIndex = -1;
    labelAttribute(section, "aria-label", "Evidence content");
    section.className = "evidence-content";
    workRow.append(section);
    const experimentForm = doc.createElement("div");
    const descriptorInput = doc.createElement("textarea");
    styled(descriptorInput, "control");
    styled(descriptorInput, "textarea");
    labelAttribute(
      descriptorInput,
      "aria-label",
      "Local experiment descriptor JSON"
    );
    descriptorInput.maxLength = 16384;
    experimentForm.append(descriptorInput);
    button("Create experiment", experimentForm, () => {
      descriptor = createDescriptor("task-1", "browser-local");
      descriptorInput.value = JSON.stringify(descriptor, null, 2);
      notice(
        "Edit task, replicate, browser label and declared conditions; share the same UUID with the second browser."
      );
    });
    button(
      "Save descriptor",
      experimentForm,
      () => guard(async () => {
        descriptor = validateDescriptor(JSON.parse(descriptorInput.value));
        await experiments.save(descriptor);
        notice(
          "Descriptor saved locally. Account condition is manual declaration only."
        );
      })
    );
    const descriptorFile = doc.createElement("input");
    styled(descriptorFile, "control");
    descriptorFile.type = "file";
    descriptorFile.accept = ".json";
    labelAttribute(
      descriptorFile,
      "aria-label",
      "Import local experiment descriptor"
    );
    experimentForm.append(descriptorFile);
    descriptorFile.addEventListener(
      "change",
      () => guard(async () => {
        const f = descriptorFile.files?.[0];
        descriptorFile.value = "";
        if (!f || f.size > 16384) throw Error("descriptor_limit");
        descriptor = validateDescriptor(JSON.parse(await f.text()));
        descriptorInput.value = JSON.stringify(descriptor, null, 2);
        await experiments.save(descriptor);
        notice("Descriptor imported locally.");
      })
    );
    button("Export descriptor", experimentForm, () => {
      if (!descriptor) return;
      download(
        new TextEncoder().encode(JSON.stringify(descriptor, null, 2)),
        "blackbox-experiment.json",
        "application/json"
      );
    });
    const key = doc.createElement("input");
    styled(key, "control");
    key.type = "password";
    key.maxLength = 64;
    labelAttribute(key, "placeholder", "Optional shared 64 hex key");
    labelAttribute(key, "aria-label", "Optional shared local experiment key");
    experimentForm.append(key);
    button(
      "Save local key",
      experimentForm,
      () => guard(async () => {
        if (!descriptor) throw Error("no_descriptor");
        const value2 = key.value;
        key.value = "";
        await experiments.save(descriptor, value2);
        notice("Shared key stored only locally; absent from evidence exports.");
      })
    );
    const prompt = doc.createElement("textarea");
    styled(prompt, "control");
    styled(prompt, "textarea");
    labelAttribute(
      prompt,
      "placeholder",
      "Optional transient exact user content"
    );
    prompt.maxLength = 1048576;
    labelAttribute(
      prompt,
      "aria-label",
      "Optional transient user content for HMAC association"
    );
    experimentForm.append(prompt);
    button(
      "Bind current run",
      experimentForm,
      () => guard(async () => {
        if (!selected || !descriptor) throw Error("no_selected_descriptor");
        const value2 = prompt.value;
        prompt.value = "";
        await experiments.bind(
          selected.start.capture_id,
          descriptor,
          value2 ? [value2] : void 0
        );
        notice(
          "Independent run bound. Content discarded; hash does not prove equal context."
        );
      })
    );
    button(
      "Clear experiment",
      experimentForm,
      () => guard(async () => {
        if (descriptor) await history.clearExperiment(descriptor.experiment_uuid);
        descriptor = null;
        descriptorInput.value = "";
        key.value = "";
        prompt.value = "";
        notice("Local experiment cleared.");
      })
    );
    const threshold = doc.createElement("input");
    styled(threshold, "control");
    threshold.type = "number";
    threshold.value = "10";
    threshold.min = "1";
    labelAttribute(threshold, "aria-label", "Timing ratio flag threshold");
    const absolute = doc.createElement("input");
    styled(absolute, "control");
    absolute.type = "number";
    absolute.value = "10000";
    absolute.min = "0";
    labelAttribute(
      absolute,
      "aria-label",
      "Timing absolute difference threshold in ms"
    );
    const compareControls = doc.createElement("div");
    compareControls.append(threshold, absolute);
    button("Compare / add pair", compareControls, () => {
      if (imported.length !== 2) return;
      const p = compareBundles(imported[0], imported[1], {
        ratio: Number(threshold.value),
        absolute_ms: Number(absolute.value)
      });
      if (!pairs.some(
        (x) => JSON.stringify(x.run_ids) === JSON.stringify(p.run_ids)
      ))
        pairs.push(p);
      if (pairs.length > 200) pairs.shift();
      render();
    });
    const settings = doc.createElement("details");
    const settingsTitle = doc.createElement("summary");
    labelText(settingsTitle, "Settings");
    settings.append(settingsTitle, languageLabel);
    const management = doc.createElement("details"), managementTitle = doc.createElement("summary");
    labelText(managementTitle, "Data management");
    management.append(managementTitle);
    const controlButtons = [...toolbar.querySelectorAll("button")];
    for (const b of controlButtons.filter(
      (b2) => b2.textContent === i18n.t("Clear current") || b2.textContent === i18n.t("Clear history") || b2.textContent === i18n.t("Clear all")
    ))
      management.append(b);
    const diagnostics = doc.createElement("details"), diagnosticsTitle = doc.createElement("summary");
    labelText(diagnosticsTitle, "Diagnostics");
    diagnostics.append(diagnosticsTitle);
    button("Check hook health", diagnostics, () => {
      actions.checkHooks?.();
    });
    button("Capture status", diagnostics, () => {
      layers.openWorkbench("Capture Health / Storage");
    });
    settings.append(hide, management, diagnostics);
    const exportButton = controlButtons.find(
      (b) => b.textContent === i18n.t("Export ZIP")
    );
    const advanced = (name = "Timeline") => {
      invalidateHistoryView();
      category.value = name;
      panel.hidden = false;
      render();
      section.focus();
      position.refresh();
    };
    let recentGeneration = 0;
    const layers = installLayers(
      doc,
      shell,
      panel,
      select,
      [pause, exportButton],
      settings,
      i18n,
      button,
      advanced,
      (parent) => {
        const generation = ++recentGeneration;
        guard(async () => {
          const view = await recoverHistoryView(
            () => actions.flush(),
            () => history.list(),
            historyOperation
          );
          if (generation !== recentGeneration || !parent.isConnected) return;
          for (const r of view.rows.slice(0, 20)) {
            const line = doc.createElement("div");
            line.className = "history-row";
            const display = historyDisplay(r.snapshot, i18n), caption = doc.createElement("div"), heading = doc.createElement("strong"), states = doc.createElement("span"), secondary = doc.createElement("small");
            caption.className = "history-caption";
            heading.textContent = `${display.time} \xB7 ${display.model}`;
            heading.title = `${display.modelSource}: ${display.model}`;
            states.textContent = `${display.verdict} \xB7 ${display.effort} \xB7 ${display.duration}`;
            secondary.textContent = `${display.modelSource} \xB7 #${display.id} \xB7 ${i18n.enum(r.completeness)}`;
            caption.append(heading, states, secondary);
            line.append(caption);
            const b = doc.createElement("button");
            b.textContent = "\u2197";
            b.title = i18n.t("Export this history round");
            b.className = "history-export";
            b.setAttribute(
              "aria-label",
              i18n.t("Export this history round") + " " + r.manifest.capture_id.slice(0, 8)
            );
            b.addEventListener(
              "click",
              () => guard(async () => {
                await exportHistoryRecord(
                  view,
                  r,
                  (bytes) => download(bytes, "blackbox-history.zip"),
                  historyOperation
                );
              })
            );
            line.append(b);
            parent.append(line);
          }
        });
      },
      (layer) => {
        setSurfaceVisible(open, layer === "launcher", "launcher");
        setSurfaceVisible(layers.quick, layer === "main", "main");
        setSurfaceVisible(panel, layer === "workbench", "workbench");
        open.setAttribute("aria-expanded", String(layer !== "launcher"));
        position.refresh();
        mainPosition?.refresh();
        workPosition?.refresh();
        if (layer === "launcher") open.focus();
      }
    );
    applySurfaceCriticalStyle(layers.quick, "main");
    if (styleHealth.method === "property-fallback") {
      applyFallbackStructure(layers.quick);
      applyFallbackStructure(panel);
    }
    setSurfaceVisible(layers.quick, false, "main");
    setSurfaceVisible(panel, false, "workbench");
    const unusedRestore = doc.createElement("button");
    const mainScale = installScale(
      layers.quick,
      460,
      560,
      MAIN_SCALE_KEY,
      () => i18n.t("Scale Main"),
      () => mainPosition.refresh(),
      actions.preferences
    );
    const workScale = installScale(
      panel,
      960,
      680,
      WORKBENCH_SCALE_KEY,
      () => i18n.t("Scale Workbench"),
      () => workPosition.refresh(),
      actions.preferences
    );
    const mainPosition = installPosition(
      layers.quick,
      layers.quick,
      layers.quick.querySelector(".main-title"),
      unusedRestore,
      actions.preferences,
      "blackbox.ui.main.position",
      mainScale.refresh
    );
    const workPosition = installPosition(
      panel,
      panel,
      workHeader,
      unusedRestore,
      actions.preferences,
      "blackbox.ui.workbench.position",
      workScale.refresh
    );
    layers.quick.append(status);
    const workStatus = doc.createElement("div");
    workStatus.className = "status";
    workStatus.setAttribute("role", "status");
    panel.append(workStatus);
    button("Export ZIP", toolbar, () => exportButton.click());
    const theme = () => {
      const scheme = win.getComputedStyle(doc.documentElement).colorScheme;
      const background = doc.body ? win.getComputedStyle(doc.body).backgroundColor : "";
      const rgb = background.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
      const darkBackground = rgb && Number(rgb[1]) * 0.2126 + Number(rgb[2]) * 0.7152 + Number(rgb[3]) * 0.0722 < 128;
      host.dataset.theme = scheme === "dark" || scheme !== "light" && darkBackground || scheme !== "light" && win.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };
    const media = win.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", theme);
    const themeObserver = new win.MutationObserver(theme);
    themeObserver.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"]
    });
    if (doc.body)
      themeObserver.observe(doc.body, {
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    theme();
    function download(bytes, name, type = "application/zip") {
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type })
      ), a = doc.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    }
    function text(value2) {
      if (typeof value2 === "string") {
        const p = doc.createElement("p");
        p.textContent = i18n.t(value2);
        contentTarget.append(p);
        return;
      }
      const object = value2;
      if (object?.conclusion) {
        const badge = doc.createElement("strong");
        badge.textContent = i18n.enum(object.conclusion);
        contentTarget.append(badge);
      }
      if (object?.page) {
        const p = doc.createElement("p");
        p.textContent = `${i18n.t("Page")} ${object.page} / ${object.pages} \xB7 ${object.total}`;
        contentTarget.append(p);
        return;
      }
      const detail = doc.createElement("details"), label = doc.createElement("summary"), pre = doc.createElement("pre");
      label.textContent = i18n.t("Raw fields");
      styled(pre, "pre");
      pre.textContent = JSON.stringify(value2, null, 2).slice(0, 5e4);
      detail.append(label, pre);
      contentTarget.append(detail);
    }
    function render() {
      if (hidden) return;
      const context = actions.context();
      const scope = `${context.document_id}:${context.visit_id}:${context.epoch}`;
      if (historyScope !== scope) {
        invalidateHistoryView();
        historyScope = scope;
      }
      if (lastVisit !== context.visit_id) {
        manual = null;
        pageIndex = 0;
        lastVisit = context.visit_id;
      }
      const snapshots = journal.ids().map((id2) => journal.snapshot(id2)).filter((s) => !!s);
      const current = currentCaptures(snapshots, context);
      selected = chooseCapture(snapshots, context, manual);
      const inventory = JSON.stringify(
        current.map((s) => [s.start.capture_id, s.start.transport])
      );
      if (inventory !== optionInventory) {
        optionInventory = inventory;
        const optionDraft = [];
        for (const s of current) {
          const o = doc.createElement("option");
          o.value = s.start.capture_id;
          o.textContent = `${s.start.transport}: ${s.start.capture_id.slice(0, 8)}`;
          optionDraft.push(o);
        }
        reconcileChildren(select, optionDraft);
      }
      if (selected) select.value = selected.start.capture_id;
      const pauseLabel = i18n.t(actions.active() ? "Pause" : "Resume");
      if (pause.textContent !== pauseLabel) {
        pause.textContent = pauseLabel;
        pause.setAttribute("aria-label", pauseLabel);
        pause.title = pauseLabel;
      }
      const presentation = (snapshot) => {
        const safe2 = snapshot ? safeSnapshot(snapshot) : null, summary2 = safe2 ? summarize(safe2) : null;
        const last = (ns, f) => safe2?.events.filter((e) => e.field_namespace === ns && e.field === f).at(-1)?.value ?? i18n.enum("Unknown");
        const duration = !snapshot || snapshot.start.mode === "reload" ? "Unknown" : summary2?.capture_health.lifecycle === "Closed" ? summary2.timing.total_ms === null ? "Unknown" : `${(summary2.timing.total_ms / 1e3).toFixed(1)}s total` : `${Math.max(0, (win.performance.now() - snapshot.start.started_at) / 1e3).toFixed(1)}s elapsed`;
        const values = [
          last("request", "model"),
          last("server_ste_metadata", "model_slug"),
          last("resolved", "resolved_model_slug"),
          i18n.enum(last("request", "thinking_effort")),
          i18n.composite(
            summary2?.capture_health.completeness ?? "Unknown",
            summary2?.route_verdict.verdict ?? "Unknown",
            !actions.active()
          ),
          i18n.duration(i18n.enum(duration)),
          i18n.enum(summary2?.network_verdict ?? "Unknown")
        ];
        return { safe: safe2, summary: summary2, values };
      };
      const strict = presentation(selected), { safe, summary } = strict;
      const display = displayConversation(snapshots, context, manual), shown = display.snapshot === selected ? strict : presentation(display.snapshot);
      const displayHelp = !display.snapshot ? i18n.t(
        "No conversation evidence yet. Send a new message to inspect it. Click the capsule to open the panel."
      ) : display.source === "recent" ? i18n.t(
        "Showing a recent conversation summary. Export ZIP uses Current capture above; export older rounds from History."
      ) : "";
      open.dataset.duration = String(shown.values[5]);
      open.dataset.captureHealth = String(shown.values[4]);
      layers.update(
        shown.values,
        shown.safe,
        shown.summary,
        snapshots.filter(
          (s) => s.start.context.document_id === context.document_id && s.start.context.epoch === (display.snapshot?.start.context.epoch ?? context.epoch) && ["environment", "network", "requirements"].includes(s.start.mode)
        ),
        `${!selected ? i18n.t("No capture in current scope") + " \xB7 " : ""}${display.source === "recent" ? i18n.t("Recent meaningful conversation") + " #" + display.snapshot.start.capture_id.slice(0, 8) + " \xB7 " : ""}${displayHelp}`
      );
      const route = shown.summary?.route_verdict.verdict ?? "Unknown";
      const facts = launcherFacts(shown.safe);
      const fullModel = facts.modelSource === "Unknown" ? i18n.enum("Unknown") : facts.model;
      const model = fullModel.replace(/^gpt-/, "");
      const launcherText = `${facts.abnormal ? "\u26A0" : "\u25CF"} ${!actions.active() ? i18n.enum("Paused") : facts.abnormal ? i18n.enum(facts.status) : i18n.enum(route)} \xB7 ${model} \xB7 ${shown.values[3]} \xB7 ${shown.values[5]}`;
      if (open.textContent !== launcherText) open.textContent = launcherText;
      const launcherTitle = `${displayHelp ? displayHelp + " / " : ""}${display.source === "recent" ? i18n.t("Recent meaningful conversation") : i18n.t("Current capture")} #${display.snapshot?.start.capture_id ?? "\u2014"} / ${JSON.stringify(display.snapshot?.start.context ?? context)} / ${facts.modelSource}: ${fullModel} / ${i18n.t("Thinking Effort")}: ${shown.values[3]} / ${i18n.t("Network Status")}: ${shown.values[6]}`;
      if (open.title !== launcherTitle) {
        open.title = launcherTitle;
        open.setAttribute("aria-description", launcherTitle);
      }
      open.dataset.displaySource = display.source;
      open.dataset.captureId = display.snapshot?.start.capture_id ?? "";
      open.dataset.modelSource = facts.modelSource;
      open.dataset.tone = !actions.active() ? "unknown" : route.includes("Mismatch") || route.includes("Conflict") || shown.summary && shown.summary.network_verdict !== "OK" && shown.summary.network_verdict !== "Unknown" ? "error" : route === "Route Match" ? "match" : "unknown";
      position.refresh();
      mainPosition.refresh();
      workPosition.refresh();
      if (panel.hidden) return;
      for (const b of navigation.querySelectorAll("button[data-category]"))
        b.setAttribute(
          "aria-current",
          b.getAttribute("data-category") === category.value ? "page" : "false"
        );
      importControls.hidden = !["Experiment", "Compare"].includes(category.value);
      if (category.value === "History" && (historyView || historyReading)) return;
      const viewKey = JSON.stringify([
        scope,
        selected?.start.capture_id,
        category.value,
        pageIndex,
        i18n.locale,
        historyGeneration
      ]);
      const changedView = structuralKey !== viewKey;
      if (changedView) section.replaceChildren();
      structuralKey = viewKey;
      const draft = category.value === "History" ? section : doc.createElement("div");
      contentTarget = draft;
      try {
        const verdictBadge = doc.createElement("strong");
        verdictBadge.className = "badge";
        verdictBadge.textContent = `${i18n.t("Route verdict")}: ${i18n.enum(summary?.route_verdict.verdict ?? "Unknown")} \xB7 ${i18n.enum(summary?.capture_health.completeness ?? "Unknown")}`;
        contentTarget.append(verdictBadge);
        if (category.value === "Advanced settings") {
          settings.hidden = false;
          contentTarget.append(changedView ? settings : settings.cloneNode(true));
          return;
        }
        if (category.value === "Experiment") {
          contentTarget.append(
            changedView ? experimentForm : experimentForm.cloneNode(true)
          );
          return;
        }
        if (category.value === "Compare") {
          contentTarget.append(
            changedView ? compareControls : compareControls.cloneNode(true)
          );
          if (imported.length === 2) {
            text(
              compareBundles(imported[0], imported[1], {
                ratio: Number(threshold.value),
                absolute_ms: Number(absolute.value)
              })
            );
            text(baseline(pairs));
          } else
            text(
              "Import two local evidence ZIPs. Explicit UUID/task/replicate required; display IDs do not pair runs."
            );
          return;
        }
        if (category.value === "History") {
          if (!historyReading) {
            historyReading = true;
            const generation = historyGeneration;
            guard(async () => {
              try {
                const view = await recoverHistoryView(
                  () => actions.flush(),
                  () => history.list(),
                  historyOperation
                );
                if (category.value === "History" && generation === historyGeneration && !panel.hidden) {
                  historyView = view;
                  section.replaceChildren();
                  for (const r of view.rows) {
                    const line = doc.createElement("div");
                    const caption = doc.createElement("span");
                    bind(() => {
                      caption.textContent = `${r.manifest.capture_id.slice(0, 8)} ${i18n.enum(r.completeness)} ${r.read_only ? i18n.enum("read-only") : ""} ${r.notes.join(",")}`;
                    }, true);
                    line.append(caption);
                    button(
                      "Export history " + r.manifest.capture_id.slice(0, 8),
                      line,
                      () => guard(async () => {
                        const result2 = await exportHistoryRecord(
                          view,
                          r,
                          (bytes) => download(bytes, "blackbox-history.zip"),
                          historyOperation,
                          () => {
                            const active = actions.context();
                            return view === historyView && generation === historyGeneration && active.document_id === context.document_id && active.visit_id === context.visit_id && active.epoch === context.epoch;
                          }
                        );
                        if (!result2) {
                          notice(
                            "History export failed. Check operation health."
                          );
                          return;
                        }
                        if (!result2.related_available) {
                          const relatedNotice = doc.createElement("span");
                          labelText(
                            relatedNotice,
                            " Related context unavailable; exported evidence remains conversation-only.",
                            true
                          );
                          line.append(relatedNotice);
                        }
                      }),
                      true
                    );
                    section.append(line);
                  }
                  historyOperation.mark("rows_rendered", {
                    conversation_rows: view.rows.length
                  });
                  historyOperation.success();
                }
              } finally {
                if (generation === historyGeneration) historyReading = false;
              }
            });
          }
          return;
        }
        if (category.value === "Capture Health / Storage") {
          text({
            health: summary?.capture_health ?? null,
            controls: safe?.controls ?? [],
            storage: history.health,
            ui_style: styleHealth,
            ui_operation: historyOperation.snapshot,
            diagnostics: actions.captureStatus?.()
          });
          return;
        }
        if (category.value === "Redaction preview") {
          const revision = JSON.stringify([
            viewKey,
            safe?.events.length,
            safe?.controls.length
          ]);
          if (!changedView && redactionRevision === revision) {
            for (const node of [...section.childNodes].slice(1))
              contentTarget.append(node.cloneNode(true));
            return;
          }
          redactionRevision = revision;
          if (selected)
            guard(async () => {
              const r = await actions.export(selected.start.capture_id);
              if (category.value === "Redaction preview" && structuralKey === viewKey) {
                const result2 = doc.createElement("div");
                result2.append(section.firstChild.cloneNode(true));
                contentTarget = result2;
                try {
                  text(r.preview);
                } finally {
                  contentTarget = section;
                }
                reconcileChildren(section, [...result2.childNodes]);
              }
            });
          return;
        }
        if (!safe) {
          text("Unknown: no bound capture in this visit.");
          return;
        }
        const related = snapshots.filter(
          (s) => s.start.context.document_id === context.document_id && s.start.context.epoch === context.epoch && ["environment", "network", "requirements"].includes(s.start.mode)
        ).flatMap((s) => safeSnapshot(s).events);
        const all = [...safe.events, ...related];
        let shown2 = all;
        if (category.value === "A/B/C/D")
          shown2 = all.filter((e) => ["A", "B", "C", "D"].includes(e.level));
        if (category.value === "Environment / Frontend Build")
          shown2 = all.filter(
            (e) => e.level === "E" && !e.field_namespace.startsWith("pow")
          );
        if (category.value === "Network / Cloudflare / PoW / IP")
          shown2 = all.filter(
            (e) => e.level === "N" || e.field_namespace.startsWith("pow") || e.field === "client_ip"
          );
        if (category.value === "Transport / Timing") {
          text({
            transport: safe.start.transport,
            timing: summary.timing,
            controls: safe.controls
          });
          shown2 = all.filter(
            (e) => e.transport === "websocket" || e.field_namespace.startsWith("network.web") || e.field_namespace === "timing"
          );
        }
        const rows = timelinePage({ ...safe, events: shown2 }, pageIndex);
        pageIndex = rows.page;
        text({ page: rows.page + 1, pages: rows.pages, total: rows.total });
        for (const e of rows.events) {
          const row = doc.createElement("article");
          row.className = "timeline-row";
          row.dataset.eventId = e.event_id;
          const caption = doc.createElement("div");
          caption.textContent = `${((e.monotonic_ms - safe.start.started_at) / 1e3).toFixed(3)}s \xB7 ${e.level} \xB7 ${i18n.t(e.field)} \xB7 ${typeof e.value === "object" ? i18n.t("Details") : String(e.value).slice(0, 100)}`;
          const detail = doc.createElement("details"), rawLabel = doc.createElement("summary"), raw = doc.createElement("pre");
          rawLabel.textContent = i18n.t("Raw fields");
          raw.textContent = JSON.stringify(
            i18n.display({
              level: e.level,
              index: e.event_index,
              field: `${e.field_namespace}.${e.field}`,
              value: e.value,
              old_value: e.old_value,
              new_value: e.new_value,
              scope: e.task_scope,
              source: e.source_path,
              transport: e.transport,
              channel: e.channel,
              observed: e.timestamp,
              availability: e.availability ?? e.value_state,
              association: e.association,
              late: e.late_metadata,
              revision: e.revision
            })
          ).slice(0, 2048);
          detail.append(rawLabel, raw);
          row.append(caption, detail);
          contentTarget.append(row);
        }
      } finally {
        contentTarget = section;
        if (draft !== section) reconcileChildren(section, [...draft.childNodes]);
      }
    }
    shell.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && (!panel.hidden || !layers.quick.hidden)) {
        e.stopPropagation();
        close();
      }
    });
    const mount = () => {
      if (doc.documentElement && !host.isConnected)
        doc.documentElement.append(host);
      render();
    };
    if (doc.documentElement) mount();
    else doc.addEventListener("DOMContentLoaded", mount, { once: true });
    const unsubscribeLocale = i18n.subscribe(() => {
      shadow.host.setAttribute("lang", i18n.locale);
      for (const update of [...bindings, ...historyBindings]) update();
      language.value = i18n.locale;
      notice(currentNotice);
      render();
    });
    host.setAttribute("lang", i18n.locale);
    const timer = setInterval(render, 1e3);
    return {
      host,
      shadow,
      i18n,
      styleHealth,
      position,
      layers,
      get operationHealth() {
        return historyOperation.snapshot;
      },
      show: () => {
        hidden = false;
        layers.close();
        restore.hidden = true;
        render();
      },
      render,
      dispose: () => {
        unsubscribeLocale();
        bindings.clear();
        historyBindings.clear();
        clearInterval(timer);
        position.dispose();
        mainPosition.dispose();
        workPosition.dispose();
        mainScale.dispose();
        workScale.dispose();
        themeObserver.disconnect();
        media.removeEventListener("change", theme);
        layers.dispose();
        host.remove();
      },
      get selected() {
        return selected?.start.capture_id ?? null;
      }
    };
  }

  // src/host/endpoints.ts
  function endpoint(raw, method, origin, allowed) {
    try {
      const url = new URL(raw, origin);
      if (url.origin !== origin || !allowed.includes(origin)) return null;
      const path = url.pathname.replace(/\/$/, "");
      if (method === "POST" && [
        "/backend-api/sentinel/chat-requirements",
        "/backend-anon/sentinel/chat-requirements",
        "/api/sentinel/chat-requirements",
        "/backend-api/sentinel/chat-requirements/prepare",
        "/backend-anon/sentinel/chat-requirements/prepare",
        "/api/sentinel/chat-requirements/prepare"
      ].includes(path))
        return {
          mode: "requirements",
          conversation_id: null,
          endpoint_path: path
        };
      if (method === "POST" && [
        "/backend-api/conversation",
        "/backend-api/f/conversation",
        "/backend-api/f/conversations"
      ].includes(url.pathname)) {
        return { mode: "live", conversation_id: null };
      }
      const record2 = /^\/backend-api\/conversations?\/([^/]+)$/.exec(
        url.pathname
      );
      if (method === "GET" && record2?.[1] && record2[1] !== "init" && !["cursor", "offset", "before", "after"].some(
        (k) => url.searchParams.has(k)
      )) {
        return {
          mode: "reload",
          conversation_id: decodeURIComponent(record2[1])
        };
      }
    } catch {
    }
    return null;
  }

  // src/host/capture.ts
  var instances = /* @__PURE__ */ new WeakMap();
  var CaptureHost = class {
    constructor(page, options = {}) {
      this.page = page;
      this.allowed = options.allowedOrigins ?? [
        "https://chatgpt.com",
        "https://chat.openai.com"
      ];
      this.sink = options.sink ?? {};
      this.now = options.now ?? (() => page.performance.now());
      this.wall = options.wall ?? (() => (/* @__PURE__ */ new Date()).toISOString());
      this.uuid = options.uuid ?? (() => page.crypto.randomUUID());
      this.context = {
        document_id: this.uuid(),
        visit_id: this.uuid(),
        epoch: 0
      };
    }
    page;
    health = {};
    events = [];
    readyTimes = {};
    context;
    active = true;
    disposed = false;
    minimumEpoch = 0;
    cleanup = /* @__PURE__ */ new Set();
    checks = [];
    allowed;
    sink;
    now;
    wall;
    uuid;
    safe(fn) {
      try {
        fn();
      } catch {
        this.health.observer = "Failed";
      }
    }
    emit(kind, transport, capture, extra = {}) {
      if (!this.active || this.disposed || capture && capture.context.epoch < this.minimumEpoch)
        return;
      this.safe(() => {
        const event = {
          ...capture?.context ?? this.context,
          kind,
          transport,
          capture_id: capture?.capture_id ?? null,
          timestamp: this.wall(),
          monotonic_ms: this.now(),
          ...extra
        };
        if (this.events.length === 512) {
          this.events.shift();
          this.health.diagnostics = "Partial";
        }
        this.events.push(Object.freeze(event));
        this.sink.event?.(event);
      });
    }
    start(raw, method, transport) {
      if (!this.active || this.disposed) return null;
      const match = endpoint(
        raw,
        method,
        this.page.location.origin,
        this.allowed
      );
      if (!match) return null;
      return this.begin(match, transport);
    }
    begin(match, transport) {
      if (!this.active || this.disposed) return null;
      return {
        capture_id: this.uuid(),
        context: { ...this.context },
        ...match,
        transport,
        started_at: this.now()
      };
    }
    replace(target, key, wrapper, transport) {
      const original = target[key];
      try {
        target[key] = wrapper;
        if (target[key] !== wrapper) throw new Error("unavailable");
        this.health[transport] = "Available";
        this.readyTimes[transport] = this.now();
        this.cleanup.add(() => {
          if (target[key] === wrapper) target[key] = original;
        });
        let reported = false;
        this.checks.push(() => {
          if (target[key] !== wrapper && !reported) {
            reported = true;
            this.health[transport] = "Partial";
            this.emit("hook_replaced", transport);
          }
        });
      } catch {
        this.health[transport] = "Unavailable";
      }
    }
    install() {
      this.installFetch();
      this.installXhr();
      this.installWebSocket();
      this.installEventSource();
      this.installLifecycle();
      return this;
    }
    installFetch() {
      const original = this.page.fetch;
      if (typeof original !== "function") {
        this.health.fetch = "Unavailable";
        return;
      }
      const host = this;
      const wrapper = function(...args) {
        const [input, init] = args;
        let capture = null;
        let requestClone;
        host.safe(() => {
          const raw = typeof input === "string" ? input : input instanceof host.page.URL ? input.href : input.url;
          const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
          capture = host.start(raw, method, "fetch");
          if (capture && host.page.Request && input instanceof host.page.Request && init?.body === void 0 && host.sink.request)
            requestClone = input.clone();
        });
        let promise;
        try {
          promise = Reflect.apply(original, this, args);
        } catch (error) {
          if (capture) host.emit("request_throw", "fetch", capture);
          throw error;
        }
        const started = capture;
        if (started) {
          host.emit("request_start", "fetch", started);
          host.safe(
            () => host.sink.request?.(started, input, init, requestClone)
          );
          void promise.then(
            (response) => {
              if (!host.active || host.disposed || started.context.epoch < host.minimumEpoch)
                return;
              host.emit("response_visible", "fetch", started);
              if (!host.sink.response) return;
              host.safe(() => {
                const clone = response.clone();
                host.page.queueMicrotask(() => {
                  if (host.active && !host.disposed && started.context.epoch >= host.minimumEpoch)
                    host.safe(() => host.sink.response?.(started, clone));
                  else void clone.body?.cancel().catch(() => {
                  });
                });
              });
            },
            (error) => host.safe(
              () => host.emit("request_rejected", "fetch", started, {
                failure_kind: init?.signal?.aborted || host.page.Request && input instanceof host.page.Request && input.signal.aborted || (error instanceof host.page.Error || error instanceof host.page.DOMException) && error.name === "AbortError" ? "abort" : "generic"
              })
            )
          );
        }
        return promise;
      };
      this.replace(this.page, "fetch", wrapper, "fetch");
    }
    installXhr() {
      const ctor = this.page.XMLHttpRequest;
      if (!ctor) {
        this.health.xhr = "Unavailable";
        return;
      }
      const host = this;
      const proto = ctor.prototype;
      const originalOpen = proto.open;
      const originalSend = proto.send;
      const contexts = /* @__PURE__ */ new WeakMap();
      const watched = /* @__PURE__ */ new WeakSet();
      const open = function(...args) {
        const result2 = Reflect.apply(originalOpen, this, args);
        contexts.set(this, {
          match: endpoint(
            String(args[1]),
            String(args[0]).toUpperCase(),
            host.page.location.origin,
            host.allowed
          ),
          capture: null
        });
        return result2;
      };
      const send = function(body) {
        const ctx = contexts.get(this);
        if (ctx)
          host.safe(() => {
            ctx.capture = ctx.match ? host.begin(ctx.match, "xhr") : null;
          });
        const capture = ctx?.capture;
        if (capture && !watched.has(this)) {
          watched.add(this);
          const releases = [];
          for (const kind of [
            "loadstart",
            "readystatechange",
            "progress",
            "load",
            "error",
            "abort",
            "timeout",
            "loadend"
          ]) {
            const listener = () => {
              const current = contexts.get(this)?.capture;
              if (current && host.active && !host.disposed && current.context.epoch >= host.minimumEpoch) {
                host.emit(kind, "xhr", current);
                host.safe(() => host.sink.xhr?.(current, this, kind));
              }
              if (kind === "loadend") {
                for (const release2 of releases) release2();
                watched.delete(this);
              }
            };
            this.addEventListener(kind, listener);
            const release = () => {
              this.removeEventListener(kind, listener);
              host.cleanup.delete(release);
            };
            releases.push(release);
            host.cleanup.add(release);
          }
        }
        if (capture) {
          host.emit("request_start", "xhr", capture);
          host.safe(() => host.sink.request?.(capture, body ?? null));
        }
        return Reflect.apply(originalSend, this, [body]);
      };
      this.replace(proto, "open", open, "xhr");
      this.replace(proto, "send", send, "xhr");
    }
    allowedSocket(raw) {
      try {
        const url = new this.page.URL(raw, this.page.location.href);
        return this.allowed.some(
          (origin) => new URL(origin).hostname === url.hostname
        ) && ["wss:", "ws:"].includes(url.protocol);
      } catch {
        return false;
      }
    }
    installWebSocket() {
      const Native = this.page.WebSocket;
      if (!Native) {
        this.health.websocket = "Unavailable";
        return;
      }
      const host = this;
      const wrapper = new Proxy(Native, {
        construct(target, args, newTarget) {
          const socket = Reflect.construct(
            target,
            args,
            newTarget === wrapper ? target : newTarget
          );
          host.safe(() => {
            if (!host.active || !host.allowedSocket(socket.url)) return;
            const socketId = host.uuid();
            const context = { ...host.context };
            const releases = [];
            for (const kind of ["open", "message", "close", "error"]) {
              const listener = (event) => {
                if (kind === "close") for (const release2 of releases) release2();
                if (!host.active || host.disposed || context.epoch < host.minimumEpoch)
                  return;
                const extra = {};
                if (kind === "message") {
                  const data = event.data;
                  extra.data_type = typeof data === "string" ? "string" : data instanceof host.page.Blob ? "Blob" : data instanceof host.page.ArrayBuffer ? "ArrayBuffer" : "unsupported";
                  extra.size = typeof data === "string" ? new host.page.TextEncoder().encode(data).byteLength : data instanceof host.page.Blob ? data.size : data instanceof host.page.ArrayBuffer ? data.byteLength : 0;
                }
                if (kind === "close") extra.code = event.code;
                host.emit(kind, "websocket", void 0, extra);
                host.safe(
                  () => host.sink.socket?.(socketId, socket, kind, event, context)
                );
              };
              socket.addEventListener(kind, listener);
              const release = () => {
                socket.removeEventListener(kind, listener);
                host.cleanup.delete(release);
              };
              releases.push(release);
              host.cleanup.add(release);
            }
          });
          return socket;
        }
      });
      this.replace(this.page, "WebSocket", wrapper, "websocket");
    }
    installEventSource() {
      const Native = this.page.EventSource;
      if (!Native) {
        this.health.eventsource = "Unavailable";
        return;
      }
      const host = this;
      const wrapper = new Proxy(Native, {
        construct(target, args, newTarget) {
          const source = Reflect.construct(
            target,
            args,
            newTarget === wrapper ? target : newTarget
          );
          host.safe(() => {
            const url = new URL(source.url, host.page.location.href);
            if (url.origin !== host.page.location.origin) return;
            for (const kind of ["open", "message", "error"]) {
              const listener = () => host.emit(kind, "eventsource");
              source.addEventListener(kind, listener);
              host.cleanup.add(() => source.removeEventListener(kind, listener));
            }
            host.health.eventsource = "Partial";
          });
          return source;
        }
      });
      this.replace(this.page, "EventSource", wrapper, "eventsource");
    }
    installLifecycle() {
      for (const key of ["pushState", "replaceState"]) {
        const original = this.page.history[key];
        const host = this;
        const wrapper = function(...args) {
          const result2 = Reflect.apply(original, this, args);
          host.newVisit(key);
          return result2;
        };
        this.replace(this.page.history, key, wrapper, "lifecycle");
      }
      for (const kind of ["popstate", "pageshow"]) {
        const listener = (event) => {
          if (kind === "popstate" || event.persisted)
            this.newVisit(kind);
          this.checkHooks();
        };
        this.page.addEventListener(kind, listener);
        this.cleanup.add(() => this.page.removeEventListener(kind, listener));
      }
    }
    newVisit(reason) {
      if (this.disposed) return;
      this.context = {
        ...this.context,
        visit_id: this.uuid(),
        epoch: this.context.epoch + 1
      };
      this.emit(reason, "lifecycle");
      this.safe(() => this.sink.reset?.({ ...this.context }, reason));
      this.checkHooks();
    }
    checkHooks() {
      for (const check of this.checks) this.safe(check);
    }
    pause() {
      this.active = false;
      this.context = { ...this.context, epoch: this.context.epoch + 1 };
      this.minimumEpoch = this.context.epoch;
      this.safe(() => this.sink.reset?.({ ...this.context }, "pause"));
    }
    resume() {
      if (!this.disposed) {
        this.active = true;
        this.newVisit("resume");
      }
    }
    clear() {
      this.events.length = 0;
      this.newVisit("clear");
      this.minimumEpoch = this.context.epoch;
    }
    dispose() {
      if (this.disposed) return;
      this.pause();
      this.disposed = true;
      for (const cleanup of [...this.cleanup].reverse()) this.safe(cleanup);
      this.cleanup.clear();
      this.checks.length = 0;
      instances.delete(this.page);
    }
  };
  function installHost(page, options = {}) {
    const previous = instances.get(page);
    if (previous) return previous;
    const host = new CaptureHost(page, options).install();
    instances.set(page, host);
    return host;
  }

  // src/host/request.ts
  function projectRequest(body) {
    if (typeof body !== "string" || body.length > 1024 * 1024) return {};
    try {
      const value2 = JSON.parse(body);
      if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) return {};
      const result2 = {};
      for (const key of [
        "model",
        "thinking_effort",
        "requested_model_experience"
      ]) {
        const item = value2[key];
        if (typeof item === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(item))
          result2[key] = item;
      }
      return result2;
    } catch {
      return {};
    }
  }

  // src/adapters/sse.ts
  var Sse = class {
    constructor(accept, error, limit = 1024 * 1024) {
      this.accept = accept;
      this.error = error;
      this.limit = limit;
    }
    accept;
    error;
    limit;
    decoder = new TextDecoder("utf-8", { fatal: true });
    line = "";
    data = [];
    name = "";
    id = null;
    retry = null;
    skipLf = false;
    first = true;
    bytes = 0;
    index = 0;
    dropping = false;
    counts = { envelopes: 0, malformed: 0, dropped: 0 };
    get pending() {
      return this.line.length > 0 || this.data.length > 0 || this.dropping;
    }
    push(bytes) {
      try {
        this.text(this.decoder.decode(bytes, { stream: true }));
      } catch {
        this.counts.malformed++;
        this.error("invalid_utf8");
      }
    }
    text(text) {
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
    readLine() {
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
            index: ++this.index
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
      let value2 = colon < 0 ? "" : line.slice(colon + 1);
      if (value2.startsWith(" ")) value2 = value2.slice(1);
      if (key === "data") this.data.push(value2);
      else if (key === "event")
        this.name = value2.length <= 128 ? value2 : "unsupported";
      else if (key === "id" && !value2.includes("\0"))
        this.id = /^[a-zA-Z0-9_.:-]{0,128}$/.test(value2) ? value2 : null;
      else if (key === "retry" && /^\d+$/.test(value2) && Number.isSafeInteger(Number(value2)))
        this.retry = Number(value2);
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
  };

  // src/adapters/protocol.ts
  var keys = /* @__PURE__ */ new Set([
    "message",
    "metadata",
    "server_ste_metadata",
    "author",
    "role",
    "type",
    "id",
    "parent_id",
    "parent",
    "conversation_id",
    "request_id",
    "input_message_id",
    "topic_id",
    "model_slug",
    "resolved_model_slug",
    "thinking_effort",
    "fast_convo",
    "requested_model_experience",
    "task_scope"
  ]);
  function metadataOnly(value2, depth = 0, budget = { nodes: 0 }) {
    if (depth > 16 || ++budget.nodes > 4096)
      throw new Error("metadata_depth_limit");
    if (value2 === null || typeof value2 === "boolean" || typeof value2 === "number")
      return value2;
    if (typeof value2 === "string") return identifier(value2) ?? void 0;
    if (Array.isArray(value2)) {
      if (value2.length > 128) throw new Error("metadata_array_limit");
      return value2.map((v) => metadataOnly(v, depth + 1, budget));
    }
    const object = record(value2);
    if (!object) return void 0;
    const result2 = /* @__PURE__ */ Object.create(null);
    for (const [key, item] of Object.entries(object))
      if (keys.has(key)) {
        const clean = metadataOnly(item, depth + 1, budget);
        if (clean !== void 0) result2[key] = clean;
      }
    return result2;
  }
  var Protocol = class {
    constructor(source, sink) {
      this.source = source;
      this.sink = sink;
      this.sse = new Sse(
        (e) => this.envelope(e),
        (code) => sink.error(code)
      );
    }
    source;
    sink;
    sse;
    encoding = "legacy";
    channel = "0";
    channels = /* @__PURE__ */ new Map();
    text(text) {
      this.sse.text(text);
    }
    push(bytes) {
      this.sse.push(bytes);
    }
    finish() {
      this.sse.finish();
    }
    json(value2, envelope = {
      data: "",
      event: "json",
      id: null,
      retry: null,
      index: 0
    }) {
      const root = record(value2);
      if (!root || root.type !== void 0 && ![
        "server_ste_metadata",
        "message",
        "response_metadata",
        "stream_handoff",
        "subscribe_ws_topic",
        "stream_resume",
        "reconnect",
        "completed",
        "response_completed"
      ].includes(String(root.type)) || ![
        "type",
        "message",
        "resolved_model_slug",
        "request_id",
        "conversation_id",
        "input_message_id"
      ].some((key) => Object.hasOwn(root, key))) {
        this.sink.error("unsupported_json_envelope");
        return;
      }
      this.sink.identity(value2, "0");
      if (root?.type === "stream_handoff" || root?.type === "subscribe_ws_topic")
        this.sink.control("handoff", value2);
      if (root?.type === "stream_resume" || root?.type === "reconnect")
        this.sink.control("reconnect", value2);
      if (root?.type === "completed" || root?.type === "response_completed")
        this.sink.control("done", value2);
      if (record(record(root?.message)?.author)?.role === "assistant" && record(root?.message)?.content !== void 0)
        this.sink.control("content", null);
      this.sink.evidence(responseEvidence(value2, this.source()), {
        envelope,
        channel: "0",
        op: null,
        path: "",
        explicit: { c: false, p: false, o: false }
      });
    }
    envelope(envelope) {
      if (envelope.data === "[DONE]") {
        if (this.encoding !== "unsupported") this.sink.control("done", null);
        return;
      }
      let value2;
      try {
        value2 = JSON.parse(envelope.data);
      } catch {
        this.sink.error("malformed_json");
        return;
      }
      if (envelope.event === "delta_encoding") {
        this.encoding = value2 === "v1" ? "v1" : "unsupported";
        this.channels.clear();
        this.channel = "0";
        if (this.encoding === "unsupported")
          this.sink.error("unsupported_delta_encoding");
        return;
      }
      if (this.encoding === "unsupported") {
        this.sink.error("unsupported_delta_payload");
        return;
      }
      const object = record(value2);
      if (envelope.event === "delta" && object && ["c", "p", "o", "v"].some((k) => Object.hasOwn(object, k))) {
        if (this.encoding !== "v1") {
          this.sink.error("delta_without_version");
          return;
        }
        try {
          this.delta(object, envelope);
        } catch (error) {
          this.sink.error(
            error instanceof Error && /^\w+$/.test(error.message) ? error.message : "invalid_delta"
          );
        }
        return;
      }
      if (envelope.event === "delta" && this.encoding === "v1") {
        this.sink.error("invalid_delta");
        return;
      }
      this.json(value2, envelope);
    }
    delta(item, envelope) {
      const c = Object.hasOwn(item, "c") ? item.c : Number(this.channel);
      if (typeof c !== "number" || !Number.isSafeInteger(c) || c < 0)
        throw new Error("invalid_channel");
      const channel = String(c);
      let state = this.channels.get(channel);
      if (!state) {
        if (this.channels.size >= 32) throw new Error("channel_limit");
        state = { tree: void 0, path: "", op: "add" };
        this.channels.set(channel, state);
      }
      const path = Object.hasOwn(item, "p") ? item.p : state.path;
      const op = Object.hasOwn(item, "o") ? item.o : state.op;
      if (typeof path !== "string" || typeof op !== "string")
        throw new Error("invalid_delta");
      const observation = {
        envelope,
        channel,
        op,
        path,
        explicit: {
          c: Object.hasOwn(item, "c"),
          p: Object.hasOwn(item, "p"),
          o: Object.hasOwn(item, "o")
        }
      };
      this.channel = channel;
      state.path = path;
      state.op = op;
      const budget = { ops: 0 };
      this.apply(state, path, op, item.v, observation, budget);
    }
    apply(state, path, op, value2, observation, budget, depth = 0) {
      if (++budget.ops > 512 || depth > 16) throw new Error("patch_limit");
      if (!["add", "replace", "append", "remove", "truncate", "patch"].includes(
        op
      ) || path.length > 512 || path !== "" && !path.startsWith("/"))
        throw new Error("invalid_delta");
      const tokens = path === "" ? [] : path.slice(1).split("/").map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
      if (tokens.length > 16) throw new Error("metadata_depth_limit");
      if (tokens.some((t) => ["__proto__", "prototype", "constructor"].includes(t)))
        throw new Error("dangerous_delta_path");
      if (tokens.some(
        (t) => ["content", "parts", "text", "reasoning", "output", "input"].includes(
          t
        )
      )) {
        this.sink.control("content", null);
        return;
      }
      if (tokens.some(
        (t) => !keys.has(t) && t !== "-" && !/^(0|[1-9]\d{0,2})$/.test(t)
      )) {
        this.sink.error("unsupported_delta_path");
        return;
      }
      if (op === "patch") {
        if (!Array.isArray(value2) || value2.length > 512)
          throw new Error("patch_limit");
        for (const raw of value2) {
          const item = record(raw);
          if (!item || typeof item.o !== "string" || item.p !== void 0 && typeof item.p !== "string")
            throw new Error("invalid_patch");
          this.apply(
            state,
            `${path}${item.p ?? ""}`,
            item.o,
            item.v,
            { ...observation, op: item.o, path: `${path}${item.p ?? ""}` },
            budget,
            depth + 1
          );
        }
        return;
      }
      const source = { ...this.source(), channel: observation.channel };
      const before = responseEvidence(state.tree, source);
      const box = { root: state.tree };
      let parent = box;
      let key = "root";
      for (const token of tokens) {
        let next = parent[key];
        if (next === void 0) {
          next = /* @__PURE__ */ Object.create(null);
          parent[key] = next;
        }
        const nextRecord = Array.isArray(next) ? next : record(next);
        if (!nextRecord) throw new Error("invalid_delta_target");
        parent = nextRecord;
        key = token === "-" && Array.isArray(parent) ? String(parent.length) : token;
        if (Array.isArray(parent) && (!/^\d+$/.test(key) || Number(key) > parent.length || Number(key) >= 128))
          throw new Error("invalid_array_index");
      }
      const previous = parent[key];
      if (op === "remove") {
        if (!Object.hasOwn(parent, key)) throw new Error("invalid_remove");
        if (Array.isArray(parent)) parent.splice(Number(key), 1);
        else delete parent[key];
      } else if (op === "truncate") {
        if (!Number.isSafeInteger(value2) || Number(value2) < 0 || typeof previous !== "string" && !Array.isArray(previous))
          throw new Error("invalid_truncate");
        parent[key] = previous.slice(0, Number(value2));
      } else {
        const next = metadataOnly(value2);
        if (op === "append") {
          if (typeof previous === "string" && typeof next === "string") {
            if (previous.length + next.length > 128)
              throw new Error("metadata_string_limit");
            parent[key] = previous + next;
          } else if (Array.isArray(previous)) {
            const items = Array.isArray(next) ? next : [next];
            if (previous.length + items.length > 128)
              throw new Error("metadata_array_limit");
            previous.push(...items);
          } else if (record(previous) && record(next))
            Object.assign(record(previous), record(next));
          else throw new Error("invalid_append");
        } else {
          if (op === "replace" && tokens.length && !Object.hasOwn(parent, key))
            throw new Error("invalid_replace");
          if (op === "add" && Array.isArray(parent)) {
            if (parent.length >= 128) throw new Error("metadata_array_limit");
            parent.splice(Number(key), 0, next);
          } else parent[key] = next;
        }
      }
      state.tree = box.root;
      if ((JSON.stringify(state.tree)?.length ?? 0) > 65536)
        throw new Error("metadata_tree_limit");
      this.sink.identity(state.tree, observation.channel);
      const after = responseEvidence(state.tree, {
        ...source,
        ...this.source(),
        channel: observation.channel
      });
      const touched = (e) => path === "" || e.source_path === path || e.source_path.startsWith(`${path}/`);
      const output = after.filter(touched);
      for (const old of before.filter(touched))
        if (!after.some((e) => e.source_path === old.source_path))
          output.push({ ...old, value: null, value_state: "removed" });
      this.sink.evidence(output, { ...observation, path, op });
    }
  };

  // src/adapters/monitor.ts
  var Monitor = class {
    constructor(now = () => performance.now(), wall = () => (/* @__PURE__ */ new Date()).toISOString()) {
      this.now = now;
      this.wall = wall;
      this.journal = new Journal(now, wall);
    }
    now;
    wall;
    journal;
    diagnostics = [];
    counters = {
      ws_message_events: 0,
      malformed: 0,
      dropped: 0,
      unsupported: 0,
      quarantine: 0,
      content_fragments: 0
    };
    captures = /* @__PURE__ */ new Map();
    readers = /* @__PURE__ */ new Map();
    xhrs = /* @__PURE__ */ new WeakMap();
    socketQueues = /* @__PURE__ */ new Map();
    socketParsers = /* @__PURE__ */ new Map();
    parserOwners = /* @__PURE__ */ new Map();
    evicted = /* @__PURE__ */ new Map();
    topicSockets = /* @__PURE__ */ new Map();
    generation = 0;
    arrivals = /* @__PURE__ */ new Map();
    timers = /* @__PURE__ */ new Map();
    complete(id2, code = "protocol_done") {
      this.journal.complete(id2, code);
      if (!this.timers.has(id2)) {
        const generation = this.generation;
        this.timers.set(
          id2,
          setTimeout(() => {
            if (generation === this.generation) this.journal.tick(id2);
            this.timers.delete(id2);
          }, 3e4)
        );
      }
    }
    diagnostic(code, capture = null, socket = null) {
      const found = this.diagnostics.find(
        (d) => d.code === code && d.capture_id === capture && d.socket_id === socket
      );
      if (found) found.count++;
      else if (this.diagnostics.length < 512)
        this.diagnostics.push({
          code,
          count: 1,
          capture_id: capture,
          socket_id: socket
        });
      else this.counters.dropped++;
      if (code.includes("malformed") || code.includes("invalid"))
        this.counters.malformed++;
      if (code.includes("unsupported")) this.counters.unsupported++;
      if (code.includes("limit") || code.includes("dropped"))
        this.counters.dropped++;
      if (code.includes("quarantine") || code.includes("contradiction") || code.includes("ambiguous"))
        this.counters.quarantine++;
      if (capture) this.journal.health(capture, "Partial", code);
      else if (socket && !["ws_open", "ws_close", "ws_error"].includes(code)) {
        for (const identity of this.captures.values())
          if (identity.valid && [...identity.topics].some((t) => this.topicSockets.get(t) === socket))
            this.journal.health(identity.capture.capture_id, "Partial", code);
      }
    }
    source(identity, transport, segment, channel = "0") {
      return {
        capture_id: identity.capture.capture_id,
        task_scope: "answer",
        message_id: identity.message,
        transport,
        direction: "inbound",
        association: "confirmed",
        association_proof: transport === "websocket" ? "strong_identity_or_explicit_handoff" : "same_observed_request",
        endpoint_verified: true,
        channel,
        transport_segment_id: segment
      };
    }
    request(capture, body) {
      if (!this.journal.start(capture)) {
        this.diagnostic("capture_limit");
        return;
      }
      const identity = this.captures.get(capture.capture_id) ?? {
        capture,
        request: null,
        conversation: capture.conversation_id,
        input: null,
        parent: null,
        message: null,
        topics: /* @__PURE__ */ new Set(),
        valid: true
      };
      this.captures.set(capture.capture_id, identity);
      if (typeof body !== "string") {
        if (body !== null && body !== void 0)
          this.diagnostic("unsupported_request_body", capture.capture_id);
        return;
      }
      if (new TextEncoder().encode(body).length > 1048576) {
        this.diagnostic("request_body_limit", capture.capture_id);
        return;
      }
      let value2;
      try {
        value2 = JSON.parse(body);
      } catch {
        this.diagnostic("malformed_request_json", capture.capture_id);
        return;
      }
      const root = record(value2);
      identity.request = identifier(root?.request_id);
      identity.conversation = identifier(root?.conversation_id) ?? identity.conversation;
      identity.parent = identifier(root?.parent_message_id);
      const messages2 = Array.isArray(root?.messages) ? root.messages : [];
      identity.input = identifier(record(messages2[0])?.id);
      for (const event of requestEvidence(value2, {
        ...this.source(identity, capture.transport, capture.capture_id),
        direction: "outbound"
      }))
        this.journal.append(event, {
          request_id: identity.request,
          conversation_id: identity.conversation,
          parent_message_id: identity.parent
        });
    }
    ids(value2) {
      const root = record(value2), metadata = record(root?.metadata), message = record(root?.message), meta = record(message?.metadata);
      return {
        request: identifier(root?.request_id) ?? identifier(metadata?.request_id) ?? identifier(meta?.request_id),
        conversation: identifier(root?.conversation_id) ?? identifier(metadata?.conversation_id) ?? identifier(meta?.conversation_id),
        input: identifier(root?.input_message_id),
        parent: identifier(root?.parent_message_id) ?? identifier(message?.parent_id),
        message: record(message?.author)?.role === "assistant" ? identifier(message?.id) : identifier(root?.message_id)
      };
    }
    compatible(identity, ids) {
      for (const key of ["request", "conversation", "input", "message"])
        if (identity[key] && ids[key] && identity[key] !== ids[key]) return false;
      return true;
    }
    learn(identity, value2) {
      const root = record(value2), scope = root?.task_scope ?? record(root?.metadata)?.task_scope ?? record(record(root?.message)?.metadata)?.task_scope;
      if (scope !== void 0 && scope !== "answer") {
        this.diagnostic("unsupported_task_scope", identity.capture.capture_id);
        return false;
      }
      const ids = this.ids(value2);
      if (!this.compatible(identity, ids)) {
        this.diagnostic("identity_contradiction", identity.capture.capture_id);
        return false;
      }
      for (const key of [
        "request",
        "conversation",
        "input",
        "parent",
        "message"
      ])
        if (!identity[key] && ids[key]) identity[key] = ids[key];
      return true;
    }
    protocol(identity, transport, segment, socket = null, proof = "confirmed_handoff_topic") {
      let accepted = true;
      return new Protocol(
        () => ({
          ...this.source(identity, transport, segment),
          association: accepted ? "confirmed" : "ambiguous",
          association_proof: socket ? proof : "same_observed_request"
        }),
        {
          identity: (value2) => {
            accepted = this.learn(identity, value2);
          },
          evidence: (events, observation) => {
            if (!identity.valid || !accepted) return;
            this.commit(
              identity,
              events,
              observation,
              transport === "websocket" ? this.arrivals.get(segment) : void 0
            );
          },
          control: (kind, value2) => {
            if (!identity.valid || !accepted) return;
            if (kind === "done") {
              this.complete(identity.capture.capture_id);
              return;
            }
            if (kind === "content") {
              this.counters.content_fragments++;
              return;
            }
            const topic = identifier(record(value2)?.topic_id);
            if (kind === "handoff") {
              if (!topic) {
                this.diagnostic(
                  "handoff_topic_unavailable",
                  identity.capture.capture_id
                );
                return;
              }
              if (identity.topics.size >= 32) {
                this.diagnostic("topic_limit", identity.capture.capture_id);
                return;
              }
              identity.topics.add(topic);
            }
            if (kind === "reconnect" && socket && topic && identity.topics.has(topic))
              this.diagnostics.push({
                code: "confirmed_reconnect",
                count: 1,
                capture_id: identity.capture.capture_id,
                socket_id: socket
              });
          },
          error: (code) => this.diagnostic(code, identity.capture.capture_id, socket)
        }
      );
    }
    commit(identity, events, observation, arrival) {
      const info = {
        arrival_index: arrival,
        envelope_id: observation.envelope.id ?? void 0,
        envelope_event: observation.envelope.event,
        envelope_retry: observation.envelope.retry,
        delta_header: observation.op ? {
          path: observation.path,
          channel: observation.channel,
          explicit: observation.explicit
        } : null,
        delta_op: observation.op ?? void 0,
        request_id: identity.request,
        conversation_id: identity.conversation,
        parent_message_id: identity.parent
      };
      for (const event of events) {
        if (event.value_state === "invalid")
          this.diagnostic("invalid_route_field", identity.capture.capture_id);
        this.journal.append(event, {
          ...info,
          decode_index: observation.envelope.index
        });
      }
    }
    async response(capture, response) {
      const identity = this.captures.get(capture.capture_id);
      if (!identity?.valid) {
        void response.body?.cancel().catch(() => {
        });
        return;
      }
      if (!response.body) {
        this.diagnostic("body_unavailable", capture.capture_id);
        return;
      }
      const reader = response.body.getReader();
      this.readers.set(capture.capture_id, reader);
      const parser = this.protocol(
        identity,
        capture.mode === "reload" ? "reload" : capture.transport,
        capture.capture_id
      );
      const type = response.headers.get("content-type") ?? "";
      const sse = type.includes("text/event-stream");
      let size = 0;
      const chunks = [];
      try {
        while (identity.valid) {
          const next = await reader.read();
          if (next.done) break;
          if (!identity.valid) break;
          if (sse) parser.push(next.value);
          else {
            size += next.value.byteLength;
            if (size > (capture.mode === "reload" ? 8388608 : 1048576)) {
              this.diagnostic("json_body_limit", capture.capture_id);
              void reader.cancel().catch(() => {
              });
              return;
            }
            chunks.push(next.value);
          }
        }
        if (!identity.valid) return;
        if (sse) parser.finish();
        else {
          const merged = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          let value2;
          try {
            value2 = JSON.parse(
              new TextDecoder("utf-8", { fatal: true }).decode(merged)
            );
          } catch {
            this.diagnostic("malformed_json", capture.capture_id);
            return;
          }
          if (capture.mode === "reload") this.reload(identity, value2);
          else parser.json(value2);
        }
        this.journal.segmentEof(capture.capture_id);
        if (!identity.topics.size && sse && this.journal.state(capture.capture_id).lifecycle === "Capturing")
          this.diagnostic("completion_unavailable", capture.capture_id);
      } catch {
        if (identity.valid)
          this.diagnostic("observer_read_failed", capture.capture_id);
      } finally {
        this.readers.delete(capture.capture_id);
        reader.releaseLock();
      }
    }
    reload(identity, value2) {
      const root = record(value2), mapping = record(root?.mapping), current = identifier(root?.current_node), conversation = identifier(root?.conversation_id) ?? identifier(root?.id);
      if (!mapping || !current || !conversation || conversation !== identity.capture.conversation_id) {
        this.diagnostic("reload_branch_unavailable", identity.capture.capture_id);
        return;
      }
      const visited = /* @__PURE__ */ new Set();
      let nodeId = current;
      let selected = null;
      while (nodeId) {
        if (visited.has(nodeId) || visited.size >= 64) {
          this.diagnostic("reload_branch_invalid", identity.capture.capture_id);
          return;
        }
        visited.add(nodeId);
        const node = record(mapping[nodeId]);
        if (!node) {
          this.diagnostic("reload_parent_missing", identity.capture.capture_id);
          return;
        }
        const message = record(node.message);
        if (!selected && record(message?.author)?.role === "assistant")
          selected = message;
        const parent = node.parent;
        if (parent !== null && typeof parent !== "string") {
          this.diagnostic("reload_parent_missing", identity.capture.capture_id);
          return;
        }
        nodeId = identifier(parent);
      }
      if (!selected) {
        this.diagnostic(
          "reload_assistant_unavailable",
          identity.capture.capture_id
        );
        return;
      }
      identity.message = identifier(selected.id);
      identity.conversation = conversation;
      for (const event of responseEvidence(
        { message: selected },
        this.source(identity, "reload", identity.capture.capture_id)
      ))
        this.journal.append(event, {
          conversation_id: conversation,
          parser_status: "supported_reload_current_branch"
        });
      this.complete(identity.capture.capture_id, "reload_record_observed");
    }
    xhr(capture, xhr, kind) {
      const identity = this.captures.get(capture.capture_id);
      if (!identity?.valid) return;
      if (["error", "abort", "timeout"].includes(kind)) {
        this.diagnostic(`xhr_${kind}`, capture.capture_id);
        return;
      }
      if (!["progress", "load"].includes(kind)) return;
      if (xhr.responseType !== "" && xhr.responseType !== "text" && xhr.responseType !== "json") {
        this.diagnostic("unsupported_xhr_response_type", capture.capture_id);
        return;
      }
      const isSse = (xhr.getResponseHeader("content-type") ?? "").includes(
        "text/event-stream"
      );
      if (!isSse) {
        if (kind === "load") {
          let value2;
          try {
            value2 = xhr.responseType === "json" ? xhr.response : JSON.parse(xhr.responseText);
          } catch {
            this.diagnostic("malformed_xhr_json", capture.capture_id);
            return;
          }
          if (capture.mode === "reload") this.reload(identity, value2);
          else this.protocol(identity, "xhr", capture.capture_id).json(value2);
        }
        return;
      }
      let state = this.xhrs.get(xhr);
      if (!state) {
        state = {
          offset: 0,
          parser: this.protocol(identity, "xhr", capture.capture_id)
        };
        this.xhrs.set(xhr, state);
      }
      const text = xhr.responseText;
      if (text.length < state.offset) {
        this.diagnostic("xhr_offset_reversal", capture.capture_id);
        return;
      }
      state.parser.text(text.slice(state.offset));
      state.offset = text.length;
      if (kind === "load") {
        state.parser.finish();
        this.journal.segmentEof(capture.capture_id);
        this.xhrs.delete(xhr);
      }
    }
    resolve(topic, value2, context) {
      const ids = this.ids(value2);
      const candidates = [...this.captures.values()].filter(
        (i) => i.valid && i.capture.context.document_id === context.document_id && i.capture.context.epoch === context.epoch
      );
      const lost = [...this.evicted.values()].find(
        (i) => i.capture.context.document_id === context.document_id && i.capture.context.epoch === context.epoch && (ids.request ? i.request === ids.request : ids.input && ids.parent ? i.input === ids.input && i.parent === ids.parent : i.topics.has(topic))
      );
      if (lost) {
        this.diagnostic("late_event_association_lost", lost.capture.capture_id);
        return null;
      }
      const owners = candidates.filter((i) => i.topics.has(topic));
      let matches = ids.request ? candidates.filter((i) => i.request === ids.request) : ids.input && ids.parent ? candidates.filter(
        (i) => i.input === ids.input && i.parent === ids.parent
      ) : owners;
      matches = matches.filter((i) => this.compatible(i, ids));
      if (matches.length !== 1 || owners.length && !owners.includes(matches[0])) {
        this.diagnostic(
          matches.length > 1 ? "ambiguous_ws_quarantine" : "orphan_or_contradiction_quarantine"
        );
        return null;
      }
      if (!ids.request && !ids.input && !owners.length) {
        this.diagnostic("candidate_ws_quarantine");
        return null;
      }
      return matches[0];
    }
    async socketMessage(socket, data, context, arrival) {
      let queue = this.socketQueues.get(socket);
      if (!queue) {
        if (this.socketQueues.size >= 32) {
          this.diagnostic("socket_limit", null, socket);
          return;
        }
        queue = {
          chain: Promise.resolve(),
          pending: 0,
          bytes: 0,
          generation: this.generation
        };
        this.socketQueues.set(socket, queue);
      }
      const size = typeof data === "string" ? new TextEncoder().encode(data).length : data instanceof Blob ? data.size : data instanceof ArrayBuffer ? data.byteLength : 0;
      this.counters.ws_message_events++;
      if (!size || size > 2097152 || queue.pending >= 64 || queue.bytes + size > 8388608) {
        this.diagnostic(
          size ? "ws_queue_limit" : "unsupported_ws_binary",
          null,
          socket
        );
        for (const i of this.captures.values())
          if (i.valid && i.topics.size)
            this.journal.health(
              i.capture.capture_id,
              "Partial",
              "ws_known_drop_or_unsupported"
            );
        return;
      }
      queue.pending++;
      queue.bytes += size;
      const active = queue;
      active.chain = active.chain.then(async () => {
        if (active.generation !== this.generation) return;
        let text;
        try {
          text = typeof data === "string" ? data : new TextDecoder("utf-8", { fatal: true }).decode(
            data instanceof Blob ? await data.arrayBuffer() : data
          );
        } catch {
          this.diagnostic("invalid_ws_utf8", null, socket);
          return;
        }
        if (active.generation !== this.generation) return;
        let value2;
        try {
          value2 = JSON.parse(text);
        } catch {
          this.diagnostic("malformed_ws_json", null, socket);
          return;
        }
        if (!Array.isArray(value2) || value2.length > 16) {
          this.diagnostic("unsupported_ws_envelope", null, socket);
          return;
        }
        for (const raw of value2) {
          const envelope = record(raw), topic = identifier(envelope?.topic_id), encoded = record(record(envelope?.payload)?.payload)?.encoded_item;
          if (!topic || typeof encoded !== "string") {
            this.diagnostic("unsupported_ws_envelope", null, socket);
            continue;
          }
          if (new TextEncoder().encode(encoded).length > 1048576) {
            this.diagnostic("ws_encoded_limit", null, socket);
            continue;
          }
          const key = `${socket}:${topic}`;
          let parser = this.socketParsers.get(key);
          if (!parser) {
            const probe = new SseProbe(encoded);
            const identity = this.resolve(topic, probe.first, context);
            if (!identity) continue;
            if (this.socketParsers.size >= 1024) {
              this.diagnostic(
                "topic_limit",
                identity.capture.capture_id,
                socket
              );
              continue;
            }
            const previous = this.topicSockets.get(topic);
            if (previous && previous !== socket)
              this.diagnostic(
                "candidate_reconnect",
                identity.capture.capture_id,
                socket
              );
            this.topicSockets.set(topic, socket);
            const ids = this.ids(probe.first);
            parser = this.protocol(
              identity,
              "websocket",
              socket,
              socket,
              ids.request ? "confirmed_request_id" : ids.input && ids.parent ? "confirmed_input_parent" : "confirmed_handoff_topic"
            );
            this.socketParsers.set(key, parser);
            this.parserOwners.set(key, identity.capture.capture_id);
          }
          this.arrivals.set(socket, arrival);
          parser.text(encoded);
        }
      }).catch(() => this.diagnostic("ws_observer_failed", null, socket)).finally(() => {
        active.pending--;
        active.bytes -= size;
      });
      await active.chain;
    }
    canReleaseClosed(id2) {
      return this.journal.state(id2).lifecycle === "Closed" && !this.readers.has(id2) && !this.readers.has(`${id2}:request`) && !this.timers.has(id2) && ![...this.socketQueues.values()].some((q) => q.pending > 0) && ![...this.parserOwners].some(
        ([key, owner]) => owner === id2 && this.socketParsers.get(key)?.sse.pending
      );
    }
    releaseClosedCapture(id2) {
      if (!this.canReleaseClosed(id2)) return false;
      const identity = this.captures.get(id2);
      if (identity) {
        identity.valid = false;
        this.evicted.set(id2, identity);
        while (this.evicted.size > 128)
          this.evicted.delete(this.evicted.keys().next().value);
        this.captures.delete(id2);
        for (const [key, owner] of this.parserOwners)
          if (owner === id2) {
            this.parserOwners.delete(key);
            this.socketParsers.delete(key);
          }
        for (const topic of identity.topics) {
          if ([...this.captures.values()].some((i) => i.topics.has(topic)))
            continue;
          const socket = this.topicSockets.get(topic);
          this.topicSockets.delete(topic);
          if (socket && ![...this.topicSockets.values()].includes(socket)) {
            this.socketQueues.delete(socket);
            this.arrivals.delete(socket);
          }
        }
      }
      return true;
    }
    discardCapture(id2) {
      const identity = this.captures.get(id2);
      if (identity) identity.valid = false;
      const reader = this.readers.get(id2);
      if (reader) void reader.cancel().catch(() => {
      });
      this.readers.delete(id2);
      const timer = this.timers.get(id2);
      if (timer) clearTimeout(timer);
      this.timers.delete(id2);
      this.journal.discard(id2);
    }
    reset(context, reason) {
      this.journal.reset(context, reason);
      if (["pause", "clear", "dispose"].includes(reason)) {
        this.generation++;
        for (const identity of this.captures.values()) identity.valid = false;
        for (const reader of this.readers.values())
          void reader.cancel().catch(() => {
          });
        this.readers.clear();
        this.socketQueues.clear();
        this.socketParsers.clear();
        this.parserOwners.clear();
        this.topicSockets.clear();
        this.arrivals.clear();
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
        this.xhrs = /* @__PURE__ */ new WeakMap();
        if (reason === "clear") {
          this.captures.clear();
          this.evicted.clear();
          this.diagnostics.length = 0;
          this.journal.clear();
        }
      }
    }
    sink() {
      return {
        request: (capture, input, init, requestClone) => {
          this.request(
            capture,
            capture.transport === "fetch" ? init?.body : input
          );
          if (requestClone) void this.requestClone(capture, requestClone);
        },
        event: (event) => {
          if (event.capture_id && ["request_rejected", "request_throw"].includes(event.kind)) {
            this.journal.health(event.capture_id, "Failed", event.kind);
            this.journal.terminate(event.capture_id, event.kind);
          }
          if (event.kind === "hook_replaced") {
            for (const identity of this.captures.values())
              if (identity.valid)
                this.journal.health(
                  identity.capture.capture_id,
                  "Partial",
                  "hook_replaced"
                );
          }
        },
        response: (capture, response) => {
          void this.response(capture, response);
        },
        xhr: (capture, xhr, kind) => this.xhr(capture, xhr, kind),
        socket: (id2, _socket, kind, event, context) => {
          if (kind === "message")
            void this.socketMessage(
              id2,
              event.data,
              context,
              this.counters.ws_message_events + 1
            );
          else {
            this.diagnostic(`ws_${kind}`, null, id2);
            if (kind === "close" || kind === "error")
              void this.closeSocket(id2, kind);
          }
        },
        reset: (context, reason) => this.reset(context, reason)
      };
    }
    async closeSocket(id2, kind) {
      const generation = this.generation;
      const queue = this.socketQueues.get(id2);
      await queue?.chain;
      if (generation !== this.generation) return;
      for (const [key, parser] of this.socketParsers)
        if (key.startsWith(`${id2}:`)) {
          parser.finish();
          this.socketParsers.delete(key);
          this.parserOwners.delete(key);
        }
      for (const identity of this.captures.values())
        if (identity.valid && [...identity.topics].some((t) => this.topicSockets.get(t) === id2) && this.journal.state(identity.capture.capture_id).lifecycle === "Capturing")
          this.journal.health(
            identity.capture.capture_id,
            "Partial",
            `ws_${kind}_before_completion`
          );
      if (kind === "close") {
        this.socketQueues.delete(id2);
        this.arrivals.delete(id2);
      }
    }
    async requestClone(capture, request) {
      if (!request.body) return;
      const identity = this.captures.get(capture.capture_id);
      if (!identity?.valid) return;
      const reader = request.body.getReader();
      const key = `${capture.capture_id}:request`;
      this.readers.set(key, reader);
      let bytes = 0;
      const chunks = [];
      try {
        while (identity.valid) {
          const next = await reader.read();
          if (next.done) break;
          bytes += next.value.byteLength;
          if (bytes > 1048576) {
            this.diagnostic("request_body_limit", capture.capture_id);
            void reader.cancel().catch(() => {
            });
            return;
          }
          chunks.push(next.value);
        }
        if (!identity.valid) return;
        const merged = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        this.request(
          capture,
          new TextDecoder("utf-8", { fatal: true }).decode(merged)
        );
      } catch {
        if (identity.valid)
          this.diagnostic("request_clone_failed", capture.capture_id);
      } finally {
        this.readers.delete(key);
        reader.releaseLock();
      }
    }
  };
  var SseProbe = class {
    first = null;
    constructor(text) {
      const parser = new Protocol(() => ({}), {
        identity: (value2) => {
          if (this.first === null) this.first = value2;
        },
        evidence() {
        },
        control() {
        },
        error() {
        }
      });
      parser.text(text);
    }
  };

  // src/core/network.ts
  var NETWORK_VERSION = "network-1";
  var AUX_SCHEMA_VERSION = "1.1";
  var SAFE_HEADERS = [
    "content-type",
    "cf-mitigated",
    "cf-ray",
    "server",
    "retry-after",
    "server-timing"
  ];
  var result = (value2, availability, source) => ({ value: value2, availability, source });
  function retryAfter(raw) {
    if (/^\d{1,10}$/.test(raw)) return { seconds: Number(raw), date: null };
    if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      raw
    ))
      return null;
    const date = Date.parse(raw);
    return Number.isFinite(date) ? { seconds: null, date: new Date(date).toISOString() } : null;
  }
  function serverTiming(raw) {
    if (raw.length > 4096) return null;
    const clean = raw.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    const parts = clean.split(",");
    if (parts.length > 32) return null;
    const metrics = [];
    for (const part of parts) {
      const [nameRaw, ...params] = part.trim().split(";");
      const name = nameRaw?.trim();
      if (!name || !/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(name)) return null;
      let dur = null;
      for (const param of params) {
        if (!/^\s*dur\s*=/i.test(param)) continue;
        const value2 = /^\s*dur\s*=\s*(\d+(?:\.\d+)?)\s*$/i.exec(param)?.[1];
        if (!value2 || !Number.isFinite(Number(value2))) return null;
        dur = Number(value2);
      }
      metrics.push({ name, dur });
    }
    return metrics;
  }
  function readSafeHeaders(get, visibility) {
    const headers = {};
    for (const name of SAFE_HEADERS) {
      const source = `response.headers/${name}`;
      let raw;
      try {
        raw = visibility === "opaque" ? null : get(name);
      } catch {
        headers[name] = result(
          null,
          "not_exposed",
          source
        );
        continue;
      }
      if (raw === null) {
        headers[name] = result(
          null,
          visibility === "opaque" || visibility === "cors" && name !== "content-type" ? "not_exposed" : "absent",
          source
        );
        continue;
      }
      if (raw.length > (name === "server-timing" ? 4096 : 256) || /[\r\n\0]/.test(raw)) {
        headers[name] = result(
          null,
          "invalid",
          source
        );
        continue;
      }
      let value2 = null;
      if (name === "content-type") {
        const mime = raw.split(";")[0]?.trim().toLowerCase();
        if (mime && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime))
          value2 = mime;
      }
      if (name === "cf-mitigated" && raw.trim().toLowerCase() === "challenge")
        value2 = "challenge";
      if (name === "cf-ray" && /^[0-9a-fA-F]{8,64}(?:-[A-Z]{3})?$/.test(raw.trim()))
        value2 = raw.trim();
      if (name === "server" && /^[a-zA-Z0-9_./-]{1,64}$/.test(raw.trim()))
        value2 = raw.trim();
      if (name === "retry-after") value2 = retryAfter(raw.trim());
      if (name === "server-timing") value2 = serverTiming(raw);
      headers[name] = result(
        value2,
        value2 === null ? "invalid" : "observed",
        source
      );
    }
    return headers;
  }
  function httpEvidence(status, get, visibility = "readable") {
    const headers = readSafeHeaders(get, visibility);
    return {
      status: result(
        status >= 100 && status <= 599 && visibility !== "opaque" ? status : null,
        visibility === "opaque" || status === 0 ? "not_exposed" : status >= 100 && status <= 599 ? "observed" : "invalid",
        "response.status"
      ),
      headers,
      indicators: {
        html: headers["content-type"].value === "text/html",
        challenge_resource_template: false,
        registered_html_structure: false
      },
      network_version: NETWORK_VERSION
    };
  }
  function htmlIndicators(text) {
    const prefix = text.slice(0, 65536);
    return {
      challenge_resource_template: /(?:src|href)\s*=\s*["'][^"']*\/cdn-cgi\/challenge-platform\//i.test(
        prefix
      ),
      registered_html_structure: /\bid\s*=\s*["']challenge-form["']/i.test(prefix) && /\/cdn-cgi\/challenge-platform\//.test(prefix)
    };
  }
  function networkVerdict(evidence, failure) {
    if (failure === "abort") return "Aborted";
    if (failure) return "Transport Failure";
    if (!evidence) return "Unknown";
    if (evidence.headers["cf-mitigated"].value === "challenge")
      return "Challenge Confirmed";
    if (evidence.indicators.html && (evidence.indicators.challenge_resource_template || evidence.indicators.registered_html_structure))
      return "Challenge Suspected";
    const status = evidence.status.value;
    if (status === null) return "Unknown";
    if (status === 429) return "Rate Limited";
    if (status >= 500) return "Server Error";
    if (status >= 400) return "HTTP Error";
    if (status >= 200 && status < 400) return "OK";
    return "Unknown";
  }
  function powEvidence(value2) {
    const root = record(value2);
    let container = root;
    let path = "/difficulty";
    outer: for (const [prefix, candidate] of [
      ["", root],
      ["/chat_requirements", record(root?.chat_requirements)],
      ["/requirements", record(root?.requirements)]
    ]) {
      for (const key of ["proofofwork", "proof_of_work", "pow"]) {
        const proof = record(candidate?.[key]);
        if (proof && Object.hasOwn(proof, "difficulty")) {
          container = proof;
          path = `${prefix}/${key}/difficulty`;
          break outer;
        }
      }
    }
    const exists = !!container && Object.hasOwn(container, "difficulty");
    const raw = container?.difficulty;
    const base = {
      raw_hex: null,
      decimal: null,
      validity: !exists ? "absent_in_observed_payload" : raw === null ? "explicit_null" : "invalid",
      request_id: identifier(root?.request_id),
      source_path: path
    };
    if (typeof raw !== "string" || raw.length > 256 || !/^(?:0[xX])?[0-9a-fA-F]{1,256}$/.test(raw))
      return base;
    const digits = raw.replace(/^0x/i, "");
    return {
      ...base,
      raw_hex: raw,
      decimal: BigInt(`0x${digits}`).toString(10),
      validity: "observed"
    };
  }
  function powAssociation(pow, capture, maxDelta = 3e4) {
    const delta = capture.monotonic_ms - pow.monotonic_ms;
    if (pow.document_id !== capture.document_id || pow.epoch !== capture.epoch)
      return {
        status: "unassociated",
        proof: "context_mismatch",
        delta_ms: null
      };
    if (pow.request_id && capture.request_id)
      return pow.request_id === capture.request_id ? { status: "confirmed", proof: "exact_request_id", delta_ms: null } : {
        status: "unassociated",
        proof: "contradictory_request_id",
        delta_ms: null
      };
    return delta >= 0 && delta <= maxDelta ? {
      status: "candidate",
      proof: "same_document_epoch_time_only",
      delta_ms: delta
    } : {
      status: "unassociated",
      proof: "no_association_evidence",
      delta_ms: null
    };
  }

  // src/adapters/network-monitor.ts
  var NetworkMonitor = class {
    constructor(journal, now = () => performance.now(), wall = () => (/* @__PURE__ */ new Date()).toISOString()) {
      this.journal = journal;
      this.now = now;
      this.wall = wall;
    }
    journal;
    now;
    wall;
    captures = /* @__PURE__ */ new Map();
    readers = /* @__PURE__ */ new Map();
    generation = 0;
    xhrSeen = /* @__PURE__ */ new WeakMap();
    reconnectSeen = /* @__PURE__ */ new Set();
    socketEvents = /* @__PURE__ */ new Map();
    socketLinks = /* @__PURE__ */ new Set();
    powReadings = [];
    links = /* @__PURE__ */ new Set();
    start(capture, body) {
      if (!this.journal.start(capture) || this.captures.size >= 128) return;
      let request_id = null;
      if (typeof body === "string" && body.length <= 1048576) {
        try {
          request_id = identifier(record(JSON.parse(body))?.request_id);
        } catch {
        }
      }
      this.captures.set(capture.capture_id, { capture, request_id, valid: true });
      if (capture.mode === "live")
        for (const reading of this.powReadings)
          this.linkPow(reading, capture, request_id);
    }
    append(capture, namespace, field2, value2, availability = "observed", proof = "same_observed_request", association = "confirmed", segment = capture.capture_id) {
      const entry = this.captures.get(capture.capture_id);
      if (!entry?.valid) return;
      this.journal.append(
        {
          capture_id: capture.capture_id,
          task_scope: "network_environment",
          message_id: null,
          transport: capture.mode === "reload" ? "reload" : capture.transport,
          direction: "inbound",
          association,
          association_proof: proof,
          endpoint_verified: true,
          channel: "0",
          transport_segment_id: segment,
          field_namespace: namespace,
          field: field2,
          level: namespace.startsWith("pow") ? "E" : "N",
          value: value2,
          value_state: availability === "explicit_null" ? "explicit_null" : availability === "invalid" ? "invalid" : "value",
          source_path: namespace === "network.headers" ? `/response/headers/${field2}` : namespace.startsWith("network.server-timing") ? `/response/headers/server-timing/${field2}` : namespace === "network.http" ? "/response/status" : namespace === "pow" ? capture.endpoint_path ?? "/requirements" : `/network/${field2}`,
          source_type: namespace.startsWith("pow") ? "requirements_environment" : "network_observation",
          raw_source_type: capture.transport,
          schema_version: AUX_SCHEMA_VERSION,
          adapter_version: NETWORK_VERSION,
          rule_version: NETWORK_VERSION,
          availability,
          privacy_class: field2 === "cf-ray" || field2 === "request_id" ? "local_identifier_redact_on_export" : "safe_metadata",
          observed_at: this.wall()
        },
        { request_id: entry.request_id }
      );
    }
    commitHttp(capture, evidence) {
      this.append(
        capture,
        "network.http",
        "http_status",
        evidence.status.value,
        evidence.status.availability
      );
      for (const name of SAFE_HEADERS) {
        const header = evidence.headers[name];
        if (header.value === null || typeof header.value === "string")
          this.append(
            capture,
            "network.headers",
            name,
            header.value,
            header.availability
          );
        else if (Array.isArray(header.value)) {
          this.append(
            capture,
            "network.headers",
            "server-timing.availability",
            header.availability
          );
          header.value.forEach((metric, index) => {
            this.append(
              capture,
              `network.server-timing.${index}`,
              "metric_name",
              metric.name
            );
            this.append(
              capture,
              `network.server-timing.${index}`,
              "dur",
              metric.dur,
              metric.dur === null ? "absent" : "observed"
            );
          });
        } else {
          this.append(
            capture,
            "network.headers",
            "retry-after.seconds",
            header.value.seconds,
            header.value.seconds === null ? "absent" : "observed"
          );
          this.append(
            capture,
            "network.headers",
            "retry-after.date",
            header.value.date,
            header.value.date === null ? "absent" : "observed"
          );
        }
      }
      this.append(capture, "network.verdict", "status", networkVerdict(evidence));
    }
    async response(capture, response) {
      this.refreshIdentity(capture);
      const evidence = httpEvidence(
        response.status,
        (name) => response.headers.get(name),
        response.type === "opaque" || response.type === "opaqueredirect" ? "opaque" : response.type === "cors" ? "cors" : "readable"
      );
      this.commitHttp(capture, evidence);
      if (capture.mode !== "requirements" && !evidence.indicators.html) return;
      if (!response.body) {
        this.append(capture, "network.observer", "body", null, "not_captured");
        return;
      }
      if (this.readers.size >= 32) {
        this.append(capture, "network.observer", "body", null, "not_captured");
        void response.body.cancel().catch(() => {
        });
        return;
      }
      const reader = response.body.getReader(), generation = this.generation;
      this.readers.set(capture.capture_id, reader);
      let size = 0;
      const chunks = [];
      const limit = capture.mode === "requirements" ? 262144 : 65536;
      try {
        while (generation === this.generation) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > limit) {
            this.append(
              capture,
              "network.observer",
              "body_limit",
              true,
              "not_captured"
            );
            if (capture.mode !== "requirements") {
              const prefix = new Uint8Array(Math.min(size, limit));
              let pos = 0;
              for (const chunk of [...chunks, next.value]) {
                const part = chunk.subarray(0, limit - pos);
                prefix.set(part, pos);
                pos += part.length;
                if (pos === limit) break;
              }
              Object.assign(
                evidence.indicators,
                htmlIndicators(new TextDecoder().decode(prefix))
              );
              for (const [name, value2] of Object.entries(evidence.indicators))
                this.append(capture, "network.challenge", name, value2);
              this.append(
                capture,
                "network.verdict",
                "status",
                networkVerdict(evidence)
              );
            }
            void reader.cancel().catch(() => {
            });
            return;
          }
          chunks.push(next.value);
        }
        if (generation !== this.generation || !this.captures.get(capture.capture_id)?.valid)
          return;
        const merged = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        const text = new TextDecoder("utf-8", { fatal: true }).decode(merged);
        if (capture.mode === "requirements") this.pow(capture, JSON.parse(text));
        else {
          Object.assign(evidence.indicators, htmlIndicators(text));
          for (const [name, value2] of Object.entries(evidence.indicators))
            this.append(capture, "network.challenge", name, value2);
          this.append(
            capture,
            "network.verdict",
            "status",
            networkVerdict(evidence)
          );
        }
      } catch {
        if (generation === this.generation)
          this.append(capture, "network.observer", "body", null, "invalid");
      } finally {
        this.readers.delete(capture.capture_id);
        reader.releaseLock();
        if (capture.mode === "requirements")
          this.journal.terminate(
            capture.capture_id,
            "requirements_observation_ended"
          );
      }
    }
    pow(capture, value2) {
      const pow = powEvidence(value2), entry = this.captures.get(capture.capture_id);
      if (!entry?.valid) return;
      entry.request_id = pow.request_id ?? entry.request_id;
      this.append(capture, "pow", "raw_hex", pow.raw_hex, pow.validity);
      this.append(capture, "pow", "decimal", pow.decimal, pow.validity);
      this.append(capture, "pow", "source_path", pow.source_path);
      this.append(
        capture,
        "pow",
        "requirements_endpoint",
        capture.endpoint_path ?? null,
        capture.endpoint_path ? "observed" : "unknown"
      );
      this.append(capture, "pow", "association_status", "unassociated");
      const observed = {
        request_id: entry.request_id,
        document_id: capture.context.document_id,
        epoch: capture.context.epoch,
        monotonic_ms: this.now()
      };
      if (this.powReadings.length === 32) this.powReadings.shift();
      const reading = { ...observed, capture };
      this.powReadings.push(reading);
      for (const other of this.captures.values()) {
        if (!other.valid || other.capture.mode !== "live") continue;
        this.linkPow(reading, other.capture, other.request_id);
      }
    }
    linkPow(reading, capture, request_id) {
      const a = powAssociation(reading, {
        request_id,
        document_id: capture.context.document_id,
        epoch: capture.context.epoch,
        monotonic_ms: capture.started_at
      });
      if (a.status === "unassociated") return;
      if (a.status === "confirmed" && [...this.captures.values()].filter(
        (e) => e.valid && e.capture.mode === "live" && e.request_id === request_id && e.capture.context.document_id === capture.context.document_id && e.capture.context.epoch === capture.context.epoch
      ).length !== 1) {
        this.append(
          capture,
          "pow.association",
          "association_status",
          "ambiguous",
          "observed",
          "duplicate_request_id",
          "orphan"
        );
        return;
      }
      const key = `${reading.capture.capture_id}:${capture.capture_id}:${a.status}`;
      if (this.links.has(key) || this.links.size >= 4096) return;
      this.links.add(key);
      this.append(
        capture,
        "pow.association",
        "association_status",
        a.status,
        "observed",
        a.proof,
        a.status === "confirmed" ? "confirmed" : "candidate"
      );
      this.append(
        capture,
        "pow.association",
        "requirements_capture_id",
        reading.capture.capture_id,
        "observed",
        a.proof,
        a.status === "confirmed" ? "confirmed" : "candidate"
      );
      this.append(
        capture,
        "pow.association",
        "delta_ms",
        a.delta_ms,
        a.delta_ms === null ? "absent" : "observed",
        a.proof,
        a.status === "confirmed" ? "confirmed" : "candidate"
      );
      this.append(
        reading.capture,
        "pow.association",
        `target.${capture.capture_id}`,
        a.status,
        "observed",
        a.proof,
        a.status === "confirmed" ? "confirmed" : "candidate"
      );
    }
    refreshIdentity(capture) {
      const entry = this.captures.get(capture.capture_id);
      if (!entry?.valid || capture.mode !== "live") return;
      const events = this.journal.snapshot(capture.capture_id)?.events ?? [];
      const ids = [
        ...new Set(
          events.filter(
            (e) => (e.level === "A" || e.level === "B") && e.association === "confirmed" && e.request_id
          ).map((e) => e.request_id)
        )
      ];
      if (ids.length === 1) entry.request_id = ids[0] ?? null;
      for (const reading of this.powReadings)
        this.linkPow(reading, capture, entry.request_id);
    }
    socket(id2, kind, event, context) {
      if (kind === "message") return;
      const capture = {
        capture_id: `network:${context.document_id}:${context.epoch}`,
        context,
        mode: "network",
        transport: "websocket",
        conversation_id: null,
        started_at: this.now()
      };
      if (!this.captures.has(capture.capture_id)) {
        this.start(capture, null);
        this.journal.terminate(
          capture.capture_id,
          "auxiliary_observation_context"
        );
      }
      if (!this.socketEvents.has(id2) && this.socketEvents.size < 32)
        this.socketEvents.set(id2, { context, events: [] });
      const saved = this.socketEvents.get(id2);
      if (saved && saved.events.length < 3)
        saved.events.push({
          kind,
          code: kind === "close" && Number.isInteger(event.code) ? event.code : null,
          clean: kind === "close" && typeof event.wasClean === "boolean" ? event.wasClean : null
        });
      this.append(
        capture,
        `network.websocket.${id2}`,
        "event",
        kind,
        "observed",
        "observed_socket_event",
        "orphan",
        id2
      );
      if (kind === "close") {
        const close = event;
        this.append(
          capture,
          `network.websocket.${id2}`,
          "code",
          Number.isInteger(close.code) ? close.code : null,
          Number.isInteger(close.code) ? "observed" : "not_exposed",
          "observed_socket_event",
          "orphan",
          id2
        );
        this.append(
          capture,
          `network.websocket.${id2}`,
          "wasClean",
          typeof close.wasClean === "boolean" ? close.wasClean : null,
          typeof close.wasClean === "boolean" ? "observed" : "not_exposed",
          "observed_socket_event",
          "orphan",
          id2
        );
      }
      if (kind === "error")
        this.append(
          capture,
          `network.websocket.${id2}`,
          "cause",
          null,
          "unknown",
          "observed_socket_event",
          "orphan",
          id2
        );
    }
    xhr(capture, xhr, kind) {
      if (["error", "timeout", "abort"].includes(kind)) {
        this.failure(
          capture,
          kind === "abort" ? "abort" : kind === "timeout" ? "timeout" : "generic"
        );
        return;
      }
      if (kind === "readystatechange" && xhr.readyState >= 2 || kind === "load") {
        if (this.xhrSeen.get(xhr) !== capture.capture_id) {
          this.xhrSeen.set(xhr, capture.capture_id);
          this.commitHttp(
            capture,
            httpEvidence(
              xhr.status,
              (name) => xhr.getResponseHeader(name),
              this.xhrVisibility(xhr)
            )
          );
        }
        if (kind === "load" && capture.mode === "requirements") {
          try {
            if (xhr.responseType === "json") {
              this.append(
                capture,
                "pow.observer",
                "byte_budget",
                null,
                "not_exposed"
              );
              this.pow(capture, xhr.response);
            } else if (xhr.responseType === "" || xhr.responseType === "text") {
              const text = xhr.responseText;
              if (text.length > 262144 || new TextEncoder().encode(text).byteLength > 262144)
                this.append(
                  capture,
                  "pow.observer",
                  "body_limit",
                  true,
                  "not_captured"
                );
              else this.pow(capture, JSON.parse(text));
            } else
              this.append(capture, "pow.observer", "body", null, "unsupported");
            this.journal.terminate(
              capture.capture_id,
              "requirements_observation_ended"
            );
          } catch {
            this.append(capture, "pow", "validity", null, "invalid");
          }
        }
        if (kind === "load" && (xhr.responseType === "" || xhr.responseType === "text") && xhr.getResponseHeader("content-type")?.includes("text/html")) {
          const indicators = htmlIndicators(xhr.responseText.slice(0, 65536));
          for (const [name, value2] of Object.entries(indicators))
            this.append(capture, "network.challenge", name, value2);
          const e = httpEvidence(
            xhr.status,
            (name) => xhr.getResponseHeader(name),
            this.xhrVisibility(xhr)
          );
          Object.assign(e.indicators, indicators);
          this.append(capture, "network.verdict", "status", networkVerdict(e));
        }
      }
    }
    xhrVisibility(xhr) {
      try {
        return xhr.responseURL && typeof location !== "undefined" && new URL(xhr.responseURL).origin === location.origin ? "readable" : "cors";
      } catch {
        return "cors";
      }
    }
    reconcile(diagnostics) {
      for (const entry of this.captures.values()) {
        if (!entry.valid || entry.capture.mode !== "live") continue;
        this.refreshIdentity(entry.capture);
        const events = this.journal.snapshot(entry.capture.capture_id)?.events ?? [];
        for (const event of events) {
          if (event.transport !== "websocket" || event.association !== "confirmed" || event.level !== "A")
            continue;
          const id2 = event.transport_segment_id, saved = id2 ? this.socketEvents.get(id2) : void 0;
          if (!id2 || !saved || saved.context.document_id !== entry.capture.context.document_id || saved.context.epoch !== entry.capture.context.epoch)
            continue;
          for (const [index, data] of saved.events.entries()) {
            const key = `${entry.capture.capture_id}:${id2}:${index}`;
            if (this.socketLinks.has(key)) continue;
            this.socketLinks.add(key);
            const cap = { ...entry.capture, transport: "websocket" };
            this.append(
              cap,
              `network.websocket.${id2}`,
              "event",
              data.kind,
              "observed",
              event.association_proof,
              "confirmed",
              id2
            );
            if (data.kind === "close") {
              this.append(
                cap,
                `network.websocket.${id2}`,
                "code",
                data.code,
                data.code === null ? "not_exposed" : "observed",
                event.association_proof,
                "confirmed",
                id2
              );
              this.append(
                cap,
                `network.websocket.${id2}`,
                "wasClean",
                data.clean,
                data.clean === null ? "not_exposed" : "observed",
                event.association_proof,
                "confirmed",
                id2
              );
            }
          }
        }
      }
      for (const d of diagnostics) {
        if (!d.capture_id || !d.socket_id || !["candidate_reconnect", "confirmed_reconnect"].includes(d.code))
          continue;
        const key = `${d.code}:${d.capture_id}:${d.socket_id}:${d.count}`;
        if (this.reconnectSeen.has(key) || this.reconnectSeen.size >= 512)
          continue;
        this.reconnectSeen.add(key);
        const entry = this.captures.get(d.capture_id);
        if (!entry?.valid) continue;
        this.append(
          { ...entry.capture, transport: "websocket" },
          `network.websocket.${d.socket_id}`,
          "reconnect",
          d.code === "confirmed_reconnect" ? "confirmed" : "candidate",
          "observed",
          d.code === "confirmed_reconnect" ? "registered_protocol_resume" : "same_topic_new_socket",
          d.code === "confirmed_reconnect" ? "confirmed" : "candidate",
          d.socket_id
        );
      }
    }
    challengeResource(context, observed) {
      if (!observed) return;
      const capture = {
        capture_id: `network:${context.document_id}:${context.epoch}`,
        context,
        mode: "network",
        transport: "fetch",
        conversation_id: null,
        started_at: this.now()
      };
      if (!this.captures.has(capture.capture_id)) {
        this.start(capture, null);
        this.journal.terminate(
          capture.capture_id,
          "auxiliary_observation_context"
        );
      }
      this.append(
        capture,
        "network.challenge.resource",
        "path_template",
        "/cdn-cgi/challenge-platform/",
        "observed",
        "document_resource_only",
        "orphan"
      );
    }
    failure(capture, kind) {
      this.append(capture, "network.failure", "category", kind);
      this.append(capture, "network.failure", "cause", null, "unknown");
      this.append(
        capture,
        "network.verdict",
        "status",
        networkVerdict(null, kind)
      );
    }
    event(event) {
      if (event.capture_id && ["request_rejected", "request_throw"].includes(event.kind)) {
        const entry = this.captures.get(event.capture_id);
        if (entry) this.failure(entry.capture, event.failure_kind ?? "generic");
      }
    }
    verdict(id2) {
      const events = this.journal.snapshot(id2)?.events.filter(
        (e) => e.field_namespace === "network.verdict" && e.field === "status"
      ) ?? [];
      return events.at(-1)?.value ?? "Unknown";
    }
    canReleaseClosed(id2) {
      return this.journal.state(id2).lifecycle === "Closed" && !this.readers.has(id2);
    }
    releaseClosedCapture(id2) {
      if (!this.canReleaseClosed(id2)) return false;
      const entry = this.captures.get(id2);
      if (entry) entry.valid = false;
      this.captures.delete(id2);
      this.powReadings = this.powReadings.filter(
        (r) => r.capture.capture_id !== id2
      );
      for (const key of this.links)
        if (key.startsWith(`${id2}:`) || key.includes(`:${id2}:`))
          this.links.delete(key);
      for (const key of this.socketLinks)
        if (key.startsWith(`${id2}:`)) this.socketLinks.delete(key);
      for (const key of this.reconnectSeen)
        if (key.includes(`:${id2}:`)) this.reconnectSeen.delete(key);
      return true;
    }
    reset(context, reason) {
      for (const entry of this.captures.values())
        if (["pause", "clear", "dispose"].includes(reason) || entry.capture.context.document_id !== context.document_id || entry.capture.mode === "requirements")
          entry.valid = false;
      if (["pause", "clear", "dispose"].includes(reason)) {
        this.powReadings = [];
        this.links.clear();
        this.generation++;
        for (const reader of this.readers.values())
          void reader.cancel().catch(() => {
          });
        this.readers.clear();
        this.xhrSeen = /* @__PURE__ */ new WeakMap();
        this.socketEvents.clear();
        this.socketLinks.clear();
        this.reconnectSeen.clear();
        if (reason === "clear") this.captures.clear();
      }
    }
  };

  // src/core/environment.ts
  var ENVIRONMENT_VERSION = "environment-1";
  function environmentFields(input, observed_at) {
    const fields = {};
    const n = record(input.navigator), s = record(input.screen), v = record(input.viewport), connection = record(n?.connection);
    const add = (key, value2, source, availability = "observed", privacy = "local_environment_reduce_on_export") => fields[key] = {
      value: value2,
      source,
      availability,
      privacy_class: privacy,
      observed_at
    };
    const text = (key, raw, source, pattern, max = 128) => add(
      key,
      typeof raw === "string" && raw.length <= max && pattern.test(raw) ? raw : null,
      source,
      raw === void 0 ? "not_exposed" : typeof raw === "string" && raw.length <= max && pattern.test(raw) ? "observed" : "invalid"
    );
    const number = (key, raw, source, min = 0, max = 1e5) => add(
      key,
      typeof raw === "number" && Number.isFinite(raw) && raw >= min && raw <= max ? raw : null,
      source,
      raw === void 0 ? "not_exposed" : typeof raw === "number" && Number.isFinite(raw) && raw >= min && raw <= max ? "observed" : "invalid"
    );
    const boolean = (key, raw, source) => add(
      key,
      typeof raw === "boolean" ? raw : null,
      source,
      raw === void 0 ? "not_exposed" : typeof raw === "boolean" ? "observed" : "invalid"
    );
    text(
      "user_agent",
      n?.userAgent,
      "navigator.userAgent",
      /^[A-Za-z0-9 .;()/,_:+-]+$/,
      512
    );
    const ua = fields.user_agent?.value;
    const match = typeof ua === "string" ? /(Edg)\/(\d{1,4})/.exec(ua) ?? /(Firefox|Chrome)\/(\d{1,4})/.exec(ua) ?? /Version\/(\d{1,4})[^]*Safari\//.exec(ua) : null;
    add(
      "browser",
      match ? match[1] === "Edg" ? "Edge" : match[1] === "Chrome" ? "Chrome" : match[1] === "Firefox" ? "Firefox" : "Safari" : null,
      "derived:navigator.userAgent",
      match ? "derived" : "unknown"
    );
    add(
      "browser_major",
      match ? Number(match[2] ?? match[1]) : null,
      "derived:navigator.userAgent",
      match ? "derived" : "unknown"
    );
    text("platform", n?.platform, "navigator.platform", /^[A-Za-z0-9 _.-]+$/, 64);
    const os = typeof ua !== "string" ? null : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
    add("os", os, "derived:navigator.userAgent", os ? "derived" : "unknown");
    add(
      "os_uncertainty",
      os ? "UA-derived, spoofable and possibly reduced" : "Unknown",
      "derived:navigator.userAgent",
      "derived"
    );
    const platform = typeof fields.platform?.value === "string" ? fields.platform.value : "";
    add(
      "consistency",
      os === "Windows" && /Linux|Mac/.test(platform) || os === "Linux" && /Win|Mac/.test(platform) ? "inconsistent" : "not_proven",
      "derived:UA/platform",
      "derived"
    );
    add(
      "ua_data_availability",
      n?.userAgentData ? "low_entropy_object_visible" : null,
      "navigator.userAgentData",
      n?.userAgentData ? "observed" : "not_exposed"
    );
    text(
      "language",
      n?.language,
      "navigator.language",
      /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/
    );
    const languages = n?.languages;
    const validLanguages = Array.isArray(languages) && languages.length <= 16 && languages.every(
      (x) => typeof x === "string" && /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(x) && x.length <= 64
    );
    add(
      "languages",
      validLanguages ? JSON.stringify(languages) : null,
      "navigator.languages",
      languages === void 0 ? "not_exposed" : validLanguages ? "observed" : "invalid"
    );
    text(
      "timezone",
      input.timezone,
      "Intl.DateTimeFormat.resolvedOptions.timeZone",
      /^[A-Za-z0-9_+/-]+$/
    );
    number(
      "timezone_offset",
      input.offset,
      "Date.getTimezoneOffset",
      -1440,
      1440
    );
    for (const key of ["width", "height"]) {
      number(`screen.${key}`, s?.[key], `screen.${key}`);
      number(
        `viewport.${key}`,
        v?.[key],
        `window.inner${key === "width" ? "Width" : "Height"}`
      );
    }
    number("device_pixel_ratio", v?.dpr, "window.devicePixelRatio", 0.1, 100);
    number(
      "hardware_concurrency",
      n?.hardwareConcurrency,
      "navigator.hardwareConcurrency",
      1,
      4096
    );
    number("device_memory", n?.deviceMemory, "navigator.deviceMemory", 0.1, 1024);
    text(
      "connection.effective_type",
      connection?.effectiveType,
      "navigator.connection.effectiveType",
      /^(slow-2g|2g|3g|4g)$/
    );
    number(
      "connection.rtt",
      connection?.rtt,
      "navigator.connection.rtt",
      0,
      1e6
    );
    number(
      "connection.downlink",
      connection?.downlink,
      "navigator.connection.downlink",
      0,
      1e6
    );
    boolean(
      "connection.save_data",
      connection?.saveData,
      "navigator.connection.saveData"
    );
    let origin = null;
    try {
      if (typeof input.origin === "string") {
        const u = new URL(input.origin);
        if (["http:", "https:"].includes(u.protocol) && u.origin === input.origin)
          origin = u.origin;
      }
    } catch {
    }
    add(
      "origin",
      origin,
      "location.origin",
      origin ? "observed" : input.origin === void 0 ? "not_exposed" : "invalid",
      "safe_metadata"
    );
    text(
      "visibility",
      input.visibility,
      "document.visibilityState",
      /^(visible|hidden|prerender)$/
    );
    boolean("focus", input.focus, "document.hasFocus");
    boolean("online", n?.onLine, "navigator.onLine");
    add(
      "client_ip",
      null,
      "no_authorized_visible_source",
      "unknown",
      "local_sensitive_omit_on_export"
    );
    return fields;
  }
  function readEnvironment(page) {
    const safe = (read) => {
      try {
        return read();
      } catch {
        return void 0;
      }
    };
    const navigator = {};
    for (const key of [
      "userAgent",
      "platform",
      "language",
      "languages",
      "hardwareConcurrency",
      "deviceMemory",
      "userAgentData",
      "onLine"
    ])
      navigator[key] = safe(
        () => page.navigator[key]
      );
    const connection = record(
      safe(
        () => page.navigator.connection
      )
    );
    navigator.connection = connection ? Object.fromEntries(
      ["effectiveType", "rtt", "downlink", "saveData"].map((key) => [
        key,
        safe(() => connection[key])
      ])
    ) : void 0;
    return {
      navigator,
      screen: {
        width: safe(() => page.screen.width),
        height: safe(() => page.screen.height)
      },
      viewport: {
        width: safe(() => page.innerWidth),
        height: safe(() => page.innerHeight),
        dpr: safe(() => page.devicePixelRatio)
      },
      origin: safe(() => page.location.origin),
      visibility: safe(() => page.document.visibilityState),
      focus: safe(() => page.document.hasFocus()),
      timezone: safe(
        () => new page.Intl.DateTimeFormat().resolvedOptions().timeZone
      ),
      offset: safe(() => new page.Date().getTimezoneOffset())
    };
  }

  // src/adapters/environment-monitor.ts
  var EnvironmentMonitor = class {
    constructor(page, journal, context, now = () => performance.now(), wall = () => (/* @__PURE__ */ new Date()).toISOString()) {
      this.page = page;
      this.journal = journal;
      this.now = now;
      this.wall = wall;
      this.windowStart = this.now();
      this.context = { ...context };
    }
    page;
    journal;
    now;
    wall;
    snapshots = [];
    health = { journal: "Unknown", dropped: 0 };
    assets = new AssetSet();
    context;
    active = true;
    generation = 0;
    sequence = 0;
    cleanup = [];
    observer = null;
    resourceTiming = "not_exposed";
    observerAvailability = "not_exposed";
    windowStart;
    scheduled = false;
    chain = Promise.resolve();
    latestSignature = null;
    sw = {
      availability: "not_exposed",
      controller: null,
      registrations: []
    };
    safe(read) {
      try {
        return read();
      } catch {
        return void 0;
      }
    }
    origin() {
      return this.safe(() => this.page.location.origin) ?? "";
    }
    listen(target, event, handler) {
      if (!target?.addEventListener) return;
      target.addEventListener(event, handler);
      this.cleanup.push(() => target.removeEventListener(event, handler));
    }
    start() {
      this.scan();
      const ctor = this.safe(() => this.page.PerformanceObserver);
      if (ctor)
        try {
          this.observer = new ctor((list) => {
            if (!this.active) return;
            let changed = false;
            const entries = list.getEntries();
            if (entries.length > 500) this.assets.overflow = true;
            for (const e of entries.slice(0, 500))
              changed = this.assets.add(
                e.name,
                this.origin(),
                "PerformanceObserver/resource",
                this.wall()
              ) || changed;
            if (changed || this.assets.overflow)
              this.schedule("resource_set_change");
          });
          this.observer.observe({ type: "resource", buffered: true });
          this.observerAvailability = "observed";
        } catch {
          this.observerAvailability = "unavailable";
        }
      this.listen(this.page.performance, "resourcetimingbufferfull", () => {
        if (this.active) {
          this.assets.overflow = true;
          this.schedule("resource_buffer_overflow");
        }
      });
      let width = this.safe(() => this.page.innerWidth), height = this.safe(() => this.page.innerHeight);
      this.listen(this.page, "resize", () => {
        const w = this.safe(() => this.page.innerWidth), h = this.safe(() => this.page.innerHeight);
        if (Math.abs((w ?? 0) - (width ?? 0)) >= 64 || Math.abs((h ?? 0) - (height ?? 0)) >= 64) {
          width = w;
          height = h;
          this.schedule("significant_resize");
        }
      });
      this.listen(
        this.page.document,
        "visibilitychange",
        () => this.schedule("visibility_change")
      );
      for (const event of ["online", "offline", "focus", "blur"])
        this.listen(this.page, event, () => this.schedule(event));
      this.listen(this.page.document, "DOMContentLoaded", () => {
        this.scan();
        this.schedule("environment_ready");
      });
      void this.observeServiceWorkers().then(
        () => this.snapshot("service_worker_ready")
      );
      return this.snapshot("document_start");
    }
    schedule(reason) {
      if (!this.active || this.scheduled) return;
      this.scheduled = true;
      const generation = this.generation;
      this.page.queueMicrotask(() => {
        this.scheduled = false;
        if (generation === this.generation && this.active)
          void this.snapshot(reason);
      });
    }
    scan() {
      const scripts = this.safe(
        () => this.page.document.querySelectorAll("script[src]")
      );
      if (scripts) {
        let count = 0;
        for (const script of scripts) {
          if (count++ >= 500) {
            this.assets.overflow = true;
            break;
          }
          this.assets.add(
            script.getAttribute("src"),
            this.origin(),
            "DOM/script.src",
            this.wall()
          );
        }
      }
      const timing = this.safe(
        () => this.page.performance.getEntriesByType("resource")
      );
      this.resourceTiming = timing ? "observed" : "not_exposed";
      if (timing) {
        if (timing.length > 500) this.assets.overflow = true;
        for (const e of timing.slice(0, 500))
          this.assets.add(
            e.name,
            this.origin(),
            "PerformanceResourceTiming/name",
            this.wall()
          );
      }
    }
    markers() {
      const node = this.safe(
        () => this.page.document.getElementById("__NEXT_DATA__")
      );
      const raw = node?.textContent;
      let next = null;
      if (raw && raw.length <= 262144)
        try {
          next = JSON.parse(raw);
        } catch {
        }
      const declared = this.safe(
        () => this.page.document.querySelector('meta[name="deployment-id"]')?.getAttribute("content")
      );
      return publicMarkers(next, declared);
    }
    async observeServiceWorkers() {
      const generation = this.generation;
      const api = this.safe(() => this.page.navigator.serviceWorker);
      if (!api) {
        this.sw = {
          availability: "not_exposed",
          controller: null,
          registrations: []
        };
        return;
      }
      const project = (worker) => worker ? {
        script_url: normalizeAsset(
          this.safe(() => worker.scriptURL),
          this.origin(),
          "ServiceWorker.scriptURL",
          this.wall()
        ).asset?.url ?? null,
        state: [
          "installing",
          "installed",
          "activating",
          "activated",
          "redundant"
        ].includes(worker.state) ? worker.state : null
      } : null;
      try {
        const registrations = await api.getRegistrations();
        if (generation !== this.generation || !this.active) return;
        this.sw = {
          availability: registrations.length > 32 ? "partial" : "observed",
          controller: project(api.controller),
          registrations: registrations.slice(0, 32).map((r) => project(r.active ?? r.waiting ?? r.installing)).filter((v) => v !== null)
        };
      } catch {
        if (generation === this.generation)
          this.sw = {
            availability: "unavailable",
            controller: project(api.controller),
            registrations: []
          };
      }
    }
    snapshot(reason = "run_start") {
      const generation = this.generation;
      let result2 = null;
      this.chain = this.chain.then(async () => {
        if (!this.active || generation !== this.generation) return;
        this.scan();
        const observed_at = this.wall(), monotonic_ms = this.now();
        const fields = environmentFields(
          readEnvironment(this.page),
          observed_at
        ), assets = this.assets.all(), markers = this.markers();
        let hash = null;
        try {
          hash = await assetSetHash(
            assets.map((a) => a.url),
            (bytes) => this.page.crypto.subtle.digest("SHA-256", bytes)
          );
        } catch {
        }
        if (!this.active || generation !== this.generation) return;
        const snapshot = {
          snapshot_id: `environment-${this.context.document_id}-${this.context.epoch}-${++this.sequence}`,
          reason,
          observed_at,
          monotonic_ms,
          fields,
          assets,
          asset_set_hash: hash,
          normalization_version: NORMALIZATION_VERSION,
          resource_count: assets.length,
          window: { start_ms: this.windowStart, end_ms: monotonic_ms },
          completeness: this.assets.overflow || this.sw.availability === "partial" ? "Partial" : this.resourceTiming !== "observed" || fields.origin?.availability !== "observed" || this.observerAvailability !== "observed" || hash === null ? "Unknown" : "Complete",
          overflow: this.assets.overflow,
          resource_timing_availability: this.resourceTiming,
          performance_observer_availability: this.observerAvailability,
          markers,
          service_worker: structuredClone(this.sw)
        };
        const signature = JSON.stringify({
          fields: Object.fromEntries(
            Object.entries(fields).map(([k, v]) => [
              k,
              { ...v, observed_at: "" }
            ])
          ),
          assets: assets.map((a) => a.url),
          markers,
          sw: this.sw,
          completeness: snapshot.completeness,
          overflow: snapshot.overflow,
          resourceTiming: this.resourceTiming,
          observerAvailability: this.observerAvailability
        });
        const capture = {
          capture_id: `environment:${this.context.document_id}:${this.context.epoch}`,
          context: { ...this.context },
          mode: "environment",
          transport: "dom",
          conversation_id: null,
          started_at: this.windowStart
        };
        if (!this.journal.start(capture)) {
          this.health.journal = "Partial";
          this.health.dropped++;
          return;
        }
        this.health.journal = "Available";
        const append = (namespace, field2, value2, source, availability = "observed", privacy = "safe_metadata") => {
          const saved = this.journal.append({
            capture_id: capture.capture_id,
            task_scope: "environment",
            message_id: null,
            transport: "dom",
            direction: "local",
            association: "orphan",
            association_proof: "document_environment_only",
            endpoint_verified: false,
            channel: "0",
            transport_segment_id: snapshot.snapshot_id,
            field_namespace: namespace,
            field: field2,
            level: "E",
            value: value2,
            value_state: "value",
            source_path: source,
            source_type: "local_environment",
            raw_source_type: "dom",
            schema_version: AUX_SCHEMA_VERSION,
            adapter_version: namespace.startsWith("frontend") ? BUILD_VERSION : ENVIRONMENT_VERSION,
            rule_version: namespace.startsWith("frontend") ? BUILD_VERSION : ENVIRONMENT_VERSION,
            availability,
            privacy_class: privacy,
            observed_at
          });
          if (!saved) {
            snapshot.completeness = "Partial";
            snapshot.overflow = true;
            this.health.journal = "Partial";
            this.health.dropped++;
          }
          return saved;
        };
        if (signature === this.latestSignature) {
          append(
            "environment.reference",
            "snapshot_id",
            this.snapshots.at(-1)?.snapshot_id ?? null,
            "identical_observed_values"
          );
          append("environment.reference", "reason", reason, "snapshot_trigger");
          result2 = this.snapshots.at(-1) ?? null;
          return;
        }
        this.latestSignature = signature;
        append(
          "environment.snapshot",
          "snapshot_id",
          snapshot.snapshot_id,
          "local_snapshot"
        );
        append("environment.snapshot", "reason", reason, "snapshot_trigger");
        for (const [key, field2] of Object.entries(fields))
          append(
            "environment.fields",
            key,
            field2.value,
            field2.source,
            field2.availability,
            field2.privacy_class
          );
        append(
          "frontend.assets",
          "asset_set_hash",
          hash,
          "SHA256:normalized_sorted_deduplicated_URL_identifiers",
          hash ? "observed" : "unavailable"
        );
        append(
          "frontend.assets",
          "normalization_version",
          NORMALIZATION_VERSION,
          "registered_normalizer"
        );
        append(
          "frontend.assets",
          "resource_count",
          assets.length,
          "observed_asset_identifiers"
        );
        append(
          "frontend.assets",
          "overflow",
          snapshot.overflow,
          "observer_budget"
        );
        append(
          "frontend.assets",
          "completeness",
          snapshot.completeness,
          "observed_resource_window"
        );
        append(
          "frontend.assets",
          "window_start_ms",
          snapshot.window.start_ms,
          "document_resource_observation_window"
        );
        append(
          "frontend.assets",
          "window_end_ms",
          snapshot.window.end_ms,
          "document_resource_observation_window"
        );
        append(
          "frontend.assets",
          "resource_timing_availability",
          this.resourceTiming,
          "performance.getEntriesByType/resource"
        );
        append(
          "frontend.assets",
          "performance_observer_availability",
          this.observerAvailability,
          "PerformanceObserver/resource"
        );
        for (const [index, asset] of assets.entries()) {
          append(`frontend.asset.${index}`, "url", asset.url, asset.source);
          append(
            `frontend.asset.${index}`,
            "asset_url_token",
            asset.asset_url_token,
            asset.source,
            asset.asset_url_token ? "observed" : "unknown"
          );
        }
        append(
          "frontend.markers",
          "build_id",
          markers.build_id,
          "DOM#__NEXT_DATA__.buildId",
          markers.build_id ? "observed" : "unknown"
        );
        append(
          "frontend.markers",
          "deployment_marker",
          markers.deployment_marker,
          "DOM meta[name=deployment-id]",
          markers.deployment_marker ? "observed" : "unknown"
        );
        append(
          "frontend.markers",
          "conflict",
          markers.conflict,
          "registered_public_markers"
        );
        append(
          "frontend.service_worker",
          "availability",
          this.sw.availability,
          "navigator.serviceWorker"
        );
        append(
          "frontend.service_worker",
          "controller_url",
          this.sw.controller?.script_url ?? null,
          "navigator.serviceWorker.controller.scriptURL",
          this.sw.controller ? "observed" : "not_exposed"
        );
        append(
          "frontend.service_worker",
          "controller_state",
          this.sw.controller?.state ?? null,
          "navigator.serviceWorker.controller.state",
          this.sw.controller ? this.sw.controller.state ? "observed" : "unknown" : this.sw.availability === "observed" ? "absent_in_observed_payload" : "not_exposed"
        );
        for (const [index, worker] of this.sw.registrations.entries()) {
          append(
            "frontend.service_worker",
            `registration.${index}.url`,
            worker.script_url,
            "navigator.serviceWorker.getRegistrations/scriptURL"
          );
          append(
            "frontend.service_worker",
            `registration.${index}.state`,
            worker.state,
            "ServiceWorker.state",
            worker.state ? "observed" : "unknown"
          );
        }
        this.journal.terminate(
          capture.capture_id,
          "environment_observation_context"
        );
        if (this.snapshots.length >= 16) this.snapshots.shift();
        this.snapshots.push(snapshot);
        result2 = snapshot;
      }).catch(() => {
      });
      return this.chain.then(() => result2);
    }
    reset(context, reason) {
      const wasActive = this.active;
      this.generation++;
      if (context.document_id !== this.context.document_id || reason === "clear")
        this.windowStart = this.now();
      this.context = { ...context };
      this.latestSignature = null;
      if (["pause", "dispose"].includes(reason)) this.active = false;
      else this.active = true;
      if (reason === "clear") {
        this.snapshots.length = 0;
        this.assets = new AssetSet();
      }
      if (!this.active) {
        this.observer?.disconnect();
        for (const fn of this.cleanup) fn();
        this.cleanup = [];
        this.observer = null;
      }
      if (this.active && !wasActive) void this.start();
      else if (this.active) void this.snapshot("context_" + reason);
    }
  };

  // src/history/flush.ts
  function coalescedFlush(pass) {
    let inFlight;
    let requested = false;
    return () => {
      requested = true;
      if (!inFlight) {
        inFlight = Promise.resolve().then(async () => {
          try {
            while (requested) {
              requested = false;
              await pass();
            }
          } finally {
            inFlight = void 0;
          }
        });
      }
      return inFlight;
    };
  }

  // src/userscript.ts
  (() => {
    if (window.top !== window) return;
    const page = typeof unsafeWindow === "object" ? unsafeWindow : null;
    if (!page) return;
    const requests = [];
    const monitor = new Monitor(() => page.performance.now());
    const sink = monitor.sink();
    const network = new NetworkMonitor(
      monitor.journal,
      () => page.performance.now()
    );
    let environment;
    const host = installHost(page, {
      allowedOrigins: false ? ["http://127.0.0.1:43997"] : void 0,
      sink: {
        event(event) {
          try {
            network.event(event);
          } catch {
          }
          sink.event?.(event);
        },
        response(capture, response) {
          if (capture.mode === "requirements") {
            void network.response(capture, response);
            return;
          }
          const html = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() === "text/html";
          if (html) {
            void network.response(capture, response);
            monitor.journal.segmentEof(capture.capture_id);
            monitor.journal.health(
              capture.capture_id,
              "Partial",
              "non_route_html_response"
            );
          } else {
            void network.response(capture, response);
            void monitor.response(capture, response).then(() => network.reconcile(monitor.diagnostics)).catch(() => {
            });
          }
        },
        xhr(capture, xhr, kind) {
          try {
            network.xhr(capture, xhr, kind);
          } catch {
          }
          if (capture.mode !== "requirements") sink.xhr?.(capture, xhr, kind);
          network.reconcile(monitor.diagnostics);
        },
        socket(id2, socket, kind, event, context) {
          try {
            network.socket(id2, kind, event, context);
          } catch {
          }
          if (kind === "message")
            void monitor.socketMessage(
              id2,
              event.data,
              context,
              monitor.counters.ws_message_events + 1
            ).then(() => network.reconcile(monitor.diagnostics)).catch(() => {
            });
          else {
            sink.socket?.(id2, socket, kind, event, context);
            network.reconcile(monitor.diagnostics);
          }
        },
        reset(context, reason) {
          network.reset(context, reason);
          sink.reset?.(context, reason);
          environment?.reset(context, reason);
        },
        request(capture, input, init, requestClone) {
          const metadata = projectRequest(
            capture.transport === "fetch" ? init?.body : input
          );
          if (requests.length === 32) requests.shift();
          requests.push({ capture_id: capture.capture_id, metadata });
          if (capture.mode !== "requirements")
            sink.request?.(capture, input, init, requestClone);
          network.start(
            capture,
            capture.transport === "fetch" ? init?.body : input
          );
        }
      }
    });
    const challengeResources = () => {
      try {
        const scripts = [
          ...page.document.querySelectorAll("script[src],link[href]")
        ].slice(0, 500).some(
          (el) => /\/cdn-cgi\/challenge-platform\//.test(
            el.getAttribute("src") ?? el.getAttribute("href") ?? ""
          )
        );
        const timing = page.performance.getEntriesByType("resource").slice(0, 500).some((entry) => /\/cdn-cgi\/challenge-platform\//.test(entry.name));
        if (host.active)
          network.challengeResource(host.context, scripts || timing);
      } catch {
      }
    };
    if (page.document.readyState === "loading")
      page.document.addEventListener("DOMContentLoaded", challengeResources, {
        once: true
      });
    else challengeResources();
    host.health.realm = typeof page.fetch === "function" && typeof page.WebSocket === "function" ? "Available" : "Unavailable";
    try {
      const key = `blackbox:probe:${host.context.document_id}`;
      GM_setValue(key, true);
      host.health.gm = GM_getValue(key, false) === true ? "Available" : "Failed";
      GM_deleteValue(key);
    } catch {
      host.health.gm = "Unavailable";
    }
    if (host.health.gm !== "Available" || host.health.realm !== "Available")
      host.pause();
    if (host.active) {
      environment = new EnvironmentMonitor(
        page,
        monitor.journal,
        host.context,
        () => page.performance.now()
      );
      void environment.start();
    }
    const history = new HistoryStore(
      {
        get: async (key) => GM_getValue(key),
        set: async (key, value2) => {
          GM_setValue(key, value2);
        },
        delete: async (key) => {
          GM_deleteValue(key);
        },
        keys: async () => GM_listValues(),
        listen: (key, callback) => {
          const id2 = GM_addValueChangeListener(key, callback);
          return () => GM_removeValueChangeListener(id2);
        }
      },
      host.context.document_id
    );
    let historyTimer;
    history.onEpochChanged = () => host.clear();
    let flushes = 0;
    const flushHistory = coalescedFlush(async () => {
      try {
        monitor.journal.tick();
        await history.flush(monitor.journal);
        await compactClosed(monitor, network, history, () => ui.selected);
        if (++flushes % 60 === 0) await history.cleanup();
      } catch {
        history.health.status = "Failed";
      }
    });
    if (host.health.gm === "Available")
      void history.init().then(() => {
        historyTimer = setInterval(() => {
          void flushHistory();
        }, 1e3);
        void flushHistory();
      }).catch(() => {
        history.health.status = "Failed";
      });
    window.addEventListener(
      "pagehide",
      () => {
        void flushHistory();
      },
      { once: true }
    );
    window.addEventListener(
      "unload",
      () => {
        if (historyTimer) clearInterval(historyTimer);
        history.dispose();
      },
      { once: true }
    );
    const experiments = new Experiments(history.store);
    const comparison = { compare: compareBundles, baseline };
    const bundle = {
      export: async (id2) => {
        const s = monitor.journal.snapshot(id2);
        if (!s) throw Error("capture_unavailable");
        const related = monitor.journal.ids().map((id3) => monitor.journal.snapshot(id3)).filter(
          (r) => !!r && r.start.capture_id !== id2 && r.start.context.document_id === s.start.context.document_id && r.start.context.epoch === s.start.context.epoch && ["environment", "network", "requirements"].includes(r.start.mode)
        );
        const run = experiments.get(id2);
        return exportBundle(
          s,
          "1.1.0",
          run ? {
            experiment_id: run.descriptor.experiment_uuid,
            run_id: run.run_id
          } : {},
          run ? { state: "not_compared", run } : { state: "not_compared" },
          related
        );
      },
      import: importBundle
    };
    const historyActions = {
      clearCurrent: async (id2) => {
        await flushHistory();
        await history.clearCurrent(id2);
        monitor.discardCapture(id2);
      },
      clearHistory: () => history.clearHistory(),
      clearAll: async () => {
        await history.clearAll();
      },
      flush: flushHistory
    };
    const i18n = new I18n({
      get: () => typeof GM_getValue === "function" ? GM_getValue(LOCALE_KEY) : void 0,
      set: (value2) => GM_setValue(LOCALE_KEY, value2)
    });
    const ui = installPanel(
      document,
      monitor.journal,
      history,
      experiments,
      {
        context: () => host.context,
        active: () => host.active,
        pause: () => host.pause(),
        resume: () => host.resume(),
        ...historyActions,
        export: bundle.export,
        import: bundle.import,
        checkHooks: () => host.checkHooks(),
        captureStatus: () => ({
          health: host.health,
          early_page_coverage: "Unknown",
          captures: monitor.journal.ids().map((id2) => ({
            id: id2,
            state: monitor.journal.state(id2),
            route: monitor.journal.route(id2, "answer"),
            network: network.verdict(id2)
          })),
          diagnostics: monitor.diagnostics,
          environment: environment?.snapshots.at(-1) ?? null
        }),
        preferences: {
          get: (key) => GM_getValue(key),
          set: (key, value2) => GM_setValue(key, value2)
        }
      },
      i18n
    );
    const originalDispose = host.dispose.bind(host);
    host.dispose = () => {
      ui.dispose();
      originalDispose();
    };
    window.addEventListener("unload", () => ui.dispose(), { once: true });
    if (false) {
      Object.defineProperty(host, "requestMetadata", { value: requests });
      Object.defineProperty(host, "monitor", { value: monitor });
      Object.defineProperty(host, "network", { value: network });
      Object.defineProperty(host, "environment", { value: environment });
      Object.defineProperty(host, "history", { value: history });
      Object.defineProperty(host, "historyTestHooks", {
        value: {
          suspend: () => {
            if (historyTimer) clearInterval(historyTimer);
            historyTimer = void 0;
          },
          resume: () => {
            if (!historyTimer)
              historyTimer = setInterval(() => {
                void flushHistory();
              }, 1e3);
          }
        }
      });
      Object.defineProperty(host, "historyActions", { value: historyActions });
      Object.defineProperty(host, "bundle", { value: bundle });
      Object.defineProperty(host, "experiments", { value: experiments });
      Object.defineProperty(host, "comparison", { value: comparison });
      Object.defineProperty(host, "ui", { value: ui });
      Object.defineProperty(page, "__BLACKBOX_SYNTHETIC__", {
        value: host,
        configurable: true
      });
    }
  })();
})();
