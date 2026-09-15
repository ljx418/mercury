# PX6-0..5 机器出门实施外部审计清单

Run：`px6-machine-exit-20260914t164500z`  
T04.1 ExitManifest 原始 SHA-256：`1e37f5ed06dd28bf94cd3fb4b2f92ee7f0fe79f7d041353f6a58b4a1ed1f4186`  
PX-6 MachineExitAudit 原始 SHA-256：`821d49662c8dc7b0f7c9a4eb1e57fd09f18d116b52b4e1e767c0c578a0e50cd2`  
PX-6 machine public archive SHA-256：`ae3e1cf59adb77906a13873e2a0ffc6b835bdd8a49e1a57567a0d0645baa2925`  
目录规则：平铺 19 载荷 + 本清单，共 20 文件；不得混入 T04.1 或其他审计轮次。

| # | 文件 | 权威来源 | SHA-256 | bytes |
|---:|---|---|---|---:|
| 1 | `01-audit-request.md` | `docs/active/project/evidence/v2_external_brain_productization/px-6/implementation/px6-0-5-external-audit-request.md` | `c2e03d947b5c906c22500f6c724cf702f082a056b9e278ebe62740061fabcb2b` | 1415 |
| 2 | `02-prd.md` | `docs/active/project/01-prd.md` | `41e7cdb3e28bb0571dc94bb338d3532ce45abf1411dcfaefb8bbc15ef00331c1` | 125655 |
| 3 | `03-architecture.md` | `docs/active/project/02-architecture.md` | `216eba6528cbe061bc0f9b2f32d7f07b2e3d3ef0fa108802a2ee8f8566ac651c` | 141122 |
| 4 | `04-stage-gate.md` | `docs/active/project/stage-gates/v2-external-brain-productization.md` | `0c447b029740249f9b7760c59c8186e8a71262534f7ba9786b4eeb1e3890e121` | 18140 |
| 5 | `05-px6-development-plan.md` | `docs/active/project/design/v2-px-6-development-plan.md` | `c87d13899b5e59cf96a2ab139d1c62d47d51167f8e931622e648d3d5ff609b0b` | 6393 |
| 6 | `06-px6-acceptance-plan.md` | `docs/active/project/design/v2-px-6-acceptance-plan.md` | `80ba7e52a17aa2f2cf19b7a7968cdc6465120d9aa40730c6a538a1700200bef4` | 6575 |
| 7 | `07-px6-contract.schema.json` | `docs/active/project/contracts/v2_px6_exit_contracts.schema.json` | `c87106761495c9b6c8b739e892b7b3e182cd268b1cb951a110fbf8c8ea8e80e0` | 31779 |
| 8 | `08-px6-contract-fixtures.json` | `docs/active/project/contracts/fixtures/v2_external_brain/px6-exit-contract-fixtures.json` | `4f9f55ecc3c6e304b5acc7d999319db570460fa36e818a8cc8baac233442a007` | 31569 |
| 9 | `09-implementation-authorization.json` | `docs/active/project/evidence/v2_external_brain_productization/px-6/implementation/implementation-authorization.json` | `e9d099c69a5f18287c117c4e1c11e2a6628fdb052b529140c1a9053ff03a17b5` | 741 |
| 10 | `10-v2-px6-exit-audit.mjs` | `apps/chrome-extension/e2e/lib/v2PxExitAudit.mjs` | `47dfb7631099c9a01c3e20080c2d8c5ef4a6156b0f163e24571ae6a9b386be91` | 46448 |
| 11 | `11-v2-px6-human-review.mjs` | `apps/chrome-extension/e2e/lib/v2PxHumanReviewSubmission.mjs` | `ccb9bf9ce1a9b5bc23e0614f7cfd004701e63ceddc9e40848617ba5387753082` | 6689 |
| 12 | `12-run-v2-px6-exit-audit.mjs` | `apps/chrome-extension/e2e/run-v2-px-6-exit-audit.mjs` | `1a7cbb64791e450a94a0226a0abb7d7d2f52e1d520ee0527ee405d523fb1d457` | 9285 |
| 13 | `13-v2-px6-exit-audit.test.mjs` | `apps/chrome-extension/e2e/lib/v2PxExitAudit.node-test.mjs` | `d37e9ad3f9d4d38f4ce357e2777252a7c0f318e16dcdbd7f7f1211212b697c9b` | 5757 |
| 14 | `14-candidate-binding.json` | `docs/active/project/evidence/v2_external_brain_productization/px-6/implementation/candidate-binding-px6-machine-exit-20260914t164500z.json` | `e62e2a430c5d61a887efba2507deda225d9581e58dbfde5e8cf208590811572b` | 1887 |
| 15 | `15-machine-exit-audit.json` | `docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t164500z/machine-exit-audit.json` | `821d49662c8dc7b0f7c9a4eb1e57fd09f18d116b52b4e1e767c0c578a0e50cd2` | 6454 |
| 16 | `16-evidence-index.json` | `docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t164500z/evidence-index.json` | `b0090c5e214ff66c32ed483298b2c9b3b054eee6d3ff16a8c984a690a84dbe6c` | 2787 |
| 17 | `17-review-request.json` | `docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t164500z/review-request.json` | `339de3ffa21bc3925c72db02fd158d58d21b385519529dc6fc1b792060805ea9` | 6036 |
| 18 | `18-px6-negative-results.json` | `docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t164500z/px6-negative-results.json` | `cb7e4139506d0614c56c91b8869aa92787b9a2bffcc4b897ea14348ceeb46e5d` | 9668 |
| 19 | `19-px6-public-evidence.tar.gz` | `docs/active/project/evidence/v2_external_brain_productization/px-6/runs/px6-machine-exit-20260914t164500z/public/px6-public-evidence.tar.gz` | `ae3e1cf59adb77906a13873e2a0ffc6b835bdd8a49e1a57567a0d0645baa2925` | 235032 |

## 本轮决定边界

```text
T04.1 LIMITED PASS: preserved
PX6-0..5 local machine candidate: awaiting independent implementation exit audit
PX6-A01..A14: passed locally
PX6-A15/A16: pending
PX6-6 Human Review / H01..H07: pending, human-only
PX6-7 production finalization: fail-closed pending two-step final-audit contract freeze
PX-5: FAIL / REOPENED
PX-6 / V2 / RAG / RKM: NOT PASSED
```

独立审查最多可授予 `PX6-0..5 LIMITED PASS`，不得代签 Human Review，不得把机器候选扩张为 PX-6、PX-5、V2、RAG 或 RKM 通过。
