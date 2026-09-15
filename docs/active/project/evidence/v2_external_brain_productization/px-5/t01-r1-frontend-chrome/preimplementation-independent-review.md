# T01 实施前独立只读审查

日期：2026-09-10  
审查者：ClaudeCode CLI 独立 session；仅 Read/Grep/Glob，未修改文件、未运行测试或浏览器。  
结论：`NO-GO`，Fatal 0 / Major 9 / Minor 7。以下意见必须先在计划和实施前审计中闭环。

| ID | 发现 | 要求 |
|---|---|---|
| M-1 | runtimeClient 无类型化错误 | 冻结错误类、抛出点、requestId 来源和 stale 规则 |
| M-2 | 路径输入无 POSIX 绝对路径前置检查 | 明确前端提示与 Runtime 权威校验 |
| M-3 | Forget 任意结果都会导航，坏 shape 可假绿 | 冻结严格完成判定；失败留在对话框 |
| M-4 | 无 credential generation/AbortController | 冻结 generation 类型、集中 abort 和 late response 行为 |
| M-5 | Permission 临时状态跨 root 残留 | 冻结单 active-root 状态及完整 reset |
| M-6 | LocalRuntimeAccess 合并 auth/offline | 冻结四态及准确文案 |
| M-7 | Workspace 在不同分支重复挂载认证组件 | 冻结公共壳层单挂载 |
| M-8 | 认证组件缺稳定 Headless 定位符 | 冻结 testid 列表 |
| M-9 | 隔离 worktree 未说明 deleted build chunks | 冻结 HEAD+source overlay+fresh build，不复制既有输出 |

Minor 要求同时纳入：限制 sidepanel 修改到知识状态；列明 token 泄漏扫描面；列明后端 104 项对应合同；固定 evidence 目录；生成逐 test file 基线；补充输入 manifest 与清理规则。修订完成后必须重新独立审查，不能把本文 NO-GO 覆盖成 PASS。
