# T04-2 R4-P 确定性重放实施前审计

日期：2026-09-14
结论：`GO FOR DEVELOPMENT PROBE / FINAL RUN REQUIRES REBUILT SNAPSHOT`

## 输入

- T02.5 sealed raw：`ce272df4...5f0c3`，seal `fed6155a...1b70f`。
- T03 baseline：`t03-r3-production-exit-candidate-20260914T134804`。
- T04-1 环境 checkpoint：acceptance commit `34b4fc48...f51af`，已验证 bundle、frozen install、offline wheelhouse。

## 固定动作

1. 在 snapshot cwd 调用 `run-v2-px-r3-validation.mjs`，不得调用旧 generator/validator。
2. output root 必须为空，并与 baseline 物理分离。
3. validationRunId 保持 baseline ID，filesystem namespace 不同。
4. 四步 `derive -> validate -> report -> package` 必须真实执行且 exitCode=0。
5. 十项 artifact 与八项 stdout/stderr 逐字节相等。
6. InvocationRecord 只删除 `/recordedAt` 后 canonical JSON 相等。
7. 执行前后重算 T02.5 raw 与 T03 package hash，必须不变。

## 停止条件

任何输出已存在、步骤缺失、路径身份变化、额外 normalization、byte mismatch、Human/G7/final 提升都立即停止。当前仅允许运行开发探针；最终证据必须在 T04-2..7 工具冻结后重建的 acceptance snapshot 中重跑。
