# T04-6 ExitManifest 与审计产物验收结果

日期：2026-09-14  
结论：`PASS / Fatal=0 / Major=0`

SnapshotRevalidation Schema/semantic 通过，T04-A01..A14 全 passed，25/25 negatives。T04 Node tests 14/14。deterministic public tar 包含 1348 个唯一文件成员，SHA-256 `bedb0932231b5e73e0f662bdaa5509cb9bf977b646a556077de5c294ea122a61`；真实成员与 payload index 精确相等，敏感字节扫描 0，ExitManifest 与独立审查均不在 tar 内。

旁挂 ExitManifest 原始字节 SHA-256 `5e492bd50a7dc3a1be5c5d57b7b694601b9563f4c6f79871b72093b3e56316cd`，content SHA-256 `e8d6ba01b542fd0f7f612e20257e7f276a5c67c516b89a9db0c6e89ffc313a48`；signed=false、Human/G7 pending、final=false。
