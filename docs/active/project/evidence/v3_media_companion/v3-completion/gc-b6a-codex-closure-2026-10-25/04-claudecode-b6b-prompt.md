# ClaudeCode Prompt: GC-B6B

你接手的是 Navia V3-5.10 Stage B 的 `GC-B6B fresh candidate + blind semantic review`。Codex 已接受 B6A，并授权一个受限 B6B 批次；B7、Stage C、Stage B PASS、V3 PASS 仍未授权。

先读：

1. `AGENTS.md`
2. `docs/active/project/design/project-stage-workflow.md`
3. `docs/active/project/design/v3-post-wp-b-completion-rebaseline.md`
4. `docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6-semantic-review-preimplementation-2026-10-25/`
5. `docs/active/project/evidence/v3_media_companion/v3-completion/gc-b6a-codex-closure-2026-10-25/`

本批是运行与评审，不是开发纠偏。不得修改任何产品代码、harness、合同、阈值、registry、rubric、prompt 或历史证据。若需要修改，立即写 `GC-B6 SEMANTIC REVIEW NO-GO` 并停下，不得边跑边修。

## 必做顺序

### 1. 候选锁与 preflight

- 校验 B6A Codex closure manifest、当前 B6A 文件摘要、active registry 摘要与顺序。
- 在任何 Cookie 读取、Chrome、Runtime 媒体任务、下载或 Provider 动作前，要求显式且全新的 `NAVIA_B5_AUTHORIZATION_ID`、owned `NAVIA_B5_STAGE_ROOT`、仓库外 0700 `NAVIA_B6_PRIVATE_ROOT` 及既有 runner 所需显式环境。
- 运行唯一的 zero-action preflight。验证 Cookie/Chrome/Runtime/依赖/Provider lock/端口/磁盘/内存/预算/private root；收据中外部动作计数必须全 0。
- 缺输入或 preflight 不绿即 EXTERNAL-INPUT BLOCK/NO-GO；不得搜索 Desktop、其他仓库或磁盘猜输入。

### 2. 一次 fresh 六源运行

- 只用 active registry 的六个 primary source，严格按顺序；reserve、替换、跨 run artifact、历史 publication 全部禁止。
- 每源独立 owned Runtime/DB/profile/namespace/task/lease；所有 Chrome 必须 owned、可见、`--mute-audio`，不得触碰用户 Chrome。
- 每源必须产生同 run 的 machine receipt、冻结 V2.1 derivative、capture receipt 和私有 bundle；capture 必须在 durable publication 后、owner cleanup 前闭合。
- stage action ledger 必须从首次外部动作前开始，精确记录 stage 与 candidate 计数。
- 捕获失败、limited/failed、第二个 blocked、泄漏、unknown Provider request count、cleanup 不闭合或 identity/hash 不一致，立即停止；不得重试整批。

### 3. 盲态评审

- evaluator 只能看 `blind_projection`，不得看 Provider/model/endpoint/receipt、运行路径、Cookie 或公开 evidence 外的元数据。
- 在首次评审前写定随机六源顺序、rubric SHA-256、prompt SHA-256、session id；不得按结果换顺序。
- 四轴逐项 1..5：事实与证据准确性、全片覆盖、内容价值/适配、章节边界质量；每轴必须 >=4，critical error 必须为 0。
- sentinel 固定为 registry order 3。第二次必须是不同 evaluator session、不同位置；thesis 或 material-claim verdict 反转、claim set 变化、任一轴漂移 >1 都失败。
- 不得修改 bundle、代码、分数或阈值来取得正结论。

### 4. 聚合与证据

- authority 只能由同一批六份 machine receipt + capture receipt 构建；要求 active registry、六行 complete、逐源 source/task/revision/depgen/derivative/capture/bundle/review-binding 闭合、counts 为正且精确求和。
- 公开证据只允许：hash、score、稳定错误码、对象索引、计数、动作账本汇总、进程与 cleanup 证明。严禁 derivative 全文、transcript/OCR/caption 文本、PNG 字节、文件名、绝对/私有路径、Cookie/secret、Provider response。
- 私有 bundle 只留在显式私有根，绝不复制到 repo/evidence。最终先完成扫描与 cleanup，再生成 `PAYLOAD_MANIFEST.sha256` 并 `sha256sum -c`。

## 验收与状态

正结论必须同时满足：fresh 6/6、B-5 machine gate 正、每轴 6/6 均 >=4、critical=0、sentinel 稳定、隐私/动作账本/owned process/cleanup 全绿。

最终状态只能是：

- `STAGE B IMPLEMENTATION CANDIDATE AWAITING INDEPENDENT B7`；或
- `GC-B6 SEMANTIC REVIEW NO-GO`。

不得宣布 Stage B/V3 PASS，不得进入 B7 或 Stage C，不得 commit/push/reset/clean/checkout/revert。交回 changed files（理应只有新证据）、合同变更 `none`、命令与退出码、六源机器结论、盲评 rubric、sentinel、隐私扫描、动作账本、清理审计、剩余风险与精确停止原因。

