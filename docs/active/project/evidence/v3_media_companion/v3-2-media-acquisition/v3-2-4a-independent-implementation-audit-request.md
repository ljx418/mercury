# V3-2-4a 独立实施出门审查请求

日期：2026-10-07。审查对象：V3-2-4a acquisition orchestration、受信任 tabCapture 与 SenseVoice fallback 实施候选。

## 审查入口与限制

先读取 `AUDIT_MANIFEST.md`，独立重算全部载荷 SHA-256，再阅读本文件。只读审查；不得运行旧 PX generator/validator，不得修改成功 run、源码或文档，不得读取仓库外 Cookie 文件。

## 必须独立判断

1. 两步 `arm -> chrome.action/command -> startArmed` 是否真实满足 Chrome 用户调用要求，是否存在自动/错 tab/cross-task capture。
2. 三条前置路线是否来自真实 Runtime/page 状态且顺序固定，UI 是否能伪造 eligibility。
3. PCM 是否以非零采样和峰值拒绝静音假绿；SenseVoice transcript 是否为同 task 真实终态。
4. `asr_sandbox_launcher.py` 是否避免多线程 Runtime 的 `preexec_fn` 风险，同时保留 rlimit、affinity、网络 syscall denylist 与冻结可执行文件约束。
5. 成功 run 是否单 run 自洽；公开证据与 source tar 是否没有 Cookie、绝对私密路径、原始音频、profile、数据库或失败 run 诊断 WAV。
6. A01..A18、PRD 边界、portal-neutral adapter 边界和清理门禁是否成立；不得把一个 B站页面扩大为十二页、V3-2 或 V3 PASS。
7. 独立抽查/重跑适当的 schema、测试、typecheck/build 或公开结果验证，并报告与候选自报的差异。

## 固定输出

- Fatal / Major / Minor 分级与逐项复现依据。
- 明确给出 `V3-2-4a PASS` 或 `FAIL/REPLAN`。
- 若通过，只允许 V3-2-5 进入实施前文档/审计；V3-2-5 implementation 仍需另行授权。
- 审查结果落盘到：
  `docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-4a-independent-implementation-exit-audit.md`
