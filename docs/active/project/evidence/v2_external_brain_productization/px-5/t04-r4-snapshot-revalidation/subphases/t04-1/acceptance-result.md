# T04-1 隔离快照构建验收结果

日期：2026-09-14
结论：`DEVELOPMENT CHECKPOINT PASS / SUPERSEDED FOR FINAL T04 EXECUTION`

> 2026-09-14 后续闭包审计发现：该 acceptance commit 中的 6 个 T04 文件只实现到 T04-1。T04-2..7 的实现会改变这些已声明文件的原始字节，因此本 run 只能证明隔离环境构建路线可行，不能作为最终 T04-2..7 执行快照。完成全部工具后必须从 T04-0 重建最终 run，并重新通过本页所有门槛。

## 唯一成功输入

- T04 run：`t04-r4-snapshot-revalidation-20260914t092332z`
- base commit：`430cddcb7ff618978851af1f3b9a3c48f2370d36`
- local-only acceptance commit：`34b4fc48c29c376e2318596d4a6b6d9bfc6f51af`
- SnapshotInputManifest SHA-256：`8a2cefe1ae7d692ede325fc0a6916bf1906c39852723e675f48e176a619e87ca`
- Git bundle SHA-256：`fe062fbed2b131de196ea313eaa665488df0c2aaf64c941909fdf8dfc44b997e`

此前 `084940z` 与 `091715z` 的 T04-1 尝试均为 VOID，只保留失败诊断，不得补写、拼接或进入 T04-2。

## 固定验收结果

| 检查 | 实测 | 结论 |
|---|---:|---|
| SnapshotInputManifest Draft 2020-12 | 0 errors | PASS |
| bundle 导入空 bare repository | acceptance commit 精确相等 | PASS |
| source tree | 3,386 entries | PASS |
| `treeSha256` 独立复算 | `a8fb8cec...4be2f` | PASS |
| path index 独立复算 | `08e48bb...5aeab` | PASS |
| extension build index | 91 files | PASS |
| pnpm frozen install | 611 name/version/integrity | PASS |
| Python wheelhouse | 32 wheels | PASS |
| offline `--no-index --require-hashes` | package identity 精确相等 | PASS |
| package.json / pnpm-lock / requirements | 与 base commit byte-equal | PASS |
| Chrome / Playwright | `150.0.7871.24` / revision `1223` | PASS |
| 主工作树 HEAD | 前后均 `ae28b627...d13` | PASS |
| 主工作树 porcelain-v2 hash | 前后均 `7e863d34...10dd` | PASS |
| T04 Node tests | 11/11 | PASS |

## 原始产物

运行目录：`runs/t04-r4-snapshot-revalidation-20260914t092332z/`。

关键 SHA-256：

```text
dependency-closure.json          ce36f9fb...0180
source-index.json                a2a84790...c06a
build-index.json                 34353f67...f3b3
resolved-packages.json           4229c738...44b6
runtime-locked-requirements.txt  ab73de34...537d
runtime-wheelhouse-index.json    f2472e36...1b55
runtime-wheelhouse.tar.gz        c6affcdd...70f
environment.json                 5e953ecb...f897
t04-1-result.json                8687229e...8b89
```

## 风险处置

- 主机缺少 `python3.12-venv`：已改用全新空 `--target` 目录验证离线 wheelhouse；不读取主工作树 site-packages。
- pnpm 不创建顶层 `playwright-core`：revision 从内容寻址 store 的唯一候选读取；不使用默认值。
- 合同文档 §6 的“22 negative results”为文字笔误；机器 Schema registry、验收计划与其余合同正文均为 25。T04-5 固定执行 25/25，不缩小分母。

## 阶段决定

允许进入 T04-2..7 工具实现与开发探针；不允许基于本快照形成正式 R4-P/R4-E/T04 LIMITED PASS。全部工具冻结后，必须新建最终 run，依次重跑 T04-0、T04-1、T04-2..7。T04、PX-5、PX-6、V2 均未通过。

## 最终候选重执行

最终 run `t04-r4-snapshot-revalidation-20260914t105407z` 已在全部六个实现文件冻结后重建：acceptance commit `e0e7ca9ae23b01db811bbd585a5ecb6c071e3a7f`，tree SHA-256 `c2c325e69e1b74f6637251377c764bbfa8988f752c50892e08433a393da02546`，source/build/Node/Python 分母为 3386/91/611/32。主工作树 HEAD `ae28b627...` 与完整 status hash `530c20df...` 前后相等。T04-1 最终执行 `Fatal=0 / Major=0`。
