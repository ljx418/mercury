# V3-2-5..7 Transcript 产品化与出门独立文档审查

日期：2026-10-06。审查方式：新的 Claude Code 只读 session；未修改仓库、未读取 Cookie/秘密、未运行产品或浏览器。

审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`。

- Manifest SHA-256：`95c8f6961e5318f695234599743b77ba2b36234d74f5cb6b7dd2970d2f334ec0`
- Request SHA-256：`02650c81c7a1a36d2c4035fba62fc3a56c0327bad571f05a78daeefe9603348c`
- 包结构：19 payload + 1 manifest，平铺 20 文件，0 子目录。

## 0. 决定

`V3-2-5..7 DOCUMENT PASS / IMPLEMENTATION BLOCKED BY PREDECESSORS`。

Fatal=0、Major=0、Minor=0。上一轮 M-1（测试副本路径）和 M-2（shape fixture 重复 digest 说明）均经最终包独立复算确认关闭。

本决定只关闭文档门禁。V3-2-2 授权会话和 Revision 3 尚未通过，V3-2-3/2-4 尚未实施出门，因此 V3-2-5/2-6/2-7 代码仍 NO-GO；H01..H10 仍只在 V3-5。

## 1. 独立复算

| 项 | 结果 |
|---|---|
| 19 项 payload SHA-256 | 19/19 与 manifest 字节一致 |
| Draft 2020-12 Schema meta | PASS |
| ProductUiAcceptance positive | PASS |
| FaultMatrix positive | PASS |
| ExitCandidate positive | PASS |
| 审计包合同测试 | 19 passed |
| Schema 补充负例 | 21/21 按预期拒绝 |
| 语义补充负例 | 9/9 按预期拒绝 |

## 2. 八项必查

1. Side Panel/Workspace 同 taskId/revision，只读 Runtime：PASS。
2. trusted capture 仅可见真实点击；取消等待 cleanup receipt：PASS。
3. A01..A14、A01..A12、F01..F14、A01..A20 无 N/A：PASS。
4. fault profile 仅签名隔离测试可用，生产入口不可选择：PASS。
5. 每故障独立 task、唯一终态、后写=0、残留=0、秘密=0：PASS。
6. 12 页精确 6+3+1+1+1、身份/URL 唯一、3 ASR、capture>=1：PASS。
7. ExitCandidate 固定 false/pending，独立审查不得回写：PASS。
8. H01..H10 仅 V3-5；V3-2 禁止扩大为 OCR/VLM/Outline/Mindmap/Ask/导出：PASS。

## 3. 关键假绿复算

以下修改均被 Schema 或语义验证器拒绝：四视口/五状态缩减、Cookie/私有路径/越界声明可见、双终态、终态后写、残留或秘密非零、故障不足/重复/越界、sampleCount=11、capture=0、fullAsr=2、12 页重分类或身份复用、ASR transcript 缺失、`independentAuditStatus=passed`、`v3_2Passed=true`、requirement 缺项/乱序和额外走私字段。

## 4. Minor 闭环

- M-1：`find_repo_root()` 可在权威仓定位 Schema/fixture；离开仓库时回退同目录 15/16 文件。最终包测试原位通过 19/19。`CLOSED`。
- M-2：测试模块明确重复 digest 仅为 shape/denominator fixture，生产 hash 必须来自 sealed runtime run；SHA-256 规则仍为 64 位小写 hex。`CLOSED`。

## 5. 允许与禁止

允许：保持文档 PASS；前序出门后按 2-5 -> 2-6 -> 2-7 顺序请求实现授权；继续运行合同回归。

禁止：当前进入任一代码阶段；提前执行 H01..H10；fixture/mock 计生产；跨 run 拼接；生产入口注入 fault；修改候选为 PASS；缩减 12 页；扩大为 V3-3+ 或其他门户完成。

## 6. 结论

V3-2-5..7 的开发、验收、威胁、机器合同和出门声明现可完整支撑后续自动化实施，但只能在 V3-2-2、V3-2-3、V3-2-4 顺序通过后使用。
