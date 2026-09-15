# T04-2 R4-P 确定性重放验收结果

日期：2026-09-14  
Run：`t04-r4-snapshot-revalidation-20260914t105407z`  
结论：`PASS / Fatal=0 / Major=0`

隔离 snapshot 内实际执行 `derive -> validate -> report -> package` 四步，exitCode 全 0。10 个确定性 artifact 逐字节相等，InvocationRecord 只删除 `/recordedAt` 后相等，8 个 stdout/stderr 逐字节相等。T02.5 raw `ce272df4...` 与 T03 package `625a322b...` 执行前后不变。
