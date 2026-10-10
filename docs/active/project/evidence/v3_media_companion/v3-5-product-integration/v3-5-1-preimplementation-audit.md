# V3-5-1 实施前审计

日期：2026-10-08。结论：`GO`。

- Fatal：0
- Major：0
- Minor：2

## 风险闭环

1. **双任务权威**：Materializer 不创建新随机 ID，只使用 acquisition taskId，并由 Runtime projection 回读 sourceIdentity。
2. **前端伪造正文**：API 不接受 evidence/segments/source title body；真实 segments 只从 Runtime 内存任务读取。
3. **无视觉证据假绿**：固定 degraded failure，不允许 ready，也不允许 UI 显示视觉完成。
4. **秘密与路径泄漏**：公开 catalog 仅相对 ref/hash；Cookie、token、原始音频和绝对路径不得进入响应。
5. **重复发布**：terminal task 幂等读取；非 terminal 使用 store revision/transaction barrier。
6. **Knowledge 回归**：不修改 Knowledge route union、API 或组件。

## Minor

- M-1：真实字幕样本可能动态漂移到本地 ASR；验收按 observed route 而非 registry class 判定。
- M-2：本子阶段故意以 degraded 发布无视觉证据任务；V3-5-3 必须用 fresh task 关闭视觉产品链，不能把本结果扩大为完整 V3-4 产品化。

允许实施 V3-5-1a..f。禁止提前实现 V3-5-4 或声明 V3-5 PASS。

