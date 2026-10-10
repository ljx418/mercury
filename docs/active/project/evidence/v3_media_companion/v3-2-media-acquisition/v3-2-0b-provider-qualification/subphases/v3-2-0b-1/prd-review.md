# V3-2-0b-1 PRD 规格检视

日期：2026-09-22

- Provider 输入只包含通用 TaskAudioRef；B站/YouTube/小红书、Cookie、URL 均未进入接口。
- native host 使用 `shell=False`、封闭 executable、固定 argv、最小环境和受控 task cwd。
- timeout/cancel/crash/output overflow 均 fail closed，并清理任务音频。
- Windows 没有在 Linux 上伪造真实执行结论，仅验证 `.exe` 命名与冻结归档。
- 真实自检不被升级为真实语音质量通过；A06 仍 FAIL/REPLAN。

规格新增=0，删减=0，越界门户耦合=0，门槛降低=0。允许进入 `0b-2` 计划与审计。
