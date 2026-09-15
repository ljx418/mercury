# T03-6 实施前审计

日期：2026-09-14。决定：GO。Fatal=0，Major=0，Minor=0。

- T03-5 Report v12 与 pending Human Review 已通过，输入 DAG 完整。
- 原文只规定 InvocationRecord 写入顺序，未冻结字段；本子阶段补充 P7 内部 Schema，避免 T03-7 自行猜测。
- 新 Schema 不改变产品、外部 API、规则注册表、fixture 或 Gate 分母；只约束父进程审计记录。
- 无环顺序固定为 Report/HTML -> Package -> Invocation；禁止 renderer 读取 Package，禁止 Package 引用自身或 Invocation。
- 停止条件：需要修改产品行为/外部合同，或无法避免绝对路径泄漏、自引用、未验证 artifact。

允许实现 T03-6；T03-7、T04、PX-6 仍未放行。
