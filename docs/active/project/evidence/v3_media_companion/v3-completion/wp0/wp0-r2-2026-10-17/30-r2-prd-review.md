# WP0 R2 PRD / 架构不变量检视（2026-10-17）

Candidate: `wp0-r2-2026-10-17`
状态：**R2 AWAITING CODEX CHECKPOINT**

## 1. R2 八项目标逐条落实

| # | `64-codex-r2-…` 目标 | 验证 | 判定 |
|---|---|---|---|
| 1 | Offscreen 纯 producer，不持 Runtime URL/WS/ticket/binding/sourceIdentity/acquisition ownership | 静态门禁（无 WS / URL / ticket 等）+ 消息序列化断言 | ✅ |
| 2 | exact extension id、exact offscreen URL、无 tab、frameId absent-or-zero、documentId 首绑拒替换、incognito exact context | `RelayR2Invariants` 5 组正负矩阵 | ✅ |
| 3 | PCM 16kHz mono s16le，Base64 canonical，decoded length 精确且偶数字节 | `RelayR2Invariants` R2-2 四组 | ✅ |
| 4 | sequence 从 0 严格 +1；duplicate/gap/out-of-order fail closed | `RelayR2Invariants` R2-3 两组 + R1 transport 30 例 | ✅ |
| 5 | producer 仅 credit 后发送；Background 仅 Runtime ACK 后返 credit | `RelayR2Invariants` R2-3 三组 | ✅ |
| 6 | queue ≤ 32 chunks / 1,572,864 bytes，超限 enqueue 前 abort，禁止 drop | `RelayR2Invariants` R2-4 四组（含精确边界）+ 静态门禁位置断言 | ✅ |
| 7 | port/runtime disconnect、ACK timeout、chunk after stop 输出固定归一化 code | `RelayR2Invariants` R2-5 七组 | ✅ |
| 8 | 不恢复旧 session 的 PCM / ticket / sequence / credit | `RelayR2Invariants` R2-8 两组 + R1 restart 22 例 | ✅ |

## 2. R2 实施原则遵守情况

`64-codex-r2-…` §2 要求「先做代码与测试盘点，不得为完成 R2 重写已通过
模块」：

- 本轮**未重写**任何已通过模块；
- R2-0 盘点 8 项不变量，7 项**无缺口**，直接复用 R1 实现；
- 唯一真实缺口（owner 未强制 capture 时长/字节上限）做**最小修改**：
  `RuntimeCaptureTransport.ts` 新增 1 个计数器 + 2 个检查 + 2 个 getter；
- 修改文件总数 **3**（1 产品 + 1 新测试 + 1 静态门禁），均在允许范围内。

## 3. 架构不变量对照（`02-target-architecture-and-boundaries.md §3`）

| 不变量 | 本轮结果 | 判定 |
|---|---|---|
| Runtime capture WebSocket owner = Background | 不变；R2 未触碰所有权 | ✅ |
| Offscreen 直接联网（不允许） | 不变 | ✅ |
| 音频生产/downsample 归 Offscreen | 不变 | ✅ |
| 同步 staging barrier 归 Runtime handler | 不变；6 项 barrier 测试全绿 | ✅ |
| barrier 后 cleanup 归 transcript service | 不变 | ✅ |
| streamId 仅一次性 | R2-1 断言 streamId 只在 `start` 出现一次 | ✅ |
| 正常停止顺序 quiesce → drain → stopped → finalize | 不变 | ✅ |
| 超限 enqueue 前 abort，禁止静默丢块 | **本轮强化**：时长/字节上限也在 enqueue 前 abort | ✅ |
| 单一 capture control plane | 不变 | ✅ |
| restart 不恢复旧音频/票据/序列 | 不变 | ✅ |
| restart 通过真实 authenticated Runtime | 不变（R1-C3-01 已闭合） | ✅ |
| **采集时长/字节上限由 owner 强制执行**（本轮新增不变量） | transport 强制 `maxCaptureMs` / `maxCaptureBytes` | ✅ |

## 4. 冻结合同不变性

| 合同面 | 本轮动作 | 判定 |
|---|---|---|
| v10 schema / fixture / 40-source / 20-target registry | **未修改** | ✅ |
| FailureCode registry（20 码） | **未修改**（复用既有 `BYTE_LIMIT` / `DURATION_LIMIT`） | ✅ |
| 固定阈值 / 验收分母 | 未修改 | ✅ |
| 公共 API / Runtime endpoint / Origin / ticket TTL | 未修改 | ✅ |
| Cookie / provider 合同 | 未修改 | ✅ |
| BVID 分母 / grounded comprehension / SourceAuthority / Side Panel materialize | 未修改 | ✅ |
| 冻结 source scope 文件 | **未修改**（R2 只改 target relay 实现与测试） | ✅ |

两个 v10 verifier 保持 **50/50** 与 **15/15**（exit 0），证明未触发重冻结。

**内部合同变化**：有 —— owner 侧新增 capture 时长/字节上限强制执行。
**公共合同变化：none**。

## 5. 严重度与状态

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | 8 项不变量全部验证；唯一真实缺口已修复并被测试锁定 |
| Minor | 0 | — |
| 待重冻结 | **0** | 50/50 + 15/15 保持绿 |

## 6. 未启动事项声明

- R3 未启动；WP1–WP7 未启动
- Chrome 0 次；Provider 0 次；六视频 fresh run 0 次；真实产品 run 0 次
- 声音播放 0 次；可见 Chrome / 原生权限弹窗 / 焦点抢占 / UIAutomation 均未执行
- 未 commit / push / reset / clean / revert；dirty worktree 全部保留
- 未修改任何冻结材料；未宣布 R2 PASS
