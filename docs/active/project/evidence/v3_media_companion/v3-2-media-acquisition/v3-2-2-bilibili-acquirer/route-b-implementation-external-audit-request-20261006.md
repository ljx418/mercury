# V3-2-2 Route B 实施出门独立审查请求

请从 `AUDIT_MANIFEST.md` 开始，独立重算全部载荷哈希。只读审查，不得修改主工作树；不得运行旧 PX generator/validator；不得读取或输出用户 Cookie 文件内容。

重点验证：

1. Revision 4 12 项固定分母、自然双探测、两个真实发现后注入、三份真实媒体、multipart/restricted/low-signal 是否闭合。
2. production code 是否存在 acceptance fault 可达入口。
3. Cookie 是否只在任务租约与私有 0600 cookiefile 使用，日志/argv/公开 evidence 是否 0 值泄漏。
4. downloader 失败、超时与 `.part` 是否清理；identity/part/host/tool hash 是否 fail closed。
5. 20/20 verifier 是否存在硬编码假绿；对 RB09/RB10/RB16/RB18 的外部回归绑定是否足够。
6. PRD 是否被缩小，是否误把 acquisition PASS 扩大为 ASR/V3 PASS。
7. 私有媒体不进入审计包时，运行时 hash/length/shape + 删除策略是否足够；若不足请定级并提出最小闭环。

请落盘 Fatal/Major/Minor、可复现命令与明确门禁：V3-2-2 LIMITED PASS 或 FAIL/REPLAN。即使通过，也只允许进入 V3-2-3 实施前恢复审计。
