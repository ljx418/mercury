# V3-2-3 SenseVoice 全长转写自动验收结果

日期：2026-10-07。候选 run：`v3-2-3-sensevoice-20261007T044217Z`。结论：`AUTOMATED CANDIDATE PASS / INDEPENDENT EXIT AUDIT PENDING`。

## 1. 固定真实分母

- source：Route B3 `v3-2-route-b3-20261007T014759Z`，content SHA-256=`66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea`。
- 同一全新 run、三个全新 task，固定顺序 `v3-sample-07/08/09`，未复用 B3 已清理音频或旧转写。
- 三槽均为 `credentialed_media_asr`；动态触发为 `runtime_no_subtitle=1`、`audited_subtitle_failure=2`，总数 3。
- SenseVoice profile：`funasr-sensevoice-small-q8`、CPU/q8、FSMN-VAD、8 cores/8 GiB/no-GPU。
- verifier：`ST01..ST20 = 20/20 PASS`。

## 2. 三槽实际结果

| slot | BVID | 时长 | 音频字节 | 分段 | ASR 耗时 | 峰值 RSS | cleanup |
|---:|---|---:|---:|---:|---:|---:|---|
| 0 | `BV13W41137qV` | 4,428,208 ms | 141,702,730 | 899 | 254,865 ms | 2,821,283,840 B | 0/0 |
| 1 | `BV1ZpYd66ELP` | 791,266 ms | 25,320,602 | 368 | 57,625 ms | 700,362,752 B | 0/0 |
| 2 | `BV1pW421c7DH` | 572,604 ms | 18,323,408 | 119 | 33,735 ms | 597,360,640 B | 0/0 |

每槽 VAD count 与非空 SRT count 精确相等，coverage receipt 为 1.0；segment 时间有序、不重叠、位于当前分 P 时长内。公开结果只包含 segment ID、时间与 text SHA-256，不包含正文、音频、Cookie、stderr 或私有路径。

## 3. 负例与回归

- staging：traversal、绝对路径、symlink、hardlink、cross-task、source mutation、预存在 task root 均拒绝。
- cancel：运行中取消会通知 provider，只有一个 cancelled 终态，ASR staging 与 acquisition sandbox 均清零。
- fault：timeout、cancel、nonzero/crash、output overflow、empty、bad SRT、VAD mismatch 均映射到固定公开 FailureCode。
- network：native child 的 socket 创建被 seccomp 独立拒绝；CPU affinity <=8，RLIMIT_AS=8 GiB。
- Runtime 全量：474/474；SenseVoice 定向：41/41。
- 前端：39 files、293/293；typecheck/build exit 0。
- credential：合同 25/25、静态 9/9、secret scanner 2/2。
- 最终公开 run 使用 18 个长度至少 8 字节的真实 Cookie needles 扫描 4 个文件、301,915 bytes，0 hit；私有 task root 不存在。

## 4. Seal

| 文件 | SHA-256 |
|---|---|
| `transcript-result.json` | `e308d45ddb9664e3e64800baddb03bf5fdcc5ad864a6e0e985937336ab7b603d` |
| `regression-result.json` | `96133ce5788bdaed37ddfc2efc08e48d42fd9ec6c51504f19afc7c8899cb3792` |
| `verification-result.json` | `2f01af429a643fb381def0a20d159079ced0b0ff70e3c94c305a70cea586ff3e` |
| `run-seal.json` | `bf1dddef22db0edd0c7bc59c1c73fe72d93719283b95e2d6ca0106efd6373aa9` |

Seal canonical content SHA-256=`395e5905479d8250bcc48630a1cd1f87c5df3e76554efb4328ccc4d3a651adbb`，3 个 sealed members，独立重算一致；`finalPassed=false`、`humanReviewStatus=not_started`。

## 5. 作废尝试

- `20261007T043729Z`：shell 重定向父目录错误，未形成 run。
- `20261007T043746Z`：DrvFS 无法证明 0700，未封存。
- `20261007T043827Z`：旧诊断能力不足的 native nonzero，未封存，私有根已清理。
- `20261007T044108Z`：编排器预建 run root，启动保护拒绝，`platformAccessed=false`。
- `20261007T044150Z`：source path 错误，启动前拒绝，`platformAccessed=false`。

上述产物均未进入成功 seal，不能复用或拼接。

## 6. 限定声明

本候选只证明三个固定 B站能力槽位在同一全新 run 内完成真实媒体获取与 SenseVoice 全长本地转写。它不证明主观语义质量、tabCapture、OCR/VLM、图文大纲、V3-2 或 V3 完成。独立实施出门审查 Fatal/Major 清零前不得声明 V3-2-3 `LIMITED PASS`。
