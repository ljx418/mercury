# V3-5.1 四视口 Axe 产品失败记录

日期：2026-10-10  
目标 run：`v3-5.1-production-candidate-20261010T210000Z`

## 失败事实

- 第一视频 10/10 真实 seek 与时间线/导图交互均完成后，四视口 Axe 阶段阻断候选。
- 360px 大纲：`color-contrast` serious，章节编号及无代表画面标签使用 `#ad7115`，未达到普通文本 AA 门槛。
- 768px 导图：`aria-required-parent` critical，三级 `role=treeitem` 直接位于二级 treeitem 内，缺少 ARIA `role=group` 中间层。
- 未降低 Axe 影响级别、未排除节点，最终 candidate 未生成。

## 修复与重验

- 两处橙色文本改为 `#80510d`；装饰性边框颜色保持不变。
- 三级导图节点统一放入二级节点的 `role=group`，方向键与 seek 行为保持。
- 重新执行组件测试、typecheck、build 和完整三视频四视口 Axe。
