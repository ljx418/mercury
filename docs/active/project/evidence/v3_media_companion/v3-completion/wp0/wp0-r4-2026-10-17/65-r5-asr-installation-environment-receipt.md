# R5 SenseVoice Windows 持久安装环境 Receipt

日期：2026-10-18  
范围：R5-0 环境准备；不构成 R5 canary 或 R5 PASS

## 1. 存储位置

全部资产位于 Windows `C:` 项目目录映射，不在 WSL 虚拟磁盘：

```text
原始下载：C:\workspace\navia\.navia\downloads\funasr-sensevoice-small-q8
最终安装：C:\workspace\navia\.navia\asr\models\funasr-sensevoice-small-q8
```

临时 `.navia-asrpack` 在安装成功后删除；`asr/imports` 与 `asr/staging` 均无残留。原始三件套
保留用于重装恢复，不进入 Git。

## 2. 下载源校验

| 源文件 | 字节数 | SHA-256 | 结果 |
|---|---:|---|---|
| `funasr-llamacpp-linux-x64.tar.gz` | 8,014,474 | `779967de1c528c2be966bcc47f246e7d3e6fcdb748d9491263062f4120f35e52` | PASS |
| `sensevoice-small-q8.gguf` | 254,208,320 | `4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5` | PASS |
| `fsmn-vad.gguf` | 1,720,512 | `1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479` | PASS |

受控 `.navia-asrpack` 只包含 manifest 与上述三项，随后由现有
`python -m navia_runtime.asr_import` 执行 catalog 文件集合、size、hash、archive member、发布
目录和 self-test 校验。安装器终态：

```text
ready: funasr-sensevoice-small-q8: Model is verified and ready.
```

## 3. 最终安装校验

| 发布文件 | 字节数 | SHA-256 | 结果 |
|---|---:|---|---|
| `llama-funasr-sensevoice` | 2,442,392 | `c41a53b0156f5c6c01a4390aee601831890d2fffe272d34499e1589e64c30edd` | PASS |
| `sensevoice-small-q8.gguf` | 254,208,320 | `4ae45c94422de949b387e2e0fb10d7e14e4c42c69db30c3444ecc7d4b844b7c5` | PASS |
| `fsmn-vad.gguf` | 1,720,512 | `1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479` | PASS |

## 4. 产品 API 验证

使用本轮 owned Runtime、端口 `17861`，经正式 API 写入并读取：

```json
{
  "requestedModelId": "funasr-sensevoice-small-q8",
  "effectiveModelId": "funasr-sensevoice-small-q8",
  "fallbackActive": false,
  "fallbackReason": null,
  "installationState": "ready",
  "verifiedAt": "2026-10-17T16:47:59.069291Z",
  "revision": "90c1c61912018b70ada0fcc024ea24aca62f2e63"
}
```

Runtime 已正常关闭；端口 `17861` 无监听，owned Navia Runtime 遗留进程为 `0`。下载、安装、
自检均未播放声音，未调用云 Provider，未处理 Cookie 或真实媒体。

## 5. 下一门禁

R5-0 的模型可用性阻塞已关闭。ClaudeCode 仍须按 64 文件补齐首次安装 UX 并执行定向测试；
之后在启动可见且 `--mute-audio` 的 Chrome canary 前通知用户并等待明确继续。R5/R6/R7 状态
均未因本 receipt 自动推进。

