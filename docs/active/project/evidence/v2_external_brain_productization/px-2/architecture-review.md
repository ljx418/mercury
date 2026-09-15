# PX-2 架构核对

日期：2026-09-08

目标链路：Host Page -> Side Panel Quick Surface -> Background OpenWorkspaceAction -> Extension Workspace Page -> shared Runtime client -> Runtime authority。

- `entrypoints/sidepanel/main.tsx` 只挂载 `KnowledgeQuickSurface`。
- Quick Surface 只组合 Save、状态、四个 Workspace 入口和只读 Trace。
- Workspace 导航经 Background，不直接创建标签页。
- Side Panel 不调用 data_service，不生成 KnowledgeItem/EvidenceRef/Graph fact。
- Runtime、Schema、CSP 和扩展权限未因 PX-2 扩张。
- `KnowledgeWorkspaceShell` 保留为 PX-4 迁移输入，但不再由 Side Panel 渲染。

结论：目标架构达到；Fatal 0，Major 0。
