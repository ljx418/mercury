# V3-5-6 人工验收包验收计划

日期：2026-10-09。

## 自动门槛

1. bundle 仅绑定 `v3-5-product-20261009T085637Z` 和 build `e7ad9c05...ba33d`。
2. 4 张截图 hash/尺寸与 V3-5-5 manifest 一致；H01..H10 每项至少一个定位截图引用。
3. 页面展示 10 个且仅 10 个步骤，逐项包含操作、预期结果和 FAIL/BLOCKED 定义。
4. reviewerId 为空或任一项未选时禁止导出。
5. 导出的 JSON 通过 `v3_media_human_review_v1.schema.json`；overall 按 BLOCKED > FAIL > PASS 计算，不可手改。
6. 页面 360/420/768/1280 无根横向溢出，键盘可完成填写和导出，Axe serious/critical=0。
7. 公开材料 secret scan 0 hit，不包含私有媒体、过程帧、Cookie、API key 或绝对私有路径。

## 人工门槛

自动验收包完成后停止；H01..H10 必须由真实人类在可见 Chrome 操作并导出 submission。任何 FAIL/BLOCKED 都不允许进入 V3-5-7 成功审计。

