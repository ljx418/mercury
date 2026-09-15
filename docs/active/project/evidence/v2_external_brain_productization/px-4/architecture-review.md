# PX-4 架构核对

- P2a Side Panel：继续只挂载 `KnowledgeQuickSurface`，没有完整 Library/Graph/Permission/Forget 管理面。
- P2b Workspace：`SourceLibraryPanel`、`SourceDetailReader`、`AskWithSourcesPanel`、`EvidenceTraceDrawer`、`KnowledgeGraphCanvas`、`PermissionRootManager`、`ForgetSourceDialog`、`DataServiceStatusCard` 已拆分并接入。
- P3：所有组件通过共享 `runtimeClient.ts` 访问 Runtime；没有直连 data_service、MCP 或外部 API。
- P4/P5：Runtime 修复仅使 list sources 与既有 `libraryAbsent` Forget 合同一致，不增加 public API 或状态枚举。
- P6：data_service 仍为 unchecked candidate，UI 没有冒充已接入。
- P7：Chrome JSON、日志、真实 PNG、PRD review 和 false-green audit 独立落盘。

目标架构达到。Public contract changes：none。Fatal 0，Major 0。

