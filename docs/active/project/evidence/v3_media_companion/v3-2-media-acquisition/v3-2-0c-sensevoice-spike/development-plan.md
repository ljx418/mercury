# V3-2-0c 路线 C 真实最小 Spike 开发计划

日期：2026-09-22  
状态：`AUTHORIZED ISOLATED SPIKE`

## 1. 目标体验与非目标

目标是验证低资源本地中文 ASR 是否存在可行替代路线，避免用户安装模型后仍遇到完整语音遗漏。当前工作包不向用户暴露新入口，也不改变 Tiny fallback，因此不会制造未经验证的体验承诺。

## 2. 顺序

| 子阶段 | 操作 | 必须结果 |
|---|---|---|
| `0c-0` | 冻结 ADR、资产、样本、验收和威胁模型 | 内审 Fatal=0/Major=0 |
| `0c-1` | 从官方固定 revision 下载 Q8 模型 | bytes/hash/license 精确一致；私有目录 0700/0600 |
| `0c-2` | 从冻结 120 秒 WAV 确定性提取 3 个 15 秒窗口 | source/window hash 可复算；格式 PCM16 mono 16kHz |
| `0c-3` | CPU-only、8 cores/8 GiB、推理期断网执行 `--vad --srt` | 3/3 exit 0、文本非空、SRT 可解析、时间戳窗口内 |
| `0c-4` | 记录 wall time、peak RSS、资产体积和 cleanup | 不超资源；无进程/临时音频残留 |
| `0c-5` | PRD 检视、false-green 审计和审计包 | 只给 feasibility 结论；生产门禁保持阻塞 |

## 3. 固定真实样本

| sample / chunk | 相对窗口 | 用途 | PCM payload SHA-256 |
|---|---|---|---|
| `v3-asr-comparison-03 / 4` | `60000..75000ms` | Paraformer 固定窗稳定遗漏 | `6271ffeeb1f1f1d144bcc0402027c7abc5acf67b1b72c49064094511360c090b` |
| `v3-asr-comparison-03 / 2` | `30000..45000ms` | 同源控制 | `e0a45bf905f458bae924496f25257cc0086675aa363afaf10463937d8c1164bf` |
| `v3-asr-comparison-01 / 0` | `0..15000ms` | 跨源控制 | 实施时由冻结 source 确定性记录 |

source SHA-256 必须分别为 `f4f61c09...cc97b` 和 `2a11e099...beb05`；不得替换样本或复用旧 transcript。

## 4. 实现边界

允许：隔离下载器/runner、私有 spike 目录、公开 hash/count/resource 证据、本工作包文档。  
禁止：修改 `catalog.py`、`model_manager.py`、Provider registry、extension UI、Runtime API、Cookie transport、V3-2-1..7；禁止将 transcript/audio/绝对路径写入公开证据。

## 5. 后续

只有 `0c-1..5` 全部通过，才可制定新的生产候选工作包；生产候选仍须完成 3x120 秒、24 bin、48 人类判断、Settings 真实回归和独立审计。
