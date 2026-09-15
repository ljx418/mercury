# PX-4 验收记录

日期：2026-09-08

结论：PASS；Fatal 0，Major 0，Minor 0。

- Workspace 产品组件测试：5 项通过；前端全量：19 文件、153 项通过。
- typecheck、WXT production build：通过，产物包含 `workspace.html`。
- Runtime V2 API：4 项通过；新增断言证明 Forget 后 source 不再出现在 Library API。
- PX-0.2 validator：9 Schema、65 正例、109 负例通过，G1-G7 contract fixture 全绿。
- Headless Chrome：60/60 checks；五 route x 四恢复 20/20；8 并发入口为 1 created + 7 focused；打开过程 0 ingest。
- 真实业务路径：PRD source 的 Source Detail、Trace、Ask、Graph；显式 Permission grant/revoke；独立真实 source 的二次确认 Forget、四面验证及 direct-route `SOURCE_NOT_FOUND`。
- 跨容器：Side Panel 与 Workspace 对同一 source 显示相同 sourceId 和 operationId。
- 视口：Side Panel 360x900/420x900，Workspace 768x900/1280x900；实际 PNG 解码尺寸匹配且无横向溢出。

失败闭环：首次 PX-4 运行暴露 route 内容先于 authority 完成的竞态；修复为 `loadedPath` 与当前 canonical path 一致后才渲染。第二次运行错误比较两个不同 source 的 operationId；修正为显式对齐同一 source。第三次运行暴露 Runtime 声称 `libraryAbsent=true` 却仍从 list API 返回 forgotten source；Runtime 在既有合同语义内改为只列 active source，并补回归测试。最终完整重跑通过。

