# V3-2-5 实现出门自动审计

日期：2026-10-08。审计对象：V3-2-5 transcript 双容器产品管线及权威 run `v3-2-5-ui-20261007T155715Z`。

## 0. 决定

`V3-2-5 LIMITED PASS / V3-2-6 PREIMPLEMENTATION MAY PROCEED`。

- Fatal：0。
- Major：0。
- Minor：1。本轮实施与自动审计由同一代理连续完成，不具备组织独立性；V3-2.7 最终出门必须由不同 reviewer session 复核。

本决定只证明 V3-2-5 的 transcript 产品体验，不代表 V3-2、V3、OCR/VLM、VideoOutline、Mindmap、Ask 或导出完成。

## 1. 可复算事实

| 项 | 结果 |
|---|---|
| ProductUiAcceptance Schema meta | PASS |
| ProductUiAcceptance instance | 0 errors |
| 固定状态 | 5/5：acquiring、awaiting_trusted_capture、transcribing、cleaning、terminal |
| 产品表面 | 4/4：Side Panel 360/420、Workspace 768/1280 |
| requirement bindings | 14/14 |
| 真实 B站页面 | `BV13W41137qV` |
| trusted tabCapture | 真实用户激活后启动；播放未被中断 |
| Runtime task 一致性 | Side Panel 与 Workspace 读取同一 taskId |
| 取消与清理 | cleaning 可见；cleanup 后才 cancelled |
| 重试 | 新 taskId、新 lease/envelope 绑定；未复用旧 task |
| Axe | serious=0、critical=0 |
| 键盘主路径 | PASS |
| 公开 secret scan | 105 files / 4,207,449 bytes / 0 hit |
| Runtime 回归 | 573 passed |
| Frontend 回归 | 45 files / 311 tests passed |
| typecheck / production build | PASS / PASS |

## 2. 权威绑定

- 原始结果 SHA-256：`1f8c59558f38427901d62079ef2b5bc5c1429ea8eaaf03c1aa22cabd1ab712fe`。
- ProductUiAcceptance SHA-256：`aa2947d63ce24550765021868fb4fd22cbc7f44f4a513cdcabedf3ef610c2762`。
- build tree SHA-256：`e414e0adb6be56477de2639ad365b288c9f8b893d7de2f59e0de3c752c0a2a17`。
- 证据目录：`v3-2-5-real-chrome/runs/v3-2-5-ui-20261007T155715Z/`。

旧失败 run 只保留诊断价值，不参与拼接、不覆盖最终候选，也不作为通过依据。

## 3. 防假绿审计

1. 未使用 mock transcript 或 fixture 替代真实媒体、真实播放、真实 capture 与 SenseVoice 终态。
2. 未跨 run 拼接状态、截图、清理或 secret scan。
3. 未减少 A01..A14、四视口、五状态、Axe 或键盘分母。
4. `capturing` 由独立可信捕获检查证明，没有私自加入冻结的五态 Schema。
5. 取消以 Runtime cleanup receipt 为终态依据；前端计时只保证 cleaning 可感知，不制造清理成功。
6. 重试通过新 taskId 和不同绑定 hash 证明，没有复用旧 lease/envelope。
7. `PYTHONPATH=. pytest -q` 才是有效 Runtime 回归；缺少 `PYTHONPATH` 的收集错误没有被记为产品失败或通过。

## 4. PRD 与架构结论

- 符合 B站优先、Cookie 主路径、公开字幕与可信捕获回退的既有 V3 架构。
- Side Panel/Workspace 只读 Runtime `MediaTranscriptProjection`，未新增第二事实源。
- `adapterId/sourceIdentity/taskId` 保留门户扩展边界，没有把核心调度固化为 B站专用实现。
- SenseVoice 继续作为用户批准的 V3 基线；多 Provider 质量回退仍属于 V4。
- 原 V3-2.7 的 12 页 `6+3+1+1+1` 分母和 V3-5 H01..H10 均保持不变。

## 5. 下一门禁

允许进入 V3-2.6 F01..F14 故障与清理实现。V3-2.6 必须保证测试故障入口生产不可达、每个故障使用独立 task、唯一终态、终态后零写、零残留和双层 secret scan。

禁止直接进入 V3-2.7、V3-3，或宣称 V3-2/V3 整体完成。
