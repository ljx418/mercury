# V3-2-0c PRD 规格检视

日期：2026-09-22

## 对齐结论

- 低资源：保持 8 cores/8 GiB/no-GPU/512 MiB，未提高用户硬件基线。
- 隐私：推理不需要 Cookie；网络 syscall 被 seccomp 拒绝；公开证据不含音频、正文和路径。
- 开放性：spike 输入来自冻结 WAV/通用音频合同，没有 BVID 或 B站字段；后续可由不同门户的 `TaskAudioRef` 复用。
- 用户体验：未修改设置页或 effective model，Tiny fallback 不受影响，因此没有体验回退或误导性“已通过”。
- 质量：3/3 非空只关闭路线 C 的最小可行性风险，不关闭 V3-2-A06；生产仍需 3x120 秒、24 bin、48 判断和 `critical=0/neither=0`。

## 偏移检查

未新增 PRD 外功能，未缩小生产分母，未复用旧 transcript，未把单窗口平均值替代逐窗口结果。唯一新增事实是 SenseVoiceSmall Q8 在当前 Linux CPU 环境可恢复已知 Paraformer 完整遗漏窗口。

## 下一门禁

允许制定 V3-2-0c production candidate 的详细合同、Provider descriptor、安装/状态 UI 与完整资格计划；在外部文档审查和新用户授权前，禁止产品实现。
