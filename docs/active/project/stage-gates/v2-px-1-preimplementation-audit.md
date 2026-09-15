# V2-PX PX-1 Preimplementation Audit

## Result

```text
Date: 2026-09-01
Fatal: 0
Major: 0 after stage-boundary clarification
Minor: 1 accepted and tracked
Disposition: GO for PX-1 implementation
```

## Findings Closed Before Code

### PX1-AUD-001 Stage ownership ambiguity

Hosting ADR 要求 PX-1 六项 spike 包含真实生产入口和重复打开复用；总阶段表把完整入口 UX 放到 PX-2，把完整 tab reuse/reconnect 放到 PX-3。

闭环：PX-1 只增加一个最小 `打开工作台 -> source_library` 入口和单标签 `focus_existing_or_create` 行为来证明 Route A 可行。PX-2 仍拥有三个入口的最终产品 UX，PX-3 仍拥有多窗口、五类 route action、reconnect 和完整幂等矩阵。公开 action/route/result 合同不变，不新增 localhost 回退。

### PX1-AUD-002 Runtime error fidelity

当前 `runtimeClient.ts` 抛出普通 Error，不能稳定暴露 Runtime error code。PX-1 不修改公共 Runtime 合同：Router 通过 route 语法、workspace 列表和 source lookup 区分 `INVALID_ROUTE`、`WORKSPACE_NOT_FOUND`、`SOURCE_NOT_FOUND`；`FORBIDDEN` 使用可注入 resolver 单元测试证明 UI 分支。错误码透传增强留给 PX-3，PX-1 不伪称真实后端已产生 FORBIDDEN。

### PX1-AUD-003 Existing shell ownership

当前 `KnowledgeWorkspaceShell` 是 Side Panel 聚合壳，不适合作为五类宽屏 route 的最终组件。PX-1 只实现 route-specific loading/diagnostic shell；PX-4 再拆分交付级组件，避免本阶段复制知识事实或提前扩大 UI 承诺。

## Permission And CSP Audit

- 当前权限：`activeTab`、`scripting`、`sidePanel`、`storage`、`tabs`。
- PX-1 不新增权限，不新增远程脚本，不新增 localhost Workspace host。
- `workspace.html` 是 extension-origin unlisted page，不需要进入面向网页的 `web_accessible_resources`。

## Minor

当前 Runtime `/v1/knowledge/workspaces` 对未知 workspace 返回空 sources 而非 canonical `WORKSPACE_NOT_FOUND`。PX-1 用 workspace 列表做显式存在性检查；Runtime 合同改动不在本阶段。

## Go Conditions

- PX-0.2 独立复审为 Fatal 0 / Major 0 / Minor 0：满足。
- 本阶段开发与验收计划已单独落盘：满足。
- 未改变 Workspace schema、Runtime API 或 P3-P6 ownership：满足。
- 无新增 Fatal/Major：满足。

