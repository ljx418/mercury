# T04-1 隔离环境失败尝试记录

日期：2026-09-14T17:16:46+08:00

## 结论

`t04-r4-snapshot-revalidation-20260914t084940z` 的 T04-0 保持 PASS；该 run 的 T04-1 尝试为 `VOID / NOT PASSED`，不得补写成功结果或用于 T04-2。

## 已完成事实

- detached worktree、local-only acceptance commit 与约 256 MB Git bundle 已生成。
- `pnpm install --frozen-lockfile`、实际 package integrity 索引与隔离 extension build 已执行完成。
- 主工作树产品文件、T02.5 sealed raw 与 T03 baseline candidate 未被修改。

## 停止原因

主机 Python 3.12 缺少 `ensurepip`/`python3.12-venv`，`python3 -m venv` fail-closed。SnapshotInputManifest 与 `t04-1-result.json` 均保持空文件，没有形成成功声明。

## 修订处置

不安装主机系统包。后续新 run 使用以下等价且更小的隔离路径：

1. `python3 -m pip download --only-binary=:all:` 从范围 requirements 解析实际 wheels；
2. 对 wheel 原始字节计算 SHA-256，并生成 exact version + `--hash=sha256:` lock；
3. 在全新空 `--target` 目录执行 `pip install --no-index --require-hashes`；
4. 从安装目录的 `*.dist-info/METADATA` 重算 name/version，并与 wheelhouse 精确对账。

该处置不复用主工作树 site-packages，不降低 hash 门槛，不改产品代码、合同 Schema 或 T02/T03 证据。新 run 必须从 T04-0 重新开始。
