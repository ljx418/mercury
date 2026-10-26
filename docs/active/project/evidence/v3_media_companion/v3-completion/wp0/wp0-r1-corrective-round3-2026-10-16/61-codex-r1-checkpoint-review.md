# WP0 R1 Codex Checkpoint Review

日期：2026-10-17  
结论：**R1 PASS / R2 MAY START**  
严重度：Fatal 0 / Major 0 / Minor 0

## 1. 独立复核

Codex 独立完成：

| 项 | 结果 |
|---|---:|
| TypeScript typecheck | PASS |
| `RuntimeRelayRecoveryAdapter.test.ts` + `RelayRestartReconciliation.test.ts` | **34/34** |
| relay ownership static gate | **25/25** |
| Runtime ownership barrier | **6/6** |
| v10 baseline | **50/50** |
| v10 mutation | **15/15** |

Runtime barrier 首次直接调用 `.venv/bin/pytest` 时因仓库包根目录未进入
`sys.path`，在 collection 阶段报 `ModuleNotFoundError: navia_runtime`；使用
`PYTHONPATH=. .venv/bin/python -m pytest ...` 后 6/6 通过。该项属于测试启动环境，
没有产品断言失败。

本轮没有启动 Chrome、Provider、六视频、Runtime 长驻服务或可见 UI；没有播放
声音，也没有执行 commit/push/reset/clean。

## 2. R1 验收结论

| R1 范围 | 证据 | 判定 |
|---|---|---|
| Background 唯一 Runtime WebSocket owner | static 25/25 + transport tests | PASS |
| Offscreen 零网络、纯 PCM producer | static gate + composition tests | PASS |
| exact Port sender/document binding | contract tests + static gate | PASS |
| credit/ACK/backpressure 有界 | transport/two-end harness | PASS |
| quiesce -> drain -> stopped -> finalize | controller/transport harness | PASS |
| 同步 staging barrier、worker 不早启 | Runtime barrier 6/6 | PASS |
| cleanup owner 唯一 | Runtime barrier + restart tests | PASS |
| worker restart 不恢复旧 PCM/ticket/sequence | restart composition 22 例 | PASS |
| production recovery 真实访问 Runtime | adapter composition 12 例 | PASS |
| 冻结合同无漂移 | baseline 50/50 + mutation 15/15 | PASS |

## 3. 剩余边界

- R2-R7 尚未验收；
- R4 的真实 404/recover/hard-crash 最终语义尚未执行；
- R5 muted real Chrome canary 尚未执行；
- R6 真实故障矩阵尚未执行；
- R7 immutable candidate 尚未生成；
- WP1-WP7、Stage A/B/C/D 与 V3 final 均未因此推进。

## 4. 下一门禁

允许 ClaudeCode 进入 R2。R2 只处理并验收 Offscreen producer、exact sender、
Base64 canonicalization、credit queue、sequence、overflow/backpressure 与断连边界。
发现 Fatal/Major 必须立即停止；R2 完成后仍需落盘 checkpoint 并交 Codex 验收，
不得自动进入 R3。

