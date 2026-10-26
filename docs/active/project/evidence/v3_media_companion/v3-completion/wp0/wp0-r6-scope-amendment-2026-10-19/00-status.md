# WP0 R6 范围修订状态

当前坐标：`V3 completion / WP0 / R6 constrained closeout / R7 DOCUMENT MAY START`。

- 原 R6 固定分母结果：G1 29/29、G2 0/7、G3 8/8、G4 21/21，总计 58/65。
- 原 R6 不声明 PASS；G2 的 7 个 owned Chrome 生命周期场景保持失败事实。
- 用户已批准在架构和开发成本过高时裁剪 tabCapture，并采用自动字幕/受控下载优先、显式本地文件 fallback 的路线。
- 本修订允许编写 R7 closeout 文档，不允许把本地文件导入写成已实现，也不允许改写历史失败证据。

R7 的候选范围是：主输入链路、relay 已验证安全边界、capture 默认关闭的受限披露、secret/cleanup 和 immutable source/build seal。R7 不再要求 G2 7/7 才能生成受限候选，但必须验证生产不会静默进入实验 capture。

