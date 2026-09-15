# T02.5 T01 结构化回归证据修复与完整重采开发计划

日期：2026-09-14。状态：`APPROVED / READY TO IMPLEMENT`。

## 目标

关闭 T03-A13 的证据缺口：T02.4 只封存了 T01 命令退出码和空 stdout/stderr，36 个 assertion 仅存在于未被 raw seal 引用的 `.infra/t01-regression/raw/t01-real-chrome-run.json`。T02.5 必须在 collector seal 前把真实 T01 结果转换为公开、结构化、可哈希的 command artifact，并由 `command_result.structuredResult` 引用。

## 实施范围

1. 新增纯函数读取 T01 run object，要求 `passed=true`、36 个唯一 assertion ID、36/36 passed；输出只保留 schema/run ID、源文件 SHA-256、assertion ID 与 passed，删除路径、token 和 detail。
2. R2 runner 在 T01 命令完成后立即读取其真实 JSON，执行上述校验，并在 `appendPrerequisiteResults` 中写入 `artifacts/public/structured/t01_real_chrome_regression.json`。
3. T01 runner 的三次 Side Panel token 输入清空检查必须使用阶段化唯一 assertion ID；总分母仍为 36，不删除、不合并检查。
4. T03 DerivedFacts 提取 `summary.t01Regression`；ProductionValidation 的 `PX_RULE_V2_REGRESSION_FAILED` 必须同时验证所有 command exit 0 和 T01 36 个唯一 assertion 全过。
5. 新建独立 T02.5 real-Chrome run；禁止修改或拼接 T02/T02.1/T02.2/T02.3/T02.4，也禁止复用本阶段失败 run。

不修改产品 UI、Runtime/API、63 RuleId、109 requirement、42 mutation、G1-G7 或 Human Review。T01 runner 的 ID 去重只修复 P7 assertion identity，不改变被测行为或通过条件。
