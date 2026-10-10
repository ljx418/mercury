# V3-2-2 平台漂移重规划记录

日期：2026-10-06。状态：`REPLAN / PRODUCTION RUN NOT YET ACCEPTED`。

## 1. 触发事实

用户更新的桌面 Cookie 经 B站 `/x/web-interface/nav` 只读验证为 HTTP 200、`code=0`、`isLogin=true`，旧会话阻塞关闭。全新真实 Chrome run `v3-2-sample-probe-20261006T085921Z` 完成 12/12 页面探测，但原 ASR 锚点 `BV1ZpYd66ELP` 出现 3 个 API 字幕项，`BV1sMNtzJE5B` 出现 1 个，原冻结矩阵不能生成 productionReady registry。

## 2. 候选发现

- `v3-2-asr-candidate-refresh-20261006T091000Z`：确认 `BV1sMNtzJE5B` 与 `BV1Bb411w741` 当次无字幕，但前者当前分 P 约 5989 秒，不符合低资源全长验收成本。
- `v3-2-asr-platform-drift-discovery-20261006T093000Z`：发现无字幕候选 `BV13W41137qV`，但时长约 9412 秒，不符合低资源验收目标。
- `v3-2-asr-short-candidate-discovery-20261006T094000Z`：确认 `BV17x411i7Kh` 当次无字幕、时长约 256 秒，作为第三个低资源 ASR 候选。
- `v3-2-asr-short-candidate-discovery-2-20261006T100000Z`：确认 `BV1Jm4y1k7SL` 当次无字幕、时长约 223 秒，用于替换 5989 秒候选。
- production 候选 run `v3-2-sample-probe-20261006T103000Z` 正确作废：三个 ASR 候选均出现 `ai-zh` 字幕项，未生成 registry。该 run 同时发现 probe 对多 P 使用合集总时长而非当前分 P 时长，必须修复后重新探测。

候选 run 只证明可选样本，不得跨 run 组成生产证据。

## 3. Amendment 1

固定分母仍为 `6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal`。锚点保留但改为 subtitle；ASR 固定为 `BV1Jm4y1k7SL`、`BV1Bb411w741`、`BV17x411i7Kh`，当前分 P 均不得超过 1200 秒。生产判定只接受修订后 12 页在同一全新授权 run 的事实。

## 4. 防假绿

- subtitle 必须有当次 API `subtitleItems`，不能只看 DOM 的“字幕”文本。
- ASR 必须同时满足 API 字幕项为 0、页面字幕制作者标记为空。
- ASR 当前分 P 时长必须不超过 1200 秒；超限即作废，不能以“机器可跑完”替代低资源门槛。
- 多 P 的 `durationSeconds` 必须按当前 `cid` 对应 part 读取；合集总时长只可作为诊断，不能进入当前 playback unit 合同。
- view/player 响应 SHA-256 必须读取真实 probe 字段并通过格式校验，禁止对 `null` 做派生 hash。
- 分类再次漂移即整个 run 作废并回到计划阶段；不改阈值、不强制路线、不拼接旧 run。
- Cookie 值不写入本记录、日志、registry 或公开审计包；临时 Chrome profile 必须清理。

## 5. 恢复门槛

Amendment 1 定向测试与 Runtime 回归通过，内部/外部文档审查 Fatal=0/Major=0，然后执行全新单 run 12 页探测。只有该 run 可生成 Revision 3 productionReady 候选。
