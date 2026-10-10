# V3-2-0b-1 Provider Adapter 与 Native Host 开发计划

日期：2026-09-22  
状态：`AUTHORIZED / PREIMPLEMENTATION AUDIT REQUIRED`

## 目标

在 `media_companion/asr/` 内建立可扩展但封闭注册的 `AsrProviderAdapter`、`AsrProviderRegistry`、`NativeAsrProcessHost` 与 `FunAsrLlamaCppProviderAdapter`。Provider 只消费通用本地 `TaskAudioRef`，不感知 B站、YouTube、小红书、Cookie 或页面结构。

## 实体

- `provider.py`：`TaskAudioRef`、`AsrSegment`、`AsrTranscriptCandidate`、adapter Protocol、closed registry。
- `native_process.py`：固定 executable/argv、受控 cwd/env/stdin/stdout/stderr、timeout/cancel/cleanup。
- `funasr_llamacpp.py`：从安装根生成固定命令；本阶段只实现 load/self-test/调用壳，不接 catalog。
- `test_v3_asr_provider.py`：契约正负例、真实 binary 最小自检和故障清理。

## 实施顺序

1. 在私有 `.tmp` 中安全解包已校验 Linux runtime，读取真实 README 并运行 `--help`，冻结可执行文件名与 argv。
2. 定义与 portal 无关的 dataclass/Protocol；输入音频必须是 runtime 创建的 task-private WAV 相对引用。
3. 实现 closed registry；未知 provider/class/URL/path 一律 fail closed。
4. 实现无 shell 的 process host；只接受安装根下的单个冻结 executable 和 adapter 生成的 argv。
5. 清除 proxy、hub/token、Cookie 与凭据环境变量；限制输出大小、timeout，确保 terminate→kill 与任务目录清理。
6. 实现 FunASR adapter 的 load/selfTest/transcribe/close 生命周期；SRT 语义留到 0b-3，当前只保留原始受限输出。
7. 运行 contract/fault tests 与真实 Linux binary 自检；输出不含音频、Cookie 或绝对路径。

## 边界

- 不修改 `catalog.py`、`model_manager.py`、Runtime API 或前端。
- 不把 runtime/model 安装到用户模型目录；使用 0b-0 私有资产。
- 不执行三个 120 秒质量样本；不产生 qualification 结论。
- Windows 仅验证归档清单与命令构造，不在 Linux 宿主冒充真实 Windows 执行。

## 停止条件

真实 CLI 与冻结设计不兼容；需要 shell/远程代码/任意用户 argv；无法清理子进程/临时音频；输出无可解析的时间戳路径；或 Provider 必须依赖 portal/Cookie 才能运行。
