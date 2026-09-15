# T02 R2 原始证据采集开发计划

日期：2026-09-11  
状态：实现前冻结候选。T01 已通过；本文件不批准 R3、R4、PX-6 或旧报告链。

## 1. 目标与边界

T02 只把真实宿主、原生 Side Panel、Workspace、Background 和 Runtime 的实际动作/请求/响应/截图写成同一新 run 的 append-only 原始事件。输出必须符合 `v2-px-raw-run/v2`，缺观察时生成失败诊断并退出非 0，不生成派生 ScenarioResult、G1-G7、HTML 或完成声明。

允许修改：`chrome-v2-px-workspace-router.mjs` 的 PX-5 采集路径、独立 raw collector/helper、仅 E2E 构建的动作观测 bridge、`v2_px_raw_run.schema.json` 及直接测试。禁止修改 Runtime HTTP/Adapter 公共合同，禁止运行或修复旧 generator/production validator，禁止真实 data_service 和 RKM。

## 2. 实施顺序

1. 从 T01 隔离提交创建新的 detached worktree；输入 manifest 按 raw bytes/mode/hash 覆盖当前 T02 文件，fresh `build:e2e` 后构建索引与产品构建共享同一 snapshot commit。
2. T02-0 首先退役旧 PX-5 假 raw 路径：`NAVIA_PX5_PRODUCTION=1` 在新collector未初始化时必须写失败diagnostic并非0退出；禁止再输出 `v2-px-5-production-raw-e2e/v1` 或把 `px-5-raw-e2e.json` 当sealed raw。移除PX-5路径对`chrome.runtime.sendMessage`的monkey patch、`evaluate`入口计数和`JSON.stringify(responseBody)` hash。上述反回退测试先红后绿，才进入后续采集。
3. 实现单写者 collector：在接收时分配全局唯一 eventId、严格递增 sequence 和 monotonicMs；artifact 先以临时名写入并 fsync/close，再登记 hash/bytes/mediaType/visibility。raw run 只在所有事件和 artifact 完成后一次封存，生成canonical-without-seal hash并原子rename，封存后只读复算；禁止事后回写。
4. 每个 Runtime 生命周期创建 segment。collector自生成`rts_<uuid>`和`bcx_<uuid>`，同时绑定真实 PID/start time、BrowserContext创建时间、sequence 范围、adapterMode 和按sequence排序的故障集合。Runtime 重启必须新 segment，旧 segment authority 不得用于新截图或路由。
5. 在每次真实导航前记录 navigation_start；每次 Playwright 真实 click/keydown 由页面捕获监听器读取 `event.isTrusted=true` 并生成 actionId。Background 观测由测试专用只读事件出口取得实际request/response，不包裹或替换生产sendMessage；必须继承 actionId/contextId，并由 requestEventId 配对。
6. 监听实际 Runtime 网络请求。request 记录 method、脱敏 URL、实际`X-Request-ID`和请求体原始字节；含授权路径的body只进private artifact。response使用`response.body()`得到浏览器网络层解压后的entity bytes，记录content-type/hash并引用request event。timeout/refused只记录transport_failure，不制造response body/hash。
7. route/container observation只能引用当前navigation之后且最近mutation之后的Runtime authority event；无法建立唯一因果时标记失败diagnostic，不按时间最近值猜测。
8. 每类受控fault都记录同segment内成对fault_start/fault_end；Runtime offline使用真实进程停止或连接拒绝，其他三类保留为明确的controlled injection，不写成自然后端失败。
9. 截图事件绑定实际PNG、metadata、当前surface、navigation/action和observationEventIds。原生Side Panel 360/420采用T01已验证的真实Chrome窗口物理坐标捕获并提供panel region metadata；Workspace 768/1280采用真实页面捕获。每次截图前断言token input为空。
10. 真实数据路径复用T01三个授权文档和真实网页fixture，但创建全新run。公开artifact落地后按token原文、Bearer形态、当前用户home和本run授权root原文扫描；private目录不纳入公开包且单独列索引。
11. 增加raw schema shape、collector invariant与seal测试。负例至少直接覆盖wrapped sendMessage无dom_action、重序列化response、错requestId/requestEventId、跨segment/navigation authority、fault不成对、错hash、封存后写入和Side Panel截图缺观察。T02结束只交付sealed raw run、artifact index、collection diagnostic、测试日志、PRD/架构检视和独立审计。

## 3. 停止条件

出现 token/私人绝对路径进入公开 artifact、非 trusted 动作被标为用户动作、response body 被重新序列化、跨 segment authority、缺事件仍输出成功、需要改变 Runtime/Adapter 公共合同或 snapshot/build 不同源时，立即停止并回到 T02 计划审计。

T02 PASS 只允许开始 T03/R3 共享语义校验的实施前计划；不得声明 PX-5 自动化候选通过。
