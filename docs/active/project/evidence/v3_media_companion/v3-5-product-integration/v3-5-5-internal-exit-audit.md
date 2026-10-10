# V3-5-5 内部出门审计

日期：2026-10-09。决定：`V3-5-5 PASS / V3-5-6 MAY GENERATE HUMAN REVIEW BUNDLE`。

- Fatal：0
- Major：0
- Minor：2

## 复核

- A01..A18 全部有同一 fresh run 证据；39/39 runner checks、4/4 viewport、Axe 0/0、keyboard 7/7。
- 焦点 Major 已以正常返回和 direct-open 两条组件测试关闭；真实 Chrome 再次验证 Escape focus return。
- 四张最终截图的 SHA-256 与 run/manifest 一致，实际解码尺寸正确；视觉复核未见遮挡或空白。
- Runtime 597/597、projection/product 26/26、Frontend 340/340、typecheck/build:e2e PASS；secret scan 0 hit；无临时媒体、ASR、profile 或安全根残留。
- 正式 v2 receipt Schema/语义均通过；真实临时磁盘峰值 1,403,308 bytes。两次 harness 失败与一次资源投影失败均已隔离、记录且未拼接。
- 没有生成 reviewerId、H PASS 或 V3-5 LIMITED PASS。

## Minor

- M-1：Side Panel 精确宽度通过同 build 的独立 `sidepanel.html` 产品面验证；原生 Side Panel 的真实启动已在同 run 完成，但宿主宽度不由 Playwright 精确控制。
- M-2：截图内容质量仍需人类完成 H01..H10；Axe 不能替代可读性和事实判断。

下一步仅允许 V3-5-6 生成冻结人工验收页面和 submission 模板，并因真实人类签署而停止自动化。
