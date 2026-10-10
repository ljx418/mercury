# V3-1P B站真实样本探测实施前审计

日期：2026-09-17  
结论：`GO FOR READ-ONLY REAL-CHROME PROBE`

## 1. 前置门禁

- V3-0 Cookie 主路径独立文档审查：`Fatal=0 / Major=0 / Minor=3`。
- 用户已明确授权进入实际开发，但当前仅执行 V3-1P 前置探测。
- V3-0 M-1（12 个具体 URL 未冻结）由本子阶段关闭，未被降级或豁免。
- V2/PX-6/RKM 保持暂停，不读取或改写其 sealed evidence。

## 2. 风险复核

| 风险 | 防线 | 结论 |
|---|---|---|
| 读取真实账号 Cookie | 全新临时 profile；不申请 cookies 权限 | 关闭 |
| 搜索摘要冒充产品证据 | 每个入选 URL 必须真实 Chrome 导航并保存原始观测/hash/截图 | 关闭 |
| 分类猜测 | 不可证明则 `unclassified`，注册表生成失败 | 关闭 |
| 复用 URL 缩小分母 | Schema + semantic validator 强制 URL/BVID 唯一与计数精确 | 关闭 |
| 平台内容变化 | 每项保存 `observedAt` 和 revision；变化创建新 revision | 关闭 |

## 3. 已知但不属于 V3-1P 的产品 Major

当前 `wxt.config.ts` 与 content script 仍包含 `<all_urls>`，而 V3 A13/No-Go 要求最终权限中不存在该模式。V3-1P 不加载 Extension，也不修改 manifest；该差异必须在 V3-1 产品实施前审计中形成明确迁移方案并关闭，不能沿用 V3-0 文档审查结论直接视为合规。

实施前分级：`Fatal=0 / Major=0 / Minor=0`（仅限 V3-1P）。V3-1 产品实现仍为 NO-GO，直到样本注册表与权限迁移审计通过。
