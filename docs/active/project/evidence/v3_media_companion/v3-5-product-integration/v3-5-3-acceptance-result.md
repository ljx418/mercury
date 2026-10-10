# V3-5-3 三视图与视觉证据验收结果

日期：2026-10-08。决定：`V3-5-3 PASS / V3-5-4 MAY ENTER DETAILED PLANNING`。

## 1. 真实运行

- 成功 run：`v3-5-3-real-20261008T145305Z`。
- 固定真实页面：`https://www.bilibili.com/video/BV1ZpYd66ELP`。
- 真实路径：B站播放 -> 用户手势扩展入口 -> tabCapture -> SenseVoice -> 同 task 新视觉 lease -> 0–8 秒媒体切片 -> 本地抽帧/RapidOCR -> 单次 MiniMax 选定帧理解 -> Runtime 原子物化 -> Workspace。
- 原始 result SHA-256：`7da2297f01a40319d68f3e433d4bdd0da1dc0afce3fd6f8333afc78c40569449`。
- 去敏结果：`v3-5-3-real-chrome-result.json`。

## 2. 固定门槛结果

| 门槛 | 结果 | 证据 |
|---|---|---|
| A01–A02 lease/task/source 绑定 | PASS | fresh visual lease；撤销 1/1；错误 task lease 测试 fail-closed |
| A03–A04 真实短片段与选帧 | PASS | 固定真实 URL；0–8 秒、最高 480p；选帧后临时媒体 0 |
| A05 本地 OCR | PASS | `ocr_block` evidence；OCR 未使用网络 Provider |
| A06 MiniMax 视觉 | PASS | verified Provider；仅 selected frame；产品达到 `ready` |
| A07 evidence 闭合 | PASS | `transcript/frame/ocr_block/vision_caption` 四类齐全 |
| A08 三视图及路由 | PASS | outline/timeline/mindmap 与 8 route direct/reload 全通过 |
| A09 Evidence Drawer | PASS | 类型、时间、来源、hash 可见；敏感值/私有路径不可见 |
| A10 负例 | PASS | 缺依赖与错 task lease 均 typed fail-closed；不启动下载 |
| A11 清理 | PASS | lease 撤销；temporaryMediaFiles=0；asrTemporaryFiles=0；安全根和 profile 删除 |
| A12 原子/重放 | PASS | task store 同 key 字节一致、陈旧 revision/变 payload 拒绝；18 项合同测试通过 |
| A13 回归 | PASS | Runtime 659、Frontend 335、typecheck、build 已通过；本次窄测试 18 passed |
| A14 公开扫描 | PASS | 105 文件、3,988,101 bytes、0 hit；公开文件不含原始媒体/帧/DB/日志 |

## 3. 作废运行

`v3-5-3-real-20261008T144908Z` 作废且未参与验收。它启用同一下载器后真实进入 credentialed media ASR，旧 runner 仍等待 tabCapture 提示而超时。修复为采集下载器与视觉下载器配置隔离，并以全新 run 重跑；未复用 task、DB、profile、artifact 或 lease。

## 4. 清理

成功/失败 run 的私有 DB、日志、视频、音频、帧及过程截图在结果摘录后删除。仓库仅保留去敏 JSON 和本验收记录。
