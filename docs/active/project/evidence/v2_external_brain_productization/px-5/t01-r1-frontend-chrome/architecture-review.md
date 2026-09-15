# T01 架构检视

日期：2026-09-11  
结论：T01 修改遵守 P0-P7 与双容器边界，未引入新的跨层依赖。

## 交互链

```text
宿主网页
-> Chrome action / background 测试桥
-> 原生 Side Panel Quick Surface
-> OpenWorkspaceAction
-> Extension Workspace Page
-> 两个页面各自的 runtimeClient module session
-> Local Runtime /v1/knowledge/*
-> 既有 Adapter / Governance
```

- token 只存在于各页面 module 内存中，不经 URL、Chrome storage 或跨容器消息传递。
- 两容器只用稳定 ID 关联；Knowledge 正文、Ask、Graph、Trace 重新从 Runtime 读取。
- 前端未直连 `data_service`，未创建 KnowledgeItem/EvidenceRef/graph relation 权威事实。
- PermissionRoot 的前端状态机不取代 Runtime 权限检查；撤销后的 403 和保留来源由真实 Runtime 验证。
- Forget UI 只有在 Runtime operation succeeded 且四面严格 absence 时显示成功。
- E2E bridge 仅在测试构建启用，不是生产 API，也不改变普通构建权限面。

没有公共合同变更，不需要返回 V1.2-0 或 PX-0。下一阶段若需要修改原始证据 schema、生产 validator 输入或 Runtime API，必须单独回到实现前审计。
