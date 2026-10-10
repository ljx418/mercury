# ADR-V3-2-0B-FW：固定 15 秒窗口恢复路线

日期：2026-09-22  
状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`  
工作包：`V3-2-0b-5.3`

## 1. 决策背景

V3-2-0b 的 120 秒长窗 Paraformer 候选在 sample 03 / bin 2（相对 `30000..45000ms`）产生 0 segment；该 bin 的 PCM16 RMS 为 1948，不能标为静音或 N/A。同一 15 秒音频用相同 runtime、Paraformer Q8、FSMN-VAD 和资源限制单独推理时产生 1 segment / 28 字符。因此，已确认问题与长窗 VAD/分段上下文强相关，但单 bin 诊断不构成生产通过。

父候选、旧 run 与失败结论全部保持不可变：

- 父 manifest SHA-256：`2016e6e87baa440ac240fcf5ceb5653928e1f3b6c284ff586413bd42c71cd1cf`。
- 原 120 秒长窗基线：sample 01/02/03 分别为 8.18/7.38/8.14 秒。
- V3-2-0b：`FAIL / REPLAN`；Paraformer 为 `failed_current_gate`、`selectable=false`。
- Tiny 仍是最低资源 fallback-only，不能进入生产质量分子。

## 2. 决策

选择路线 A：三个冻结样本均从原始 120 秒 PCM16 单声道 16kHz WAV 确定性切成 8 个不重叠 15 秒 chunk，顺序执行同一已冻结 Paraformer Provider，再将 chunk 内时间戳加固定 offset 合并。

新增 Runtime 私有实体：

```text
TaskAudioRef
-> FixedWindowAsrOrchestrator
-> FixedWindowPlan(8 x 15000ms, overlap=0, concurrency=1)
-> ChunkAudioRef
-> FunAsrLlamaCppProviderAdapter
-> NativeAsrProcessHost
-> ChunkInferenceResult
-> deterministic offset merge
-> FixedWindowSampleResult
```

`FixedWindowAsrOrchestrator` 不知道 BVID、CID、Cookie、portal URL 或浏览器权限。B站、未来 YouTube、小红书只能经各自 `MediaAcquirer` 生成通用 `TaskAudioRef`；注册新门户不会自动获得 B站 session policy、Cookie lease 或本路线 PASS。

## 3. 固定算法

对每个 120000ms 输入，令 `i in [0,7]`：

```text
chunk.startMs = i * 15000
chunk.endMs   = (i + 1) * 15000
coverage      = [0, 120000)
overlap       = 0
gap           = 0
```

冻结 WAV 的实际帧数为 `1919997/1920000/1920000`。因此算法先绑定源 SHA-256 与实际帧数，再仅对 sample 01 最终尾部确定性追加 3 个 PCM 零帧，使推理窗口达到 1920000 帧；容忍上限固定为 16 帧（1ms）。源 WAV 保持只读，任何超长、缺失超过上限、非尾部填充或非零填充均失败。此规则只解决容器裁剪产生的亚毫秒尾差，不得用于掩盖缺音频。

每个 chunk 必须从同一个 source audio hash 导出，记录 `chunkIndex/startMs/endMs/chunkSha256`。每个 chunk 至少产生一个有效 segment；本冻结语料的 24 个 bin 均为真实语音，不允许运行期改写为静音或 N/A。

合并规则：

1. 先校验 chunk 内 `0 <= startMs < endMs <= 15000`。
2. 全局时间戳为 `local timestamp + chunk.startMs`。
3. segment ID 按 `sampleId/chunkIndex/localIndex` 确定性生成。
4. 全局 segment 必须单调、不重叠、无重复 ID，且位于 `[0,120000]`。
5. 禁止复制相邻文本、跨 chunk 去重、语言修正、LLM 改写、补字或猜测边界词。

## 4. 重试、取消与清理

- 资格验收不允许复用成功 chunk；任一 chunk 失败后，本 sample 的新 attempt 必须从 chunk 0 开始。
- 禁止跨 run 拼接、只补失败 bin、选择最好输出或混用旧长窗 transcript。
- 单任务最大并发固定为 1；不得以并发 8 降低总耗时。
- 取消、超时、崩溃、Runtime 重启或输出解析失败时，终止整个原生进程组。
- chunk WAV、chunk result、staging、原始 120 秒 WAV 和进程引用必须先清零，随后才能写终态 cleanup receipt。
- cleanup 失败时任务保持 `failed_cleanup`，不能写 `completed` 或进入人工盲评。

## 5. 性能与资源硬门槛

低资源基线保持 8 CPU cores、8 GiB 地址空间、无 GPU、推理期断网。资产仍使用父候选约 230 MiB，不新增生产模型。

为拒绝明显体验回退，每个 sample 的固定窗口总耗时必须同时满足：

```text
elapsedRegressionRatio = fixedWindowElapsedMs / longWindowBaselineMs <= 2.0
sample01 <= 16360ms
sample02 <= 14760ms
sample03 <= 16280ms
```

任一 sample 超限即路线 A 失败并返回重新规划；不得用平均值掩盖单样本超限，不得降低阈值。失败后的技术选择是持久 worker 优化或重新冻结路线 C，不是弱化用户体验门槛。

## 6. 质量门槛

机器完整性先于人类判断：24/24 chunk 非空、时间合同、资源、延迟、清理和秘密扫描全部通过后，才能生成全新的匿名比较包。

人工分母保持：3 个样本、24 个 bin、2 个不同 reviewer、48 个判断；候选含义保留至少 44/48，每样本至少 15/16，`critical=0`、`neither_acceptable=0`。不得复用旧 reviewer 文件或把单人结果复制为第二人。

## 7. 备选与否决

| 路线 | 当前处理 | 原因 |
|---|---|---|
| A 固定 15 秒 Paraformer | 采用，先文档外审 | 复用现有资产且诊断有正信号；需控制边界和延迟 |
| B Faster-Whisper Medium | 暂缓 | 约 1.5 GiB 模型和更高 CPU 成本，不符合当前低资源优先 |
| C SenseVoiceSmall | 后备研究 | 新 runtime、时间戳、许可证与攻击面均需重新冻结 |
| D 停止 | 保留选择 | 无新增风险，但 V3-2-A06 永久阻塞 |

## 8. 出门声明

本 ADR 通过外部文档审查后只允许申请 `V3-2-0b-5.3 implementation` 授权。实施与真实验收通过后，也只恢复 Paraformer 生产资格候选；V3-2-1..7、媒体获取、视频理解和 V3 整体仍需各自门禁。
