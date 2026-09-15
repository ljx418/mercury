# T04.1 正式候选失败记录：Snapshot Input Manifest 授权版本不兼容

日期：2026-09-14  
Run：`t04-r4-resolved-invocation-20260914t142529z`  
状态：`VOID / CONTRACT COMPATIBILITY FAILURE / NOT ELIGIBLE FOR T04 EVIDENCE`

## 事实

- `T04-0` 通过：依赖闭包 1152 个文件、38 条 import edge、14 个 acceptance ID、25 个 requirement、22 个 failure code。
- `T04-1` 在 detached snapshot 中完成构建，但在写入 Snapshot Input Manifest 时 fail-closed。
- `snapshot-input-manifest.json` 与 `t04-1-result.json` 均为 0 字节；本 run 没有执行 replay、真实 Chrome、fresh lane、negative fixture、公开打包或独立实现审计。
- 本 run 没有 `ExitManifest`、public archive、seal 或可供 PX-6 使用的 candidate。

## 根因

`v2_px_snapshot_input_manifest.schema.json` 仍冻结原 T04 的治理常量：

- 旧 `independent-document-audit.md`；
- 旧 `implementation-authorization.json`；
- `stage=T04`；
- `schemaVersion=v2-px-t04-implementation-authorization/v1`；
- `approvedScope=T04-0..T04-7 implementation`；
- `additionalProperties=false` 且未登记 T04.1 授权必需的 `userId`。

T04.1 runner 正确提交了新的审计、授权、阶段、scope 与 `userId`，因此 Schema 拒绝。该失败是合同版本兼容缺口，不是产品体验或真实 Chrome 失败。

## 处置

- 本 run 永久作废，仅保留为诊断证据；不得续跑、补写 0 字节文件、封存或跨 run 复用。
- 输入清单 Schema 必须精确冻结 T04.1 独立审计路径、授权路径、stage、scope、schemaVersion 与 `userId`。
- Schema 变更必须先经过新的内部审计和独立外部文档审计；审计通过后生成新的授权字节。
- 最终候选必须使用全新 run ID，从 `T04-0` 开始完整执行 T04-0..T04-7，包括真实 Chrome。

门禁保持：`T04.1 FAIL / REPLAN`、`PX-5 FAIL / REOPENED`、`PX-6 BLOCKED`。
