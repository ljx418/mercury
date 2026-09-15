# T03-1 验收结果

日期：2026-09-13。结论：`PASS`。Fatal=0，Major=0，Minor=0。

执行：`pnpm test:v2-px-r3-reader`，3/3 通过。

- 三种 cwd 读取相同字节。
- absolute、drive、NUL、遍历、virtual、symlink、hash 和 length 负例全部拒绝。
- Git reader 从指定 commit 读取旧 blob，不受工作树后续修改影响。
- 必填 `artifactRoot` 明确 source/validation/snapshot 三类根。

允许进入 T03-2。

