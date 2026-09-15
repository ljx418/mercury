# T04-5 比较器与负向矩阵验收结果

日期：2026-09-14  
结论：`PASS / Fatal=0 / Major=0`

R4-P 与 R4-E positive profiles 先通过。`T04-N-001..025` 精确 25 项全部执行并命中登记 primary failure；每项保留 mutation 描述，集合无缺失、重复或未知码。N-017 修改 tracked source 并重算 blob/source tree 后由真实 AST 扫描拒绝；N-018、N-020、N-021、N-024 分别拒绝公开泄漏、Human 自动签署、G7/final 提升与 tar 成员越界。
