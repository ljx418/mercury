# WP-A PRD / 架构不变量检视（2026-10-19）

候选：`wp-a-media-dependency-readiness-implementation-2026-10-19`
状态：**WP-A NO-GO**

## 1. `04-development-plan.md` A0–A7 逐条

| 阶段 | 要求 | 本轮结果 | 判定 |
|---|---|---|---|
| **A0** | 合同门禁先行：schema、fixture、文档 verifier 全绿 | **42/42** | ✅ |
| **A1** | Runtime manager：catalog、状态聚合、四项验证、内容寻址版本目录、generation/lease、单 job、取消/提交竞争、重启清理 | 全部实现，21/21 | ✅ |
| **A2** | 四个认证 loopback 路由 + 严格 TS 类型；拒绝多余字段、URL/path/hash、非法 job id | 22/22 + 6/6 | ✅ |
| **A3** | Settings 五种状态、真实进度、取消、失败分类、离线恢复 | 6/6 | ✅ |
| **A4** | `execute_media_acquisition` 在 route 前绑定一次 snapshot；三处共用同一对象与 task lease；不保留第二条全局 owner | 5/5 | ✅ |
| **A5** | 故障矩阵：来源、长度、摘要、空间、权限、自检、取消、并发、重启、旧 ready 保留、system tool/ASR 缺失 | 12/12 | ✅ |
| **A6** | 真实工具验证：owned 临时 managed root 走一次冻结下载/校验/自检 | **A23 通过** | ✅ |
| **A7** | 单路径证明：以现有受支持会话做一次受控下载到本地 ASR 的真实无声运行 | **A24 阻塞** | ❌ |

## 2. `01-target-experience-and-scope.md` 逐条

| 项 | 判定 |
|---|---|
| 未安装时点击一次「修复本机依赖」 | ✅ 面板 `media-dependency-repair` |
| 进度连续显示检查/下载/校验/自检/启用 | ✅ 六个冻结阶段，百分比取自 Runtime |
| 失败按网络/空间/摘要/权限/自检/系统工具缺失分类 | ✅ 七类，各有独立下一步 |
| 不只显示 `Runtime offline` | ✅ 显示「启动 Navia 本机伴侣」 |
| ready 后日常无需额外授权 | ✅ 依赖就绪不触发任何 capture |
| 固定范围：只允许 `yt-dlp 2026.08.19` 冻结 URL/字节/摘要 | ✅ 唯一托管下载 |
| ffmpeg/ffprobe 只验证路径/版本/摘要 | ✅ 未实现安装 |
| SenseVoice 继续由 `AsrModelManager` 管理 | ✅ 只读聚合 |
| 可恢复工具放 Windows 持久目录，不只放 WSL 临时目录 | ✅ managed root 可由 `NAVIA_MEDIA_TOOL_ROOT` 指向持久卷 |
| 状态接口不返回绝对路径 | ✅ API 测试断言响应不含 `/mnt/`、`C:\`、`https://` |

## 3. 明确非目标（均未触碰）

| 非目标 | 状态 |
|---|---|
| 自动执行 apt | ✅ 未实现 |
| 接收客户端 URL/path/hash | ✅ 全部拒绝为 400 |
| 工具自更新 | ✅ 未实现 |
| 用户本地视频导入（WP-B） | ✅ 未实现 |
| 重新启用/证明 tabCapture | ✅ 未触碰；A24 断言 `captureStarted=false` |
| 改变 Cookie/密钥/媒体/转写/OCR/视觉上传边界 | ✅ 未改动 |
| 把 WP-A 通过扩大为整个 V3 通过 | ✅ 未声明 |

## 4. `02-target-architecture-and-code-map.md` 所有权与并发

| 不变量 | 结果 |
|---|---|
| Runtime manager 是下载/校验/安装/generation 的唯一 owner | ✅ |
| Extension 只发固定命令并渲染状态 | ✅ 客户端只接受冻结 body |
| 只允许一个活动 repair job | ✅ 409 `JOB_ACTIVE` + `details.jobId` |
| managed root 固定、可被 `NAVIA_MEDIA_TOOL_ROOT` 覆盖、目录 0700 / 暂存 0600 / 已发布 0700 | ✅ |
| 内容寻址且不变的版本目录；fsync → atomic replace → 父目录 fsync → 原子 active manifest | ✅ |
| WP-A 不删除已发布版本 | ✅ 失败路径只删 staging |
| 重启后从最终文件重新验证 | ✅ `recover_after_restart` |
| snapshot 内部字段固定；generation 为除 path/verifiedAt 外的 canonical SHA-256 | ✅（并修正为**递归**剔除） |
| 三条路径共用同一 snapshot，无第二条全局依赖 owner | ✅ |
| lease 按 taskId 持有到既有 terminal cleanup | ✅ `acquire_snapshot` / `leased_snapshot` |
| 托管版本永不回收；系统工具每次 subprocess 前复核；ASR 被删则本任务 fail closed | ✅ 前两项已实现，第三项由 A20 PARTIAL 记录 |

## 5. `03-api-contract-and-state-machine.md` 状态机

| 项 | 结果 |
|---|---|
| 六阶段顺序 | ✅ A09 逐步断言 |
| 四个可取消阶段 + `cancelling → cancelled` | ✅ A11 |
| `installing` 不可取消 | ✅ A12 |
| 取消/提交竞争：先持锁者胜出，只有两种合法结果 | ✅ A12 |
| 终态不可被旧 worker 回写 | ✅ A18 |
| 新 repair 新 job id、sequence 初始 0、每次持久变化 +1 | ✅ A09 |
| 重启把活动 job 原子转 `failed/RUNTIME_RESTARTED` 并清 staging | ✅ A17 |
| 旧 ready 可用而最近 repair 失败时 overall 仍 ready、latest job 显示非阻塞失败 | ✅ 状态机实现；面板侧列为 A22 PARTIAL |
| 成功 envelope 精确 `{ok,data,error,request_id}`；status 直位于 data；job 位于 `data.job` | ✅ A03 |
| 错误 envelope 精确 `{ok:false,data:null,error:{code,message,recoverable,details},request_id}` | ✅ A03 |
| HTTP 状态映射 400/404/409/422/507/500/502/504 | ✅ A02/A04 |
| 响应不含绝对路径/URL/原始异常/命令行/Cookie/token/API key | ✅ A03 |

## 6. 冻结网络与资源策略

| 项 | 结果 |
|---|---|
| 唯一 URL、仅 HTTPS、≤2 次重定向、逐跳 host 白名单 | ✅ 实现；A13 逐跳穷举列为 PARTIAL |
| expected bytes = 3,072,469，Content-Length 精确相等 | ✅ A23 实测一致 |
| connect 15s / read 30s / 总 deadline 180s / 最多 2 次重试且每次新暂存 | ✅ 实现 |
| 安装前空闲 ≥ `2*bytes + 64 MiB` | ✅ A16（且**先于下载**检查） |
| 自检 deadline 30s、命令精确、exit 0 且 stdout 去空白等于 `2026.08.19` | ✅ A23 实测通过 |
| symlink / 非普通文件 / root escape / size / hash / timeout / 自检失败一律 fail closed | ✅ A14–A16 |

## 7. 架构不变量与兼容性

| 不变量 | 结果 |
|---|---|
| 新 dependency API 是 WP-A 的版本化公共 loopback 合同 | ✅ 三个 v1 schema |
| 现有 media acquisition 请求/响应不变 | ✅ 仅新增路由 |
| SourceAuthority 不变 | ✅ 未触碰 |
| Cookie 租约 / Provider 不变 | ✅ 未触碰 |
| relay v11 不变 | ✅ `unlistedBoundaryEmits` 为空 |
| 既有媒体 FailureCode registry 不变 | ✅ 新码独立 registry |

## 8. 严重度

| 级别 | 数量 |
|---|---:|
| Fatal | 0 |
| Major | **2**（凭据通道 HTTP 路径异常；`app.py` 冻结摘要待重冻结） |
| Minor | 0 |
