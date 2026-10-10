# V3-5-6 Chat / Know 滚动阻塞修复计划

日期：2026-10-09。来源：人工 H 前体验阻塞。

## 根因

`.main-pane` 为 `overflow:hidden`。Chat 的 `.chat-stage` 没有纵向滚动，Know 的两个根组件也未包入已有 `.view-panel`，因此内容超出视口后没有可接管 wheel 的父容器。

## 最小修复

1. Chat stage 成为纵向滚动容器；卡片/编辑器不被 flex 压扁，消息区保持可用最小高度。
2. Know 的 `LocalRuntimeAccess + KnowledgeQuickSurface` 包入统一 `view-panel knowledge-view-panel`。
3. 在真实扩展页 420x500 下分别将鼠标置于 Chat/Know 内容，派发 wheel 并要求 `scrollTop` 增长；同时验证 PageDown/Space 键盘路径。
4. 运行目标测试、typecheck、build:e2e 和四视口无横向溢出检查。

不修改 Runtime、知识合同、媒体任务、授权、Ask 或人工 judgment。

