# V3-2-2 路线 B 开发计划

日期：2026-10-06。授权范围：用户已批准“路线 B 规格修订与实施”。

## 1. 目标体验

用户仍只需在当前 B站视频页点击“开始分析”。系统优先读取真实字幕；字幕不存在或字幕体真实失败时，获取当前分 P 的任务期音频。验收故障只用于证明回退路径，不出现在产品设置、请求体、环境变量或 UI。

## 2. 子阶段

1. `B-0`：冻结 Revision 4 Schema、12 页矩阵、故障证明合同、PRD/架构/阶段门禁与威胁模型。
2. `B-1`：实现 portal-neutral `MediaAcquirer`、`SubtitleCandidate`、`AcquiredMedia` 和强类型字幕解析。
3. `B-2`：实现 B站凭据字幕获取、Cookie 白名单序列化、身份/分 P 绑定和封闭失败码。
4. `B-3`：实现固定 yt-dlp/ffmpeg 的当前分 P 音频获取、配额、取消和清理。
5. `B-4`：实现只位于 E2E 的 subtitle-body 故障编排器及生产不可达静态审计。
6. `B-5`：执行全新真实 Chrome 12 页 run，生成 schema-valid Revision 4；完成 6 个真实字幕 body、1 个自然媒体、2 个受控故障真实媒体、multipart/restricted/low-signal。
7. `B-6`：全量回归、PRD 检视、秘密/路径扫描、清理证明、候选包和独立实施出门审计。

## 3. 代码实体

- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/contracts.py`
- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/subtitle_resolver.py`
- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/downloaders/yt_dlp.py`
- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/bilibili/acquirer.py`
- `services/local-runtime/navia_runtime/modules/media_companion/acquisition/sample_registry.py`
- `apps/chrome-extension/e2e/v3-bilibili-route-b-runner.mjs`
- `apps/chrome-extension/e2e/v3-route-b-production-unreachable-audit.mjs`

## 4. 固定样本

| 类别 | BVID | Route B 角色 |
|---|---|---|
| subtitle x6 | `BV1yLuwzpEt2`、`BV1VG4117775`、`BV1Bt411D78C`、`BV1CiFMenEye`、`BV1Fh1VYFEDu`、`BV1iv411j7wL` | 真实字幕 body |
| ASR natural | `BV13W41137qV` | 双探测自然无字幕 + 真实当前分 P 媒体 |
| ASR injected | `BV1ZpYd66ELP` | 真实字幕发现 + `subtitle_body_http_403` + 真实媒体 |
| ASR injected | `BV1pW421c7DH` | 真实字幕发现 + `subtitle_body_empty` + 真实媒体 |
| multipart | `BV1PA4m1w7ya` | 只处理冻结 part |
| restricted | `BV1vt1sBgEzc` | blocked，不绕过 |
| low signal | `BV1goA2zrEEq` | degraded |

## 5. 不变量

- 12 个 URL 必须同一全新 run；旧 run 不拼接。
- 真实授权 Cookie 只经 lease 进入随机 `0600` cookiefile，值不进入 argv/log/evidence。
- 下载器不接收 caller URL，只接收已校验 identity 并由 B站 adapter 构造 URL。
- 故障计划不能进入 Runtime request/response、生产 Python 包或环境变量。
- V3-2-2 不执行 SenseVoice、tabCapture、OCR/VLM、Outline、Ask 或导出；只为 V3-2-3 交付真实媒体输入。

## 6. 出门条件

`RB01..RB20` 全通过，真实数据观察 0 mock，Schema/semantic/static/secret/cleanup 全通过，Fatal=0/Major=0。通过只允许进入 V3-2-3 实施前恢复审计。
