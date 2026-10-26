# V3 完成态架构与所有权

## 1. 产品完成态

V3 一级产品域为 `Chat + Know`，`Settings` 为辅助入口，`Agent` 在 V5+。B站视频理解是 Chat 当前上下文的一种 `MediaPortalAdapter`，不是独立事实系统。Runtime 由用户通过桌面“Navia 本机伴侣”显式启动；扩展不自动启动或绑定浏览器生命周期。

权威图：

- `docs/active/project/design/v3-completion-execution-architecture.html`
- `docs/active/project/design/v3-completion-execution-architecture.json`
- `docs/active/project/design/v3-chat-know-l0-architecture.html`
- `docs/active/project/design/v3-media-companion-gap.drawio`

## 2. L0 数据流

```text
用户显式动作
  -> Chrome Side Panel / Media Workspace
  -> WebPageAdapter | BilibiliMediaPortalAdapter
  -> Local Runtime API（exact Origin / short session）
  -> Source Authority + MediaTaskStore（单 sourceIdentity 单权威任务）
  -> Acquisition（subtitle -> credential media ASR -> public subtitle -> trusted tabCapture ASR）
  -> Evidence Catalog（transcript / OCR / selected frame / vision caption）
  -> Grounded Comprehension（brief / chapter / claim / relation）
  -> Workspace Views（overview / outline / timeline / concept graph / export）
  -> KnowledgeDraft
  -> 用户显式确认
  -> KnowledgeItem
```

## 3. 所有权不变量

| 实体 | 唯一所有者 | 不允许 |
|---|---|---|
| sourceIdentity -> active task | Runtime Source Authority | Side Panel/runner 私造第二任务 |
| 产品终态 ready/degraded | SQLite MediaTaskStore | completed frame 或内存状态冒充成功 |
| Runtime capture WebSocket | Background service worker | Offscreen 直接联网 |
| 音频生产/downsample | Offscreen document | 保存产品成功或调用 Runtime API |
| 同步 staging barrier | Runtime capture handler | worker 在 barrier 前启动 |
| barrier 后 cleanup | Transcript service/recover coordinator | handler 与 worker 双重清理 |
| evidence claims | Runtime grounded projection | renderer/LLM 自造 evidence ID |
| UI 布局 | 前端 workspace | UI 布局成为内容事实源 |
| Provider 选择 | 用户设置 + task snapshot | 隐式 fallback/跨 Provider 拼接 |
| KnowledgeItem 创建 | 用户确认事务 | Chat 自动保存 |

## 4. Relay v10 时序

```text
trusted click
 -> controller creates one-shot capture session
 -> Offscreen captures/downsamples
 -> exact-sender Port sends bounded Base64 PCM with credit
 -> Background owns Runtime WebSocket
 -> Runtime synchronous stage: copy + fsync + hash + WAV shape
 -> owner.json O_EXCL temp + file fsync + atomic replace + parent fsync
 -> SQLite FULL ownership receipt binds manifest canonical SHA-256
 -> async transcript worker may start
 -> acquisition succeeded
 -> Side Panel product effect materializes
 -> SQLite commit ready|degraded
 -> UI observes terminal; terminal frame is notification only
```

## 5. 版本和 fence

- consent policy revision、transcript projection revision、outline/workspace product revision 是三个独立域；域内单调，禁止强求跨域相等。
- `taskId`、`sourceIdentity` 在字段存在的层之间必须一致。
- stale response、旧任务晚到和 revision conflict 必须 fail closed，不得覆盖新权威。
- 旧任务保持只读兼容；新授权或新来源创建 fresh task，不拼接旧证据。

## 6. 扩展性

门户能力通过 adapter 合同表达：身份解析、权限、可用采集路线、seek 和来源 metadata。V3 只验收 B站；YouTube、小红书等后续 adapter 不能继承 B站权限、Cookie、样本或 PASS，但不得要求重写 Runtime evidence/comprehension/workspace 主链。

## 7. 架构停止条件

出现以下任一项，ClaudeCode 立即停止并交回 Codex：

- 需要修改公共 API、公开 schema、Origin、ticket TTL、Cookie/provider 合同；
- 新增第二编排者、第二事实库或 renderer 事实源；
- 需要上传原始音视频、Cookie、密钥或未授权帧；
- 需要弱化 Chrome 116 sender 身份、cleanup、revision fence 或 secret scan；
- 需要把 V4/V5 能力提前计入 V3。
