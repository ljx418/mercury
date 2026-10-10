# V3-1 路线 A 架构与 PRD 内部审计

日期：2026-09-17。性质：实施前内部审计，不替代外部独立审查。

## 1. 审计对象

- 主 PRD、交互 PRD、目标架构、总开发计划、总验收计划。
- V3 component/route、risk ADR、stage gate、gap Markdown 与 8 页 Draw.io。
- V3-1 开发计划、验收计划、授权记录和原权限冲突审计。
- 通用合同 Schema v3、门户注册表 v1 和 fixture v3。

## 2. 路线 A 闭环

| 问题 | 当前决定 | 一致性结果 |
|---|---|---|
| V1 全站常驻 launcher 与 V3 无全站权限冲突 | B站详情页窄域自动入口；普通网页 action/command + activeTab + 原生 Side Panel | PASS |
| 页面桥接与 Cookie 权限混淆 | B站页面桥接固定窄域；`cookies` + B站 wildcard host 只在五项授权后可选请求 | PASS |
| 未来门户会复制 B站实现 | `MediaPortalAdapter` + build-time `MediaPortalRegistry`；B站字段只留 adapter 内 | PASS |
| 新门户静默获得权限 | 每个 adapter 独立窄域权限、identity、capability、样本和两轮审计 | PASS |
| 远程插件扩大攻击面 | `remoteAdaptersAllowed=false`，registry 为构建期封闭集合 | PASS |
| 普通网页能力退化为不可用 | 用户点击 action/command 后仍可读取当前页并使用原生 Side Panel；仅取消安装后自动 launcher | PASS WITH EXPLICIT UX CHANGE |

## 3. 开放接口检查

通用 `MediaPageContext` 已移除 bvid/cid/partId 顶层字段，改为：

```text
platform / adapterId / adapterRevision
canonicalUrl / mediaId / playbackUnitId / part
title / author / durationSeconds / currentTimeSeconds
transcriptAvailability / observedAt
```

`MediaPortalAdapter` 冻结 `match/collect/readPlayback/seek/capabilities` 责任；`PortalCredentialLease` 以 `adapterId` 区分门户且禁止秘密值。B站 bvid/cid 分别映射 `mediaId/playbackUnitId`。未来 YouTube、小红书可以使用同一 context 和 task identity，不需要修改 UI、Runtime、VideoOutline 或 route；但新增 adapter 仍必须回到权限和验收门禁。

## 4. Draw.io 检查

- 页数：8。
- 页面节点/边：12/7、18/8、18/5、12/10、16/8、10/6、12/7、15/2。
- 重复 ID：0；越界：0；断裂 edge reference：0。
- 已出现：`MediaPortalRegistry`、B站首个 adapter、`activeTab`、YouTube/XHS 后续适配、全站静态注入 No-Go、通用 `MediaPageContext`。

## 5. 结论

Fatal=0，Major=0，Minor=0。

路线 A 在 PRD、交互、架构、组件、风险、里程碑、验收和图纸层已一致落盘。该结论只允许进入合同/假绿复审和外部文档审查，不能单独授权产品代码。
