# T04 正式候选失败记录：隔离 Python 子进程依赖不可见

日期：2026-09-14  
Run：`t04-r4-snapshot-revalidation-20260914t095530z`  
状态：`VOID / NOT SEALED / NOT ELIGIBLE FOR T04 EVIDENCE`

## 事实

- T04-0、T04-1、T04-2 已执行成功；T04-3 在真实 Chrome 启动前的 `runtime_full_tests` 前置回归停止。
- Runtime 回归结果为 300 passed、6 failed、1 error。失败集中在 Runtime 内部再次通过 `sys.executable -m pytest` 执行 focused pytest，以及依赖同一能力的 external-repo/MCP/HTTP 测试。
- T04 runner 当时用系统 Python 向临时 `--target` 目录离线安装锁定 wheels，并只通过外层 `PYTHONPATH` 暴露依赖。产品测试中的子进程会按合同把 `PYTHONPATH` 重设为 `services/local-runtime`，因此相同 `sys.executable` 看不到临时 pytest/uvicorn。
- T02.5 在宿主 Python user site 下通过 307 项；本失败揭示的是 T04 隔离环境模型不能覆盖嵌套 Python 子进程，不撤销 T02.5 或 T03 限定 PASS。

## 处置

允许范围内只修改 `run-v2-px-r4-snapshot-revalidation.mjs`：使用 `python3 -m venv --without-pip` 创建不读取 system site 的临时 runtime environment，再从同一带 SHA-256 的 wheelhouse 以 `--no-index --require-hashes --target <venv site-packages>` 安装。T04-3/4 通过 PATH、VIRTUAL_ENV 和 `sys.executable` 继承该环境；新增 pytest/jsonschema/uvicorn import probe。

不修改 Runtime、测试、产品组件、合同或门槛，不跳过 prerequisites，不使用 system site fallback。

## 重启条件

实现文件已变化，因此本 run 的 acceptance commit 与依赖闭包永久作废。修复通过静态测试后必须创建新 run，从 T04-0 开始重建 snapshot，再顺序执行 T04-1..7；不得复用本 run 的 replay 或任何临时输出。
