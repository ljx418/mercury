# PX-4 False-Green Audit

- 从 `px-4-e2e.json` 重算 60/60 checks、20/20 recovery pairs、8 个并发结果单一 tabId。
- PRD source 的 fingerprint 从当前文件原始字节计算；source/operation/evidence/graph/permission/forget 均来自真实 Runtime 响应。
- Forget 使用本轮新建的独立 source，不删除共享基线；验证后 list API 中不存在该 source，原 detail route 返回 `SOURCE_NOT_FOUND`。
- Runtime offline 由 Playwright transport fault 产生，UI 将下游状态置为 unchecked/unknown；恢复后重新查询 Runtime。
- PNG 由 `file` 检查 magic 和实际尺寸；人工图像复核未发现重叠、截断或弹窗遮挡关键动作。
- 静态扫描未发现 Workspace/knowledge modules 直连 data_service endpoint 或创建 KnowledgeItem/EvidenceRef/graph relation；命中的 `data_service` 仅为状态标签和边界文案。
- 早期失败报告全部保留在最终日志历史说明中，不以局部重跑替代最终完整 E2E。

结论：Fatal 0，Major 0，Minor 0。

