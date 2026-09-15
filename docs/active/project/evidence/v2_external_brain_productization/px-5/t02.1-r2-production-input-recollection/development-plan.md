# T02.1 R2 Production Positive 输入全量重采开发计划

日期：2026-09-11  
状态：`APPROVED FOR IMPLEMENTATION`  
上游：T02 限定范围 PASS；Claude Code CLI 已批准路线 A。旧 run `t02-r2-raw-20260911T143100` 保持只读且不得拼接。

## 1. 目标

创建一个全新的单 run 真实 Chrome 原始证据包，在不修改 Runtime/Extension 产品行为的前提下，同时满足 T02-A01..A12 与 T03 production positive base 的四项缺口：

```text
view_source trusted entry >= 3
source corpus = 6 real_web + 3 explicit_local_document + 3 note_markdown
invalid/forbidden route recovery >= 2
typed AxeResult >= 1 and typed KeyboardResult >= 1
```

新 run 使用 `t02-r2-raw-production-input-<timestamp>` 独立命名空间、独立 snapshot commit、独立 build/profile/runtime/database 和独立 seal。禁止覆盖、修改、复制事件或引用旧 `143100` run；禁止跨 run 合并。

## 2. 允许修改的实体

| 实体 | 修改目的 |
|---|---|
| `apps/chrome-extension/e2e/chrome-v2-px-r2-raw-evidence.mjs` | 复用 R2 runner，增加完整 corpus、第三次真实 `view_source`、错误路由恢复、Axe/Keyboard 结构化采集 |
| `docs/active/project/contracts/v2_px_raw_run.schema.json` | 允许 `route_observation.errorCode` 承载 canonical route error；不改变产品 API |
| `apps/chrome-extension/e2e/lib/v2PxRawCollector.node-test.mjs` | 增加 route error 与 structured command artifact 回归 |
| `t03-r3-semantic-reporting/audit-t03-input-readiness.py` | 支持任意新 run，只读解引用 typed artifact，并按真实分子条件生成 gap |
| 本目录文档与新 `runs/<runId>/` | 计划、审计、验收和不可变证据 |

不允许修改 `services/local-runtime/**`、Extension 生产组件、Runtime HTTP/Adapter 合同、63 RuleId、109 contract requirement 或 G1-G7 分母。

## 3. 实施顺序

1. 从已审查 T02 snapshot `c2409206e4a337314b2995665780da1ca86c7a8d` 创建新的 detached worktree，只带入本计划允许的采集器/schema/test/readiness 变更并提交为新 snapshot。
2. runner 在同一 Runtime session 内保存 6 个网页来源、3 个用户 note/markdown；3 个本地文档继续经真实 Permission grant/scan/import/revoke 流程创建。每个 source 绑定预登记原始字节、SHA-256、`sourceSampleId`、Runtime `sourceId` 和 `operationId`。
3. 三个入口均使用 native Side Panel 的可信 CDP click；`view_source` 至少三次，必须各自形成 `dom_action -> background_request -> background_response -> route/runtime authority` 链。
4. 对至少两类 canonical 错误执行真实 route：记录错误 route observation，再点击真实恢复按钮，记录回到 Source Library 的 recovery observation。不得只在 report 中补 `errorCode`。
5. 对实际 Side Panel 与 Workspace 执行 axe-core；保存原始 JSON 结构化结果。执行键盘 Escape/焦点返回、Tab 可达、无 trap 和 reduced-motion 检查，保存 typed KeyboardResult。自动化扫描不冒充屏幕阅读器或完整 WCAG 合规。
6. 执行 fresh build、typecheck、collector test、前端全量、Runtime 全量与 T01 Chrome 回归；随后启动全新真实 Chrome/Runtime 采集并封存。
7. 对新 run 执行 raw Schema/invariant/seal/hash/privacy/cleanup 检查和 T03 input readiness。任何一项失败都保留为失败 run，重新计划后创建另一个全新 run。
8. 通过后生成 changed-files、contract-changes、test-results、PRD/架构/false-green 检视、acceptance-result、handoff，并重建不超过 20 个平铺文件的 Claude Code CLI 审计包。

## 4. 真实数据口径

- `real_web`：当前真实 host page 1 项，加 5 项来自项目已留存的真实网页 DOM 原始快照；每项使用不同 raw bytes/hash。
- `explicit_local_document`：3 项由用户已授权的项目文档副本经 PermissionRoot 扫描导入，原始内容只留在 private evidence。
- `note_markdown`：3 项用户创作的项目 ADR Markdown，以 `user_note` sourceType 保存；每项使用不同 raw bytes/hash。
- Source sample ID 与 Runtime source ID 分离。`sourceSampleId` 只作验收 corpus 身份，不能冒充产品 ID。

## 5. 停止条件

- 需要改产品代码、Runtime API 或权限/遗忘语义。
- 无法以真实可信 click 或真实 Runtime response 建立证据。
- Axe/Keyboard 存在 Serious/Critical 或关键键盘断言失败。
- 12 个 source 不能在同一新 run 内完成，或只能通过拼接旧 run 达成。
- invalid/forbidden 只能伪造字段、不能由真实 route 与恢复动作产生。
- 公开证据出现 token、私人绝对路径或 private artifact。
- 清理后仍有 Chrome/Runtime/profile/port 存活。

命中任一项时，新 run 不得封为成功，T03 继续 No-Go。
