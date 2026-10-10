# V3-2-7 单 run 生产出门验收计划

日期：2026-10-06。固定使用总计划 `V3-2-A01..A20`，本文件冻结执行和证据方式。

| 分组 | 必须复算 |
|---|---|
| A01-A03 | Schema/49 cases、依赖/模型、Revision 3 的 12 个唯一 identity 与 6+3+1+1+1 |
| A04-A08 | 6 subtitle、3 full ASR、multipart 精确 part、restricted blocked、low-signal degraded |
| A09-A11 | route 严格前缀、trusted capture、transcript/hash/provenance |
| A12-A16 | 双容器 UI、取消/撤销/重启、完整故障矩阵 |
| A17-A18 | 五终态 cleanup、secret scan、权限/架构/全量回归 |
| A19 | 360/420/768/1280 PNG、overflow=0、Axe 0/0、键盘主流程 |
| A20 | 单 run binding、public/private、seal、外部独立审计 |

## 固定语义

- `sampleCount=12`，sourceIdentity 和 URL hash 各自唯一。
- 分类必须精确 6 subtitle、3 ASR、1 multipart、1 restricted、1 low-signal。
- 三个 ASR 都有 transcript；至少一个 selected route 为 trusted capture。
- restricted 只能 blocked 且无 transcript；low-signal 只能 degraded 且无伪 transcript。
- ExitCandidate 必须 `v3_2Passed=false`、`independentAuditStatus=pending`。
- 只有不同 reviewer session 复算全部 A01..A20 且 Fatal=0/Major=0 后，阶段状态文档才能写 LIMITED PASS；不得修改候选 JSON 伪造通过。

## 审计包

最多 20 个平铺文件，必须包含 audit request、PRD/架构/stage gate、开发/验收合同、candidate、artifact/build/index、public tar、cleanup/secret scan 和独立审查入口。任何 payload 源变化后必须清空重建 manifest。
