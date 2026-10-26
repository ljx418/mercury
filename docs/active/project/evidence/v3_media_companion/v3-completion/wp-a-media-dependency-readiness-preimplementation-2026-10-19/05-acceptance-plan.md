# WP-A 验收计划

## 固定矩阵（24 项，24/24 才可提交 checkpoint）

| ID | 场景与操作 | 生产路径 / oracle / 负例与清理 |
|---|---|---|
| A01 | 对三个 schema 做 Draft 2020-12 meta-validation并校验四个正向 fixture | 3/3 meta、4/4 instance；失败即合同 NO-GO |
| A02 | POST 精确 body；逐项增加 url/path/hash/额外 id/额外字段 | 精确 body=202；每个 mutation=400 `REQUEST_INVALID`，0 job/文件 |
| A03 | GET status、POST/GET/DELETE job 的成功/错误 envelope | HTTP 与 03 文档逐项一致；无绝对路径、URL、原始异常或秘密 |
| A04 | 变异重复/缺失 dependency、ready-null generation、错误 kind/mode/scope、非法状态关系 | schema 或 Runtime semantic validator 全拒绝；至少 12 个 mutations |
| A05 | 四项真实校验均 ready | generation 非空稳定、route ready、activeJobId null；重复 GET 字节语义一致 |
| A06 | managed root 无 yt-dlp | action_required/NOT_READY；显示修复；不创建 downloader |
| A07 | ffmpeg 或 ffprobe 缺失/摘要 one-nibble mismatch | SYSTEM_TOOL_MISSING 或 HASH_MISMATCH；不尝试 apt/网络修复 |
| A08 | ASR requested 与 effective 不符或 model 未 ready | sensevoice NOT_READY、route blocked；只读取既有 manager，不复制状态 |
| A09 | 从无旧版本完成 repair | 状态严格 checking→downloading→verifying→self_testing→installing→ready；sequence +1；发布 generation |
| A10 | 活动 job 时并发 POST 两次 | 仅一个 worker/staging；第二次 409 JOB_ACTIVE，返回 details.jobId |
| A11 | 在 checking/downloading/verifying/self_testing 各取消 | cancelling→cancelled；子进程/句柄/staging=0；旧 active manifest 不变 |
| A12 | 取消与 installing commit lock 同时竞争 | 只允许 cancelled+旧版本或 ready+新版本；无第三状态、半文件或终态反转 |
| A13 | DNS/连接/读取/5xx、HTTP 降级、第三 host、第三次 redirect、总 deadline | 仅网络/5xx 最多 2 次；固定 NETWORK_FAILED/TIMEOUT/SOURCE_NOT_ALLOWED；每次新 staging |
| A14 | Content-Length/stream 分别 exact bytes 与 one-over/one-under | exact 继续；one-over/under SIZE_MISMATCH，拒绝在 publish 前 |
| A15 | exact SHA 与 one-nibble mutation | exact 继续；mutation corrupt/HASH_MISMATCH；旧 ready 与 manifest 不变 |
| A16 | 空间 exact `2*bytes+64MiB` 与 one-under；权限拒绝；自检超时/非零/错误版本 | exact 可继续；其余固定码，进程组与 staging 清零 |
| A17 | 在 checking/downloading/verifying/self_testing/installing 五处模拟 Runtime crash 并新建 manager | 前四处旧 job=RUNTIME_RESTARTED 且 staging=0；installing 后只允许旧或完整新版本，重新验证 |
| A18 | 已终态后旧 worker 再写状态/进度，或旧 sequence 响应晚到 | 终态、active manifest、generation 不变；UI 忽略不大于当前 sequence 的更新 |
| A19 | task T1 开始后发布 generation G2，再启动 T2 | T1 acquisition/visual/ASR 日志均 G1；T2 均 G2；每 task 只读取一次 |
| A20 | T1 期间篡改 system tool 或删除其 ASR model | T1 fail closed 且不切 G2/其他模型；lease 释放；T2 重新校验后 blocked |
| A21 | 组件渲染 ready/action_required/installing/failed/offline | 文本、按钮、可取消性、进度和恢复建议与 API fixture 一致；无假百分比 |
| A22 | 安装中离开/重进 Settings、Runtime 离线后恢复、latest failure + old ready | activeJobId 恢复 polling；焦点/键盘可达；old ready 时仍可分析并显示非阻塞失败 |
| A23 | owned 临时 managed root 通过产品 manager fresh 下载 | 初始 URL/redirect/3,072,469 bytes/SHA/version 全匹配；固定自检 30s 内 exit0；删除 probe root |
| A24 | 固定 `BV1Bb411w741 / CID 61744125 / p1`，现有受支持凭据会话，经公开 API 开始分析 | `credentialed_subtitle` 真实不可用后 `credentialed_media_asr` 成功；生产 factory/acquirer/SenseVoice 得到 >=1 个非空、时间戳单调 segment；capture 启动=0，原媒体/音频/task staging/进程/端口清零 |

## 反假绿

- A23 不能用当前已有 `.navia/tools/yt-dlp` 代替 fresh managed-root 安装；允许其作为恢复/采纳测试的独立输入。A23 的网络或上游失败必须如实 NO-GO，不允许换 URL。
- A24 必须经过公开产品 API/生产 factory/acquirer/ASR，不得直调 downloader、写数据库、预写 route failure、伪造 transcript 或 materialize。若固定样本的平台状态变化，停止交 Codex 重冻结样本，不自行替换。
- 文件存在、版本输出、mock HTTP、fixture shape 或 exit 0 不能单独证明 ready；必须同时验证精确摘要、自检和发布后的 generation。
- 超限/失败要断言未覆盖旧 ready、未发布新 generation、临时文件清零和 UI 可恢复动作。A12/A17 必须在 atomic replace 前后注入，不得只 mock 最终返回值。
- 不播放声音。若需要 Chrome，必须 owned profile、`--mute-audio`、一次集中运行、finally 清理。

## 出门门槛

Fatal=0、Major=0；24/24；定向与集中回归全绿；secret scan 0；owned 进程、端口、临时下载和测试 profile 残留 0；公共边界无未授权变化。否则 `WP-A NO-GO`。

