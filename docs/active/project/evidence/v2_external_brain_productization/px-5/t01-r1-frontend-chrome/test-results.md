# T01 测试与真实数据结果

日期：2026-09-11  
Run：`t01-r1-frontend-20260910T232816`  
隔离提交：`5a34e5aef0ad493ef4374ad0ead6ea3a1c27fcbd`

## 自动化结果

| 检查 | 结果 | 证据 |
|---|---|---|
| 前端 TypeScript | PASS | `runs/t01-r1-frontend-20260910T232816/logs/typecheck-final.log` |
| 前端全量 Vitest | PASS，22 files / 169 tests | `runs/t01-r1-frontend-20260910T232816/logs/frontend-full-vitest-final.log` |
| SourceLibraryPanel 专项 | PASS，1 file / 3 tests | `runs/t01-r1-frontend-20260910T232816/logs/vitest-source-library-panel-final.log` |
| Runtime 全量 pytest | PASS，239 tests / 55 warnings | `runs/t01-r1-frontend-20260910T232816/logs/runtime-full-pytest-final.log` |
| Fresh E2E build | PASS | `runs/t01-r1-frontend-20260910T232816/raw/t01-real-chrome-run.json` 的 `fresh_extension_build` |
| 真实 Chrome 双容器 | PASS，36/36 硬断言 | 同上 |
| 进程与临时资源清理 | PASS | `runs/t01-r1-frontend-20260910T232816/raw/cleanup-manifest.json` |

关键文件 SHA-256：

```text
b8d8536e994c95d8744a7dba853395093c28aa241776f80b1f03dd2c8e81cb1f  raw/t01-real-chrome-run.json
1e45a9a87b0244f644a4bd9da9fc4e71b16651194a8e297b32b998a639b0a320  raw/cleanup-manifest.json
716a5b771050253338f0c232a73ecc06ebc6457ad21af79f52a097a96ff0b05c  logs/frontend-full-vitest-final.log
27fe908106fe116333fc388ced9dfb12845e63089c7441959679e102ce402321  logs/typecheck-final.log
893d883765218ed28af39678ed63e32d8fb69880bd306955e9f884c66d454a45  logs/runtime-full-pytest-final.log
ec3a432ceb6418f25e0a6293b9c56304f76cd6eb4f80563d78fe3bb2ad1b86e8  logs/vitest-source-library-panel-final.log
fc47a1f0224f8faffeb17e557450e47a1ea883c6afafb1c3a22638c7723b3d09  logs/claude-independent-audit.log
```

## 真实输入和结果

三个输入分别是本仓库 PRD、架构和验收计划的只读字节副本。每个样本均完成 grant -> scan -> import -> revoke；撤销后新 scan/import 均返回 403，撤销前已导入 source 仍可读取，返回内容 SHA-256 与原始文件完全相等。

真实 Chrome 路径完成：宿主页面 -> 原生 Side Panel -> 输入随机 Runtime token -> 保存 -> 打开 `workspace.html` -> 第二次输入 token -> 同一 `workspaceId/sourceId/operationId` -> PermissionRoot -> Forget 四面缺席 -> Runtime offline 四域状态。公开证据 185 个文件按 token 原始字节扫描，命中 0。

## 证据限制

- `raw/individual-vitest-results.tsv` 是新增 SourceLibraryPanel 测试前的 21 文件表；新增测试由独立专项日志和最终 22/169 全量日志证明，未伪造表内第 22 行。
- 历史 attempt 7 因早期复制失误未保留，attempt 19 是环境启动失败且未落盘；二者不是最终成功 run 输入。最终报告、截图、日志和 cleanup 均完整。
- 截图只证明 T01 双容器路径，不替代 V1.2-AC-Native 元数据矩阵或 PX-6 人工签署。
