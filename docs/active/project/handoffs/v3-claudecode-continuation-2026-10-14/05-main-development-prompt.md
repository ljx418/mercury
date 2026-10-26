# 给 `navia-主干开发` 的续开发提示词

```text
继续 Navia V3 自动化开发，目标是按权威 PRD 和阶段门禁完成 V3，而不是只完成一个冒烟脚本。

首先读取：
1. AGENTS.md
2. docs/active/project/design/project-stage-workflow.md
3. docs/active/project/handoffs/v3-claudecode-continuation-2026-10-14/01-current-state.md
4. 同目录 02-remaining-development-plan.md、03-authoritative-file-index.md、04-acceptance-and-stop-gates.md
5. 03 中列出的 B-5 权威文档与独立审查报告。

恢复基线为 `main` / `a303551a5bf89c26ff36b24ac06c7e30c334db27`，但工作树已有大量未提交差异。先执行只读盘点并记录当前差异所有权；严禁 reset/checkout/clean 或覆盖不属于本子阶段的文件。不要假设未提交差异都是你生成的。

当前状态：B-5-1/B-5-2 已通过独立审查（Fatal=0/Major=0/Minor=0）；B-5-3 未完成。run `stage-b-b5-3-recovery-20261014T132500Z` 和 `stage-b-b5-3-recovery-20261014T133200Z` 均为被中断的诊断 run，严禁用于验收或与新 run 拼接。交接前所有对应后台进程已终止。

先完成 Phase 0：只读审计 `scripts/stage_b_b5_3/run_one_bvid.mjs` 和 `sequencer.mjs`，为 fresh isolation、SIGTERM/清理、超时、两个 blocked、secret scan、禁止上传计数、Chrome worker 缺失补测试；定位 `BV1pohR6rEEh` Stage A 7 分钟超时根因，不得简单扩大超时。落盘详细计划、验收标准和实施前风险闭环。Fatal/Major 清零后，创建全新 run ID 执行六个固定 BVID。

用户授权已覆盖完整 B-5-0..B-5-7、任务级 DeepSeek 和派生 transcript/OCR/vision-caption 文本上传；不要再次要求每 BVID 手动授权或手动导航。全局 Chat Provider 默认 MiniMax 不变。禁止上传原始视频/音频/帧/Cookie/API key/凭据/本地路径。所有 Chrome 必须 --mute-audio，任何测试不得播放声音。

按 02-remaining-development-plan.md 顺序持续开发：B-5-3 -> B-5-4..7 -> 独立外审 -> B-6/B-7 -> Stage C/D -> V3-4.1 Chat/Know -> Stage E -> V3-6/V3-7。每个子阶段必须执行“详细计划 -> 验收标准 -> 实施前审计 -> 实现 -> 自动化与真实数据验收 -> PRD 检视 -> handoff”；Fatal/Major 未清零不得继续。尚未完备冻结或缺少实施授权的阶段，只做文档与外审并明确请求授权，不得直接编码。>=2 blocked、secret/raw-media 命中、fresh isolation 无法证明或虚假验收风险时立即停止并落盘。

V3 出门同时包含原媒体主干和 Chat/Know 增量分母；不得只完成媒体链就宣布 V3 完成。Query/Graph/Durable Forget 属于 V4，Agent 属于 V5+，不要纳入当前实现。

不要 commit/push，直到阶段性独立审查明确允许。不要替独立审查窗口签署 PASS。
```
