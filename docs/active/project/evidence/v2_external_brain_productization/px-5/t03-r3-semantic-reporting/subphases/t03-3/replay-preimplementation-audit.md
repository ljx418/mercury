# T03-3 T02.3 前共享核心回归审计

日期：2026-09-14。决定：`GO FOR REGRESSION ONLY`。

T03-3 实现和历史验收保持不变。本轮在读取新 raw 前验证：63 RuleId 精确为 41 semantic + 22 schema，109 contract fixtures 继续调用同一 Schema/Semantic/TypeScript AST 核心，failure code registry 和 profile 分母无漂移。

停止条件：规则数量变化、fixture 缩减、production 与 contract 使用不同核心、旧 production validator 被调用、Human-only 规则被自动通过。通过只恢复 T03-4 的前置，不构成新的产品声明。
