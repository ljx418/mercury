# T03-6 Package 与 InvocationRecord 验收结果

日期：2026-09-14  
结论：`PASS / LOCAL SUBPHASE`

| 验收项 | 结果 |
|---|---|
| ProductionPackage v1 / InvocationRecord v1 Schema | PASS |
| Package 绑定同一 T02.5 raw 与 validation run | PASS |
| path/hash/length/mediaType 重算 | PASS；Derived/Validation/Package/Invocation 共 87 个 P7 ArtifactRef 无错误 |
| candidate 状态 | `automatedCandidatePassed=true / human=pending / passed=false` |
| Package 自引用 | 0 |
| Invocation step | `derive -> validate -> report -> package`，4/4 exit 0 |
| Package/Invocation 方向 | 单向；Package 不反向引用 Invocation |
| 失败回归 | 非法状态、step 非零与 hash/runId 不一致由 Schema/单元测试拒绝 |
| 公开路径与敏感数据 | 0 绝对工作区路径；无 private bytes |
| 单元测试 | Package `2/2`；Contracts `3/3` |

候选 package SHA-256：`625a322b0dd4642cc1564e1189ded872933cd0b2c51bf38be5930de7c03ff410`。Invocation SHA-256：`473159174cef49a575b40fbeed937df276e6a6c9c1641c5e17cc8a28ea3a16da`。

Fatal=0，Major=0。该结论只放行 T03-7，本身不构成 T03/PX-5 PASS。
