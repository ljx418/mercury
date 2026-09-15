# T04.1 正式候选失败记录：approvedScope 生成常量漂移

日期：2026-09-14  
Run：`t04-r4-resolved-invocation-20260914t144755z`  
状态：`VOID / IMPLEMENTATION CONSTANT DRIFT / NOT ELIGIBLE FOR T04 EVIDENCE`

## 事实

- T04-0 通过：1152 个 dependency file、38 条 import edge、14/25/22 固定分母。
- T04-1 在 detached snapshot 完成依赖安装与 Extension build 后，Input Manifest Schema 拒绝 `governance.approvedScope`。
- runner 生成值仍为 `T04-0..T04-7 implementation`，冻结 Schema 与授权要求 `T04.1 resolved-invocation remediation and complete T04-0..T04-7 rerun`。
- 本 run 无 replay、真实 Chrome、fresh lane、seal、public archive 或 ExitManifest；`snapshot-input-manifest.json`、`t04-1-result.json` 和 `.infra/snapshot-location.json` 为 0 字节。

## 处置

- 本 run 永久作废，不得补写、续跑、封存或跨 run 复用。
- 新增 T04.1a 微子阶段，只允许让 manifest governance 复用已由授权校验使用的 `T04_APPROVED_SCOPE` 单一常量，并增加回归断言。
- 修复后必须重新执行语法、16 项 T04 Node tests、授权原始字节校验及独立只读代码审查。
- 只有 `Fatal=0 / Major=0` 才能用全新 run ID 从 T04-0 重启。

门禁保持：`T04.1 FAIL / REPLAN`、`PX-5 FAIL / REOPENED`、`PX-6 BLOCKED`。
