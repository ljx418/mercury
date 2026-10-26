# WP-B API、合同与状态机

## API 与认证边界

四个 endpoint 都加入 `app.py` privileged media path 判定，要求现有 companion bearer 与精确 `chrome-extension://<Navia extension id>` Origin，响应 `Cache-Control: no-store`。content script、任意网页 Origin、其他 extension id、缺失/错误 bearer 都必须在 writer 创建前拒绝。

| 方法 | 路径 | 行为 |
|---|---|---|
| POST | `/v1/media/local-imports` | 精确 JSON create；201 返回 import 与仅一次可见 uploadToken |
| PUT | `/v1/media/local-imports/{importId}/content` | raw body；bearer + `X-Navia-Import-Token`；流写、验证、准备和 bind |
| GET | `/v1/media/local-imports/{importId}` | 200 返回 store 中无秘密状态；重启后仍可查询 |
| DELETE | `/v1/media/local-imports/{importId}` | 请求取消并等待 bounded composite cleanup；terminal 幂等 |

OPTIONS 对 local-import path 精确允许 `POST,GET,PUT,DELETE,OPTIONS`，允许 headers 为 `Content-Type,X-Request-Id,Authorization,X-Navia-Import-Token`；不得列入浏览器控制的 `Content-Length`。拒绝顺序固定：middleware exact Origin -> endpoint bearer -> JSON/header/token contract -> writer。Origin 失败映射 403 `V3_MEDIA_IMPORT_ORIGIN_MISMATCH`；bearer 失败映射 401 `V3_MEDIA_IMPORT_AUTH_REQUIRED`。

Schemas：公共 `v3_media_local_import_status_v1.schema.json`、`v3_media_local_import_api_v1.schema.json`；内部 durable `v3_media_local_import_internal_v1.schema.json`。

## create 与 content

create 精确字段：`taskId/sourceIdentity/declaredMediaType/byteLength`。禁止 `fileName/path/url/hash/extension/lastModified/relativePath`。task 必须已有三条自动 route failure、无 selected input、capture/import active 或 terminal。

- `Content-Type` 必须与声明一致；`Content-Length` 必须存在并精确等于 byteLength；拒绝 chunked transfer 和 content encoding。
- upload token 是 256-bit base64url 43 字符，只在 manager 内存保存摘要；首次合法 content 请求原子消费并绑定连接。
- endpoint 使用 ASGI `request.stream()`。ASGI/服务器可以交付任意合理大小的 transport chunk；不得因单个 chunk 大于 1 MiB 而拒绝合法请求。writer 用 memoryview 在进程内切成 `<=1,048,576` 字节 slice，逐 slice 在写前检查取消、累计 2 GiB 上限与 quota，并增量更新 SHA-256。任何时刻不得复制或保留完整 transport chunk 之外的第二份大 buffer。
- EOF 必须与声明和 Content-Length 精确一致；file fsync、manifest replace 与父目录 fsync 后才进入 verifying。
- 不把 body、token、hash 中间态、stderr 或异常文本写入 access log/Trace/证据。

## 状态机与持久化

`awaiting_upload -> uploading -> verifying -> preparing -> ready`

`awaiting_upload|uploading|verifying|preparing -> cancelling -> cancelled`；任一非终态可进入 `failed`。每次变化 sequence +1；terminal 不可反转。`uploadedBytes` 单调且不超过 byteLength；ready 时长度相等、failureCode=null、media 非空；failed 时 failureCode 非空、media=null。

每次变更先提交 `LocalMediaImportStore` 再响应/发 UI 状态。GET 从 store 读取。新进程将未完成记录转换为 `failed/RUNTIME_RESTARTED` 并执行 manifest-aware cleanup；不能返回 NOT_FOUND 或恢复旧 token/worker。

## 限制与探测

- byte exact boundary：2 GiB 允许，2 GiB+1 拒绝。
- duration exact boundary：4h 允许，4h+1ms 拒绝。
- 尺寸最大 7680x4320；至少一个 video stream；container 为 mp4/webm/matroska。
- 音频固定 `pcm_s16le/16000Hz/mono`；ffmpeg/ffprobe 来自同 task 的 WP-A verified snapshot。
- 磁盘预检至少 `declared bytes + min(512 MiB, duration-derived PCM bytes + 128 MiB)`，仍受 task quota。
- awaiting token 10 分钟；首字节后 upload wall clock 30 分钟；ffprobe 30 秒；preparing `min(1800s, durationSeconds/2 + 60s)`。

## 失败码与 HTTP

400：`REQUEST_INVALID|SIZE_MISMATCH|TYPE_UNSUPPORTED|MEDIA_INVALID`；401：`AUTH_REQUIRED|TOKEN_INVALID`；403：`ORIGIN_MISMATCH`；404：`NOT_FOUND`；409：`TASK_NOT_ELIGIBLE|ACTIVE|CANCELLED`；413：`SIZE_LIMIT`；422：`DURATION_LIMIT|PREPARE_FAILED`；507：`DISK_SPACE_LOW`；500：`WRITE_FAILED|RUNTIME_RESTARTED|CLEANUP_INCOMPLETE`。全部使用 `V3_MEDIA_IMPORT_` 前缀。

18 码闭集：`V3_MEDIA_IMPORT_REQUEST_INVALID`、`V3_MEDIA_IMPORT_AUTH_REQUIRED`、`V3_MEDIA_IMPORT_ORIGIN_MISMATCH`、`V3_MEDIA_IMPORT_NOT_FOUND`、`V3_MEDIA_IMPORT_TASK_NOT_ELIGIBLE`、`V3_MEDIA_IMPORT_ACTIVE`、`V3_MEDIA_IMPORT_TOKEN_INVALID`、`V3_MEDIA_IMPORT_SIZE_MISMATCH`、`V3_MEDIA_IMPORT_SIZE_LIMIT`、`V3_MEDIA_IMPORT_TYPE_UNSUPPORTED`、`V3_MEDIA_IMPORT_MEDIA_INVALID`、`V3_MEDIA_IMPORT_DURATION_LIMIT`、`V3_MEDIA_IMPORT_DISK_SPACE_LOW`、`V3_MEDIA_IMPORT_WRITE_FAILED`、`V3_MEDIA_IMPORT_PREPARE_FAILED`、`V3_MEDIA_IMPORT_RUNTIME_RESTARTED`、`V3_MEDIA_IMPORT_CANCELLED`、`V3_MEDIA_IMPORT_CLEANUP_INCOMPLETE`。

错误 envelope 为 `{ok:false,data:null,error:{code,message,recoverable,details},request_id}`。details 只允许 importId、maximumBytes、maximumDurationMs；不得含路径、文件名、token、stderr、命令、Cookie 或原始异常。

## 客户端语义

- create/status 使用严格 JSON client；content 使用 extension document 内 XMLHttpRequest，`upload.progress` 是上传进度真值。
- Runtime generation、页面 source identity、panel unmount 任一变化立即 abort XHR 并 DELETE；不得由 Background/content script 代理 raw bytes。
- 用户取消只在 DELETE/terminal status 确认后显示 cancelled。
- DELETE 对 terminal 只读幂等；非终态才触发取消。成功导入后的产品生命周期由 consumer barrier 管理。
