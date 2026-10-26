# WP0 R5-B Browser Relay 正控开发与验收计划

日期：2026-10-18  
前置：`60-codex-r5-checkpoint.md` 判定 `R5-A PASS / R5-B UNVERIFIED`  
当前授权：**仅 R5-B；R6/R7/P1 不得启动**

## 1. 固定输入和环境

- URL：`https://www.bilibili.com/video/BV1Bb411w741`
- source：`portal:bilibili:BV1Bb411w741:61744125:p1`
- 时长：258 秒；2026-10-18 authenticated subtitle count=0。
- Cookie：只使用已由产品 Settings 保存到 OS credential store 的用户授权 B站 Cookie；不得读取、
  打印、复制到证据或重新写入扩展 storage/SQLite。
- Runtime：fresh database/task roots；SenseVoice 必须 ready/verified/effective；
  `NAVIA_MEDIA_YT_DLP_PATH` 指向本轮 owned 且不存在的路径。
- Chrome：fresh owned profile、production unpacked build、visible、显式 `--mute-audio`。

下载器 unavailable 只用于让真实产品走已设计的最终本地 capture 回退；它不得进入普通用户默认
配置，不得新增 UI/API/test mode，不得更改仲裁顺序。

## 2. 前置检查

打开 Chrome 前完成：

1. 核验 R4 PASS、R5-A 证据 manifest、v10 baseline 50/50、mutations 15/15；
2. typecheck、受影响 media 测试、Runtime focused、relay static 和 production build；
3. 产品 API 证明 SenseVoice frozen revision/hash 为 ready/verified/effective；
4. 本轮 Runtime 配置回读或启动证据证明 downloader 为 unavailable，且不是 hash 不匹配伪装；
5. 只读 metadata probe 重新验证 BVID/CID/p1、duration 和 subtitle count；任一变化立即停止交 Codex；
6. runner 静态审计证明对 route-failure/Controller/grant/materialize/database/store 的直调为 0。

## 3. 单次 visible muted Chrome 正控

启动可见 Chrome、原生权限、焦点或 UIAutomation 前先通知用户。获得继续后只运行一次：

1. 启动 owned fresh Runtime 和 owned Chrome，打开固定 URL；
2. 从真实页面内 Navia 入口执行“分析当前视频”；
3. 同 task 观察三路 trace 精确为：
   - `credentialed_subtitle -> V3_MEDIA_SUBTITLE_UNAVAILABLE`
   - `credentialed_media_asr -> V3_MEDIA_RUNTIME_OFFLINE`
   - `public_or_page_subtitle -> V3_MEDIA_SUBTITLE_UNAVAILABLE`
4. 只有产品显示真实 `TrustedTabCaptureCard` 后，点击用户可见 capture 动作；不得注入 grant；
5. 通过真实 Chrome extension action/command 启动捕获，观察 Background 唯一 WS owner、Offscreen
   producer 和 Runtime `started`；
6. 证明 PCM bytes/chunks 均大于 0、captured duration `>=15,000ms`，sequence/length/ACK 正确；达到该时长后通过
   用户可见“完成并转写”停止；全程不播放声音；
7. frozen verified SenseVoice 生成非空带时间戳 transcript，acquisition 先到 `succeeded`；
8. 只有产品 Side Panel effect 发出 materialize；视觉不可用可按冻结合同 `degraded`，不得补造截图；
9. SQLite/UI 最终为 `ready|degraded`，同 task/source，三个 revision 域各自单调，product fence 一致，
   busy/计时停止；
10. 保存脱敏状态、进程、网络摘要和必要 UI 截图；不保存 Cookie、PCM/WAV、原始媒体或私有路径。

## 4. 强制 oracle

| ID | 门槛 |
|---|---|
| R5B-01 | fresh Runtime/database/profile/task/build owner 可复算 |
| R5B-02 | 固定 BVID/CID/p1 和 subtitle count=0 未漂移 |
| R5B-03 | 三路失败 code、顺序和同 task 精确一致 |
| R5B-04 | route-failure/Controller/grant/materialize/database/store 直调均为 0 |
| R5B-05 | 可信用户动作后才产生 grant/streamId/producer |
| R5B-06 | Background 唯一 WS owner；Offscreen 网络调用 0 |
| R5B-07 | PCM bytes/chunks >0、captured duration >=15,000ms，Runtime started 早于首 chunk |
| R5B-08 | SenseVoice model/revision/hash 精确匹配并输出非空时间戳 transcript |
| R5B-09 | acquisition succeeded 早于产品 materialize；handoff frame 不算 success |
| R5B-10 | task/source/revision/fence/SQLite/UI terminal 一致，UI 退出 busy |
| R5B-11 | Cookie/token/raw media/private path 公开命中 0 |
| R5B-12 | track/context/Port/WS/offscreen/sink/profile/runtime/port/scratch 全归零 |

任一失败即 R5-B NO-GO。只有代码、输入或环境条件明确改变后才允许重跑；不得缩分母或用 R1-R4
测试总数替代浏览器正控。

## 5. 验证预算和交付

- 实现内循环只跑受影响测试。
- 正控后只做一次集中回归：typecheck、media 子树、全量 unit、build、Runtime focused、relay static、
  v10 50/50、15/15、secret/cleanup scan。
- 不重复 R4 62-process 故障矩阵，不启动 R6，不发起 Claude 文档外审。
- 只清理本轮可证明 ownership 的资源，不触碰用户 Chrome，不 commit/push/reset/clean/checkout/revert。

证据目录必须先确认不存在；默认
`wp0-r5b-2026-10-18/`，若已存在则使用附带 UTC run ID 的新目录，禁止覆盖历史证据。交付：

- `10-receipt.md`
- `20-test-results.md`
- `30-prd-review.md`
- `40-route-and-relay-oracle.json`
- `50-handoff.md`
- `60-payload-manifest.sha256`

通过时状态只能写 `R5-B AWAITING CODEX CHECKPOINT` 并停止。不得自行宣布 R5/P0 PASS，不得进入
R6/R7/P1。
