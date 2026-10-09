# ChatGPT Blackbox Monitor V1.1 当前使用指南

当前公开版本：**1.1.0**。默认简体中文，可切换 English；以下说明对应当前四个 Tab 和三层界面。

## 安装与最常用流程

在 Chrome/Edge 安装[官方 Tampermonkey](https://www.tampermonkey.net/)，确认允许用户脚本；按浏览器实际设置使用 Allow User Scripts 或 Developer Mode，见[官方权限帮助](https://www.tampermonkey.net/faq.php?ext=fcmf&q=Q209&updated=true&version=4.19.6175)。从 [v1.1.0 Release 下载脚本](https://github.com/karel244/chatgpt-blackbox-monitor/releases/download/v1.1.0/chatgpt-blackbox-monitor.user.js)，在 Tampermonkey 导入、保存并启用，刷新 ChatGPT。Tampermonkey Blackbox 业务菜单为 0。

**打开 ChatGPT → 发一条新消息并等回答 → 看胶囊；有异常或要查看来源再打开面板。** 暂无可展示对话时，会在胶囊 tooltip/Main 说明提示首次动作。已有 conversation 但缺充分 A 级服务器路由时仍可未知，发送新消息不保证解决。

## 入口、Main 与 Workbench

- 初始只显示约 **380×36** 单行胶囊：路由状态、模型、请求思考强度、客户端可观察耗时。模型来源优先服务器声明→解析声明→请求；网络异常优先显示。完整模型与来源在 tooltip。未知不假造正常，不自动展开面板。
- 点击胶囊打开约 **460×560 Main**；四 Tab：**路由、网络、环境、历史**，默认路由。顶部 ···/×；×返回胶囊。主层保留重要结论，证据详情/详细诊断/技术详情/原始字段默认折叠，真实控件可展开。
- 底部暂停/继续、导出 ZIP、高级取证。暂停控制监测；关闭只回入口。···→设置可切简体中文/English、隐藏、进入数据管理和诊断。
- 高级取证才打开约 **960×680 非模态 Workbench**；日常不用打开。完整时间线、路由/网络/环境、全部历史、A/B 对比、系统/健康与高级设置都在工具内。返回主面板回 Main，×或组件内 Escape 回入口；不拦截页面输入键盘。
- 隐藏后页面边缘留下约 **16×32 恢复点**；点击回胶囊。Hide 不 Pause，capture 继续。没有 A/B/C 模式开关，也没有移动/重置按钮。

## 移动与等比例缩放

拖动胶囊或面板标题栏；移动达到 5px 才按拖动处理，松手自动记位。各 surface 位置独立、自动防出界。

拖动 Main/Workbench 右下角可整体等比例缩放；聚焦缩放手柄后用方向键微调。Main 和 Workbench 分别记忆 **0.75–1.40 scale**；字体、按钮、间距和窗口同比缩放，胶囊与恢复点不跟随。没有 slider、Move 或 Reset。

## 当前捕获、最近摘要与导出

Current Capture 只列当前 document/visit/epoch 中仍在 Journal 的 live/reload 轮次。Main↔Workbench 共用一个 selector 和 authoritative selected/manual 状态；旧范围或已释放轮次到 History 查看/导出。

Main/Launcher 默认可能显示同 document 的**最近有效对话摘要**。这只是 display anchor，不改变 Current selector。recent 说明明确：**摘要展示 ≠ 当前捕获/导出对象；导出 ZIP 以顶部“当前捕获”为准，旧轮请到“历史”导出。** 手工选定空 reload 仍诚实显示未知，没有当前轮时不能凭摘要导出当前证据。

## 四个 Tab 怎么看

- **路由**：判定→请求模型/服务器路由/解析路由/思考强度。fast_convo 和 A/B/C/D 在证据详情，机器字段在原始字段；不要把页面标签升级成服务器证据。
- **网络**：正常先看状态/HTTP；挑战、Retry-After、传输失败或异常 WS 会浮出。403/429 不直接证明账号问题或模型降级，更多来源在详细诊断。
- **环境**：浏览器、可视区宽×高/DPR、时区、在线状态；build/hash 在技术详情，不推断后台算力。
- **历史**：时间+模型优先，次行路由/请求强度/耗时，短ID为次级信息；↗导出那轮。Main 最近20轮，全部历史进入 Workbench。进入时恢复快照，导出复用快照与安全 related context；新保存轮次需离开再进入刷新。

## 未知、部分完整、冲突

**未知/Unknown**＝没有充分可观察证据：首次没请求与已有请求但缺可靠关联的服务器声明不同；不等于故障或降级。**部分完整/Partial**＝有证据但覆盖不全，可能涉及捕获/关联/恢复或声明的脱敏间隔；不是回答内容不完整。**Conflict/冲突**＝同轮公开声明互相冲突，不选赢家。**不可比较**＝比较条件或请求别名不满足要求，不是模型故障。

Timeline 每页最多50条；Raw fields 展开/收起状态跨1秒刷新保留，表单焦点和值稳定。模型ID、原始enum/schema、机器JSON保留原样，中文只改变显示。

## 胶囊与证据等级

| 字段 | 含义 |
|---|---|
| Requested | 客户端请求中的 model，即 B 级请求意图 |
| Server Route | 已观察到的服务器 STE 声明 |
| Resolved Route | 已观察到的 resolved 路由声明，与 STE 分开 |
| Thinking Effort | 主要显示请求 B 的 effort；响应 C 在取证面板查看 |
| Capture Health | 观察完整性和路由判定；Unknown、Partial、Failed 不表示安全或风险分数 |
| Duration | 捕获期间客户端 elapsed，Closed 后客户端 total；reload 原时长无法还原时 Unknown |
| Network Status | 独立 HTTP、Cloudflare 或传输状态，不改写模型路由结论 |

A 是支持协议和可信关联范围内服务器显式公开的路由；B 是请求意图；C 是 assistant metadata；D 是 DOM 标签。C/D 永不升级成 A。Unknown 表示没有充分观察；Conflict 表示声明互相冲突，保留事件，不猜一个赢家。Route Match 只说明可见请求和服务器声明一致，不证明内部执行。Network 的 Rate Limited、Server Error、Challenge Confirmed 等均不代表账号被封或模型被降级。

Current capture 可选择当前访问内的轮次；默认按请求开始时间选择，旧页面的迟到 metadata 不应抢当前轮。Timeline 分页显示，保留原事件索引、来源、通道和观察时间；合法脱敏删除可能留下有声明的索引间隔并标 Partial。

## History 与本地证据包

快速面板历史显示最近20轮，高级取证选择 History 查看 GM storage 中的安全历史并导出单轮。Storage 和 Capture Health 显示存储与观察状态；Redaction preview 可查看导出脱敏说明。当前配额为 200 个 conversation rounds；environment/network/requirements 等 auxiliary 不占轮数，但仍受 30 天、50 MiB 和既有预算约束，并有每轮、队列和事件数量上限。History 使用进入时恢复的同一快照，导出也从它取得同 document/epoch 的安全 related context，不再全盘重读 GM。需要刷新新保存记录时，离开再进入 History。Capture Health / Storage 可查看 operation、stage、status 和安全错误码；失败不会把原始异常或秘密写进证据。

Export ZIP 在本机下载七文件 Evidence Bundle。包内有 manifest、summary、timeline、network、environment、comparison 和安全报告。没有比较时，comparison 为 not_compared。包不含完整 Prompt/Answer、认证 Cookie/token、任意原始 body；必要 ID 在默认导出中映射。映射和摘要不保证绝对匿名。SHA-256 证明包内完整性，不是服务器签名。

第二个浏览器也可独立捕获、导出，再把两个 ZIP 通过面板的 **Import evidence ZIPs for local comparison** 导入任意已安装脚本的浏览器。本地验证 schema、digest、大小、文件路径和来源；导入不会上传、执行包内内容或写入捕获历史。失败时显示 Operation failed，请保留原包和错误，不把失败包当作已验证数据。

## A/B 实验

1. 选择 Experiment，点击 Create experiment，填写 task、replicate、非账号 browser label 和声明的 conditions，Save descriptor。
2. Export descriptor，把本地 JSON 在另一浏览器用 Import local experiment descriptor 导入。必须使用同一 experiment UUID、task、replicate；相同显示名称不会自动配对。
3. 如需关联相同用户内容，可在两边保存同一个可选 shared local key。密钥只存在本地，不进入证据包；用户内容只瞬时用于 HMAC，绑定后清空输入，不保存正文。没有同一个 key，Prompt association 为 Not comparable。摘要相同也不证明历史、memory、工具状态或服务随机性相同。
4. 每边选中对应 capture，Bind current run，分别 Export ZIP。独立 run_id 保留，不能把同一 run 与自己当作独立对照。
5. 本地导入两个 ZIP，查看 Compare / add pair。每个字段显示 Equal、Different、Unknown 或 Not comparable；缺失值不会被当成 Equal。

账号条件只由用户声明，不读取邮箱或账号身份。普通 Chat、Work、Search、附件、历史等条件不应混入同一 baseline。建议每种可比条件至少 3–5 对；面板的 median/range 是描述统计，单对不产生统计显著性结论。自定时长阈值只产生 timing flag。

同样 metadata 的 1 秒与 20 分钟对照，只能描述客户端观察时长差。A 缺失时路由 Unknown；Partial 时证据不足；双 A、一致来源链、可比版本且双方 Closed 时，可报告该配对样本客户端时序明显不同。不能证明 reasoning budget、GPU、worker 调度、hidden reasoning、内部工具或账号待遇。

## 清空与卸载

所有 Clear 不能撤销，先导出要保留的证据：

- **Clear current**：flush 后删除当前捕获的内存证据与该轮已保存历史，不是只清内存。
- **Clear history**：只删除已结束（Closed）的已保存记录，不清除所有正在监测的数据。
- **Clear all**：清除现有本地证据及实验数据，使用新 clear epoch 使其他同 profile tab 的旧写入失效。**不暂停监测**，之后仍可产生 post-clear environment/context_clear 等新记录；旧证据删除不意味着 Journal 永远为空。语言/位置/Main 和 Workbench scale 偏好保留。
- **Clear experiment**：清相应实验数据，与上述范围不同。

已下载到磁盘的 ZIP 都不会自动删除。Hide/Pause 不清 GM 历史；GM storage 不是加密保险库。数据通常保存在 Tampermonkey 本地；当前产品没有 telemetry/自动上传路径，不替浏览器/扩展同步作承诺。

请求/响应可能被瞬时解析以提取白名单字段，不持久保存完整 Prompt/Answer，不主动采集认证 Cookie/Authorization/token。脱敏不等于绝对匿名；分享 Evidence ZIP 前人工检查仍含的时间/模型/路由/网络/环境线索。安全 Issue 字段和禁止上传的内容见[README](../README.md#报-issue)。

首次公开版采用**手动更新**，不宣称自动更新已验证；从确定的官方来源获取 production 脚本，核对 hash、在 Tampermonkey 替换并刷新，避免重复启用。官方入口：[Repository](https://github.com/karel244/chatgpt-blackbox-monitor) / [Latest Release](https://github.com/karel244/chatgpt-blackbox-monitor/releases/latest)，见[发布清单](GITHUB_RELEASE_CHECKLIST.md)。

卸载时如需清证据，先按实际范围 Clear，再在 Tampermonkey 删除脚本、刷新 ChatGPT；下载文件另行删除，Clear all 保留 UI 偏好。

## 验证范围与限制

产品基线经过 Chrome/Edge + official Tampermonkey 5.5.0 合成验收；公开 v2 裁剪了来源未确认的测试文件；后续公开 metadata 更新未改变功能逻辑，并已重新通过 format/lint/typecheck/unit 141/141/integration 55/55/production build/synthetic build。早期包装检查范围列在[历史包装报告](GITHUB_PUBLIC_RELEASE_PACKAGING_REPORT.md)。

Real-user live smoke: preliminary positive feedback after performance-fixed RC.

Authenticated Chat/Work：**Not validated**。Native BFCache restore：**Not validated / Harness unavailable in Playwright automated harness**。真实 back/forward 再注入和 synthetic persisted 生命周期不代表 native restore 已通过。详见[已知限制](KNOWN_LIMITATIONS.md)。
