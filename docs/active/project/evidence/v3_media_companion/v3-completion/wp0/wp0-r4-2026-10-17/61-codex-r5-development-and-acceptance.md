# WP0 R5 Fresh Visible Muted Chrome Canary 开发与验收计划

日期：2026-10-17  
前置：`60-codex-r4-checkpoint.md` 已判定 `R4 PASS`  
当前授权：**仅 R5；R6/R7 不得启动**

模型首次使用体验同时以 `64-r5-asr-model-installation-ux.md` 为冻结输入。R5 不只验证开发机
已有模型；还要关闭“一次确认 -> 下载/导入 -> 校验 -> 安装 -> 自检 -> 自动启用”的用户路径。

## 1. 目标与固定输入

使用固定视频 `https://www.bilibili.com/video/BV1pohR6rEEh`，从 fresh Runtime、database、
Chrome profile、task 和 production extension build 出发，只通过用户可达 UI 动作证明：

```text
扩展入口 -> Background relay -> Offscreen 非空 PCM -> Runtime sink
-> SenseVoiceSmall Q8 -> acquisition succeeded -> Side Panel product effect
-> materialize -> SQLite ready|degraded -> UI 退出 busy
```

runner 不得直调 Controller、materialize endpoint、数据库、状态 store 或成功 terminal，不得伪造
grant、PCM、transcript、projection 或产品结果。`completed` frame 仍只表示 handoff。

## 2. R5-0 离线预检

在打开 Chrome 前完成：

1. 核验 R4 PASS、v10 baseline 50/50、mutations 15/15；
2. typecheck、受影响 media 测试、Runtime focused 与 production build；
3. 端口 `17861` bind preflight，确认没有占用或非 owned Runtime；
4. 通过产品 `GET /v1/asr/catalog`、`GET /v1/asr/settings`（安装中再观察既有
   `GET /v1/asr/installations/{job_id}`）证明 `funasr-sensevoice-small-q8` 为
   verified/ready、effective model；同时记录
   frozen revision、binary/model/VAD hashes 与资源状态；
5. 确认 extension manifest、unpacked build、B站站点权限、Runtime 启动方式和 canary runner
   均指向本轮 fresh 资源。

禁止用 R4 的 deterministic/in-process provider、fixture transcript、bundled Tiny、旧转写或旧
model receipt 冒充 SenseVoice。若模型缺失，只能使用产品既有的 Settings“下载并安装”或
“导入离线包”用户路径；不得新增任意 URL、静默下载或跳过 hash/self-test。安装会产生网络、
磁盘和较长等待，执行前先报告缺口和资源需求。未达到 verified/ready/effective 时，R5
`NO-GO`，不得启动 canary。

R5-0 还必须对照 64 文件检查安装 UX。允许在不改变公共 API/catalog/security boundary 的
前提下修复：一次操作自动启用、Windows 持久目录披露、按失败类型给出下一动作、三个冻结
文件的本地组包/导入，以及删除不存在的发布包指引。该用户路径定向测试通过后再做 canary。

## 3. R5-1 可见窗口前通知门禁

离线预检全绿后，先在终端明确通知用户：将启动一个本轮 owned 的可见 Chrome，可能弹出站点
权限或 `tabCapture` 原生选择并短暂抢焦点，命令显式包含 `--mute-audio`，测试结束会关闭该
实例。等待用户明确继续后才能启动。无确认不得通过 headless、UIAutomation 或其他方式绕过。

## 4. R5-2 单次真实 canary

只在条件发生有效变化且预检全绿后运行一次：

1. 启动 owned Runtime（fresh database/private root，端口 17861）和 owned Chrome profile；
2. 加载本轮 production unpacked build，打开固定 BVID；
3. 从扩展图标/Side Panel 执行用户可达的“分析当前视频”动作；
4. 若出现一次性站点或 capture 授权，按真实用户动作完成，不注入 grant；
5. 观察真实 relay：Runtime started 前 0 chunk，随后收到非空 PCM，ACK/sequence/length 正确；
6. 观察真实 SenseVoice 进程和固定 model identity，得到非空、带时间戳 transcript；
7. acquisition 必须到 `succeeded` 后，产品 Side Panel 才能发出同 authority 的 materialize
   effect；视觉能力失败只允许按冻结合同得到基础 `degraded`，不得补造截图或换 Provider；
8. 最终 SQLite 只能是 `ready|degraded`，Side Panel/Workspace 使用同 task/source/product
   revision/fence，busy/呼吸灯/计时状态及时停止；
9. 保存必要的脱敏网络、状态、进程、UI 截图与结构化 run 证据。

R5 默认不调用云 Provider，不上传原始视频、音频、帧、Cookie、API key、ticket 或私有路径。
若现有产品 materialize 在无云 Provider 时走已冻结 degraded 路径，该结果可接受，但必须明确
披露视觉证据缺失，不能声称 ready。任何新增云调用或私有数据上传需要另行授权。

## 5. 强制行为 oracle

1. fresh Runtime/database/profile/task/build 均有本轮 owner 和唯一 ID/hash；
2. runner 的成功路径对 Controller/materialize/database 的直接调用数为 `0`；
3. capture 的 PCM bytes/chunks/duration 均大于 `0`，无声音播放；
4. ASR model 精确为 `funasr-sensevoice-small-q8` 的 frozen verified revision/hash；
5. transcript 非空、有合法时间戳，且不能来自历史 artifact/fixture；
6. acquisition `succeeded` 先于 product materialize；`created`/handoff completed 不算成功；
7. taskId/sourceIdentity 跨 relay、acquisition、transcript、product、UI 一致；
8. consent/transcript/product revision 域分别单调，outline/workspace product fence 一致；
9. SQLite `ready|degraded` 与 UI terminal 一致，UI 退出 busy，不再显示无限“正在分析”；
10. capture/ASR/acquisition/product/sink/marker/profile/port/process cleanup 可复算为零残留；
11. secret/raw-media/private-path 公开证据命中为 `0`。
12. 首次安装只需一次确认；ready 后自动成为 effective model，重启仍保持；自动下载失败时
    三文件手动路径可执行且继续复用相同 size/hash/self-test。

## 6. 验证预算与失败处置

- 实现内循环只跑受影响测试；不重复 R4 的 62-process 故障矩阵。
- 可见 canary 最多一次。仅当代码、配置、模型或环境条件明确改变后才允许重跑，并记录变化。
- R5 收口集中运行一次 typecheck、media 子树、全量 unit、build、Runtime focused、relay static、
  v10 50/50 与 15/15、secret/cleanup scan。
- 浏览器、Runtime、profile、port、scratch 只能清理本轮可证明 ownership 的资源。
- 任一真实路径失败、模型非 SenseVoice、声音播放、runner 越权、secret/raw-media 泄露、cleanup
  不完整、公共合同变化或需要未授权云调用，立即 `R5 NO-GO`，保留失败证据，不重复碰运气。

## 7. 交付与停止条件

落盘到 `wp0-r5-<date>/`：`10-receipt.md`、`20-test-results.md`、`30-prd-review.md`、
`40-handoff.md`、`50-payload-manifest.sha256`，至少记录 build/run/task/capture/model identity、
操作路径、UI terminal、命令/退出码、截图索引、cleanup/secret 和 Fatal/Major/Minor。

完成状态必须写 `R5 AWAITING CODEX CHECKPOINT` 并停止。不得自行宣布 R5 PASS，不得进入 R6，
不得做独立文档外审或阶段 closeout。

