# V3-2-0b-5.3 固定窗口威胁模型

日期：2026-09-22  
状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`

## 1. 资产与信任边界

受保护资产：真实音频、transcript、临时路径、模型资产、原生进程、资源预算、review 身份和生产资格状态。信任边界依次为 Portal Acquirer、Runtime task private root、FixedWindow orchestrator、Provider adapter、NativeProcessHost、公开 evidence pack。

门户身份与凭据在 `TaskAudioRef` 形成前终止传播；固定窗口层不接触 Cookie、URL、BVID、YouTube token 或小红书签名。

## 2. 威胁与控制

| 威胁 | 攻击方式 | 控制 | FailureCode |
|---|---|---|---|
| 分母漂移 | 只切失败 bin、换样或改变窗口 | 3 source hash + 8 固定边界 + plan hash | `V3_ASR_FW_SOURCE_DENOMINATOR_CHANGED` / `V3_ASR_FW_CHUNK_PLAN_DRIFT` |
| 选择性重试 | 保留成功 chunk 只补失败项 | attempt 原子化；新 attempt 从 chunk 0 | `V3_ASR_FW_PARTIAL_REUSE_FORBIDDEN` |
| 文本造绿 | 复制相邻文本、LLM 改写、去重 | 原始 segment hash、静态调用图、0 rewrite policy | `V3_ASR_FW_TEXT_REWRITE_FORBIDDEN` |
| 时间造假 | offset 错位、重复 ID、跨 chunk 重叠 | local + global 双层校验 | `V3_ASR_FW_LOCAL_TIMESTAMP_INVALID` / `V3_ASR_FW_GLOBAL_TIMESTAMP_INVALID` |
| 资源放大 | 8 进程并发、无限 chunk、模型重复加载 | 8 chunk、concurrency=1、8 GiB/512 MiB/2x latency | `V3_ASR_FW_CONCURRENCY_VIOLATION` / `V3_ASR_FW_RESOURCE_BASELINE_EXCEEDED` |
| 取消残留 | 子进程、WAV、result 在终态后存活 | 进程组 kill + cleanup barrier + receipt | `V3_ASR_FW_PRIVATE_DATA_RETAINED` |
| 路径/链接攻击 | symlink/hardlink/traversal 读取任意音频 | 私有根 0700/0600、nofollow、realpath/owner/link-count 校验 | `V3_ASR_FW_AUDIO_FORMAT_INVALID` |
| Provider 绕过 | UI/portal 直接执行 binary | closed registry + adapter only + static audit | `V3_ASR_FW_PROVIDER_BOUNDARY_BYPASSED` |
| 延迟假绿 | 报平均值或排除启动/切片时间 | 每样本 wall total 与固定基线逐项比较 | `V3_ASR_FW_LATENCY_REGRESSION_EXCEEDED` |
| Review 复用 | 复制 reviewer 或旧 bundle | 新 bundle hash、不同 reviewer ID、48 唯一键 | `V3_ASR_FW_REVIEW_DENOMINATOR_NOT_MET` |
| 公开泄漏 | evidence 含正文、音频、Cookie、路径 | 双层 secret/path/media/transcript scan | `V3_ASR_FW_PRIVATE_DATA_RETAINED` |
| 状态误标 | 安装成功即 qualified | machine/human/independent 三门；Settings fail closed | `V3_ASR_FW_INDEPENDENT_AUDIT_NOT_PASSED` |

## 3. 故障生命周期

`planned -> slicing -> inferring(chunk 0..7) -> merging -> machine_validating -> cleanup -> machine_passed`。任一异常进入 `cancelling|failing -> terminate_process_group -> delete_private_artifacts -> cleanup_receipt -> failed`。cleanup receipt 前禁止终态。

Runtime 崩溃恢复时，扫描仅属于本 task/attempt 的私有目录；删除残留后将 attempt 标为 failed，不恢复 chunk 推理，不读取其他 attempt 输出。

## 4. 隐私与公开证据

公开 evidence 仅包含 hash、计数、边界、资源值、FailureCode 和 PASS/FAIL。音频和 transcript 只在私有 review bundle 生命周期内存在；bundle 给 reviewer 后仍不得进入 Git、tar 或 external-audit-package。公开扫描必须覆盖嵌套 JSON/tar 内容，而非只扫文件名。

## 5. 残余风险

固定 15 秒可能截断边界词，原生进程逐 chunk 启动可能超过 2x 延迟，模型仍可能在其他真实语音上遗漏。这些只能由 24 chunk、真实耗时和双 reviewer 验证，文档不能消除。任一风险成为实测失败时停止并重新规划，不降低阈值。
