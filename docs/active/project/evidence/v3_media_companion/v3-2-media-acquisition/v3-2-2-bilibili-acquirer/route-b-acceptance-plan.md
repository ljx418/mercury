# V3-2-2 路线 B 验收计划

日期：2026-10-06。固定分母：`RB01..RB20`，不得 N/A、缩分母或跨 run。

| ID | 用户/系统场景与操作 | 必须结果 |
|---|---|---|
| RB01 | 校验历史 Revision 1/2/3 与新增 Revision 4 | 历史字节不变；v4 meta PASS；supersedes 精确绑定 v3 |
| RB02 | 全新授权 Chrome 单 run 探测固定 12 URL | 12 唯一 URL，6+3+1+1+1；identity/part/page/server/screenshot hash 可复算 |
| RB03 | 检查三个 ASR trigger | 恰好 1 natural、2 audited failure；两类计数不可替换 |
| RB04 | 双探测 natural 样本 | 两次间隔探测 subtitleItems=0，两个响应 hash 不同且均可复算 |
| RB05 | 探测两个 injected 样本 | 注入前真实 subtitleItems>=1；字幕发现响应 hash 可复算 |
| RB06 | 审计故障入口 | 仅 E2E acceptance orchestrator 可表达；Runtime/API/env/production package 搜索 0 入口 |
| RB07 | 注入 `subtitle_body_http_403` | route attempt 先记录真实 discovery，再记录受控 403，随后进入真实 media route |
| RB08 | 注入 `subtitle_body_empty` | route attempt 先记录真实 discovery，再记录受控空体，随后进入真实 media route |
| RB09 | 无 lease 调用凭据 route | `V3_MEDIA_LEASE_REQUIRED`，0 文件/子进程 |
| RB10 | 错 task/过期/撤销 lease | 分别 fail closed，0 cookiefile/media |
| RB11 | 创建 cookiefile | 随机名、0600、task 0700、仅白名单域/名称；argv/log 0 值 |
| RB12 | 6 个字幕样本 | 6/6 获取真实 body；segment 非空、有序、时界内，source/hash 闭合 |
| RB13 | 3 个 ASR trigger 媒体 | 3/3 只获取目标 part 音频；byte/hash 可复算且不是 fixture |
| RB14 | multipart | 只处理冻结 part；其他 part 0 artifact |
| RB15 | restricted/low-signal | 前者 blocked 且 0 绕过；后者 degraded 且不伪造 transcript |
| RB16 | 任意 URL/未注册 adapter/identity drift/私网重定向 | 全拒绝；下载器未启动或立即 fail closed |
| RB17 | 超时/403/超限/ffmpeg 失败/取消 | 唯一终态；终态后 0 写；cleanup 0 残留 |
| RB18 | 回归 | V3-1.3、V3-2-1、Schema/fixture、Runtime 全量均通过 |
| RB19 | PRD 与秘密审计 | 未新增用户操作；Cookie/path/token/字幕私有 URL 在公开材料 0 hit |
| RB20 | 候选与独立审计 | 单 run seal；真实 observation；Fatal=0/Major=0；候选不得自称 V3-2 或 V3 PASS |

## 防假绿

- fixture、预下载媒体、旧截图和旧 subtitle response 均不能计 RB02/RB04/RB05/RB12/RB13。
- 注入样本缺少“注入前真实字幕发现 hash”或“注入后真实媒体 hash”任一项即失败。
- production code 出现 fault flag、fault env、fault request field 或测试 wrapper import 即 Major。
- natural 样本任一次探测出现字幕即失败，不得改名为 injected 后继续同 run。
- 长自然样本可以延长 wall-clock，但不能放宽 8 CPU、8 GiB、无 GPU、artifact 配额和清理门槛。

