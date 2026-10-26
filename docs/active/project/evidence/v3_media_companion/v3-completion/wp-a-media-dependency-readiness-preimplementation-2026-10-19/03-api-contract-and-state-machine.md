# WP-A API、合同与状态机

## API

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | `/v1/media/dependencies` | 200；`success(status)`，含 active/latest job id 供重新进入 Settings 恢复轮询 |
| POST | `/v1/media/dependency-installations` | 只接受精确 body `{"dependencyIds":["yt-dlp"]}`；202 `success({job})` |
| GET | `/v1/media/dependency-installations/{jobId}` | 200 `success({job})`；首版 500ms polling，不新增 SSE |
| DELETE | `/v1/media/dependency-installations/{jobId}` | 200 `success({job})`；提交阶段取消请求按提交胜出返回最新 job |

Schema：

- `docs/active/project/contracts/v3_media_dependency_status_v1.schema.json`
- `docs/active/project/contracts/v3_media_dependency_installation_v1.schema.json`
- `docs/active/project/contracts/v3_media_dependency_api_v1.schema.json`

成功 envelope 精确为 `{ok:true,data,error:null,request_id}`；status 直接位于 data，job 位于 `data.job`。错误 envelope 精确为 `{ok:false,data:null,error:{code,message,recoverable,details},request_id}`，不得有其他字段。400=`REQUEST_INVALID|SOURCE_NOT_ALLOWED`，404=`JOB_NOT_FOUND`，409=`JOB_ACTIVE|NOT_READY`，422=`SIZE_MISMATCH|HASH_MISMATCH|SELF_TEST_FAILED`，507=`DISK_SPACE_LOW`，500=`PERMISSION_DENIED|SYSTEM_TOOL_MISSING|RUNTIME_RESTARTED`，502=`NETWORK_FAILED`，504=`TIMEOUT`。服务端内部细节不得放入 message/details。

## 状态机

`checking -> downloading -> verifying -> self_testing -> installing -> ready`

`checking|downloading|verifying|self_testing` 可取消并进入 `cancelling -> cancelled`。`installing` 是短暂的原子提交阶段，`cancelable=false`；取消与提交竞争时，先持有 manager commit lock 者胜出：取消先获锁则不发布，提交先获锁则发布并返回 ready。任一非提交阶段可进入 `failed|corrupt`；终态不可被旧 worker 回写。新的 repair 创建新 job id，初始 sequence=0，每次持久状态变化严格 +1。

作业与 latestJobId 持久保存。Runtime 重启把活动 job 原子转为 `failed/RUNTIME_RESTARTED`，清理其 staging，并从最终版本目录重新校验 status；不得继续旧下载。Settings 每次进入先 GET status：activeJobId 非空即恢复该 job polling；否则 latestJobId 非空可读取最近终态并显示恢复建议。旧 ready 可用而最近 repair 失败时，overall 仍为 ready、route 仍 ready，同时 latest job 显示非阻塞失败；只有没有可用 snapshot 时 overall=failed/action_required。

## 固定失败码

`REQUEST_INVALID`、`JOB_NOT_FOUND`、`JOB_ACTIVE`、`SOURCE_NOT_ALLOWED`、`NETWORK_FAILED`、`TIMEOUT`、`SIZE_MISMATCH`、`HASH_MISMATCH`、`DISK_SPACE_LOW`、`PERMISSION_DENIED`、`SELF_TEST_FAILED`、`RUNTIME_RESTARTED`、`SYSTEM_TOOL_MISSING`、`NOT_READY`，均带 `V3_MEDIA_DEPENDENCY_` 前缀。

失败码只能出现在 dependency API 和 Settings 诊断中，不改变既有媒体任务合同。响应不得包含绝对私有路径、下载 URL、原始异常、命令行、Cookie、token 或 API key。

## 强制关系

- 四项 dependency id 必须唯一且完整；类型、安装方式和 storage scope 固定。Schema 表达 shape/枚举/ready 条件；Runtime semantic validator 再校验唯一集合、状态与 failureCode、progress 上界和 sequence 单调，文档 verifier 必须含对应负例。
- `overallState=ready` 时必须有 generation、verifiedAt、route ready，四项均 ready。
- generation 或任何 observed digest 变化只影响新任务。
- SenseVoice expected/observed 单文件摘要可为 null，因为权威校验属于现有多资产 ASR manager；其 effective model id 必须进入 generation 输入。

## 冻结网络与资源策略

- 唯一初始 URL：`https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp`；只允许 HTTPS，重定向最多 2 次，逐跳 host 仅 `github.com` 或 `release-assets.githubusercontent.com`，禁止凭据、非默认端口和降级 HTTP。
- expected bytes=`3,072,469`，响应和流式写入硬上限均为该值；Content-Length 存在时必须精确相等。connect timeout=15s、单次 read timeout=30s、总下载 deadline=180s；最多 2 次重试且只重试网络/5xx，每次创建新暂存文件。
- 安装前可用空间至少 `2 * expectedBytes + 64 MiB`。自检 deadline=30s；精确命令为 `yt-dlp --ignore-config --no-plugin-dirs --no-update --no-playlist --simulate --version`，exit=0 且 stdout 去空白后等于 `2026.08.19`。
- 任何 symlink、非普通文件、root escape、size/hash mismatch、timeout 或自检失败均 fail closed，关闭句柄和子进程组、删除本 job staging、保留旧 ready 及 active manifest。

