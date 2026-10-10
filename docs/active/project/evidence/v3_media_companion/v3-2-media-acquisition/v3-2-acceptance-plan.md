# V3-2 受控媒体获取与本地 ASR 验收计划

日期：2026-10-06。状态：`SENSEVOICE DEVELOPMENT BASELINE ACCEPTED / V3-2-1 LIMITED PASS / V3-2-2 REVISION 4 ROUTE B AUTHORIZED`。固定分母 `V3-2-A01..A20`，不得 N/A、缩分母或跨 run。2026-09-22 用户决策将跨模型退化比较与失败后质量回退移入 V4；历史 blind-review 失败保留，不再作为 V3 acquisition core 的阻塞门槛。

## 1. 生产样本

V3-2-0 原计划从 revision 1 生成 revision 2；真实探测证明原三个 ASR 样本均出现平台字幕，且 revision 2 又把已经移入 V4 的 24-bin/双 reviewer 固定为 `productionReady` 条件。Revision 1/2 均保持不可变；V3 使用新增 revision 3，仍保持 6 subtitle、3 ASR、1 multipart、1 restricted/blocked、1 low_signal/degraded、12 个唯一 URL 和主分类互斥。Revision 3 必须包含页面身份、目标分 P、页面/server probe hash、授权证据类、预期路线和截图 hash。

三个 ASR 路线样本必须用 SenseVoiceSmall Q8 全长转写，3/3 非空、可转写语音区间覆盖率 >=90%、时间/hash/来源闭合。Revision 4 精确包含 1 个双探测自然无字幕和 2 个只在验收编排层注入的字幕体失败；注入前真实字幕发现与注入后真实媒体均须留 hash。至少一个 ASR 场景通过真实 `tabCapture` 回退完成，且触发原因来自真实 downloader/platform 失败或受控网络故障，不得把 fixture WAV 计生产。跨模型比较与智能回退属于 V4，不得重新混入 V3 分母。

## 2. A01-A20

| ID | 场景与操作 | 必须结果 |
|---|---|---|
| A01 | 对 Schema/positive/49 fixture/registry 执行 meta、shape、mutation 和映射复算 | meta PASS；positive 0 error；13 schema + 36 semantic 实际结果一致；FailureCode 封闭；semantic base 先 PASS；`<all_urls>` 负例失败 |
| A02 | 执行 dependency spike | yt-dlp/ffmpeg/SenseVoice engine+model exact version+hash+license+能力冻结；禁自更新/插件/exec；无缺失项 |
| A03 | 授权会话重探测 12 URL | revision 3 通过专用 Schema；正好 12 唯一 URL/identity；分类 6+3+1+1+1；目标分 P、预期路线、页面/server probe、授权证据和截图 hash 完整；锚点 identity/duration 无静默漂移；cross-model gate 明确为 V4 |
| A04 | 6 个 subtitle 样本点击开始 | 6/6 获得有序非空 `MediaTranscript`；route/语言/segment 时间/hash/provenance 完整；不启动 capture |
| A05 | 3 个 ASR 样本点击开始 | 3/3 全长本地 ASR；至少 2 个 credentialed media，至少 1 个真实 capture 回退；cloudUpload=false |
| A06 | ASR 基线完整性 | SenseVoice 对 3 个固定真实样本全长输出非空；时间覆盖 >=90%；空/重复/逆序/越界 segment=0；model/revision/weights 与 `development_baseline` 精确绑定；跨模型退化比较和智能质量回退留待 V4 |
| A07 | 多 P 样本选择指定 part | 只获取 registry 指定 cid/part；其他 part request/artifact=0；sourceIdentity 全链一致 |
| A08 | restricted 与 low-signal | restricted 唯一终态 blocked；low-signal 唯一终态 degraded；0 伪 transcript/伪成功 |
| A09 | 路由回退 | attempt sequence 连续且严格按 policy；首成功即停止；每个失败有唯一机器原因；无并行竞速 |
| A10 | 可信 capture | Chrome 116+ 可见 Side Panel/Workspace click -> 30s ticket -> stream ID 立即一次性消费 -> 正确 tab/唯一 `USER_MEDIA` offscreen/socket；原视频声音保持可听；content script、普通 tab、Chrome<116、错误/旧/replay ticket 全拒绝 |
| A11 | transcript 合同 | task/source/acquisition identity 相等；segment 不重叠、边界 <= duration；text/content/input/output hash 可复算 |
| A12 | 开始、进度、回退、取消和重试 UI | 两容器读取同一 Runtime task；用户看见 route/原因/cleaning/终态；不显示 Cookie/path/ticket/account |
| A13 | 用户取消 | downloader/ffmpeg/ASR/capture 在限时内停止；取消后 observation/artifact 不再增长；cleanup 后才显示 cancelled |
| A14 | 租约到期/撤销、页面关闭/导航 | 新下载立即拒绝；进行中任务停止；capture tracks/socket 关闭；不可旧 authority 恢复 |
| A15 | Runtime/Background/Chrome 重启 | Runtime 重启清理 owner manifest orphan；Background/Chrome 重启清空 capture authority；任务不伪恢复成功 |
| A16 | 工具/资源故障 | 403、超时、重定向私网、超配额、磁盘失败、ffmpeg/ASR exit、socket 丢失均唯一终态并清理 |
| A17 | 清理与秘密扫描 | 五终态 cookiefile/temp media/raw audio/raw video/active capture=0；配置/DB/EventStore/Trace/log/retry/public tar 真实 Cookie/路径/ticket/streamId 0 hit |
| A18 | 架构、权限与回归 | 通用层 B站词命中=0；仅 bilibili 注册；required/optional/host 权限精确匹配机器合同且无全站权限；V3-1.1/1.2/1.3 与前后端全回归 PASS；旧 sealed bytes 不变 |
| A19 | 四视口与可访问性 | Side Panel 360/420、Workspace 768/1280 实际 PNG；根溢出 0；Axe serious/critical=0；两容器键盘主路径 PASS |
| A20 | 单 run 证据与独立审查 | production run/build/dependency/model/sample registry 全绑定；public/private 分离；seal/hash 可复算；Fatal=0/Major=0 |

## 3. 用户验收步骤

1. 打开 `BV1ZpYd66ELP`，确认身份、无字幕状态和 V3-1.3 会话租约就绪。
2. 点击“开始分析”，观察凭据字幕失败、凭据媒体尝试和本地 ASR 路线；不得出现 Cookie 或路径。
3. 在专用 fault 场景观察系统停在“需要捕获当前标签页”，点击一次，确认浏览器只捕获当前 tab 且显示进度。
4. 在处理中点击取消，确认先显示“正在清理”，随后才显示“已取消”；刷新/重开不出现幽灵任务或残留 capture。
5. 打开 Workspace transcript，抽查时间段、来源路线和 confidence；本阶段不应出现大纲、Mindmap、OCR/VLM 或 Ask 成功声明。
6. 打开一个 subtitle 样本和多 P 样本，确认字幕直达且只处理目标分 P。
7. 打开 restricted/low-signal，确认 blocked/degraded 文案与实际终态一致。

## 4. 性能与停止条件

- API 状态读取 P95 <300ms；取消信号到子进程/轨道停止 P95 <=3s；cleanup 完成 P95 <=10s（不含被 OS 锁定导致的明确失败）。
- 字幕 route 在平台响应后 10s 内产出首个 segment；ASR 可慢于实时，但必须提供进度和取消，3 个固定样本单个不得超过媒体时长 2.5 倍或 30 分钟中的较小值。
- capture 最长 900s；达到上限且内容未完成必须 degraded/blocked，不得成功。
- 任何 Cookie/raw audio/temp media 残留、跨 task 复用、错误 tab capture、无点击 capture、秘密进入公开证据、旧 ticket 重放、DRM/限制绕过、mock 计 production 为 Fatal。
- 分母/route/order/hash/cleanup/ASR 质量任一失败为 Major，返回开发计划修复并全新 run；禁止降低阈值。

## 5. 证据要求

每个 A 项保存 expected/actual、原始 artifact path/hash、run/build/dependency/model/sample registry binding。至少抽样五类 payload：credential subtitle、credential media、public/page subtitle、capture、cancel/cleanup。截图必须实际解码；capture 必须有真实 trusted click 和 Chrome target 证据；secret scanner 使用用户授权 Cookie 原值，仅输出计数。

## 6. 2026-09-21 实际人类结论与 2026-09-22 决策

用户将 `reviewerId=123` 的 24 项结果指定为当时最终结论。原始 review 通过 Schema 和 bundle/hash 校验；Small/Base 比较含 1 个 critical、1 个 neither-acceptable，因此旧 A06 正确地 `FAIL / REPLAN`，该历史结论不得改写。2026-09-22 用户另行选择 SenseVoice 为 V3 开发基线，并将跨模型退化与失败后质量回退移入 V4；V3 现在按修订后的 A06 验收 SenseVoice 全长转写完整性，不把旧候选失败伪装为通过。

## 7. V3-2-0a 与本计划的关系

V3-2-0a 的 `A01..A16` 是模型管理独立分母，只能证明 provider/model 选择、资源可见性、Tiny fallback、校验安装、离线恢复和低资源自检。它不替代本计划 A03-A20，也不把 Tiny/Small 安装成功计为本计划 A06。V3-2-0a 已经独立审查取得 `LOCAL LIMITED PASS`（Fatal=0/Major=0/Minor=3），本计划仍保持 `FAIL / REPLAN`，直到新的模型/profile 对同一真实样本和原质量阈值形成全新、不可拼接的通过证据。
