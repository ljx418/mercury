# T04-1 隔离快照构建实施前审计

日期：2026-09-14  
状态：`GO`

## 前置结论

- T04-0 正式 run `t04-r4-snapshot-revalidation-20260914t084940z` 已通过。
- 依赖闭包实测为 1149 文件、34 import edges、6 个授权 T04 文件，三个缺口集合均为 0。
- 用户授权、T04 外审、T02.5 sealed raw、T03 baseline 和 product base commit 均已绑定。

## 实施边界

1. 从 `430cddcb7ff618978851af1f3b9a3c48f2370d36` 创建 detached 临时 worktree。
2. product base 文件只从 Git blob 物化；T03/T04/冻结合同文件只按闭包叠加。
3. 创建 local-only acceptance commit 和可导入空 bare repository 的 Git bundle，不修改主仓库分支。
4. `package.json`、`pnpm-lock.yaml` 必须与 product base byte-equal；使用 `pnpm install --frozen-lockfile`。
5. Python 必须生成 exact-version、带 SHA-256 的锁和 wheelhouse index，并在新 venv 中用 `--no-index --require-hashes` 验证安装。
6. 记录 path/source/build/environment index 原始字节；主工作树 HEAD 和 porcelain-v2 状态 hash 前后相等。

## 停止条件

- 任一 base product 文件漂移或闭包文件缺失；
- frozen install 需要修改锁文件；
- Python 依赖不能形成完整离线 wheelhouse；
- Git bundle 不能在空 bare repository 导入并 checkout；
- 主工作树 HEAD 或状态 hash 因快照操作改变。

实施前分级：`Fatal=0 / Major=0 / Minor=0`。允许开始 T04-1，不允许提前声明 T04-1 PASS。
