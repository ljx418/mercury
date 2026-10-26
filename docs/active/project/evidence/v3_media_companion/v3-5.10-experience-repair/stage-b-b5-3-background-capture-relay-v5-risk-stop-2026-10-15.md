# P0 Background Capture Relay v5 风险停止记录

日期：2026-10-15。结论：`V5 REJECTED / IMPLEMENTATION NO-GO`。

Claude Code 首轮只读审查曾给出 PASS，但更严格的独立复核和针对 Runtime handler 的窄审查发现 v5 仍有阻断问题。项目按“冲突审查取更严格结论”停止 v5，不以先到的 PASS 授权编码。

## 阻断事实

1. v5 verifier 只冻结 fixture 子树，没有冻结完整 Schema；删除约束或回退 port 版本仍可能保持 26/26。
2. 当前 Runtime handler 在 sink finalize 后、transcript create/start 和 terminal frame send 前提前设置局部 `terminal=True`，使异常绕过 finally cleanup；这证明 v5 的 terminal 定义不能指导正确实现。
3. marker 处于 `connecting` 时，合法 Runtime start 尚未发生，Runtime finally 无法成为旧 task terminal owner。
4. Runtime hard crash 不执行 finally，且进程内 task 状态丢失；新 worker 仅 GET 会得到 404，不能证明终结。
5. v5 的 20 项内部 relay FailureCode 与既有公共 Runtime/grant/UI code 未显式分层，容易诱发越界公共合同改动。

## 恢复条件

只允许提交 v6：冻结 Schema/protocol digest；定义 exact protocol terminal commit；覆盖五个 terminal 注入点；按 marker phase 冻结 DELETE/GET/recover owner；GET 404 停轮询；内部错误码映射不改变公共合同。v6 双重独立审查 Fatal=0/Major=0 前不得编码。
