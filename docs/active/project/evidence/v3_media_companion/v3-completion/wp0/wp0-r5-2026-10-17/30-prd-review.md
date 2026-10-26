# WP0 R5 PRD / 架构不变量检视（2026-10-18）

Candidate: `wp0-r5-2026-10-17`
状态：**R5 NO-GO**

## 1. 61 §2 R5-0 逐条

| # | 要求 | 本轮结果 | 判定 |
|---:|---|---|---|
| 1 | 核验 R4 PASS、baseline 50/50、mutations 15/15 | 全绿；重冻结摘要与 checkpoint 逐字一致；R4 证据 manifest 4/4 | ✅ |
| 2 | typecheck、受影响 media 测试、Runtime focused、production build | exit 0 / 229/229 / 247 passed / exit 0 | ✅ |
| 3 | 端口 `17861` bind preflight | 空闲，无 listener，无非 owned Runtime | ✅ |
| 4 | 通过产品 API 证明 SenseVoice fixed revision、installation=ready、verified/self-test、effective model | 全部满足；frozen revision `90c1c619…`；`ready` + `verifiedAt`；`effectiveModelId` 正是它；下载与已安装文件 hash 6/6 与 64 §4 一致；原生二进制 rc=0 | ✅ |
| 5 | manifest / unpacked build / 站点权限 / Runtime 启动 / runner 指向本轮 fresh 资源 | build 98 files、SHA `f5b7f976…`；`tabCapture` 与 17861 host 权限在位；Runtime 与 Chrome 均本轮 owned | ⚠️ 媒体面不可用（§3） |
| — | 禁止用 R4 deterministic provider / fixture transcript / bundled Tiny / 历史 artifact / 旧 receipt 冒充 | **一项未用** | ✅ |
| — | 不得新增任意 URL、静默下载、跳过 hash/self-test | **均未发生** | ✅ |
| — | 模型与缓存不得进入 WSL 虚拟磁盘或 Git | 模型在 Windows 持久卷；`/tmp` 无残留；`.navia` 未被 Git 跟踪 | ✅ |

## 2. 64 安装 UX 五项缺口逐条

| 缺口 | 要求 | 本轮实现 | 判定 |
|---:|---|---|---|
| 1 | 主动作改为一次「下载、安装并使用」，ready/self-test 后自动选择并以 `effectiveModelId` 确认 | `asrAutoSelectEnabled` 仅 `ready`；安装就绪自动 `patchAsrSettings`；标签文案按 effectiveModelId 分「已安装并启用」/「已安装但尚未生效」 | ✅ |
| 2 | 披露 Windows 目录 | `ASR_WINDOWS_STORAGE` 三目录 + 「不在 WSL 虚拟磁盘」说明，渲染于设置面板 | ✅ |
| 3 | 删除不存在的 Navia 发布包提示 | 断言文案**不含**「发布页」；如实说明导入入口只接受 `.navia-asrpack` 且 Navia 不提供可下载发布包 | ✅ |
| 4 | 手动路径只接受三项冻结文件并由本机伴侣验证/组包 | 列出三个冻结文件名、暂存目录、导入格式与「hash 后生效」；**未**让用户填写 URL；未伪造组包能力 | ✅（诚实呈现当前真实能力边界） |
| 5 | 分类展示网络/空间/hash/自检错误 | 七类分类（network/space/hash/self_test/permission/qualification/unknown），每类独立下一步动作 | ✅ |

**约束遵守**：仅内部 UI / 编排调整；**未改动**公共 API、catalog、hash、来源白名单或安全边界。

## 3. 61 §4 R5-2 与 §5 oracle 覆盖

| 项 | 覆盖 |
|---|---|
| R5-2 单次真实 canary | **未进入**（配额 0） |
| fresh Runtime/database/profile/task/build owner | **部分**：Runtime、build、Chrome profile 均有本轮 owner 与唯一身份；task 未产生 |
| runner 成功路径直调 Controller/materialize/database/store/grant/transcript/terminal | **0** ✅ |
| 从扩展图标或 Side Panel 启动分析 | **不可用**：媒体卡片渲染为空容器，主动作无可观测响应 |
| Background relay → Offscreen 非空 PCM → Runtime sink | ⛔ 无观测 |
| 冻结 SenseVoiceSmall Q8 → 非空带时间戳 transcript | ⛔ 无观测 |
| acquisition succeeded → materialize → SQLite `ready\|degraded` | ⛔ 无观测 |
| Runtime started 前 0 chunk / 之后 PCM>0 / ACK 精确 | ⛔ 无观测 |
| taskId/sourceIdentity 跨层一致；revision 单调；fence 一致 | ⛔ 无观测 |
| 不调用云 Provider、不上传原始媒体/Cookie/key/ticket/私有路径 | ✅ **0 / 0** |
| 无视觉 Provider 时只接受明确 degraded | ⛔ 无观测 |
| 全程禁止播放声音；Chrome `--mute-audio` | ✅ **0 声音**；每个 Chrome 启动均带 `--mute-audio` |
| 只关闭本轮 owned 资源 | ✅ owned Chrome 14 进程、Runtime、端口、profile、scratch 全部清理；本机原有 Chrome 未触碰 |
| canary 最多一次 | ✅ **0 次** |

## 4. 61 §5 十一条 oracle

| # | oracle | 本轮 |
|---:|---|---|
| 1 | fresh Runtime/database/profile/task/build 均有本轮 owner 与唯一 ID/hash | **部分**：Runtime PID、build tree SHA、profile 名、model SHA 均有；**task 未产生** |
| 2 | 成功路径直调次数为 `0` | ✅ **0** |
| 3 | PCM bytes/chunks/duration > 0，无声音 | ⛔ 无观测；声音 **0** |
| 4 | ASR model 精确为 SenseVoice frozen verified revision/hash | ✅ **通过**（§2 第 4 项） |
| 5 | transcript 非空、有合法时间戳，非历史/fixture | ⛔ 无观测；未使用任何替代物 |
| 6 | acquisition `succeeded` 先于 materialize | ⛔ 无观测 |
| 7 | taskId/sourceIdentity 跨层一致 | ⛔ 无观测 |
| 8 | revision 域分别单调；fence 一致 | ⛔ 无观测 |
| 9 | SQLite `ready\|degraded` 与 UI terminal 一致，退出 busy | ⛔ 无观测 |
| 10 | cleanup 可复算为零残留 | ✅ 本轮 owned **0** |
| 11 | secret/raw-media/private-path 公开证据命中 `0` | ✅ **0** |

## 5. 架构不变量

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| 唯一 durable 产品成功 = SQLite `ready\|degraded`；handoff ≠ 成功 | 未触碰该逻辑；未产生任何 handoff 断言 | ✅ |
| 不静默切换 Provider / 不补造截图 | **未启动任何 Provider**；`fallbackActive=false` 时如实呈现 | ✅ |
| 公共 endpoint/API、Origin、ticket TTL、v10 schema+fixture、FailureCode、40/20 inventory、阈值、SourceAuthority | **全部未改动** | ✅ |
| 模型仅在 Windows 持久目录，不进 Git / 证据 / WSL 虚拟磁盘 | ✅ | ✅ |
| 冻结分母不得降低 | 未降低；NO-GO 如实上报 | ✅ |

## 6. 合同变化

**公共合同：none。** 仅内部新增纯函数与一次性 UI 编排。

## 7. 严重度

| 级别 | 数量 |
|---|---:|
| Fatal | 0 |
| Major | **1** — R5-2 用户可达媒体面在真实侧边栏中渲染为空容器且主动作无可观测响应（真实路径失败） |
| Minor | 0 |
