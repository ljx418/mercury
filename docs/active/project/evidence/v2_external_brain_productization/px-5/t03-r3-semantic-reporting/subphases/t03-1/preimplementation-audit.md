# T03-1 实施前审计

日期：2026-09-13。范围：production ArtifactReader 与 Git blob reader。

- 前置：T03-0 PASS，Fatal=0/Major=0。
- 输入：绝对 `runRoot`、绝对 `repoRoot`、POSIX 相对 ArtifactRef、40 位 snapshot commit。
- 必须拒绝：absolute、drive path、NUL、`..`、`virtual/*`、symlink、缺文件、hash/length mismatch。
- Git：只用显式 commit 的 `git cat-file/ls-tree`，不读取工作树作为 snapshot 事实。
- CWD：repo root、脚本目录、临时目录结果相同。
- 停止条件：路径逃逸、symlink 或 hash 负例未被拒绝。

结论：`GO`。Fatal=0，Major=0，Minor=0。

