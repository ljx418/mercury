# WP0 R7 集中验收结果

日期：2026-10-19

R7 按 `project-stage-workflow.md` 5.1 执行一次集中回归。修复期间只运行受影响测试，没有重复可见 Chrome 或重复外审。

## 最终通过项

| 命令或门禁 | 退出码 | 结果 |
|---|---:|---|
| `npm run typecheck` | 0 | PASS |
| `npx vitest run ...TrustedTabCaptureCard... ...MediaCompanionLaunchCard...` | 0 | 2 files / 8 tests |
| 受影响 relay 与组件测试 | 0 | 4 files / 72 tests |
| `npx vitest run --maxWorkers=4` | 0 | 80 files / 644 tests |
| `npm run build` | 0 | PASS，构建总量 4.67 MB |
| `node --test scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs` | 0 | 45/45 |
| relay v11 baseline verifier | 0 | 50/50 |
| relay v11 mutation verifier | 0 | 16/16 |
| `.venv/bin/python -m pytest -q -k 'capture or transcript or outline or fault or product'` | 0 | 196 passed / 662 deselected |
| 生产调用点 experimental opt-in 静态扫描 | 0 | 两个生产调用点均无 `experimentalEnabled` |

v11 verifier：

- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-contract.py`
- `docs/active/project/evidence/v3_media_companion/v3-5.10-experience-repair/verify-stage-b-b5-3-background-capture-relay-v11-mutations.py`

## 如实记录的非产品失败

- 第一次 extension 全量回归使用 `--maxWorkers=2`，宿主资源压力下运行超过 20 分钟后被停止；它同时暴露两处已过期断言。断言修正后只执行一次最终集中回归，`--maxWorkers=4` 为 644/644。
- 第一次 Runtime focused 命令直接调用 `.venv/bin/pytest`，因入口脚本路径导致 67 个 `ModuleNotFoundError` 收集错误。改为同一环境的 `.venv/bin/python -m pytest` 后，196 项通过。前一次结果不计为产品失败，也未被隐去。

## 可见浏览器事实

R7 未启动 Chrome、Provider 或六视频，也未播放声音。R6 已执行且只执行一次的 owned Chrome 正控保持 0/7；本轮没有用无头测试、mock 或重复运行替换该事实。
