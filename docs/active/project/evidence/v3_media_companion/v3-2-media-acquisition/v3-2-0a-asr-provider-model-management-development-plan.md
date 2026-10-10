# V3-2-0a ASR Provider 与模型管理开发计划

日期：2026-09-21。状态：`LOCAL LIMITED PASS`。独立实施出门审查为 `Fatal=0 / Major=0 / Minor=3`。本子阶段用于关闭 V3-2-0 的模型/profile 管理缺口，不改变 V3-2-A06 质量阈值。

## 1. 用户结果

用户在 Settings 的“媒体与语音”页可以：

1. 看见当前请求模型、实际生效模型、质量定位和 CPU/RAM/显存/磁盘影响。
2. 使用随 Runtime 发布的 `faster-whisper tiny` 完成无 GPU 的最低可用兜底。
3. 对允许安装的模型点击一次“安装”，在模态框中看到检查、下载、校验、安装、自检的真实进度，并可取消。
4. 自动下载失败后重试，或选择经过校验的 `.navia-asrpack` 离线包；高级说明只给固定 CLI，不接受任意 URL 或任意模型目录。
5. 当所选模型不可用或损坏时，看见明确 fallback 原因；系统不得静默换模型。

`tiny` 只证明本地 ASR 可运行，不计 V3-2-A06 production quality PASS。`small` 保留“当前盲评未通过”标记；`Paraformer-zh` 和 `large-v3-turbo` 在版本、许可、资产 hash、自检未冻结前只显示为待资格确认，不能安装或选择。

## 2. 代码实体与分层

| 层 | 实体 | 责任 |
|---|---|---|
| Runtime API | `app.py /v1/asr/*` | 返回公开目录/设置/安装状态；不暴露绝对路径 |
| Domain | `asr/catalog.py` | build-time closed-set provider/model descriptor |
| Domain | `asr/model_manager.py` | 选择、安装任务、hash 校验、原子发布、卸载、离线导入 |
| Persistence | `asr/model_manager.py` 的 `_read_state/_write_state` | 原子 JSON 状态；不保存音频、转录文本或秘密 |
| Package | `asr/model_manager.py` 的 `_extract_package` | `.navia-asrpack` manifest、zip-slip、大小和 hash 校验 |
| Release | `scripts/prepare_bundled_asr.py` | 在构建时把固定 revision 的 tiny 复制为发布资产；权重不提交 Git |
| Extension API | `runtimeClient.ts` | 只调用 Runtime；不得直接访问下载源或模型目录 |
| Extension UI | `AsrModelSettingsPanel.tsx` | 模型选择、资源影响、进度模态框、失败恢复和离线包导入 |

数据流为：

```text
Settings trusted click
-> runtimeClient
-> Runtime AsrModelManager
-> allowlisted immutable catalog
-> staging/<jobId>
-> byte progress
-> per-file SHA-256
-> self-test in staging
-> atomic rename models/<modelId>
-> explicit requested/effective selection
```

Extension 不下载模型。Runtime 不接受客户端提供的 URL、hash、安装目录或 provider Python 类名。

## 3. 冻结目录

| modelId | providerId | 默认状态 | 资源说明 | 质量声明 |
|---|---|---|---|---|
| `faster-whisper-tiny` | `faster_whisper_local` | bundled / 默认 fallback | 约 76 MiB 权重；CPU；峰值 RAM 门槛 2 GiB | 最低可用，不计 production quality |
| `faster-whisper-small` | `faster_whisper_local` | 可安装 | 约 462 MiB 权重；CPU/int8；峰值 RAM 门槛 8 GiB | 当前真实盲评未过 A06 |
| `funasr-paraformer-zh` | `funasr_edge_local` | qualification_required | 预估 1.5 GiB 安装；CPU；实测前不承诺 | 中文低资源候选，未通过 |
| `faster-whisper-large-v3-turbo` | `faster_whisper_local` | qualification_required | 高资源；GPU 推荐 | 不属于低资源出门分母 |

默认低资源验收主机：8 CPU cores、8 GiB RAM、无 GPU。发布包增加量必须不超过 100 MiB；推荐模型安装体积不超过 2 GiB；设置读取 P95 小于 300 ms。

## 4. API 与状态机

冻结 API：

```text
GET    /v1/asr/catalog
GET    /v1/asr/settings
PATCH  /v1/asr/settings
POST   /v1/asr/installations
GET    /v1/asr/installations/{jobId}
GET    /v1/asr/installations/{jobId}/events
DELETE /v1/asr/installations/{jobId}
DELETE /v1/asr/models/{modelId}
PUT    /v1/asr/models/import/{modelId}
```

安装状态固定为：

```text
not_installed -> checking -> downloading -> verifying -> self_testing -> installing -> ready
                                            \-> corrupt
checking/downloading/verifying/self_testing/installing -> cancelling -> cancelled
任一步骤 -> failed
```

响应同时提供 `requestedModelId`、`effectiveModelId`、`fallbackActive` 和 `fallbackReason`。只有 `ready` 模型可成为 effective；requested 不可用时仅能回退到校验通过的 bundled tiny。

## 5. 子阶段

| 子阶段 | 实施 | 出门证据 |
|---|---|---|
| 0a-0 | 文档、Schema、目录和威胁边界冻结 | meta/shape/内部审计 |
| 0a-1 | Runtime catalog、持久设置、bundled tiny 发现 | pytest + 本地资产 hash |
| 0a-2 | 下载任务、进度、取消、hash、原子发布 | 本地 HTTP 真实字节 E2E |
| 0a-3 | `.navia-asrpack` 离线导入与拒绝矩阵 | zip-slip/hash/超限负例 |
| 0a-4 | Settings 模型选择和资源说明 | Vitest/typecheck/build |
| 0a-5 | 安装进度模态框和手动恢复 | 键盘/Axe/失败路径 |
| 0a-6 | 8 core/8 GiB/no-GPU tiny 自检与资源测量 | 真实模型加载/短音频推理 |
| 0a-7 | PRD 检视、公开/私有证据和独立审查包 | Fatal=0/Major=0 |

## 6. 停止条件

发现任意以下问题立即停止并回到计划：需要云端 ASR；需要 Runtime 接受任意 URL/代码；模型许可或固定资产无法审计；秘密/绝对路径进入公开材料；`tiny` 被当作 A06 通过；8 GiB/no-GPU 无法完成自检；安装失败仍显示 ready；新 Fatal/Major 无法在本子阶段关闭。

## 7. 实施结果候选

- Runtime/Extension/Settings、Schema/positive、bundled prepare/import CLI 和 Chrome E2E 已实现。
- Small 官方下载因 Hugging Face 重定向到 `*.cdn.hf.co` 首次 fail closed；修复仅允许该官方后缀，并新增合法子域与伪装域名正反测试。全新 run 随后完成 `486212372` bytes 下载、四文件 hash、本地加载自检、原子发布和重启恢复。
- Tiny 在 8 cores/8 GiB/no-GPU 限制下对用户授权真实 B站 30 秒音频完成 17 段转写，峰值 RSS `350200 KiB`；仅证明 fallback 可执行。
- 真实 Chrome 最终候选 17/17；详细证据与审计见同目录 `v3-2-0a-*.json/md`。独立审查前不得把本候选升级为 LIMITED PASS。
