# V2-PX-4 Workspace 组件产品化开发计划

日期：2026-09-08

## 目标

把 PX-1 的宽屏路由壳升级为可实际操作的管理面：Source Library、Source Detail、Ask with Sources、Evidence Trace、Knowledge Graph、PermissionRoot 和用户主动 Forget。

## 组件与事实来源

| 组件 | 生产事实来源 | 允许动作 |
|---|---|---|
| `SourceLibraryPanel` | list sources/workspaces | 筛选、选择 source |
| `SourceDetailReader` | get source | 查看 status/revision/IDs，打开 Trace，发起 Forget |
| `AskWithSourcesPanel` | query API | 提问并展示 answer/evidence/degraded |
| `EvidenceTraceDrawer` | source.evidenceRefs | 只读展示，不推断 located |
| `KnowledgeGraphCanvas` | graph API | 选择节点、刷新，不创建节点/边 |
| `PermissionRootManager` | grant/revoke API | 显式授权、撤销；不扫描文件 |
| `ForgetSourceDialog` | forget API | 二次确认；成功后显示 Runtime 四面 verification |
| `DataServiceStatusCard` | knowledge status | 四域状态与 Runtime offline authority |

## 顺序

1. 拆分交付级组件并增加组件测试。
2. Workspace route 接入现有 runtimeClient；Source Detail/Ask/Graph/Permissions 使用真实 Runtime。
3. Forget 成功后回到 Library、重读 Runtime，原 source direct route 必须 SOURCE_NOT_FOUND。
4. 768/1280 响应式、keyboard、dialog focus/Escape 和无阻塞视觉测试。
5. 全量回归、真实 Runtime + Headless Chrome 交互、PRD/架构/false-green/独立审计。

## 禁止范围

不修改 Runtime contract；不实现自动遗忘、RAG、文件自动扫描；不把 local state 当 Permission/Forget 权威；不直连 data_service；不让前端创建 graph/evidence facts。
