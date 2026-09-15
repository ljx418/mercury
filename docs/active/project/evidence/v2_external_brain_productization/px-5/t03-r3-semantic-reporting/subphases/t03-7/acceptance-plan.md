# T03-7 验收计划

| ID | 必须结果 |
|---|---|
| T03-7-A01 | 从空目录、单一 T02.5 source run 完整生成固定 DAG |
| T03-7-A02 | derive/validate/report/package 四步 exit 0，implementation/stdout/stderr refs 均可重算 |
| T03-7-A03 | InvocationRecord v1 Schema 通过且四 step 顺序/唯一性正确 |
| T03-7-A04 | Package/Report/Validation/DerivedFacts/source raw 的 runId 与 hash 链一致 |
| T03-7-A05 | 成功候选 61 passed + 2 pending、42/42 mutation、109/109 contract、G1-G6 pass/G7 pending |
| T03-7-A06 | Human Review pending、Report/Package/final 均 false，禁止成功声明 |
| T03-7-A07 | T02.4 输入因 `T03-IN-11` 返回 2，只有 diagnostic 路径且无 package/invocation PASS |
| T03-7-A08 | 非空 output、路径逃逸、hash/run/profile 不一致与子命令失败均 fail-closed |
| T03-7-A09 | T03-0..7 单元/contract/frontend/typecheck/Runtime/T01 前置结果可追溯且全部通过 |
| T03-7-A10 | PRD/架构/false-green 内审 Fatal=0/Major=0；外部独立出门审计仍 pending |

固定 10 项，无 N/A。A10 的“外部独立审计”在审计者签署前保持 pending，因此本 session 最多形成 T03 exit candidate，不得自行宣布组织独立 PASS。
