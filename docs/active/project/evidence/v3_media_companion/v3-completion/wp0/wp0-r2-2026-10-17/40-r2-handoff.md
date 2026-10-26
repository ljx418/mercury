# WP0 R2 Handoff（2026-10-17）

Candidate: `wp0-r2-2026-10-17`
阶段结论：**R2 AWAITING CODEX CHECKPOINT**。R3 未启动。
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r2-2026-10-17/`

## 1. changed files

### 新增

```
apps/chrome-extension/src/modules/media_companion/tests/RelayR2Invariants.test.ts
  0d93216835294261b370156e757b645d5cf5e317b398402fcee7da79d1133c27
```

### 修改

```
apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts
  476a9602b732328eee54e24bec0996d93bc8c6094c5ce53109972de4160708f3
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
  b38eb936ec3fab06cee4a5641e4cdde4ae8cf78b8e4f57bc70e97e77979ccda0
apps/chrome-extension/chrome-mv3-unpacked/**   （npm run build 产物）
```

### 明确未修改

冻结 source scope 内文件（`MediaCaptureController.ts`、
`media-capture-offscreen/main.ts` 等）**未修改** —— 这也是两个 v10 verifier
保持 50/50 与 15/15 的原因。`services/local-runtime/**`、冻结 schema /
fixture / contracts / 权威文档、`stage-b-six-video-registry.json`、
R0/R1 全部历史证据目录亦未修改。

## 2. 合同变化

- **内部合同变化**：有 —— owner（`RuntimeCaptureTransport`）新增采集
  时长上限 `maxCaptureMs` 与字节上限 `maxCaptureBytes` 的强制执行，复用
  既有冻结失败码 `DURATION_LIMIT` / `BYTE_LIMIT`，检查位置在入队之前。
- **公共合同变化**：**none**。

## 3. 全部命令与退出码

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | 0 | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | **194 / 194**（22 files） |
| 3 | `npx vitest run --maxWorkers=2` | 0 | **527 / 527**（66 files） |
| 4 | `npm run build` | 0 | PASS（Σ 4.66 MB） |
| 5 | `node --test …/relay_ownership_contract.node-test.mjs` | 0 | **28 / 28** |
| 6 | `pytest tests/test_wp0_r1_relay_barrier.py -q` | 0 | **6 / 6** |
| 7 | `pytest -k "capture or transcript or outline or fault or product" -q` | 0 | **180 passed** |
| 8 | `verify-...-v10-contract.py` | **0** | **50 / 50** |
| 9 | `verify-...-v10-mutations.py` | **0** | **15 / 15** |

## 4. 测试计数

| 类别 | 计数 |
|---|---:|
| R2 新增不变量测试 | **28** |
| 静态所有权合同（R1 25 + R2 3） | **28** |
| media_companion 子树 | **194**（22 files） |
| 扩展全量 | **527**（66 files） |
| Runtime barrier | 6 |
| Runtime focused | 180 |
| v10 baseline / mutation | **50 / 50** · **15 / 15** |

## 5. 真实 run / build / task / candidate ID

- 真实产品 run：**未执行**
- Chrome：**0 次**
- Provider 请求：**0 次**
- 六视频 fresh run：**未启动**
- task ID：**无**
- build：`npm run build` 已执行
- candidate ID：`wp0-r2-2026-10-17`（**非** immutable candidate；WP0 的
  immutable candidate 在 R7 产出）

## 6. PRD / 架构覆盖

见 `30-r2-prd-review.md`：`64-codex-r2-…` §1 的 8 项目标逐条验证；§2 的
「不重写已通过模块」遵守（8 项不变量 7 项无缺口，唯一缺口最小修改）；
架构不变量 12 项全部满足（其中「采集时长/字节上限由 owner 强制执行」
为本轮新增）。

## 7. cleanup / secret scan

- Chrome 0 次、Provider 0 次、六视频 0 次、真实产品 run 0 次
- 无 Cookie / API key / 凭据 / 原始音视频 / 绝对私有路径进入源码或证据
- R2 新增断言：Offscreen 消息序列化不含 ticket / sourceIdentity /
  acquisitionRecordId
- 未新增 token 持久化
- 全部测试使用 `os.tmpdir()` / `tmp_path` 沙箱并清理
- 结束前无遗留测试进程（见 §9）

## 8. Fatal / Major / Minor

| 级别 | 数量 | 内容 |
|---|---:|---|
| Fatal | 0 | — |
| Major | 0 | 8 项不变量全部验证；唯一真实缺口已修复并被测试与静态门禁双重锁定 |
| Minor | 0 | — |
| 待重冻结 | **0** | v10 50/50 + 15/15 保持绿（exit 0）；未修改任何冻结 source scope 文件 |

## 9. 本轮修正的唯一真实缺口

**采集时长与总字节上限从未被强制执行。**

- 冻结合同定义了 `maxCaptureMs: 900_000` 与
  `maxCaptureBytes: 536_870_912`；
- `RuntimeCaptureTransport` 累计了 `#capturedMs` / `#chunkCount` 却从未与
  这两个值比较；
- R1-C2-1 的 entrypoint 重写同时移除了 Offscreen 侧的 `MAX_CAPTURE_MS`
  本地计时器；
- 结果：产品中没有任何位置强制这两个上限。

**最小修复**：`RuntimeCaptureTransport.offerChunkMessage()` 在
`admitChunk` 与 `#queue.push` 之前各加一个 owner 侧检查，超限则
`#fail(DURATION_LIMIT | BYTE_LIMIT)` 并返回失败 —— 不存在静默截断或 drop。

## 10. 自动化开发停止原因

R2-0..R2-7 全部完成：8 项不变量逐条验证，1 项真实缺口（capture 上限未
执行）已最小修复并被单元测试 + 静态门禁双重锁定；自验证全部通过
（527/527 全量、194/194 子树、28/28 静态、6/6 barrier、180/180 focused、
typecheck 与 build 全绿），且两个 v10 verifier 保持 50/50 与 15/15，说明
R2 未修改任何冻结材料，无需再次重冻结。

按 `64-codex-r2-…` §5 与用户指令，在 R2 停止，状态
**R2 AWAITING CODEX CHECKPOINT**，不进入 R3。

## 11. 下一门禁

1. Codex 复核本轮实现与证据（尤其 capture 上限修复）；
2. Codex 明确 `R3 may start`。

在此之前不进入 R3，不宣布 R2 PASS。
