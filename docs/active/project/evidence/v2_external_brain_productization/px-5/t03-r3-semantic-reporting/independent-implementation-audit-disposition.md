# T03 实现出门独立审查处置

日期：2026-09-14  
审查文件：`independent-implementation-exit-audit.md`  
审查文件 SHA-256：`1d6d5cbf82e90410497601c0e0eb30fc66e2c3e88624bbaf0b1911e241f7ad71`

## 1. 门禁处置

独立审查结论已接受：

```text
T03 LIMITED PASS for R3 production-candidate evidence pipeline
Fatal = 0
Major = 0
Minor = 5
T04 = 只允许实施前规划与审计
```

T03 的 `production_candidate` 仍固定为 `machinePassed=true`、`humanReviewStatus=pending`、`G7=pending`、`finalPassed=false`。本处置不签署 Human Review，不把 T03 LIMITED PASS 扩大为 PX-5、PX-6、V2、RAG 或 RKM 通过。

## 2. Minor 处置

| ID | 处置 | 关闭位置 |
|---|---|---|
| M-1 | 旧候选 `t03-r3-production-exit-candidate-20260914T132413` 只保留为 Architecture Manifest Schema 失败回归；唯一正候选为 `...T134804`。两者不得参与同一分母或被下游二选一读取。 | `acceptance-plan.md` 第 6 节、T04 `snapshot-revalidation-contract.md` |
| M-2 | Architecture Scan Manifest v2 的 `symlinkPolicy` 唯一合法值冻结为 `hash_link_target_utf8`；版本名不表示继续兼容其他旧枚举。若将来升级 Schema，必须新版本迁移，不得宽松读取。 | `validation-profile-contract.md` 第 11 节 |
| M-3 | T03 production 编排严格只有 `derive -> validate -> report -> package` 四步。独立审查未重跑 CLI，只复算已封存日志；其来源链另附，不修改已审计的 `local-exit-verification.json`。T04 必须在隔离快照中实际重放。 | `orchestration-evidence-source-chain.md`、T04 A04 |
| M-4 | session/prompt hash 只能证明审查输入不同，不能冒充组织独立。T04 实现出门要求另一 reviewer session；PX-6 另要求真实人类签署。 | T04 `risk-adr.md`、A14 |
| M-5 | T04 的 PRD 边界、架构、开发顺序、14 项分母、合同和风险已形成独立文档候选；外部文档审查 Fatal 0/Major 0 前实现仍 NO-GO。 | `../t04-r4-snapshot-revalidation/` |

## 3. 不可变边界

- 不修改 T02、T02.1、T02.2、T02.4、T02.5 的 raw、seal 或审计文件。
- 不修改 T03 候选 `132413`、`134804` 的任何字节。
- 不修改本次独立审查文件或已审计的外部包来追写更好看的结论。
- T04 只能引用 `134804` 为 replay baseline；引用 `132413` 必须 fail closed。
- T04 结束后仍保持 Human Review pending；PX-6 才能执行人工体验核查与签署。

## 4. 当前状态

```text
T03 R3 production-candidate evidence pipeline: LIMITED PASS
T03 final product acceptance: NOT PASSED
T04 documentation: IN DEVELOPMENT
T04 implementation: NO-GO pending independent document audit and explicit user approval
PX-5: FAIL / REOPENED
PX-6: BLOCKED
RKM implementation: NOT IMPLEMENTED
```
