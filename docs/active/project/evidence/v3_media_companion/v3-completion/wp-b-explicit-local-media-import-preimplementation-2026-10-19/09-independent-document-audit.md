# WP-B 独立文档审查与闭环

日期：2026-10-19  
审查者：隔离 Codex Agent（只读）  
范围：WP-B 实施前包、3 个 schema、5 个 fixture/registry、原型和 Archify 架构  
实现代码：未审、未改

## 审查轨迹

首轮结论为 `NO-GO / Fatal 0 / Major 5 / Minor 3`。Codex 主会话集中修订后只执行一次 focused recheck，结论为 `NO-GO / Fatal 0 / Major 3 / Minor 1`；未重复全文外审。focused recheck 仅检查首轮问题是否关闭，并发现三项机械合同矛盾与一个 enum 缺口。随后由 Codex 对这四项做限定修订和 deterministic verifier 复算。

## 闭环表

| Finding | 修订 | 固定证明 | 状态 |
|---|---|---|---|
| Store/重启 GET 不具体 | 冻结 `LocalMediaImportStore` SQLite 字段、FULL/CAS、startup scan、manifest mismatch | B06/B07/B26；内部 schema 禁止 token/name/path | CLOSED |
| ASR/视觉 early cleanup | 冻结 `LocalMediaConsumerBarrier`、T1-T4、route-aware callback、双 terminal cleanup owner | B23/B26；architecture 12 entities | CLOSED |
| ASGI >1 MiB 被误拒 | 1 MiB 改为 writer `memoryview` 内部分片，不是 transport chunk 限制 | B11 64 KiB/1 MiB+1/8 MiB 同 SHA | CLOSED |
| Origin/CORS/auth 不完整 | privileged path；exact extension Origin；bearer；token；18 码；writer 前拒绝 | B04；verifier 精确 methods/headers/code count | CLOSED |
| 100 MB/1 GB fixture 不可复算 | 私有有声动态 seed + verified ffmpeg 真转码 + allocated ratio + ASR/frame/resource oracle | asset registry；B29/B30 | CLOSED |
| 架构缺 store/barrier/双消费者 | Archify 12 节点显式展示 store、双沙箱、barrier、ASR、视觉 | showcase 9/9，composition 0/0 | CLOSED |
| ImportedVisualReceipt 未冻结 | 新增内部 schema、canonical receipt digest、1..8 frames、mutation | internal fixture + frame-nine mutation | CLOSED |
| 原型 tabs/状态 A11y 缺口 | tablist/tab/tabpanel/aria-controls/selected、aria-pressed、live status/progressbar | verifier DOM assertions | CLOSED |
| CORS methods 漏 POST | exact methods 改为 `POST,GET,PUT,DELETE,OPTIONS` | `cors_methods_exact` | CLOSED |
| hard-kill 注入点不可达 | 改为 T1/T2/T3、双 receipt 删除前、删除后 T4 前、两种 terminal-first | `acceptance_hard_kill` | CLOSED |
| artifact id 前缀不兼容 | 内部 schema 使用既有 `artifact_[a-f0-9]{32}` | positive fixture + schema validation | CLOSED |
| internal failureCode 任意字符串 | store failureCode 改为 null + 18 码闭集 | unknown-code mutation | CLOSED |

## 最终结论

`Fatal 0 / Major 0 / Minor 0`。文档、架构、合同、开发顺序和 B01-B30 已达到产品实现所需的可执行程度。第三轮全文外审没有新增信息价值，按 `project-stage-workflow.md` 5.1 不执行。

限定：Archify deterministic deliver 已通过；本机 Linux Chrome 不可用，因此 architecture automated browser visual-check 为 `skipped/chrome-unavailable`，不冒充视觉人工验收。该限制不影响合同和产品实现门限；产品 UI 仍由 B29/B30 的真实浏览器验收覆盖。
