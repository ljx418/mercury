# V3-2-7 实施与端到端验收结果

日期：2026-10-08。候选：`v3-2-production-20261007T174158Z`。状态：`MACHINE CANDIDATE PASS / INDEPENDENT AUDIT PENDING`。

## 1. 真实执行结果

- 全新 build、Chrome profile、Runtime、数据库、Route/ASR task root；未启用 skip prerequisite。
- 12 个真实 B站页面精确覆盖 `6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal`。
- 3 个 ASR 样本均重新下载完整当前分 P 音频并由本机 SenseVoice CPU 完整转写；`successCount=3`、`humanTranscriptInputCount=0`、`crossRunArtifactCount=0`。
- 可信 tabCapture 在真实 Chrome/B站播放页完成；Workspace/Side Panel 四视口、五状态、取消/重试均通过，UI `20/20` checks。
- 14 类真实本地 fault 全部单终态、终态后写入为 0、残留为 0、secret 命中为 0。
- 全量 Runtime、frontend test、typecheck、WXT build 与同一父 run 绑定并通过。

## 2. 固定分母

`v3-media-transcript-verifier.py` 独立复算 `A01..A20 = 20/20`。ExitCandidate：`sampleCount=12`、`captureCount=1`、`fullAsrCount=3`、`secretHitCount=0`、`residualCount=0`。

候选 SHA-256：`bdc38827b59702d9b12da431fba2615962b5a0b505525754130690b299fa4a80`。Seal content SHA-256：`e45d67ea67f687e037fc49e13d9a761caaf1b0082d8f3ed91203a1c32c22e1f9`。

## 3. 防假绿

- `independentAuditStatus=pending`、`v3_2Passed=false`，机器候选不得自升阶段 PASS。
- 前 6 个尝试均保留 `FAILED.json` 或 `INVALIDATED.json`，不得拼接；其中 `172103Z` 因空 `/tmp` 父目录残留在 seal 后审计中失效。
- 最终 run 的 `/tmp/navia-v3-2-7-*` 父根已删除；`run-binding.json.securePrivateRootRemoved=true` 并纳入 A17。
- public payload 34 项，不含 private 成员；公开文件二次扫描未命中 Cookie/token/用户路径。

## 4. 决定

V3-2-7 自动化候选通过。V3-2 只可等待不同 reviewer session 的独立出门审计；在 Fatal=0/Major=0 前不得进入 V3-3 实施或声明 V3-2 LIMITED PASS。
