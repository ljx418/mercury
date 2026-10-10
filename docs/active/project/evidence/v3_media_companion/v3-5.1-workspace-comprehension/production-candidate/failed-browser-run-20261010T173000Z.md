# V3-5.1 浏览器验收非原子二次回读失败记录

日期：2026-10-10  
目标 run：`v3-5.1-production-candidate-20261010T210000Z`

## 失败事实

- 防碰撞修复后，第一个固定视频的章节、moment、frame、导图键盘定位均已真实通过。
- 问答引用按钮内部的 `MediaJumpbackController` 已执行 seek、等待 150ms、回读播放器并显示 `located`。
- runner 在该原子操作完成后又通过 service worker 发起第二次独立回读；第二次读取得到已变化的播放器位置，误差 334248ms，runner fail-closed。
- 最终 candidate 未生成，所有本轮观察作废。

## 修复与隔离

- seek 状态节点增加只读 `data-seek-requested-ms`、`data-seek-observed-ms`、`data-seek-delta-ms`、`data-seek-observed-at`。
- runner 直接记录控制器同一次原子 seek/readback 的 receipt，并独立校验 `deltaMs = abs(observedMs - requestedMs) <= 2000`。
- 不使用推算值、不降低阈值，也不再用存在竞态的第二次读取覆盖原子 receipt。
- 浏览器 profile、Runtime 和内存截图均已清理。
