# V3-2-7 外部独立实现出门审查请求

请以只读方式独立复算 `v3-2-production-20261007T174158Z`，输出 Fatal/Major/Minor，并将结果落盘为 `v3-2-7-independent-implementation-exit-audit.md`。

必须从 external audit package 的 `AUDIT_MANIFEST.md` 开始，重算全部 payload SHA-256、Schema、A01..A20、12 页分类、3 full ASR、trusted capture、14 fault、四视口、cleanup、public/private、secret scan、seal 和失败 run 隔离。不得运行旧 PX generator/validator，不得打开 Cookie 文件，不得修改候选。

允许的最高结论：`V3-2 LIMITED PASS`，仅允许 V3-3 按既有文档进入实施前门禁。禁止声明 V3、视频理解、图文大纲或 Media Mindmap 完成。
