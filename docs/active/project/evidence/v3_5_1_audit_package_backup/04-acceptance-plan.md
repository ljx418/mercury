# V3-5.1 三视频生产候选验收绑定

日期：2026-10-10  
状态：`FROZEN`

## 1. 固定输入

- 样本：`fresh-probe/frozen-sample-registry.json` 中恰好 3 项，不得替换或跳过。
- ASR：`funasr-sensevoice-small-q8` 固定 revision/weights/VAD hash，完整媒体覆盖率必须为 1.0。
- 视觉：每视频 1..8 个跨完整时长分布的真实帧；MiniMax-M3 只接收这些帧。
- 合同：`contracts/v3_media_workspace_comprehension_v1.schema.json` 与 `v3-5.1-semantic-verifier.py`。

## 2. A01..A20 机器门槛

沿用 `v3-5.1-acceptance-plan.md` 原始 A01..A20，追加以下生产绑定：

- A01..A05、A09..A10、A13..A18：三个 candidate 各自独立通过，不得以总数抵消单样本失败。
- A06..A08、A11..A12、A19：至少对三个候选逐一加载；seek 观察必须来自真实 B 站 player readback，五类入口每类至少两次。
- A20：分别记录 ASR 峰值资源、工作台首交互、主线程最长阻塞、CSP/remote script/eval；8 GiB/no-GPU 基线不得改写。
- 每个 candidate 必须通过 Draft 2020-12 schema 与 semantic verifier，且三个 candidate 的 taskId/sourceIdentity/outlineId/evidenceId 集合互不混用。

## 3. 公开与私有证据

公开：candidate JSON、执行/网络/交互哈希、工具与 build hash、清理清单、秘密扫描汇总、必要的脱敏页面截图。  
私有：Cookie、API key、原视频、原音频、完整转写正文、OCR 原文、云请求体、临时帧。私有材料仅存活于 run 期间；封存前删除，公开扫描必须 0 命中。

## 4. 出门规则

- 三视频 A01..A20 全绿、20/20 负例、全量 Runtime/Extension 回归、秘密扫描与清理通过后，状态最多为 `MACHINE CANDIDATE PASS / HUMAN REVIEW PENDING`。
- 人类仅在固定候选上执行拖动时间线、截图 seek、章节展开、导图节点 seek、跨章节提问五步；不得让人类听写或补机器结果。
- 人类签署与独立实现审计均通过后，才可声明 `V3-5.1 LIMITED PASS` 并进入 V3-6。

