# V3-5-5 Product Acceptance v2 Major 闭环

日期：2026-10-09。初始审计：Fatal=0 / Major=1。修订决定：`FRESH RUN REQUIRED`。

## Major

首个 V3-5-5 run 的 37/37 阶段检查和四视口证据真实有效，但 runner 未输出冻结的 `v3-media-product-acceptance/v2`。若直接生成 H01..H10 bundle，将缺少 `taskExecution`、完整 task binding、18 项 requirement 与合同级 seek 算术，构成机器证据假绿风险。

## 闭环

- runner 从认证 Runtime API 读取 task 和 Ask 权威记录，不从 DOM 文本反推内容。
- seek receipt 读取真实播放器 `currentTime`，独立复算 `deltaMs` 与分 P duration 边界。
- 资源提示通过产品 DOM 的数值属性读取，不只判断文案存在。
- 生成 8 route、3 Ask、5 seek、2 export、4 surface、18 requirement 的 v2 receipt。
- 先执行 Draft 2020-12 Schema，再执行 route drift、资源、seek 算术、route 集合和 requirement 唯一性语义校验；任一失败令 run 非零。
- machine evidence 去敏，不包含完整 transcript、帧或私有路径；正式 receipt 只保留合同要求的 Ask 输出与 evidence IDs。

首个 37/37 run 仅保留为历史自动 UX 证据，不可绑定人工 review。必须从零执行新的真实 run，并以新截图替换旧截图。
