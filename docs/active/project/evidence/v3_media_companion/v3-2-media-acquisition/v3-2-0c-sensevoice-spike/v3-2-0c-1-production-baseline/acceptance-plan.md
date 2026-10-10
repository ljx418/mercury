# V3-2-0c-1 验收计划

日期：2026-09-22

| ID | 用户操作/机器操作 | 必须结果 |
|---|---|---|
| SB01 | 获取 catalog | SenseVoice identity/revision/files/resources 精确；`selectable=true`、`development_baseline` |
| SB02 | 查看设置页 | 明示 V3 基线、约 252 MiB 下载、约 247 MiB磁盘、CPU-only/no-GPU、V4 边界 |
| SB03 | 未安装时选择 | fail closed，不写 requested 状态 |
| SB04 | 点击下载并安装 | 官方 runtime/model/VAD 逐文件 bytes/hash 校验；真实进度可见 |
| SB05 | runtime archive materialize | 只提取 `llama-funasr-sensevoice(.exe)`；0 其他可执行文件 |
| SB06 | self-test | adapter 加载固定三文件并通过本地 CLI；不联网取模型 |
| SB07 | 安装完成后选择 | requested/effective 均为 SenseVoice，重启后保持 |
| SB08 | 真实音频 | 已知遗漏窗口产生非空合法 SRT；provider/model identity 正确 |
| SB09 | 安全负例 | 未知 model/spec、篡改 hash、错 archive member、任意 path/class 均拒绝 |
| SB10 | 取消/失败 | staging 清空；未发布半成品；已有 effective 不被破坏 |
| SB11 | 回归 | Paraformer 仍失败且不可选；Tiny 仍可作为技术安全兜底 |
| SB12 | 隐私/清理 | 公开材料 0 transcript/audio/secret/private path；0 活跃原生进程/临时 WAV |
| SB13 | PRD 审查 | 不宣称 24-bin 或 `production_qualified`；V4 延后项明确 |
| SB14 | 实施出门审计 | Fatal=0/Major=0；最多放行 V3-2-1 详细文档/审计 |

SB01..SB14 不得 N/A。真实安装或真实音频失败时回到计划阶段，不得仅凭旧 spike 升级状态。
