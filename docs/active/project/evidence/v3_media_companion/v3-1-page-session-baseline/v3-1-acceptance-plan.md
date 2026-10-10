# V3-1 B站页面、会话与能力基线验收计划

日期：2026-09-17。状态：`ROUTE A FROZEN / V3-1.1 EXTERNAL LIMITED PASS / V3-1.2 DETAILED ACCEPTANCE PENDING EXTERNAL DOCUMENT AUDIT`。

## 1. 生产基线

- 必须使用一个全新 run、全新扩展 build、全新 Chrome profile 和真实本地 Runtime。
- 输入固定为 revision 1 的 12 页注册表，SHA-256 必须等于 `b71588928db4a0cb371152999052ae6b511b076377df427d74e680119491d8c1`。
- 不允许将 V3-1P 的页面探测结果直接复制为产品 collector 输出。
- 登录态与未登录态必须由真实 Chrome 权限/会话观测产生；测试可使用隔离 profile，但不得把 Cookie 值写入证据。

## 2. 固定验收项

| ID | 用户操作/输入 | 必须结果 |
|---|---|---|
| V3-1-A01 | 依次打开 12 个注册页 | adapter 内部 bvid/cid 与通用 mediaId/playbackUnitId、part、duration、title、owner、revision 映射一致；UI/Runtime 不出现平台专用字段 |
| V3-1-A02 | 打开固定锚点 | 识别 `BV1ZpYd66ELP`、单 P、真实时长与无字幕能力；不得由标题/简介生成 transcript |
| V3-1-A03 | 打开多 P 样本并切换两个分 P | part/cid/revision 更新；旧 page context 失效；两个分 P 不被合并为一个 identity |
| V3-1-A04 | 首次查看并拒绝授权 | 显示五项 scope；拒绝后 0 Cookie API 读取、0 credential envelope、0 lease |
| V3-1-A05 | 授予 B站会话 scope | 只请求冻结的可选权限和 B站 host；界面只显示 `available/unavailable/unknown`，0 Cookie 值 |
| V3-1-A06 | 刷新、关闭重开、撤销 | 授权状态按合同恢复；撤销后拒绝新 envelope/lease；旧租约立即不可用 |
| V3-1-A07 | 启动两个 task | 每个 task 获得不同、短期、单次的 lease metadata；Cookie 名称集合只来自冻结白名单 |
| V3-1-A08 | 重放/跨 task/过期 envelope | 全部 fail closed，返回冻结 FailureCode；不得进入重试队列 |
| V3-1-A09 | Runtime 离线和重启 | UI 显示可恢复错误；不缓存伪造会话成功；秘密不因重试持久化 |
| V3-1-A10 | Side Panel/Workspace direct-open、reload、Back、reopen | 同页面 revision 保持；identity 变化时回退媒体入口；焦点返回正确 |
| V3-1-A11 | 360/420/768/1280 四视口 | 文本不遮挡、主操作可达；Axe serious/critical=0；键盘主流程通过 |
| V3-1-A12 | 关闭、撤销、超时与成功终态 | 内存 envelope 清空，0 Cookie 值/原始 request body 持久化；没有 V3-2 下载产物 |
| V3-1-A13 | 构建产物权限审计 | 严格执行用户选定路线；不得用 `http://*/*`/`https://*/*` 等等价写法伪装移除 `<all_urls>` |
| V3-1-A14 | 全树秘密与来源扫描 | 配置、DB、EventStore、Trace、日志、错误、公开证据和 retry payload 中 0 Cookie/token；结果可从单 run 重算 |

## 3. E2E 证据

每项必须记录：runId、build hash、profile identity hash、URL、adapterId、通用 mediaId/playbackUnitId/part、B站内部 bvid/cid 对账、观测时间、页面/API 来源、截图、请求/响应 hash、实际结果和 PASS/FAIL/BLOCKED。Cookie 值、完整请求 Cookie header、认证 token 和用户身份不得进入 evidence。

截图至少包括：锚点识别、授权前、拒绝、授权后能力、撤销后、分 P 更新、Runtime 离线、Side Panel 360/420、Workspace 768/1280。截图中不得出现 Cookie 值。

## 4. False-green 拒绝

以下任一项为 Major 或 Fatal：

- 用 V3-1P raw observation、fixture、mock、原型或 BiliNote 输出冒充产品 collector；
- 只改字符串 `<all_urls>`，却保留语义等价的所有 HTTP/HTTPS host 权限；
- 因测试 profile 无登录 Cookie 而跳过 session broker 正/负路径；
- 只相信 UI badge，不检查实际 Chrome permission 和 Broker 事件；
- Cookie 值、完整 header 或一次性 envelope 出现在持久介质/证据；
- 一个样本重复计数、缩小 12 页分母或跨 run 拼接；
- 把 V3-1 身份/租约能力扩大声明为媒体下载、ASR 或视频理解完成。

## 5. 出门条件

- V3-1-A01..A14 全部 PASS，不允许 N/A。
- Fatal=0、Major=0；Minor 有明确 owner 与后续门禁。
- PRD review 证明没有未授权改变 V1 普通网页入口或 V3 权限承诺。
- 独立实施出门审查通过。

通过后最多声明：`V3-1 Bilibili page identity and governed session lease baseline passed the frozen real-Chrome matrix.`
