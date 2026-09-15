# T04 正式候选失败记录：fresh raw commit 身份误判

日期：2026-09-14  
Run：`t04-r4-snapshot-revalidation-20260914t102514z`  
状态：`VOID / VALIDATOR FALSE-NEGATIVE / NOT ELIGIBLE FOR T04 EVIDENCE`

## 事实

- T04-0、T04-1、T04-2 成功；修复后的隔离 Python venv 与 Windows 挂载盘 Chrome profile 均跨过此前失败点。
- R2 子进程完成真实 Chrome 流程并生成 raw，但 T04 后置校验以 `T04_FRESH_RAW_INVALID` 拒绝。
- raw `runId=t04-r4-fresh-raw-20260914103136081`，seal algorithm/inputMode 正确；`raw.snapshotCommit=0a7405aceb6c654bd17f784eb6ece036932ef5cc`，精确等于 SnapshotInputManifest 的 acceptance commit，而非 product base `430cdd...`。

## 规格判定

T04-A08 要求 G4 读取“本 T04 commit”的 Git blob。R4-E 从包含授权 T04/T03 overlay 的 detached acceptance snapshot 实际执行，因此 raw 与 ArchitectureResult 应绑定 acceptance commit；product base 只用于证明 P0-P6 产品路径未漂移。原后置断言把两个身份层级混同，属于 T04 validator false-negative，不是产品失败。

## 处置

- `runT043` 改为要求 raw commit 等于 `manifest.snapshot.acceptanceCommit`。
- `validateFreshProductionCandidate` 改为接收并要求同一 acceptance commit，不再硬编码 product base。
- 不修改 raw、产品代码、T03 pipeline、Schema 或分母。
- 作废 run 后处理探针另发现 T04-N-002 action 缺少 `dependencyClosureSha256` 显式 import，导致 `ReferenceError` 被登记为 `UNKNOWN`；已补齐 import，并保留原始异常详情用于拒绝未来未知失败码。
- T04-N-018 探针最初使用不属于公开证据命名空间的 `leak.log`，无法触发证据文本凭据规则；已改为 `fresh/source-run/leak.log`，使 mutation 与正式 public payload 路径模型一致。
- T04-6 公开包探针正确拒绝了 Runtime warning 中未脱敏的临时 venv 路径。根因是 venv 位于 snapshot 同级目录，既有 R2 `repoRoot` 脱敏无法覆盖；已将 venv 移到 detached snapshot 的 `.tmp` 内，使真实 collector 脱敏而不放宽 public scan。
- 归档静态检视确认 `tar -C <root> .` 会额外产生目录成员，无法与 payload-only 文件索引精确相等；已改为 NUL 分隔的封闭文件清单输入，tar 不递归发现目录或额外文件。

实现字节已变化，本 run 永久作废。允许仅使用其已完成的真实 raw 做不计入验收的 T04-4..6 开发探针，以提前发现后处理缺陷；最终证据必须另建全新 run，从 T04-0 和真实 Chrome 开始执行，不得复制本 run artifact。
