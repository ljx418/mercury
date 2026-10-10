# V3-2-2 Route B3 开发与验收计划

日期：2026-10-07。固定分母：`B3-01..B3-20`，不得 N/A、缩分母、跨 run 或复用撤回候选。

| ID | 操作 / 场景 | 必须结果 |
|---|---|---|
| B3-01 | 校验历史 Revision 1..4 与新增 Revision 5 | 历史字节不变；v5 Schema meta PASS；supersedes 精确绑定 v4 |
| B3-02 | 全新授权 Chrome 单 run 探测固定 12 URL | 12 唯一 URL、固定顺序、6+3+1+1+1、截图/identity/hash 可复算 |
| B3-03 | 检查三个 ASR 槽位预冻结策略 | URL 与 faultPolicy 在探测前固定；无运行后选择字段 |
| B3-04 | acquisition task 真实字幕发现 | 每槽一条 discovery receipt；count/hash/observedAt 完整 |
| B3-05 | 按运行时事实分类 | count=0 必为 `runtime_no_subtitle`；count>0 必为 `audited_subtitle_failure` |
| B3-06 | 检查动态分母 | `runtimeNoSubtitle` 0..3；`auditedSubtitleFailure` 0..3；两者之和精确 3 |
| B3-07 | 字幕存在的 ASR 槽位 | 只执行该槽预冻结 fault；真实发现后故障一次，再进入媒体路线 |
| B3-08 | 字幕不存在的 ASR 槽位 | 0 fault；fallback reason=`V3_MEDIA_SUBTITLE_UNAVAILABLE`；进入媒体路线 |
| B3-09 | 审计故障不可达 | production Runtime/API/env/schema/acquirer 0 入口，静态审计 PASS |
| B3-10 | 无 lease、错 task、过期、撤销 | 全部 fail closed，0 cookiefile、0 media、0 子进程 |
| B3-11 | 任务凭据文件 | 随机名、0600、task 0700；argv/log/公开证据 0 secret/path |
| B3-12 | 六个字幕槽位 | 6/6 真实字幕 body，segment 非空有序且时界内 |
| B3-13 | 三个 ASR 槽位 | 3/3 真实当前分 P 音频，非 fixture，byte/hash 可复算，16 kHz mono PCM |
| B3-14 | multipart | 只处理冻结 part；其他 part 0 artifact |
| B3-15 | restricted / low-signal | blocked/degraded，均不伪造 transcript |
| B3-16 | 身份漂移、任意 URL、未注册 adapter、私网重定向 | fail closed；下载器不启动或立即停止 |
| B3-17 | 超时、403、超限、ffmpeg 失败、取消 | 唯一终态、终态后 0 写、cleanup 0 残留 |
| B3-18 | 回归 | Registry v5、Acquirer、Downloader、Core、Credential、Runtime 全量和前端回归通过 |
| B3-19 | PRD / 秘密 / 版权审计 | 无新增用户操作；公开包 0 Cookie/token/private URL/path/raw audio |
| B3-20 | 单 run seal 与审计 | 20/20；Fatal=0/Major=0；只声明 V3-2-2 LIMITED PASS |

## 实施顺序

1. B3-0：冻结 Revision 5 Schema、样本矩阵、开发/验收/威胁边界。
2. B3-1：实现运行时字幕能力分类和 v5 registry builder。
3. B3-2：改造 acceptance runner，按预冻结策略包装有字幕槽位。
4. B3-3：改造 verifier、negative fixtures 和生产不可达审计。
5. B3-4：定向回归与全量回归。
6. B3-5：全新 Chrome/profile/private root 单 run，真实 12 页与真实媒体获取。
7. B3-6：独立复算、secret scan、seal、PRD 检视。
8. B3-7：独立实施出门审查；通过后只放行 V3-2-3。

## 防假绿

- 不要求任何固定 URL 永久无字幕，也不允许在 run 后替换 URL。
- 不能用页面 probe 的旧字幕计数替代 acquisition task 的真实 discovery receipt。
- 三个 ASR 槽位任一走字幕成功、缺真实媒体或被标 blocked/degraded，B3-13 失败。
- `runtimeNoSubtitle=0` 不是失败；但必须明确记录“本 run 未观测自然无字幕”，不得伪造自然样本。
- fixture、历史音频、旧截图、旧 subtitle response、撤回的 `190000Z` 和失败的 `200000Z` 均不计分。
- 降低 SenseVoice、资源、秘密、清理或后续 transcript 门槛不能补救 B3 失败。

