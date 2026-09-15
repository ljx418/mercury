# T03 子阶段审计索引

每个 `T03-0..T03-7` 目录必须在实施前包含 `preimplementation-audit.md`，实施后包含 `acceptance-result.md` 与 `prd-architecture-review.md`。后一阶段只有在前一阶段 `Fatal=0 / Major=0` 后才能开始。

| 子阶段 | 范围 | 状态 |
|---|---|---|
| T03-0 | 合同与注册表冻结 | PASS |
| T03-1 | ArtifactReader | T02.5 REPLAY PASS |
| T03-2 | DerivedFacts | T02.5 REPLAY PASS / gaps=[] |
| T03-3 | 共享 Schema/Semantic/AST core | T02.5 REGRESSION PASS |
| T03-4 | ProductionValidation 与 42 mutations | PASS / 61 machine passed + 2 human pending |
| T03-5 | pending HumanReview 与纯报告 | PASS / Report v12 / final=false |
| T03-6 | Package 与 InvocationRecord | PASS / 引用可重算 / 无自引用 |
| T03-7 | 编排、全量回归与出门候选 | LIMITED PASS / INDEPENDENT AUDIT Fatal 0 Major 0 |

T02.3 只保留为 G5 负回归；T02.4 只保留为 `T03-IN-11` 负回归。T02.5 是唯一正基线。旧 run `t03-r3-production-exit-candidate-20260914T132413` 因 Architecture Manifest Schema 失败而作废；新 run `t03-r3-production-exit-candidate-20260914T134804` 为唯一候选并已本地重算 16/16。T03-A14 的独立审计已在 R3 production-candidate 限定范围通过；T03 final、PX-5、PX-6 和 V2 仍不得宣称 PASS。
