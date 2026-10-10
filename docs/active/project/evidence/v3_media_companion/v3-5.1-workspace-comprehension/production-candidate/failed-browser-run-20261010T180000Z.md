# V3-5.1 问答引用动态树竞态记录

日期：2026-10-10  
目标 run：`v3-5.1-production-candidate-20261010T210000Z`

## 失败事实

- 第一视频前八条 seek 与第一条问答引用均通过。
- 第一条引用的 `busy/receipt` 状态更新后，第二条引用所在 React 子树在 Playwright actionability 检查期间被替换；目标 Element 连续 detached，runner 超时。
- 未使用 `force` 或 DOM 注入绕过，最终 candidate 未生成。

## 重验方式

- 两条问答引用分别在独立的问答路由加载与提交周期内验收，每次固定 `data-ask-question` 并只触发一个引用。
- 每一周期仍由真实按钮、真实 content bridge 与真实 B 站播放器完成定位；重复加载不跨 candidate，也不复用 receipt。
