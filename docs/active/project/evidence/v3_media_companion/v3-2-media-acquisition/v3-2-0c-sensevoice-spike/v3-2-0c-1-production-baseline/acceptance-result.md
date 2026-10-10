# V3-2-0c-1 SenseVoice 基线验收结果

日期：2026-09-22  
正式 run：`v3-2-0c-1-baseline-20260922T135843Z`  
结论：`PASS`（仅 SenseVoice V3 本地转写开发基线）

## 1. 固定分母

| ID | 结果 | 真实证据 |
|---|---|---|
| SB01 | PASS | catalog 存在冻结 identity/revision/3 files；`selectable=true`、`quality.status=development_baseline` |
| SB02 | PASS | 真实 Chrome 360/420 两视口展示 Linux 252 MiB、Windows 249 MiB、硬盘 247 MiB、内存上限 2 GiB、8 核 CPU、无需 GPU 与 V4 边界 |
| SB03 | PASS | 未安装选择返回 `V3_ASR_MODEL_NOT_READY`，requested 未被写入 |
| SB04 | PASS | 正式 manager 从官方 URL 下载 `263943306` bytes，逐文件 bytes/hash 一致，job 到达 ready |
| SB05 | PASS | 安装目录仅 `llama-funasr-sensevoice`、`sensevoice-small-q8.gguf`、`fsmn-vad.gguf`；可执行文件只有冻结 runtime |
| SB06 | PASS | 安装过程执行正式 adapter self-test，history 包含 `self_testing` 后才原子发布 |
| SB07 | PASS | requested/effective 均为 SenseVoice、fallback=false；重建 manager 后保持 |
| SB08 | PASS | 私有真实 B 站 sample03 `60000..75000ms` 窗口输出 1 个非空合法 SRT 片段，耗时 1167ms；公开材料仅保留 hash |
| SB09 | PASS | 未知 model/spec、危险路径/链接、archive member 与 hash 负例由 62 项相关 Runtime 回归覆盖 |
| SB10 | PASS | 取消、hash/size/disk/404 失败均不发布半成品；staging/原 effective 回归通过 |
| SB11 | PASS | Paraformer 仍为 `failed_current_gate` 且不可选；Tiny 技术兜底合同保持 |
| SB12 | PASS | 公开 5 文件扫描 0 secret/private path/transcript/audio；任务目录为空；无残留 Runtime/SenseVoice 进程 |
| SB13 | PASS | 未声明 24-bin、生产质量或自动质量回退；后两项明确进入 V4 |
| SB14 | PASS | 本地实施审计 Fatal=0/Major=0；V3-2-1 仅可进入详细计划与实施前审计 |

SB01..SB14：`14/14 PASS`，无 N/A。

## 2. 自动化结果

- Runtime 全量：`332 passed`。
- ASR 定向：`62 passed`。
- 前端全量：`39 files / 293 tests passed`。
- 设置组件定向：`3 passed`。
- TypeScript typecheck：exit 0。
- WXT production build：exit 0。
- 真实 Chrome：`12/12 PASS`，2 screenshots，Axe serious/critical `0/0`。

## 3. 失败尝试保留

首轮 Chrome runner 错误地尝试聚焦 HTML 禁用的“已选择”按钮，得到 `10/12`。该结果保留为 `ui-failed-attempt-keyboard-target.json`。修订只把键盘检查目标改为同一卡片内可操作的“卸载”按钮，没有降低布局、Axe、资源披露或模型状态门槛；复跑为 `12/12`。

## 4. 证据入口

- `runs/v3-2-0c-1-baseline-20260922T135843Z/baseline-result.json`
- `runs/v3-2-0c-1-baseline-20260922T135843Z/ui-result.json`
- `runs/v3-2-0c-1-baseline-20260922T135843Z/screenshots/`

