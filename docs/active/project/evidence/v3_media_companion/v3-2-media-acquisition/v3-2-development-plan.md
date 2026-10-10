# V3-2 受控媒体获取与本地 ASR 开发计划

日期：2026-10-06。状态：`V3-2-0c-1 LIMITED PASS / V3-2-1 LIMITED PASS / V3-2-2 REVISION 4 ROUTE B AUTHORIZED`。SenseVoice 已成为 V3 development baseline；跨模型退化与质量失败回退进入 V4。

## 1. 目标体验

用户在当前 B站视频页完成五项授权并建立 V3-1.3 安全租约后点击“开始分析”：Navia 优先取得字幕；无字幕时在任务私有目录获取当前分 P 音频并本地转写；平台路径失败时明确显示原因，并只在用户再次可信点击后 capture 当前 tab 音频。进度、路线、取消和清理均可见。V3-2 最终只交付强类型 `MediaTranscript`，不展示伪大纲或画面理解。

## 2. 范围与禁止项

本阶段实现：`MediaAcquisitionCoordinator`、`BilibiliMediaAcquirer`、`SubtitleResolver`、`TaskArtifactSandbox`、受限 yt-dlp/ffmpeg adapter、`LocalAsrAdapter`、`MediaCaptureController/Offscreen`、双容器状态 UI、取消和清理、真实证据采集。

禁止：关键帧/OCR/VLM、总结/大纲/Mindmap/Ask、持久任务恢复/导出、V4 知识、YouTube/小红书实现、直播、通用文件、云端 ASR、DRM/付费限制绕过、BiliNote 整模块复制。

## 3. 前置事实

- V3-1.3 独立实施出门 PASS，Fatal=0/Major=0/Minor=3。
- V3-2-0 已冻结 yt-dlp `2026.08.19` 与 `ffmpeg/ffprobe 6.1.1`；历史 Faster-Whisper/Paraformer 资产和失败证据只读。当前 ASR 基线为 `funasr-llamacpp runtime-llamacpp-v0.2.6 / SenseVoiceSmall Q8` exact revision/hash，离线 model load 与网络 deny 已通过。下载器参数为 `--ignore-config --no-plugin-dirs --no-update --no-playlist`。
- BiliNote clean commit `be388939...` 六个 allowlist 文件只能 `reference_only`；本阶段没有复制授权。
- V3-1P revision 1 保存历史探测；V3-2 使用新 revision 2，不覆写旧 run。

## 4. 子阶段

### V3-2-0 合同、依赖和真实样本重探测

目标文件：V3-2 Schema/registry/fixtures、dependency manifest、revision 2 sample registry、实施前审计。

动作：

1. 对 12 个固定 URL 用授权 Chrome 116+ 会话重新探测字幕/媒体/限制状态；锚点仍为 `BV1ZpYd66ELP`。历史 revision 2 继续由 `contracts/v3_media_acquisition_sample_registry.schema.json` 约束且只读；当前输出必须通过 `contracts/v3_media_acquisition_sample_registry_v3.schema.json`，冻结目标分 P、预期 transcript 路线、页面/server probe hash 和授权证据类，不再要求已移入 V4 的跨模型人工比较。
2. 安装隔离 yt-dlp stable 候选，冻结 tag、来源、license、可执行 hash；验证禁用自更新/配置/插件/exec。
3. 冻结 ffmpeg/ffprobe hash、支持 codec 和 network protocol deny；冻结 SenseVoice engine/model revision/weights hash。
4. 49 case（13 Schema + 36 semantic）声明结果、Schema meta/positive、FailureCode 集合全部通过；必须由 `v3-media-acquisition-contract-audit.py` 实际执行 mutation，不能只核对集合。
5. 对照实际 WXT manifest 冻结 required/optional/host 权限闭集；V3-2 只把 `offscreen`、`tabCapture` 加入 required permission，Cookie 与 B站 host 继续按需授权，拒绝任意全站权限。

历史 Small/Base 与 Paraformer 失败证据继续保留。2026-09-22 用户接受 SenseVoice 作为 V3 development baseline；V3-2-0c-1 已完成正式安装、真实音频和真实 Chrome 验收。V3-2-1 仍须独立详细计划与实施前审计；依赖无法从可信来源固定、模型不能离线运行或任何 secret 出现在 manifest 时继续停止。

### V3-2-1 Runtime acquisition core

目标位置：`services/local-runtime/navia_runtime/modules/media_companion/acquisition/`。

实现 `MediaAcquisitionCoordinator`、`TaskArtifactSandbox`、状态/取消 token、semantic validator 和 API。先用 contract fixture 与既有私有真实 B 站音频的受控副本测试，不计 production pass。

验收：路由严格顺序；跨 task/过期 lease/任意 URL/path traversal/symlink/配额失败；五终态 cleanup barrier；Runtime 重启 orphan cleanup 只限 owner manifest root。

2026-09-22 实施结果：通用 task/sandbox/API 已完成，RC01..RC16 全通过；真实私有 B站 WAV 完整写入后取消清理为 0，owner orphan recovery 仅删除受控目录，Runtime 全量 346 passed。当前 `V3-2-1 LIMITED PASS`；V3-2-2 在 sample registry revision 3 文档冻结前保持 NO-GO。

### V3-2-2 B站字幕与媒体 acquirer

实现 B站 plugin 和受限 downloader。凭据只从进程内 lease 解封到随机 cookiefile；字幕优先；音频/视频只取当前 part；平台受限/无字幕/下载拒绝映射封闭失败码。

2026-10-06 路线 B 修订：保留 12 页与 6+3+1+1+1，总计三个 ASR 路线使用 1 个自然无字幕和 2 个可审计字幕体失败。故障注入只允许 E2E acceptance orchestrator，生产路径不可达。详细 `B-0..B-6`、矩阵和 RB01..RB20 位于 `v3-2-2-bilibili-acquirer/route-b-*.md`。

验收：6 个字幕样本获得完整有序 segments；2 个 ASR 样本用 credentialed media audio；多 P 只取目标 part；restricted 明确 blocked；日志/命令/公开证据 0 secret/path。

### V3-2-3 Local ASR

把已经限定通过的 `funasr-llamacpp/SenseVoiceSmall Q8` 通用 adapter 接入 acquisition task，支持 cancel、进度和离线模型。全长转写 3 个 ASR 样本；不得在任务路径回退到未通过质量门禁的 Faster-Whisper/Paraformer，也不得把 Tiny 技术自检冒充 V3 质量结果。

验收：3/3 全长任务产生非空 transcript；可转写语音区间时间覆盖率 >=90%；segment hash/顺序/边界有效；model/revision/weights hash 精确匹配 SenseVoice 开发基线；原始音频终态删除。识别失败必须显式 `failed/degraded`，不得静默改用其他模型。跨模型质量比较与智能回退留给 V4。

### V3-2-4 可信 tabCapture 回退

目标位置：Background、`media-capture-offscreen`、共享 capture client/router。

实现 Chrome 116+ 的 30 秒 one-shot ticket、精确 sender/tab/page binding、`USER_MEDIA` Offscreen、stream ID 立即一次性消费、AudioContext 原声回放、MediaRecorder 和专用 loopback WebSocket。以真实平台获取拒绝的故障场景触发至少 1 次完整 capture+ASR；不把人为 fixture 音频计生产。

验收：系统权限/用户点击真实；普通 tab/content script/旧 ticket/错误 tab/reload/replay/Chrome<116 拒绝；stream ID 过期要求新点击；capture 期间原视频声音保持可听；同 profile 同时只存在一个 Offscreen；断线不自动重试旧 ticket；关闭/导航/撤销/取消均停轨并清理。

### V3-2-5 Side Panel 与 Workspace 状态体验

复用同一 Runtime task，不建立前端第二事实源。显示当前 route、失败原因、等待可信点击、ASR 进度、正在清理和终态。Side Panel 负责快速控制，Workspace 负责完整 transcript 检查。

验收：360/420/768/1280；无根溢出；Axe serious/critical=0；键盘可完成开始、capture 回退、取消、重试；ready 文案只声称 transcript 可用，不声称大纲/画面理解。

### V3-2-6 故障、清理与回归

注入下载器 403/超时/超限、ffmpeg 失败、ASR 失败、Runtime 离线、tab 关闭/导航、capture socket 丢失、租约到期、授权撤销、取消竞态、磁盘只读/满、orphan subprocess。

每个场景独立 task/run，验证唯一终态、无后续写入、0 残留、无跨 run 拼接。回归 V3-1.1、V3-1.2、V3-1.3 和现有前后端全套。

### V3-2-7 全新真实 Chrome 出门候选

单一全新 run 绑定 build、dependency/model manifest 和 revision 2 sample registry。固定 12 页 + 四视口 + 真实 capture + 3 ASR + 故障矩阵，生成 public/private 分离证据、seal、secret/path scan、cleanup manifest、PRD review、false-green audit 和不超过 20 文件外审包。

仅当本地 A01-A20 全通过、Fatal=0/Major=0，才提交不同 session 独立实施出门审查。V3-2 PASS 不自动放行 V3-3。

## 5. 文件所有权

- Runtime acquisition/asr 只在 `services/local-runtime/navia_runtime/modules/media_companion/`。
- Extension capture/renderer 只在 `apps/chrome-extension/.../media_companion/` 与 Background/offscreen entrypoint。
- 通用 `runtimeClient` 不承载 Cookie 或 capture ticket body；专用 client 只能调用冻结路径。
- V3-1.2 registry、V3-1.3 sealed run、旧 V2/PX/RKM 证据只读。

## 6. 实施授权边界

用户已于 2026-09-18 在独立文档审查 Fatal=0/Major=0 后明确确认继续开发，授权记录为 `v3-2-implementation-authorization.json`。该授权只允许按 V3-2-0..7 的既定顺序实施；每个子阶段仍须先有独立开发计划、验收计划和 Fatal=0/Major=0 实施前审计。V3-2-4 若要求扩大已冻结权限、后台自动 capture 或新的秘密边界，必须再次停止确认。

## 7. V3-1.3 Minor 继承闭环

- 上游 M-1：V3-2-0 与 V3-2-7 必须逐字段复算 V3-1.3 A01..A20，不能只读取 summary。
- 上游 M-2：实施证据至少抽样 credential subtitle、credential media、public/page subtitle、capture、cancel/cleanup 五类 observation payload，并记录 path/hash。
- 上游 M-3：Cookie 真值只由已授权的一次性 Chrome harness 使用；真实性以真实 B站 server probe 成功证明。产品代码、公开包和独立审查均不得读取、复制或散列 Cookie 原值。

## 8. V3-2-0a 模型管理重规划闭环

V3-2-0 的 A06 失败不允许 V3-2-1 开始，但允许在不触碰媒体获取的前提下先补齐模型管理。V3-2-0a 已实现 closed provider/model catalog、bundled Tiny、requested/effective/fallback、真实安装进度、取消、逐文件 hash、本地 load self-test、原子发布、卸载、重启恢复、`.navia-asrpack`、Settings 资源说明和低资源自检，并已取得独立 `LOCAL LIMITED PASS`（Fatal=0/Major=0/Minor=3）。该结论只关闭模型分发与选择能力；下一步仍必须选择并冻结新的 production model/profile，再对原三个真实 ASR 样本重新生成全新比较材料并满足原 A06，不能直接进入 acquisition core。
