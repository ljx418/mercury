# V3-2-4 trusted tabCapture 实现候选记录

日期：2026-10-07。状态：`IMPLEMENTATION CANDIDATE / REAL POSITIVE BLOCKED`。

## 1. 授权与范围

- 用户授权：`approved V3-2-4 trusted tabCapture implementation (V3-2-4-0..7 only)`。
- 授权文本 SHA-256：`de6faffa97305c894b8135cbd144254cae014cfe4c77e3d0dd290a920758b4f2`。
- 权限变化仅为 `tabCapture`、`offscreen`；host permissions 未变化，不含 `<all_urls>`。
- 未修改 V3-2-3 sealed run，未运行旧 PX generator/validator。

## 2. 子阶段结果

| 子阶段 | 实现 | 自动验证 | 状态 |
|---|---|---|---|
| V3-2-4-0 | 公共 Schema、严格 message shape、三路失败顺序门槛 | Schema 合同与 61 项聚焦 Runtime 测试 | PASS |
| V3-2-4-1 | `MediaCaptureGrantService`、30 秒 256-bit one-shot ticket、严格 binding | replay/expiry/错 task-tab-page-adapter-surface 全拒绝 | PASS |
| V3-2-4-2 | `MediaCaptureController`、`MediaCaptureMessageRouter`、Side Panel/Workspace sender 边界 | 3 controller/router tests；content/page sender 拒绝 | PASS |
| V3-2-4-3 | WXT Offscreen `USER_MEDIA+AUDIO_PLAYBACK`、单例、原声回放图 | build 产出真实 offscreen HTML/JS；真实 stream 尚未验收 | PARTIAL |
| V3-2-4-4 | WebSocket 顺序 PCM、16k mono s16、task-private WAV、512MiB/900s 上限 | TestClient WebSocket + 真实 WAV header/frames；乱序/并发/abort 清理 | PASS |
| V3-2-4-5 | finalized WAV 绑定 `SenseVoiceTranscriptService`；tab close/navigation/cancel/timeout stop | 代码与替身链路通过；真实 B站 stream→SenseVoice 未执行 | BLOCKED |
| V3-2-4-6 | 双 surface 组件、键盘原生按钮、manifest/secret boundary、全量回归 | Runtime 486、frontend 298、typecheck/build、Chromium extension smoke | PARTIAL |
| V3-2-4-7 | PRD review、候选证据、风险停止 | 本轮文档已落盘；独立实施出门审计未开始 | BLOCKED |

## 3. 实现实体

- Runtime：`capture_grants.py`、`capture_sink.py`、`app.py` capture grant/eligibility/WebSocket endpoints。
- Extension：`capture/contracts.ts`、controller/router/client/card、Background 生命周期、Offscreen Document。
- UI：Side Panel 与 Workspace 均只在同 task 三条固定 route failure 完整且有序时渲染按钮。
- 安全：ticket/streamId 不进入 storage、generic proxy、SSE 或公开 grant；Background 对活动/唯一 B站 tab 重新计算哈希。

## 4. 已执行验证

```text
Runtime full: 486 passed
Frontend full: 41 files / 298 passed
Focused Runtime: 61 passed
Focused frontend: 2 files / 5 passed
TypeScript typecheck: PASS
WXT E2E build: PASS
Manifest audit: PASS
Chromium unpacked-extension smoke: PASS (service worker exposed)
```

## 5. 未通过边界

当前代码库没有生产 `MediaAcquisitionClient` 编排把以下动作连成同一用户任务：创建 acquisition task、执行前三路、写入三条权威失败、触发 UI eligibility。现有 V3-2-1..3 是 Runtime 能力与 runner 证据，Side Panel/Workspace 仍只建立 credential lease。若测试 runner 直接写 route failure 或用 query/storage 开关显示按钮，会绕过用户任务并造成 TC02/TC03/TC04/TC13 假绿。

因此本候选不能声明 V3-2-4 PASS，也不能进入 V3-2-5 实施。

