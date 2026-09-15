# T03-1 T02.3 ArtifactReader 重放验收结果

日期：2026-09-14。状态：PASS。Fatal=0，Major=0。

- `pnpm test:v2-px-r3-reader`：3/3 PASS。
- Artifact bytes/path/hash/length 校验与 process cwd 无关。
- `virtual/*`、绝对路径、路径遍历、symlink escape、hash 与 length mismatch 全部 fail closed。
- Git reader 从指定 snapshot commit 读取 blob，不读取当前 dirty worktree 冒充快照。
- T02.3 sealed raw、artifact 和 snapshot 未写入或修改。

允许从该 reader 进入 T03-2 T02.3 派生；不允许复用旧 DerivedFacts。
