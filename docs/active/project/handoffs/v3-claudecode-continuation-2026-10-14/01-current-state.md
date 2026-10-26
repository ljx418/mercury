# Navia V3 ClaudeCode 续开发交接（2026-10-14，2026-10-15 复核）

## 0. 恢复基线

- 复核时 Git 基线：`a303551a5bf89c26ff36b24ac06c7e30c334db27`，分支 `main`。
- 工作树包含约 412 项既有差异（含产品源码、测试、证据、未跟踪文件和构建输出）；这些差异是当前开发现场，不是接手代理可自行丢弃的垃圾。
- 禁止 `git reset --hard`、`git checkout --`、`git clean` 或以重建产物为名覆盖既有差异。先按文件所有权和当前子阶段盘点，再做最小范围修改。
- 2026-10-15 复核未发现遗留的 B-5-3 runner、sequencer 或隔离 Runtime 进程。每次新 run 前后仍需重新检查。
- 本交接包是恢复入口，不替代权威 PRD、阶段门禁、最新审计和实际代码差异。

## 1. 当前权威状态

- V3-5.10 Stage B B-5-1：`PASS`，独立审查 Fatal=0 / Major=0 / Minor=0。
- V3-5.10 Stage B B-5-2：`PASS`，独立审查 Fatal=0 / Major=0 / Minor=0。
- B-5-3：`INCOMPLETE / FRESH RUN REQUIRED`。
- B-5-4..B-5-7、B-6、B-7、Stage C/D/E、V3-6、V3-7：均未完成，不得声明 V3 完成。
- Chat Provider 全局默认仍为 MiniMax；DeepSeek 只允许在已授权的 B-5 任务内临时选择，不得自动改写用户设置。
- V3 Chat + Know 收敛计划继续有效：媒体链归入 Chat 当前上下文；Know 只交付最小真实本地投影。Query、Graph、Durable Forget 属于 V4，Agent 属于 V5+。

## 2. 已完成实现

1. `quality.py`：V2.1 receipt 支持 7 个 Provider 扩展字段，V2 路径保持原形态。
2. `service.py`：401/403/refusal fail-closed，不进入 repair/composer；composer allowlist 仅允许两个 brief 失败码。
3. `synthesis.py`：记录 attempt、latency、request/response SHA、finish reason、endpoint class、structure mode。
4. V2.1 schema、positive/negative fixtures、verifier 已与实现对齐；V2 schema SHA 保持不变。
5. B-5-1/B-5-2 本地回归：65/65 PASS；fixture verifier：3/3 positive、5/5 schema negative、11/11 registry。

## 3. B-5-3 当前诊断事实

- 已新增自动化 runner：
  - `scripts/stage_b_b5_3/run_one_bvid.mjs`
  - `scripts/stage_b_b5_3/sequencer.mjs`
- runner 复用仓库既有 Windows Chrome / extension / Runtime 自动化路线；Chrome 必须带 `--mute-audio`。
- 首次错误 STOP（误认为需要用户手动导航）已由 `stage-b-b5-3-stop-report-correction-2026-10-14.md` 更正。
- 最近 run：`stage-b-b5-3-recovery-20261014T132500Z`。
- 该 run 只可作诊断，不可验收：
  - BVID 1 `BV1pohR6rEEh`：Stage A 7 分钟超时，`blocked`。
  - BVID 2 执行中因交接主动停止。
  - sequencer 未完成，`finishedAtUtc=null`。
- 续开发必须从新的 run ID、Runtime、database、Chrome profile、task namespace 重新开始六视频完整序列，不得拼接本 run。
- 交接冻结期间主干后台命令又启动了 `stage-b-b5-3-recovery-20261014T133200Z`；该 run 已被强制终止，同样属于部分诊断产物，禁止作为验收输入或与其他 run 拼接。

## 4. 用户授权边界

用户已经批准完整 B-5-0..B-5-7、冻结六视频 fresh run、任务级 DeepSeek 选择，以及派生 transcript/OCR/vision-caption 文本上传。

仍禁止上传：原始视频、原始音频、原始帧、Cookie、API key/凭据内容、本地绝对路径。任何 Chrome 测试必须静音。累计两个 blocked、秘密扫描命中、禁止数据上传、fresh isolation 无法证明时必须立即 NO-GO。

## 5. 进程清理状态

交接前已终止 B-5-3 sequencer、`run_one_bvid.mjs` 和隔离 Runtime；未发现对应 Windows Chrome 残留。后续仍须在每次 run 前后独立复核。
