# PX-4 PRD 规格检视

| PRD 要求 | 真实证据 | 结论 |
|---|---|---|
| Source Library / Detail | Runtime 列表、stable route ID、operationId、Forget 后 Library API absent | PASS |
| Ask with Sources | 真实提问返回 `source_supported` 与 1 个 EvidenceRef | PASS |
| Evidence Trace | 只展示 Runtime `fallback_text/fallback_shown`，不升级为 located | PASS |
| Knowledge Graph | Runtime 返回 2 nodes，选择只改变视图 | PASS |
| PermissionRoot | 用户显式 grant 后显示 granted，revoke 后显示 revoked；未触发 source 删除 | PASS |
| Forget | 二次确认、Runtime Library/Ask/Graph/Trace 四面 true、原 detail route 为 SOURCE_NOT_FOUND | PASS |
| 四域服务状态 | online 与 Runtime offline 截图均区分 Runtime/Adapter/data_service/source build | PASS |
| 双容器职责 | Side Panel 只有 Quick Surface；完整管理组件只在 Workspace | PASS |
| 稳定 ID | 同一 source 的 Side Panel/Workspace sourceId、operationId 一致 | PASS |
| 宽屏 UX | 768/1280 无横向溢出；dialog、drawer、键盘名称和焦点返回有组件/Chrome 证据 | PASS |

PX-4 不声明真实 data_service 已接入、自动遗忘、默认本地文件扫描、完整 RAG、PX-5 产品总验收或 V2 ready。

