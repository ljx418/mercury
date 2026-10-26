# WP0 R2 开发与验收交接

日期：2026-10-17  
前置状态：`R1 PASS`  
授权边界：仅 R2，不进入 R3

## 1. R2 目标

以现有 R1 实现为基线，完成并证明：

1. Offscreen 是纯音频 producer，不持有 Runtime URL、WebSocket、ticket、binding、
   sourceIdentity 或 acquisition ownership；
2. Background 对 Port sender 执行 exact extension id、exact offscreen URL、无 tab、
   frameId absent-or-zero、documentId 首绑拒替换、incognito exact context 校验；
3. PCM 为 16kHz、mono、signed 16-bit little-endian，Base64 canonical，decoded length
   与 `rawByteLength` 精确一致且偶数字节；
4. sequence 从 0 开始严格 +1；duplicate/gap/out-of-order fail closed；
5. producer 仅在 credit 后发送，Background 仅在 Runtime ACK 后返 credit；
6. queue 最大 32 chunks / 1,572,864 raw bytes，超限必须 enqueue 前 abort，禁止 drop；
7. port/runtime disconnect、ACK timeout、chunk after stop 均输出固定归一化 code；
8. 不恢复旧 session 的 PCM、ticket、sequence 或 credit。

## 2. 实施原则

R1 已实现大量 R2 基础能力。先做代码与测试盘点，不得为“完成 R2”重写已通过模块。
只有发现上述不变量存在真实缺口时才做最小产品修改。

允许范围优先限定在：

```text
apps/chrome-extension/entrypoints/media-capture-offscreen/main.ts
apps/chrome-extension/src/modules/media_companion/capture/OffscreenAudioPort.ts
apps/chrome-extension/src/modules/media_companion/capture/OffscreenProducerBootstrap.ts
apps/chrome-extension/src/modules/media_companion/capture/RuntimeCaptureTransport.ts
apps/chrome-extension/src/modules/media_companion/capture/audioChunk.ts
apps/chrome-extension/src/modules/media_companion/capture/relayContracts.ts
apps/chrome-extension/src/modules/media_companion/tests/*Relay*.test.ts
apps/chrome-extension/src/modules/media_companion/tests/Offscreen*.test.ts
scripts/stage_b_b5_3/test/relay_ownership_contract.node-test.mjs
R2 独立证据目录
```

禁止修改公共 API、Runtime endpoint、Origin、ticket、Cookie/provider、40/20
inventory、固定阈值和验收分母。若必须修改冻结 scope 内文件，完成实现后停止等待
Codex 重冻结，不得自行改冻结材料。

## 3. R2-0..R2-7

| 子阶段 | 内容 | 出门证据 |
|---|---|---|
| R2-0 | 现状盘点与缺口表 | 每项不变量映射到源码与测试 |
| R2-1 | exact sender/document binding | 正负 sender matrix |
| R2-2 | PCM/Base64 canonicalization | malformed/length/odd/oversize matrix |
| R2-3 | credit/ACK/sequence | first/duplicate/gap/no-credit/ACK 顺序 |
| R2-4 | bounded queue/backpressure | 32 chunks、byte cap、enqueue-before-abort |
| R2-5 | disconnect/timeout/stop boundary | fixed code、无 drop、无继续发送 |
| R2-6 | 双端 composition 与全量回归 | typecheck/test/build/static/baseline/mutation |
| R2-7 | receipt、PRD review、handoff | Fatal/Major/Minor 与停止原因 |

## 4. 固定验收

- v10 baseline `50/50`、mutation `15/15`；
- extension typecheck；
- media companion 子树与 extension 全量 Vitest，资源受限时 `--maxWorkers=2`；
- extension build；
- relay ownership static gate；
- Runtime barrier 6/6 与 focused pytest；
- 不启动真实 Chrome、Provider 或六视频；若新发现必须使用 Chrome，先通知用户，
  且启动参数必须包含 `--mute-audio`；
- 无 Cookie/API key/raw media/private path 进入公开证据；
- 结束时无遗留测试进程。

## 5. 证据与停止点

新建：

```text
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
  wp0-r2-2026-10-17/
```

至少包含 phase receipt、test results、PRD review、handoff、payload manifest。
完成后状态写 `R2 AWAITING CODEX CHECKPOINT`，停止等待 Codex；不得进入 R3。

## 6. ClaudeCode 提示词

```text
在 /mnt/c/workspace/navia 执行 WP0 R2，仅限 R2，不进入 R3。

先阅读 AGENTS.md、project-stage-workflow.md、05-wp0-relay-acceptance.md，以及：
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
wp0-r1-corrective-round3-2026-10-16/61-codex-r1-checkpoint-review.md
docs/active/project/evidence/v3_media_companion/v3-completion/wp0/
wp0-r1-corrective-round3-2026-10-16/64-codex-r2-development-and-acceptance.md

先盘点，复用 R1 已完成能力；只修真实缺口。逐项验证 exact sender、PCM/Base64、
sequence、credit/ACK、bounded queue、overflow-before-enqueue、disconnect/timeout/stop。
不得修改冻结合同；若必须改冻结 scope 文件，完成后停等 Codex 重冻结。不得启动
Provider/六视频，不得播放声音；若确需 Chrome，先通知用户并强制 --mute-audio。
不得 commit/push/reset/clean，保留 dirty worktree。完成后落盘 R2 独立证据，状态写
R2 AWAITING CODEX CHECKPOINT，然后停止，不得进入 R3。
```

