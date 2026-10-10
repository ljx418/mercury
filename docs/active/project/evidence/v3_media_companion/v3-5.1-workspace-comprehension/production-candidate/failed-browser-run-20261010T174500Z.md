# V3-5.1 浏览器验收 receipt 定位失败记录

日期：2026-10-10  
目标 run：`v3-5.1-production-candidate-20261010T210000Z`

## 失败事实

- 第一个视频全部非问答入口已通过，第一条问答引用也生成了原子 receipt。
- runner 对第二条引用使用 `button.locator("xpath=..")` 后，Playwright 在动态列表重解析时取得第一条引用的父节点；按钮时间为 665068ms，误读 receipt 为 330820ms。
- 请求时间不一致检查正确 fail-closed；产品 seek 本身没有被计为通过或失败，candidate 未生成。

## 修复

- receipt 定位改为目标按钮的直接 `following-sibling::small`，并继续强制校验 receipt requestedMs 与按钮 data-seek-ms 完全相等。
- 不按时间猜测、不选择列表中任意 `located` 状态；下一轮完整重跑。
