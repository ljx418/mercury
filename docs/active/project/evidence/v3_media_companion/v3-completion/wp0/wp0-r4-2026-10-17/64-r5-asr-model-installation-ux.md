# R5 ASR 模型下载、安装与配置体验

日期：2026-10-17  
状态：R5 实施输入；不改变 ASR catalog、下载源、hash、自检或公共 API

## 1. 用户目标

首次需要本地语音转写时，用户只做一次明确决定：查看资源影响后点击“下载、安装并使用”。
Runtime 在 Windows 持久目录完成受控下载、校验、安装、自检和选择；后续分析直接复用，不因
WSL 压缩、发行版回收或重启丢失。

固定持久目录：

```text
下载暂存：C:\workspace\navia\.navia\downloads\funasr-sensevoice-small-q8
产品根：  C:\workspace\navia\.navia\asr
最终模型：C:\workspace\navia\.navia\asr\models\funasr-sensevoice-small-q8
```

对应 WSL 路径均位于 `/mnt/c/workspace/navia/.navia/`，不在 WSL 虚拟磁盘。Runtime 仍以 Linux
进程执行，因此必须使用 catalog 冻结的 Linux x64 runtime archive，而不是 Windows exe。

## 2. 当前实现基线

`AsrModelSettingsPanel` 已有：

- 模型质量、下载/硬盘/内存/CPU/GPU/空闲空间披露；
- “下载并安装”“导入离线包”“选择”“卸载”；
- checking/downloading/verifying/installing/self_testing 状态、进度、速度、ETA；
- 取消、失败/损坏、hash 后生效、键盘焦点和状态播报。

当前缺口：

1. 自动安装完成后仍要求用户再点一次“选择”，不满足“一次下载后配置结束”；
2. 失败提示要求从 Navia 发布页取得 `.navia-asrpack`，但当前没有冻结可下载包证据；
3. UI 不披露 Windows 持久目录，用户无法判断 WSL 回收风险；
4. 手动下载的三个官方文件不能直接作为 `.navia-asrpack` 导入，缺少可操作的组包入口或说明；
5. Runtime 离线、空间不足、网络失败、hash 失败和自检失败需要分别给出下一动作，不能统一写
   “安装失败”。

## 3. 目标流程

### 正常路径

1. 用户在 Settings 看到“本地语音识别”及当前实际模型；不诱导任何云模型供应商。
2. 未安装时展示下载约 252 MiB、落盘约 246 MiB、至少 1 GiB 空闲、峰值约 2 GiB 内存、
   建议 8 核 CPU、无需 GPU，以及 Windows 保存目录。
3. 用户点击“下载、安装并使用”；确认弹窗再次列出来源、资源、目录和取消影响。
4. 弹窗依次显示检查、下载、校验、安装、自检，不把下载 100% 误写成可用。
5. `ready` 后由该次明确操作自动写入 `requestedModelId`；只有 API 返回
   `effectiveModelId=funasr-sensevoice-small-q8` 才显示“已安装并启用”。
6. Runtime/浏览器重启后状态仍为 ready/effective；无需再次下载或配置。

### 自动下载失败

1. 保留固定失败码和失败阶段；展示“重试自动安装”与“使用离线文件”两个动作。
2. 网络失败不得删除既有 ready 模型；取消/失败 staging 必须清理，已验证资产不得损坏。
3. 手动路径只接受 catalog 固定的三个文件及固定 revision/size/SHA-256；不得让用户填写 URL。
4. 产品必须提供可信组包/导入方式：优先由 Navia 本机伴侣选择三个文件后本地验证并组装
   `.navia-asrpack`；在该入口实现前，不得显示不存在的“Navia 发布页离线包”。
5. hash、size、文件集合或自检失败时保持旧 effective model，并明确指出需重新下载哪一项。

### Runtime 离线与资源不足

- Runtime 离线：显示“启动 Navia 本机伴侣”，不展示可执行但必失败的安装按钮。
- 空间不足：安装前阻止并显示所需/当前可用空间；不得下载后才失败。
- 重启恢复：活动 job 标记失败并清 staging；用户可重试，不得伪造继续进度。

## 4. 当前人工下载三件套

所有链接和校验值来自 immutable catalog；下载到第 1 节暂存目录，文件名不得更改：

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| `funasr-llamacpp-linux-x64.tar.gz` | 8,014,474 | `779967de1c528c2be966bcc47f246e7d3e6fcdb748d9491263062f4120f35e52` |
| `sensevoice-small-q8.gguf` | 254,208,320 | `4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5` |
| `fsmn-vad.gguf` | 1,720,512 | `1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479` |

下载完成后由 Codex/ClaudeCode 在本机完成 size/hash 校验、受控离线包组装或产品导入、自检和
effective model 验证；用户不需要解压、改权限、移动文件或编写 manifest。

## 5. R5 验收门槛

1. Settings 一次操作可完成确认、下载、校验、安装、自检和启用；安装后不再要求第二次选择。
2. 五个阶段、bytes/percent/speed/ETA、取消和失败原因可观察；终态不继续轮询或显示 busy。
3. Windows 持久目录和资源影响可见；Runtime 重启后 ready/effective 保持。
4. 自动安装与三文件手动导入都经过同一 catalog size/hash/self-test；任意变异 fail-closed。
5. 自动失败不再引用不存在的发布包；手动步骤对普通用户可完成。
6. Tiny 或旧 effective model 在新模型 ready 前不被破坏；没有兜底时明确显示 unavailable。
7. 模型文件、下载缓存和 staging 不进入 Git、公开证据或 WSL 虚拟磁盘。

