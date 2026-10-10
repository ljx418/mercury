# V3-2-2 路线 B 外审 Minor 闭环

日期：2026-10-06。依据：`route-b-independent-document-audit.md` 的 M-1..M-3。

## 处置

- M-1：测试不再固定 `parents[3]`；从当前文件祖先中定位权威 Schema，仓库内与平铺审计副本均可显式供给/定位。
- M-2：`NaturalEvidence` 新增必填 `firstProbeAt`、`secondProbeAt`，格式均为 `date-time`；builder 缺时间戳即 fail closed。
- M-3：builder 在字典折叠前验证 `len(by_bvid)==len(observations)`；重复 BVID 行明确拒绝。

## 验证

Revision 3 + Revision 4 定向测试：`18 passed`。Revision 4 Schema meta-validation：PASS。新增负例覆盖缺时间戳与重复 BVID。

## 边界

该闭环只增强证据合同，不新增产品 Fault 入口，不修改 12 URL、6+3+1+1+1、1+2 ASR trigger、SenseVoice 基线或用户体验。外部差异复审 Fatal=0/Major=0 后进入 B-1。

