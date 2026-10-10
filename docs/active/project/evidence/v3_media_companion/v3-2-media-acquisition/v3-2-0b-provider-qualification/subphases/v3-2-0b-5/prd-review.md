# V3-2-0b-5 PRD 规格检视

日期：2026-09-22

- 固定三个原样本、cid/P1、30s..150s，不缩小质量分母，不更换更容易的音频。
- Cookie 只用于获取阶段；worker 无 URL/Cookie，native child 使用最小环境。
- 推理期禁止 AF_INET/AF_INET6，并隐藏宿主 GPU 设备；网络/GPU负探针由 runner 与独立 verifier 各执行一次。
- 每段均生成非空、顺序、无重叠、边界内 timestamped segments；完整正文只在 0600 私有 handoff。
- 资源实测明显低于政策上限，但该事实只证明低资源可运行，不证明语义质量。
- 公开 evidence 不含 Cookie、正文、音频、模型二进制或 private path。

规格偏差=0，假绿风险=0。`V3-2-A06` 的运行/资源部分完成，质量 numerator/critical/neither 仍 pending；只允许进入 0b-6 比较包与人类审查准备。
