# T03 实施授权摘要

状态：`AUTHORIZED`  
授权时间：`2026-09-13T22:20:44+08:00`

## 授权载荷

```json
{"authorizationVersion":"v2-px-t03-implementation-authorization/v1","authorizedAt":"2026-09-13T22:20:44+08:00","constraints":{"humanReviewSigningAllowed":false,"legacyProductionChainForbidden":true,"productionCodeAllowed":true,"t02SealedInputsReadOnly":true,"t04Allowed":false},"instruction":"继续执行T3的具体开发计划","preimplementationAudit":{"path":"docs/active/project/evidence/v2_external_brain_productization/px-5/t03-r3-semantic-reporting/independent-resumption-preimplementation-audit.md","sha256":"0bc22a17ea84ee19e6b2e0b3d9e1d7cf6be03b0a15cb4a624e36626ee6b7b2b9"},"scope":["T03-0","T03-1","T03-2","T03-3","T03-4","T03-5","T03-6","T03-7"],"userId":"repository_owner_current_chat"}
```

载荷采用 RFC 8785 风格的递归 key 排序、无空白 UTF-8 JSON（与 `canonicalJson` 实现一致）计算，且不包含 hash 自身：

```text
sha256=8efd98f23dd9908a9f983818ac7b9f95a325a559ff3421ed9c6a5bdc068aefd7
```

## 授权边界

- 允许实施 `T03-0..T03-7` 的 R3 证据读取、派生、共享校验、报告与封装代码。
- T02、T02.1、T02.2 的 sealed raw、seal 与 artifact 全部只读。
- 禁止调用旧 production generator/validator 链，禁止自动签署 Human Review。
- 本授权不允许进入 T04、PX-6 或 RKM 实施，不构成 PX-5/V2 通过声明。

