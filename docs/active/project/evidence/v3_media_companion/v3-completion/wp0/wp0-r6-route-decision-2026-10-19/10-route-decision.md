# WP0 R6 路线裁决：自动下载、标签页捕获与用户文件导入

## 结论

R6 保持为标签页捕获安全性验收，不安装 `yt-dlp` 来替代 R6-G2，也不在 R6 内新增文件导入公开入口。安装下载器会让仲裁器优先走 `credentialed_media_asr`，从而绕开待验收的 capture 路径；它只能证明下载路线可用，不能证明 R6 的 65 个故障场景。

目标产品路线调整为：

1. 自动字幕；
2. Runtime 管理并校验依赖的凭据下载 + 本地 ASR；
3. 自动路线失败后，由用户明确选择“选择已下载视频”或“捕获当前标签页”；
4. 两条 fallback 都必须显示原因、预计耗时、数据边界和取消入口，不再静默切换。

## 体验对比

| 路线 | 用户成本 | 稳定性 | 隐私与资源 | 适用位置 |
|---|---:|---:|---|---|
| 自动字幕 | 最低 | 高，但依赖站点字幕 | 不产生原始媒体副本 | 第一优先 |
| 受控下载 + 本地 ASR | 低 | 安装完成后较高，仍受站点风控影响 | Runtime 临时持有媒体，任务后清理 | 第二优先 |
| 用户下载 + 显式选文件 | 中高 | 高，不依赖标签页实时状态 | 用户保留原文件；Runtime 可能产生受控临时副本 | 显式 fallback |
| 标签页捕获 | 中 | 受 Chrome 权限、用户手势、播放时长和页面生命周期影响 | 不下载完整视频，但需实时捕获音频 | 无文件或用户不愿导入时 |

“用户下载/自行下载后接续解析”优于当前静默 capture 的部分是：失败原因更透明、可恢复、可重复，且不受标签页关闭和实时播放时长约束。它的退化是：多出下载和选文件动作，可能复制大文件，并要求新增大小、类型、路径、清理和磁盘空间治理。因此它应是可选 fallback，而不是替代自动路线。

## 架构冲击

### 受控下载依赖就绪

冲击较小。保留现有 `BilibiliMediaAcquirer -> YtDlpMediaDownloader -> ASR` 边界，新增依赖状态、受控安装、摘要校验和 UI 披露。`yt-dlp` 不入 Git，不允许任意 URL，不静默下载；安装后仍按冻结摘要验证。

### 显式文件导入

冲击中到高，必须独立 workpack 和 refreeze：

- Side Panel 新增用户手势触发的文件选择器；不允许默认扫描本地文件，因而不违反“default local file access”禁令。
- Runtime 新增受认证的本地导入会话和流式上传/本机伴侣选择协议，不能把浏览器伪路径当真实路径。
- 必须限制 MIME、扩展名、单文件大小、磁盘余量和并发；写入私有任务沙箱并执行 owner manifest、fsync、原子 handoff 与失败清理。
- 原始媒体不得进入知识库、日志、公开证据或 Provider；ASR durable handoff 后按策略删除临时副本。
- SourceAuthority 需要区分站点来源与用户导入来源，避免同一 BVID 的自动结果被无条件覆盖。
- 需要新增失败码、接口 schema、隐私文案、进度/取消/重试状态和真实大文件验收，因此不能塞入当前 relay v11/R6 合同。

## 后续开发计划

1. 完成 R6 capture 安全矩阵，不以下载成功代替。
2. R7 closeout 后建立“媒体依赖就绪”workpack：状态检测、一次安装、摘要验证、失败分类和设置页管理。
3. 建立“显式本地媒体导入”原型与 PRD：先验证 100 MB、1 GB、取消、磁盘不足、格式不支持和 Runtime 重启清理，再冻结 API。
4. 调整用户仲裁 UI：自动路线失败时展示两个可理解的选择，不自动开始捕获，也不把依赖缺失伪装成视频不支持。

## R6 具体裁决

- `R6B-N01`：Chrome 的 required permission 不能被撤销。保留用例分母，但将故障注入明确为 owned visible Chrome 中对 `chrome.permissions.contains` 浏览器边界的受控 false 返回；生产 Controller、真实 grant/ticket、原生扩展调用和 cleanup oracle 均不得替换。
- acquisition 400：不是隐藏先决条件。G2 runner 把所有请求的 `partId` 固定为 `1`，却让场景 2..7 的 `sourceIdentity` 末段为 `2..7`，违反冻结 identity tuple；按每个 source identity 修正。
- `R6B-N05/N06/N07` 必须分别为 tab close、navigation、user cancel，不允许用 cancel/native 占位互换。
- 固定字符串 `observedCode`、空 `deliverProducerStop()`、未发送 arm 的 `armAndTrigger()` 和直接布尔断言均为无效证据，必须删除。
- `RLY11-N07/N18/N22` 必须命中各自冻结边界；不得以较早闸门或常量存在性替代行为证明。
