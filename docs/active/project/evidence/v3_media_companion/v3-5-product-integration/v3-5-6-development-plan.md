# V3-5-6 人工验收包开发计划

日期：2026-10-09。输入 run：`v3-5-product-20261009T085637Z`（Chat / Know 滚动修复后的 fresh run）。

## 目标

把已通过 A01..A18 的同一 fresh build 冻结为一次 H01..H10 可见 Chrome 人工审查。交付逐步配图 HTML、只读 bundle manifest 和未签署 submission template；不新增产品能力，不代签判断。

## 实施

1. 绑定 product acceptance、machine evidence、build tree 和四张 fresh 截图哈希。
2. 为 H01..H10 提供具体入口、操作、可见 PASS 标准、失败/阻塞定义与相关截图。
3. 页面只允许填写 reviewerId、逐项 decision/note；10 项完整后导出 JSON。
4. 导出内容固定 run/build/bundle，Schema 强制 overall 与逐项状态一致。
5. 本地执行 HTML 静态审计、四视口、键盘与导出 JSON Schema 正/负验证。

## 边界

- 不要求人类提供 Cookie、API key、听写、日志、路径或哈希判断。
- 预置截图仅用于定位当前 build，不代表人类已经执行或通过。
- 不生成 reviewerId、submittedAt、PASS submission 或 V3-5 LIMITED PASS。

