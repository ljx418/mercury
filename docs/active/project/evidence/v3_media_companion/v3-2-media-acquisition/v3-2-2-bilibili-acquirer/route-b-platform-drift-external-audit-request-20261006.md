# V3-2-2 Route B 平台漂移修订独立审查请求

请从 `AUDIT_MANIFEST.md` 开始，只读审查平铺载荷并独立重算 SHA-256。不得修改主工作树，不得运行旧 PX generator / validator。

## 决策问题

1. 旧第 9 项在真实 Chrome 中 `subtitleItems=0` 后，是否被正确判失败而非伪造成故障注入？
2. 替换为 `BV1pW421c7DH` 是否保持 12 URL 唯一、`6+3+1+1+1`、`1 natural+2 audited` 与两个 faultClass？
3. discovery-only 事实是否被明确禁止拼接进 production evidence？
4. v3 历史 registry 是否保持不变，v4 schema/builder/tests 是否同步？
5. 生产代码是否仍不存在 fault flag/env/request field/import？
6. 修订是否偏离 PRD、缩小分母、扩大产品接口或造成体验回退？

请报告 Fatal / Major / Minor，并明确：是否允许按修订后的 12 项执行全新完整真实 Chrome run。文档通过不得扩大为 V3-2-2 implementation PASS。
