# T03 四步编排证据来源链

日期：2026-09-14  
对象：`t03-r3-production-exit-candidate-20260914T134804`

## 1. 固定步骤

T03 production orchestrator 只有四个唯一步骤：

```text
derive -> validate -> report -> package
```

不存在第 5 或第 6 个 production step。独立审查中的“6 步 orchestration”措辞不改变 `InvocationRecord v1` 和实际候选的四步闭合列表。

## 2. 证据来源

| stepId | 命令入口 | cwdRole | exitCode | stdout SHA-256 | stderr SHA-256 |
|---|---|---|---:|---|---|
| derive | `e2e/derive-v2-px-production-facts.mjs` | `extension_root` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 同左 |
| validate | `e2e/validate-v2-px-production-package.mjs` | `extension_root` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 同左 |
| report | `e2e/generate-v2-px-production-report.mjs` | `extension_root` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 同左 |
| package | `e2e/package-v2-px-production-candidate.mjs` | `extension_root` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 同左 |

权威结构记录为候选目录的 `invocation-record.json`；每个 stdout/stderr 引用均指向同目录 `logs/invocation/` 下的实际空字节文件。独立审查复算这些路径、长度和 hash，但没有再次启动 CLI。

## 3. T04 继承要求

T04 不能把上述日志复算冒充“隔离重放”。R4 必须在新鲜空输出根中实际执行四步，记录新 InvocationRecord，并同时保留：

- 实际 command、cwd 和 process exit code；
- stdout/stderr 原始字节、长度和 SHA-256；
- 完整实现依赖闭包的 path/hash；
- 与 T03 baseline 的逐产物比较结果；
- Human Review pending、G7 pending、final=false。
