# T03-3 T02.3 前共享核心回归结果

日期：2026-09-14。状态：PASS。Fatal=0，Major=0。

- `pnpm exec vitest run e2e/validate-v2-external-brain-productization-report.test.mjs`：10/10 PASS。
- Contract fixture：109/109；9 Schema、65 positive instances、63 RuleId（41 semantic + 22 schema）分母不变。
- TypeScript/HTML AST 绕过回归继续通过；contract 和 production 仍导入同一核心实现。
- 使用 `node --test` 直接启动 Vitest 文件曾产生 runner 初始化错误；该错误属于命令不匹配，正确 Vitest 命令随后完整通过，未计为代码失败。

允许 T03-4 读取 T02.3 DerivedFacts 执行 production validation；不构成 candidate 报告或封包。
