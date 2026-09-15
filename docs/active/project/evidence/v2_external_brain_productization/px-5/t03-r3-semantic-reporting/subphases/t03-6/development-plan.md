# T03-6 ProductionPackage 与 InvocationRecord 开发计划

日期：2026-09-14。范围仅 P7 evidence pipeline。

1. 纯 builder 从已验证的 raw/DerivedFacts/ProductionValidation/contract/HumanReview/Report/HTML 生成 candidate ProductionPackage。
2. Package 不含自身 hash；`passed=false`、Human Review pending、claim 为未通过。
3. 冻结内部 `v2-px-invocation-record/v1`，只记录 derive/validate/report/package 四步的 portable implementation artifact、cwd role、argv、exit/signal/stdout/stderr；不泄露绝对工作区路径。
4. InvocationRecord 由 T03-7 父编排器在 package 落盘后写；它引用 package，但 package 不引用 invocation。
5. 所有 ArtifactRef 必须真实存在并匹配 path/hash/length；缺项立即失败，不生成成功 package。

不修改产品代码、Runtime/API、Report v12、63 RuleId、109 fixture、42 mutation 或 Human Review 状态。
