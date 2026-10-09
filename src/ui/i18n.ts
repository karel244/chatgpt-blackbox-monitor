export type Locale = "zh-CN" | "en-US";
export const LOCALE_KEY = "blackbox.ui.locale";
export const messages = {
  "Scale Main": "等比例缩放主面板",
  "Scale Workbench": "等比例缩放工作台",
  "No capture in current scope": "当前范围暂无捕获",
  "Recent meaningful conversation": "最近有效对话",
  "No conversation evidence yet. Send a new message to inspect it. Click the capsule to open the panel.":
    "暂无本轮对话证据。发送一条新消息后查看。点击胶囊打开面板。",
  "Showing a recent conversation summary. Export ZIP uses Current capture above; export older rounds from History.":
    "当前显示的是最近有效对话摘要。导出 ZIP 以顶部“当前捕获”为准；旧轮请到“历史”导出。",
  "Evidence details": "证据详情",
  "Detailed diagnostics": "详细诊断",
  "Technical details": "技术详情",
  "Time unknown": "时间未知",
  "Duration unknown": "耗时未知",
  "Export this history round": "导出该轮历史",
  "WebSocket diagnostics": "WebSocket 诊断",
  "Transport failure": "传输故障",
  Online: "在线",
  Offline: "离线",
  "More options": "更多选项",
  "Evidence Workbench": "完整取证工作台",
  "Workbench navigation": "工作台导航",
  "Back to controls": "返回主面板",
  "Route evidence": "路由证据",
  "A/B compare": "A/B 对比",
  "System / Health": "系统 / 健康",
  "Advanced settings": "高级设置",
  "More evidence": "更多证据",
  "Confirm clear current":
    "确定删除当前捕获的内存证据和该轮已保存历史吗？此操作无法撤销。",
  "View details": "查看详情",
  "Quick controls": "快速控制面板",
  "Advanced evidence": "高级取证",
  "Monitor title": "黑盒监控",
  "Restore monitor": "恢复监控器",
  "Drag header": "拖动标题栏",
  Overview: "概览",
  Route: "路由",
  Network: "网络",
  Environment: "环境",
  "Raw fields": "查看原始字段",
  "Route verdict": "路由判定",
  "Response effort": "响应思考强度",
  Transport: "传输方式",
  Source: "来源",
  "HTTP status": "HTTP 状态",
  Cloudflare: "Cloudflare 状态",
  "Retry-After": "重试等待（Retry-After）",
  PoW: "PoW 摘要",
  "WebSocket events": "WebSocket 事件数",
  "All history": "查看全部历史",
  Settings: "设置",
  "Data management": "数据管理",
  Diagnostics: "诊断",
  "Check hook health": "检查捕获挂钩状态",
  "Capture status": "查看捕获状态（P1-P6）",
  "Confirm clear history":
    "确定删除已结束（Closed）的已保存历史记录吗？正在捕获的证据不受影响；此操作无法撤销。",
  "Confirm clear all":
    "确定清除现有本地证据吗？无法撤销。监测不会暂停，之后仍可产生新记录；界面偏好和已下载 ZIP 将保留。",
  browser: "浏览器",
  browser_version: "浏览器版本",
  os: "操作系统",
  viewport: "可视区",
  timezone: "时区",
  online: "在线状态",
  build_marker: "构建标记",
  asset_set: "资源集",
  fast_convo: "快速对话标记（fast_convo）",
  Evidence: "证据",
  Page: "页码",
  Details: "详情",
  "Request start": "请求开始",
  model: "请求模型",
  model_slug: "服务器路由",
  resolved_model_slug: "解析路由",
  thinking_effort: "思考强度",
  first_content: "首个内容",
  "ChatGPT Blackbox Monitor": "ChatGPT 黑盒监控器",
  "Open evidence": "打开取证面板",
  Hide: "隐藏",
  Pause: "暂停监测",
  Resume: "继续监测",
  Move: "移动",
  "Reset position": "重置位置",
  "Current capture": "当前捕获",
  "Daily capsule": "日常小胶囊",
  Requested: "请求模型",
  "Server Route": "服务器路由",
  "Resolved Route": "解析路由",
  "Thinking Effort": "思考强度",
  "Capture Health": "捕获状态",
  Duration: "总耗时",
  "Network Status": "网络状态",
  "Forensic evidence": "取证面板",
  Close: "关闭",
  "Evidence section": "证据分类",
  Timeline: "时间线",
  "A/B/C/D": "A/B/C/D 证据",
  "Transport / Timing": "传输 / 时序",
  "Network / Cloudflare / PoW / IP": "网络 / Cloudflare / PoW / IP",
  "Environment / Frontend Build": "环境 / 前端构建",
  "Capture Health / Storage": "捕获状态 / 存储",
  History: "历史",
  "Redaction preview": "脱敏预览",
  Experiment: "实验",
  Compare: "对比",
  "Previous page": "上一页",
  "Next page": "下一页",
  "Export ZIP": "导出 ZIP",
  "Export history": "导出历史",
  "Clear current": "清除当前捕获",
  "Clear history": "清除历史",
  "Clear all": "清除全部证据",
  "Import evidence ZIPs for local comparison": "导入证据 ZIP 进行本地对比",
  "Evidence content": "证据内容",
  "Local experiment descriptor JSON": "本地实验描述 JSON",
  "Create experiment": "创建实验",
  "Save descriptor": "保存实验描述",
  "Import local experiment descriptor": "导入本地实验描述",
  "Export descriptor": "导出实验描述",
  "Optional shared 64 hex key": "可选：共享的 64 位十六进制密钥",
  "Optional shared local experiment key": "可选：本地共享实验密钥",
  "Save local key": "保存本地密钥",
  "Optional transient exact user content": "可选：仅临时使用的准确用户内容",
  "Optional transient user content for HMAC association":
    "可选：用于 HMAC 关联的临时用户内容",
  "Bind current run": "绑定当前运行",
  "Clear experiment": "清除实验",
  "Timing ratio flag threshold": "时长比值提示阈值",
  "Timing absolute difference threshold in ms": "时长绝对差提示阈值（毫秒）",
  "Compare / add pair": "对比 / 添加配对",
  Language: "语言",
  "Operation failed or unsupported input. History remains available.":
    "操作失败或输入不受支持；历史仍可查看。",
  "Use arrow keys on Move or drag it. Reset position restores the corner.":
    "聚焦“移动”后使用方向键，或拖动按钮。“重置位置”恢复到角落。",
  "Sanitized local ZIP exported. Review it before sharing.":
    "已导出脱敏的本地 ZIP；分享前请检查内容。",
  "Local import validated; no history writes or upload.":
    "本地导入已验证；没有写入历史或上传。",
  "Edit task, replicate, browser label and declared conditions; share the same UUID with the second browser.":
    "编辑 task、replicate、浏览器标签及声明条件；与另一浏览器共享同一 UUID。",
  "Descriptor saved locally. Account condition is manual declaration only.":
    "实验描述已保存到本地；账号条件仅为手动声明。",
  "Descriptor imported locally.": "实验描述已导入本地。",
  "Shared key stored only locally; absent from evidence exports.":
    "共享密钥仅保存在本地，不进入导出的证据。",
  "Independent run bound. Content discarded; hash does not prove equal context.":
    "已绑定独立运行；正文已丢弃，摘要不能证明上下文相同。",
  "Local experiment cleared.": "已清除本地实验。",
  "Import two local evidence ZIPs. Explicit UUID/task/replicate required; display IDs do not pair runs.":
    "请导入两份本地证据 ZIP；必须匹配明确的 UUID/task/replicate，显示 ID 不用于配对。",
  "History export failed. Check operation health.":
    "历史导出失败，请查看操作状态。",
  " Related context unavailable; exported evidence remains conversation-only.":
    " 相关上下文不可用；导出证据仅包含该对话轮次。",
  "Unknown: no bound capture in this visit.":
    "未知：本次访问没有已关联的捕获。",
  "Blackbox: Hook Unavailable (page realm)":
    "黑盒监控：捕获挂钩不可用（页面域）",
  "Hook Unavailable: unsafeWindow page realm not accessible.":
    "捕获挂钩不可用：无法访问 unsafeWindow 页面域。",
  "Blackbox: Show monitor": "黑盒监控：显示监控器",
  "Blackbox: Pause / Resume": "黑盒监控：暂停 / 继续",
  "Blackbox: Clear current memory": "黑盒监控：清除当前内存",
  "Blackbox: Clear saved history": "黑盒监控：清除已保存历史",
  "Blackbox: Clear all local evidence": "黑盒监控：清除全部本地证据",
  "Blackbox: Export current evidence ZIP": "黑盒监控：导出当前证据 ZIP",
  "Blackbox: Check hook health": "黑盒监控：检查捕获挂钩状态",
  "Blackbox: Capture status (P1-P6)": "黑盒监控：查看捕获状态（P1-P6）",
  "No capture available": "没有可用的捕获",
  "Evidence export failed; no file saved.": "证据导出失败，未保存文件。",
} as const;

export const englishConfirmations: Record<string, string> = {
  "Confirm clear current":
    "Delete the current capture's in-memory evidence and its saved history? This cannot be undone.",
  "Confirm clear history":
    "Delete saved history records that have ended (Closed)? Active captures are unaffected. This cannot be undone.",
  "Confirm clear all":
    "Clear existing local evidence? This cannot be undone. Monitoring continues and may create new records; UI preferences and downloaded ZIPs remain.",
};

export const enums: Record<string, string> = {
  Unknown: "未知",
  Complete: "完整",
  Partial: "部分完整",
  Failed: "失败",
  "Route Match": "路由一致",
  "Route Mismatch": "路由不一致",
  "Route Conflict": "路由冲突",
  Conflict: "冲突",
  OK: "正常",
  "HTTP Error": "HTTP 错误",
  "Challenge Confirmed": "已确认挑战",
  "Challenge Suspected": "疑似挑战",
  "Rate Limited": "请求受限",
  "Server Error": "服务器错误",
  "Transport Failure": "传输失败",
  Aborted: "已中止",
  Capturing: "捕获中",
  Settling: "收尾确认中",
  Closed: "已结束",
  Equal: "相同",
  Different: "不同",
  "Not comparable": "不可比较",
  Paused: "已暂停",
  Ready: "已就绪",
  Available: "可用",
  Unavailable: "不可用",
  Disabled: "已禁用",
  Idle: "空闲",
  Running: "运行中",
  Success: "成功",
  Pending: "待处理",
  "read-only": "只读",
  not_compared: "未对比",
  compared: "已对比",
  minimal: "最低",
  low: "低",
  medium: "中",
  high: "高",
  extended: "扩展",
  "Evidence insufficient: capture Partial/Unknown/Failed":
    "证据不足：捕获为部分完整、未知或失败",
  observed: "已观察",
  absent: "缺失",
  not_exposed: "未公开",
  unavailable: "不可用",
  inferred: "推断",
  unknown: "未知",
  confirmed: "已确认",
  candidate: "候选",
};

// These keys are UI wrappers, not Evidence keys or values. Raw JSON inputs,
// model IDs, paths, enums in export/import and descriptor editors stay intact.
export const displayLabels: Record<string, string> = {
  health: "捕获状态",
  controls: "控制记录",
  storage: "存储",
  ui_style: "界面样式",
  ui_operation: "界面操作",
  completeness: "完整性",
  lifecycle: "生命周期",
  status: "状态",
  method: "方式",
  reason: "原因",
  stage: "阶段",
  operation: "操作",
  verdict: "判定",
  page: "页码",
  pages: "总页数",
  total: "总数",
  level: "等级",
  index: "索引",
  field: "字段",
  value: "原始值",
  old_value: "原始旧值",
  new_value: "原始新值",
  scope: "范围",
  source: "来源",
  transport: "传输方式",
  channel: "通道",
  observed: "观察时间",
  availability: "可用性",
  association: "关联",
  late: "迟到",
  revision: "修订",
  timing: "时序",
  fields: "字段对比",
  timing_flag: "时长提示",
  conclusion: "结论",
  limits: "限制",
  order: "次序",
  left: "左侧",
  right: "右侧",
};
const enumFields = new Set([
  "status",
  "completeness",
  "lifecycle",
  "verdict",
  "availability",
  "state",
  "conclusion",
  "effort",
  "thinking_effort",
]);
const rawFields = new Set([
  "value",
  "old_value",
  "new_value",
  "raw",
  "descriptor",
  "conditions",
  "browser_label",
  "source",
  "source_path",
]);
export class I18n {
  private current: Locale;
  private listeners = new Set<() => void>();
  constructor(
    private preference?: { get: () => unknown; set: (value: Locale) => void },
  ) {
    let value: unknown;
    try {
      value = preference?.get();
    } catch {
      /* unavailable preference uses default */
    }
    this.current = value === "en-US" ? "en-US" : "zh-CN";
  }
  get locale() {
    return this.current;
  }
  setLocale(value: unknown) {
    if ((value !== "zh-CN" && value !== "en-US") || value === this.current)
      return;
    // Persist first: a failed setting write must not silently promise persistence.
    this.preference?.set(value);
    this.current = value;
    for (const fn of this.listeners) fn();
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  t(key: string): string {
    if (this.current === "en-US")
      return Object.hasOwn(englishConfirmations, key)
        ? englishConfirmations[key]!
        : key;
    if (key.startsWith("Export history "))
      return messages["Export history"] + key.slice("Export history".length);
    return Object.hasOwn(messages, key)
      ? messages[key as keyof typeof messages]
      : key;
  }
  enum(value: unknown): string {
    const raw = String(value);
    return this.current === "zh-CN" && Object.hasOwn(enums, raw)
      ? enums[raw]!
      : raw;
  }
  duration(value: string) {
    if (this.current === "en-US") return value;
    return value.replace(/^(\d+\.\d+)s (total|elapsed)$/, (_, n, kind) =>
      kind === "total" ? `${n} 秒` : `${n} 秒（进行中）`,
    );
  }
  composite(health: string, verdict: string, paused: boolean) {
    const separator = this.current === "zh-CN" ? "；" : "; ";
    return `${paused ? this.enum("Paused") + separator : ""}${this.enum(health)}${separator}${this.enum(verdict)}`;
  }
  display(value: unknown, key = ""): unknown {
    if (this.current === "en-US" || rawFields.has(key)) return value;
    if (Array.isArray(value)) return value.map((v) => this.display(v, key));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          displayLabels[k] ?? k,
          this.display(v, k),
        ]),
      );
    if (typeof value === "string")
      return enumFields.has(key)
        ? this.enum(value)
        : key === ""
          ? this.t(value)
          : value;
    return value;
  }
}
