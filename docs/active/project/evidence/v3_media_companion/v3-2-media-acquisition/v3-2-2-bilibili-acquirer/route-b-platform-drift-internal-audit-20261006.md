# V3-2-2 Route B 平台漂移内部审计

日期：2026-10-06。对象：`route-b-platform-drift-amendment-20261006.md` 及其同步合同。结论：内部文档与合同审计 PASS，可进入独立只读文档审查，不构成实施出门通过。

## 1. 事实与处置

- 首轮真实 Chrome run 完成 12/12，但旧第 9 项当前无字幕，按 RB05 判定失败并作废 production-candidate 资格。
- 替代项 `BV1pW421c7DH` 来自既有 discovery-only 真实 Chrome 观测：3 个字幕项、约 573 秒、无限制信号。
- 新 run 必须重新观测该事实；历史 run 不进入 production evidence。

## 2. 一致性复核

| 检查 | 结果 |
|---|---|
| matrix / candidate JSON / registry / v4 test BVID 一致 | PASS |
| 12 个 BVID 唯一 | PASS |
| `6+3+1+1+1` 分母不变 | PASS |
| `1 natural + 2 audited` 不变 | PASS |
| 403 / empty 两类故障各 1 | PASS |
| `BV1ZpYd66ELP` 固定锚点不变 | PASS |
| v3 registry 与历史样本不修改 | PASS |
| v3 + v4 registry tests | 18 passed |
| 生产故障注入不可达静态审计 | 8 files / 9 needles / 0 hit / PASS |

## 3. PRD 与风险结论

用户操作、portal-neutral 接口、Cookie 任务租约、真实媒体、SenseVoice 基线及低资源约束均未改变。该修订提高验收真实性，不构成体验回退或规格扩张。残留风险只有平台在新 run 前再次改变字幕状态；处理方式为 fail closed 并再次回到规格修订，不允许降门槛。

Fatal=0，Major=0，Minor=0。允许提交外部只读文档审查；V3-2-2 implementation exit 仍未通过。
