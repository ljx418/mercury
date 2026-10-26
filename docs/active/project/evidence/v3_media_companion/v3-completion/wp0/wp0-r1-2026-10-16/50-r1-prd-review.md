# WP0 R1 PRD 检视（2026-10-16）

Candidate: `wp0-r1-2026-10-16`
结论：**`R1 NO-GO / 1 Major OPEN`**。R1 实施与自验证完成，但冻结 v10 证据
与 R1 迁移目标结构性冲突，须 Codex 处置后方可出门。

## 1. `04-prd-coverage-matrix.md` 覆盖

| 权威范围 | WP0 交付 | 本轮实际 | 判定 |
|---|---|---|---|
| V3-2 trusted tabCapture ASR + SenseVoice + cleanup | WP0 canary | R1 只做 transport 所有权迁移；S3-voice/canary 属 R5 | 未到 R5，N/A |
| V3-4 单 TaskStore/Outline、同 task/revision | WP0 提供权威基础 | Runtime barrier 测试证明 worker 不早启、owner 唯一 | ✓ |
| G3 B站 Chat、真实 route、0 残留 | WP0-WP5 | R1 未进入真实 run | 未到 |

本轮只推进 R1 transport，不推进任何 PRD 范围的阶段结论。

## 2. 所有权不变量对照（`02-target-architecture-and-boundaries.md §3`）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background service worker | Background 唯一 `new WebSocket`；Offscreen 0 处 | ✅ |
| Offscreen 直接联网（不允许） | 无 `fetch` / `XMLHttpRequest` / `sendBeacon` / WS | ✅ |
| 音频生产/downsample 归 Offscreen | getUserMedia / AudioContext / downsample / PCM16 保留 | ✅ |
| 同步 staging barrier 归 Runtime capture handler | 既有实现 + 新增确定性测试 | ✅ |
| barrier 后 cleanup 归 transcript service，handler 禁止再 cleanup | `app.py:1045` terminal 移交 + 测试证明幂等 | ✅ |
| 唯一 durable 产品终态为 SQLite `commit_terminal(ready|degraded)` | 本轮未触及 | 未到 |
| restart marker 五阶段、TTL 不刷新、字段最小 | 单元测试逐字段断言 | ✅ |
| 停止顺序 quiesce → drain → stopped → finalize | 单元测试断言 stop 前不发 Runtime stop | ✅ |
| 超限必须 enqueue 前 abort，禁止静默丢块 | `admitChunk` 在入队前；两上限各一例 | ✅ |
| 正常停止不得在 Offscreen stopped 前 finalize | 顺序断言 | ✅ |

## 3. 合同不变性

| 合同面 | 本轮动作 | 判定 |
|---|---|---|
| 公共 API / 公开 schema | 未修改 | ✅ |
| Runtime endpoint / Origin / ticket TTL | 未修改 | ✅ |
| Cookie / provider 合同 | 未修改 | ✅ |
| BVID 分母 | 未修改 | ✅ |
| grounded comprehension / SourceAuthority | 未修改 | ✅ |
| Side Panel materialize ownership | 未修改 | ✅ |
| 冻结 FailureCode registry（40 source / 20 target） | 未修改 | ✅ |
| 验收阈值 | 未修改 | ✅ |
| 40/20 registry 本身 | 未修改（但 verifier 因 2 文件哈希漂移报 45/50） | ❌ 见 §4 |

## 4. 严重度

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| **Major** | **1** | 冻结 v10 fixture 把 R1 必然要改的两个文件钉进 11-scope；verifier 跳过漂移文件 → 45/50 + 14/15；4 个新 relay 模块触发 unlisted emit |
| Minor | 2 | ① `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 真实删除；② 1 个既有 Controller 用例原断言越权行为，已按新合同改写并补 2 个顺序用例 |

## 5. 需 Codex 裁定

1. 重新冻结：更新 2 个漂移文件哈希 + 把 4 个新 relay 模块加入 11-scope +
   重算 40-code inventory；
2. `V3_MEDIA_CAPTURE_AUDIO_CONTEXT_SUSPENDED` 的去留（是否可由
   `RELAY_FAILURE_CODES.AUDIO_SHAPE_INVALID` 取代）；
3. 是否接受 `MediaCaptureController.test.ts` 按新合同改写。

## 6. 未启动事项声明

- R2–R7 未启动
- WP1 / Stage A / 六视频 fresh run 未启动
- Provider 请求 0 次
- 可见 Chrome / 原生权限弹窗 / 焦点抢占 / UIAutomation 均未执行
- 未宣布 PASS，未承担独立外审，未 commit / push
