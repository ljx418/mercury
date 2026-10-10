# V3-2-0b-5.3 固定窗口开发计划

日期：2026-09-22  
状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`

## 1. 用户结果

目标不是新增页面，而是在不提高默认硬件要求的前提下，消除长窗 VAD 导致的完整语音 bin 遗漏。成功后用户仍在 Settings 看见真实 requested/effective/fallback 状态；只有生产质量门槛通过后 Paraformer 才可选择。失败时继续使用 Tiny fallback，并明确显示质量未通过，不产生静默回退。

## 2. 实施前门槛

1. 本文档包内部审计 Fatal=0/Major=0。
2. 外部独立文档审查 Fatal=0/Major=0。
3. 用户另行明确批准 `V3-2-0b-5.3 implementation`。
4. 生成独立 `implementation-authorization.json`，绑定审计请求 hash 和 scope。

以上任一项缺失均不得修改 Runtime 产品代码。

## 3. 子阶段顺序

| 子阶段 | 实施内容 | 验收/停止条件 |
|---|---|---|
| `5.3-0` | 固定窗口 Schema、registry、manifest、20 负例及 verifier | Schema meta/positive PASS；20 tuple 精确一致 |
| `5.3-1` | `FixedWindowPlan` 与确定性 PCM 切片 | 三 source hash 不变；24 chunk 边界/hash 可复算；0 gap/overlap |
| `5.3-2` | `FixedWindowAsrOrchestrator` 顺序调度 | concurrency=1；Provider/ProcessHost 边界不变；任一失败即停止 |
| `5.3-3` | local timestamp 校验与 offset merge | 0 越界/逆序/重叠/重复 ID；0 文本重写 |
| `5.3-4` | cancel/crash/timeout/restart 与 cleanup barrier | 进程、chunk、WAV、staging、私有路径引用均为 0 |
| `5.3-5` | 三个真实样本从零推理 | 24/24 chunk 非空；每样本 <=2x 长窗耗时；资源门槛通过 |
| `5.3-6` | 新匿名 A/B bundle 与双 reviewer | 48 判断、reviewer 不同；>=44/48、每样本>=15/16、critical=0、neither=0 |
| `5.3-7` | 真实 Settings 状态、回归、PRD 检视、独立出门审计 | 成功才允许 `production_qualified`；否则保持失败并回滚到计划阶段 |

## 4. 计划代码范围

允许新增/修改的实现边界：

```text
services/local-runtime/navia_runtime/modules/media_companion/asr/fixed_window.py
services/local-runtime/navia_runtime/modules/media_companion/asr/provider.py
services/local-runtime/tests/test_v3_asr_fixed_window.py
apps/chrome-extension/e2e/v3-asr-fixed-window-*.py|mjs
docs/active/project/evidence/.../v3-2-0b-5.3/
```

若现有具体文件名不同，实施前审计必须记录映射；不得借此修改页面 bridge、Cookie transport、门户注册表或 V4 知识模块。

## 5. 明确不做

- 不更换模型、不下载 Medium/SenseVoice、不新增 GPU 路线。
- 不改 V3-2 的 12 URL 与 24 bin 分母。
- 不改已有 ASR 文本，不用 LLM 修复边界词。
- 不增加 B站专用字段到通用 ASR 层。
- 不并行执行 8 个原生进程。
- 不把诊断 sample03 单 bin 当生产证据。
- 不启动 V3-2-1..7。

## 6. 每阶段审计产物

每个子阶段单独落盘 `development-plan.md`、`acceptance-plan.md`、`preimplementation-audit.md`、`acceptance-result.md`、`prd-review.md`、`implementation-exit-audit.md`。真实失败 run 保留 `invalidated.json`，不得覆盖或拼接。

## 7. 回退与后续路线

如 24 chunk 完整但延迟 >2x，先返回计划阶段评估“单个持久 worker 顺序喂入”是否保持 NativeProcessHost 隔离；未经新 ADR 不实施。如质量仍失败或持久 worker不可行，则关闭路线 A，重新冻结路线 C。任何情况下不得降低 A06 或把 Tiny 升级为 production qualified。
