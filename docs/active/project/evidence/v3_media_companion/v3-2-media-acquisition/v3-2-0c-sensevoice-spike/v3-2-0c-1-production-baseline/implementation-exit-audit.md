# V3-2-0c-1 实施出门审计

日期：2026-09-22  
审计范围：SenseVoice V3 正式开发基线，不含 V3-2-1 媒体获取。  
决定：`V3-2-0c-1 LIMITED PASS`  
严重度：Fatal=0 / Major=0 / Minor=2

## 1. 实现与合同

- `catalog.py` 冻结 SenseVoice runtime/model/VAD 的官方 URL、bytes、SHA-256、revision、资源成本与 `development_baseline` 状态。
- `funasr_llamacpp.py` 通过闭集 `FUNASR_MODEL_SPECS` 复用同一 ProcessHost；未知 modelId fail closed。
- `model_manager.py` 按 descriptor 创建正确 adapter；未安装/未校验模型不能写入 requested 状态。
- 设置页明确展示成本、安装状态、V3 基线和 V4 延期边界；安装前按钮为“安装后可选”。
- `NAVIA_ASR_ROOT` 只允许部署选择受控 ASR 状态根，不改变公开 API 或来源隔离合同。

公开合同变化：新增 catalog model enum `funasr-sensevoice-small-q8` 和 quality enum `development_baseline`；既有字段未破坏。

## 2. 真实证据

正式 manager 下载并校验 `263943306` bytes；发布文件分别为：

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `llama-funasr-sensevoice` | 2442392 | `c41a53b0156f5c6c01a4390aee601831890d2fffe272d34499e1589e64c30edd` |
| `sensevoice-small-q8.gguf` | 254208320 | `4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5` |
| `fsmn-vad.gguf` | 1720512 | `1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479` |

真实 sample03/chunk4 产生 1 个片段，时间戳合法，elapsed=1167ms。真实 Chrome 12/12，Axe blocking 0，公开扫描 0 命中。

## 3. Minor

- M-1：本审计由实施 session 完成，不具备组织独立性；下一轮外部审查应复算 catalog、baseline result、UI result 和公开扫描。
- M-2：本次只证明正式链路和已知遗漏窗口，不重新宣称 24-bin 质量门禁；跨模型退化与失败后质量回退按用户决策进入 V4。

## 4. 门禁决定

- V3-2-0c-1 SenseVoice development baseline：`LIMITED PASS`。
- V3-2-1：可进入详细开发/验收计划和实施前审计；在该审计 Fatal=0/Major=0 前不得实施。
- V3-2 / V3 整体：仍未通过。
- V2/PX-6/RKM：继续 paused/incomplete，不由本次结果改变。

