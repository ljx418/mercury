# V3-2-2 Route B3 中断恢复交接

日期：2026-10-07。停止类型：用户要求保存状态并于下次继续。停止时没有运行 Chrome、Runtime、下载器、ffmpeg、ASR 或审计进程。

## 1. 当前已完成

- Route B3 文档、Revision 5 Schema、实现、定向测试、全量回归、真实 Chrome 探测、真实媒体获取、20 项 verifier、PRD 检视和候选出门审计均已完成。
- 固定 12 个真实 Bilibili URL：6 个字幕样本、3 个 ASR 能力槽位、1 个多 P、1 个受限、1 个低信号。
- 三个 ASR 能力槽位在 acquisition task 时依据真实字幕发现 receipt 分类；0 个字幕候选走 `runtime_no_subtitle`，存在字幕候选时仅在 acceptance wrapper 内应用预绑定故障后走真实媒体。
- 生产代码没有接受故障注入入口；生产不可达静态审计为 8 个文件、10 个 needle、0 hit。
- Schema meta PASS；定向测试 68 passed；Runtime 449 passed；前端 293 passed；typecheck/build PASS；公共 secret scan 0 hit。
- 真实 run 结果为 7 subtitle + 3 real media + 1 blocked + 1 degraded；动态分布为 1 `runtime_no_subtitle` + 2 `audited_subtitle_failure`；清理残留为 0。
- `B3-01..B3-20` 为 20/20 PASS；公开 seal 可重算。
- 外部审计包已重建为 19 payload + 1 manifest，平铺且无子目录，19/19 SHA-256 与权威源一致。

## 2. 权威运行基线

```text
runId: v3-2-route-b3-20261007T014759Z
runRoot: docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-2-bilibili-acquirer/runs/v3-2-route-b3-20261007T014759Z
contentSha256: 66b9d6ce6997261e3b6b4291178424b1df69e5d8f57b5e51cf07546f9bcd56ea
sealFileSha256: 64c80a7f7f689a466099b85aae78eec7d2d08ae090b4206ac1151c887a863a13
rawSha256: eebf70ed0ff0aaa6c584a77500f34acb47480bda99c369b543cff8caea6e0af6
registrySha256: 7e76c9f30e52aac70d9e89406476f0b893b661a1d46bb3afc3f2ed2004ed5104
verificationSha256: a84acd011bcc623d4ca5423cd8a86d59ef038f66641ab54bc7f504ff61b84340
buildTreeSha256: 455409dff66f4aac00640536e1c1cb406150bd9f6be16f45db0d09f01e05a119
```

旧 Revision 1..4 run、历史失败 run 和旧 seal 不得修改、拼接或升级为当前输入。

## 3. 当前唯一未完成门禁

- Claude Code CLI 独立实现出门审查曾启动，但用户请求保存状态时运行约 6 分钟仍无输出。
- 该进程已终止，未生成 `route-b3-independent-implementation-exit-audit-20261007.md`，因此没有半成品审查结论。
- B3 当前只能记为 `IMPLEMENTATION EXIT CANDIDATE`，不能升级为 `LIMITED PASS`。
- `external-audit-package/` 保持为本轮 B3 包；恢复前先复核 `AUDIT_MANIFEST.md`，不要清空或混入下一阶段文件。

## 4. 下次恢复的严格顺序

1. 读取本文件、`external-audit-package/AUDIT_MANIFEST.md` 和 `01-audit-request.md`。
2. 重新启动 B3 独立只读出门审查；只允许生成 `route-b3-independent-implementation-exit-audit-20261007.md`。
3. 独立复算 19 项载荷哈希、Revision 5 Schema/instance、动态计数、12 行分母、20 项 B3 语义、canonical seal、secret safety、旧 run 隔离和生产故障不可达。
4. 若 Fatal=0 且 Major=0，才把 V3-2-2 标记为 `LIMITED PASS`，仅允许进入 V3-2-3 实施前恢复审计。
5. V3-2-3 不得直接复用 B3 公共包中的音频：B3 已按清理合同删除 private audio。必须先更新 V3-2-3 source-run 绑定，并规划同规格的新 acquisition + SenseVoice task/run。
6. 更新并重新审计 V3-2-3 development plan、acceptance plan、preimplementation audit、threat model 后，才允许实现。
7. 人工验收仍推迟到 V3-5；不得在 V3-2-3 要求人类听写或代替 ASR 产出。

## 5. 门禁状态

- V3-2-2 Route B3 文档与内部审计：PASS。
- V3-2-2 实现与真实候选验收：20/20 PASS candidate。
- V3-2-2 独立实现出门审查：PENDING（上次进程已终止且无报告）。
- V3-2-2 最终阶段状态：`IMPLEMENTATION EXIT CANDIDATE`，尚非 `LIMITED PASS`。
- V3-2-3：BLOCKED，下一允许动作仅为实施前恢复文档与审计。
- V3-3 及之后：BLOCKED。
- 人工验收：推迟至 V3-5。

## 6. 工作树说明

- 工作树包含长周期 V2/V3 的大量 tracked 与 untracked 变更，均需原样保留。
- 不得 reset、checkout、clean 或删除不属于当前恢复步骤的文件。
- Cookie 授权文件位于 `/mnt/c/Users/Administrator/Desktop/myCk.txt`；只允许临时私有运行使用，禁止复制到仓库、日志、tar、manifest 或公开证据。

**自动化开发停止原因：用户要求保存当前工作状态并于下次继续。B3 实现及真实候选验收已完成，但独立实现出门审查尚未形成报告；恢复后必须先完成该审查，禁止直接进入 V3-2-3 代码实施。**
