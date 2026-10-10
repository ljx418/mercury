# V3-2-0c-1 SenseVoice 生产开发基线计划

日期：2026-09-22  
状态：`AUTHORIZED FOR IMPLEMENTATION`

## 1. 用户决策

SenseVoiceSmall Q8 成为 V3 本地转写开发基线。模型间质量退化检测、失败后智能质量回退和比较优化移入 V4；V3 仍必须保证安装校验、失败显式呈现、取消清理、隐私与低资源边界。

## 2. 实施顺序

| 子阶段 | 实体 | 出门条件 |
|---|---|---|
| `0c1-0` | PRD/架构状态、catalog descriptor、用户授权 | `development_baseline` 不冒充 `production_qualified` |
| `0c1-1` | manifest-driven `FunAsrLlamaCppProviderAdapter` | Paraformer 与 SenseVoice 闭集映射；未知 model fail closed |
| `0c1-2` | `AsrModelManager` 安装/self-test/selection | 官方资产 bytes/hash；原子发布；SenseVoice 可选 |
| `0c1-3` | Settings 状态与资源披露 | 下载、磁盘、内存、CPU、无 GPU、V4 边界可见 |
| `0c1-4` | 单元/合同/回归 | Runtime 与前端相关测试通过；未知资产/路径负例通过 |
| `0c1-5` | 官方资产真实安装 | 下载/校验/self-test/发布/重启后选择真实通过 |
| `0c1-6` | 真实冻结音频转写 | 已知遗漏窗口非空、SRT 合法、资源与清理通过 |
| `0c1-7` | PRD 审查、公开证据和实施出门审计 | Fatal=0/Major=0；不放行 V3-2-1 |

## 3. 代码范围

- `asr/catalog.py`：SenseVoice model descriptor 和 provider 状态。
- `asr/funasr_llamacpp.py`：闭集模型 spec，不复制 ProcessHost。
- `asr/model_manager.py`：按 descriptor 创建正确 adapter。
- `runtimeClient.ts` / `AsrModelSettingsPanel.tsx`：新增准确状态文案。
- 对应 Runtime/前端测试和本工作包证据。

不实现媒体下载、tabCapture、视频大纲、V4 自动质量回退或新门户逻辑。
