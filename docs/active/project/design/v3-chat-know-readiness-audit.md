# V3 Chat + Know 文档与目标内部审查

日期：2026-10-07  
审查性质：文档、现有代码入口和确定性原型的内部只读复核；未实施产品代码。  
结论：`TARGET APPROVED / ADDITIVE PLAN CORRECTED / IMPLEMENTATION REMAINS PER-STAGE GATED`

## 1. 审查对象

- `01-prd.md`
- `02-architecture.md`
- `03-development-plan.md`
- `04-acceptance-plan.md`
- `interaction-prd/窗口交互_PRD.md`
- `design/v3-chat-know-product-convergence.md`
- `design/v3-chat-know-development-plan.md`
- `design/v3-chat-know-acceptance-plan.md`
- `design/v3-chat-know-risk-adr.md`
- `design/v3-chat-know-l0-architecture.json`
- `design/v3-chat-know-l0-architecture.html`
- `design/v3-chat-know-target-review.html`

## 2. 代码事实对照

| 事实 | 现状判断 | 文档处置 |
|---|---|---|
| Side Panel 仍有 Chat/Know/Agent/Debug/Set 并列入口 | 偏离新目标 | 在原 V3-5 集成阶段追加 Chat/Know 一级、Settings 辅助的产品收敛验收 |
| Agent 页面显示 disabled/no AgentTask | 仅占位 | V5+，不得计 V3 完成 |
| LocalRuntimeAccess 仍存在手工 token 交互 | 不满足一次配置 | V3-1.4 增量实现一次配对与短时会话 |
| Know 已有列表、详情、Graph、Permission、Forget 等 UI | 容器/候选不等于真实服务 | V3 只承诺真实 CRUD/标签/排序/归档；高级能力进 V4 |
| B站会话、媒体、SenseVoice、capture 已有大量候选 | 可复用但未完成总产品闭环 | 保留在原 V3-2..V3-4，并通过 V3-4.1 接入 Chat/Know |

## 3. 独立一致性轮次

### Round 1：规格边界

- Chat、Know、Settings、Agent 四者责任无重叠。
- Runtime 启动权威统一为桌面图标；“自动启动/浏览器同生命周期”已从当前权威撤销。
- V3/V4/V5/V6 分工明确，未把历史 Mock 或 LIMITED PASS 放大为产品完成。
- 结果：Fatal 0 / Major 0 / Minor 2。

Minor：历史正文仍保留旧 Media Companion 与 Agent 路线描述；已通过每份主文档顶部权威指针解决解释优先级，不能删除历史审计事实。旧文件名仍含 V1/V3 Media，不影响当前权威，但未来可在归档阶段统一命名。

### Round 2：架构与实现可行性

- L0 只有一个知识写入路径：Evidence → KnowledgeDraft → 用户确认 → KnowledgeItem。
- 页面和视频共享 ContextEnvelope/证据模型；门户扩展点不依赖 B站专用字段。
- 浏览器不具备任意启动本机进程的能力，文档没有作此错误承诺；设置页启动入口被限定为已安装伴侣的可信点击桥，缺失时回到桌面图标。
- Agent 只能未来读取受治理接口，不反向定义 V3 合同。
- 结果：Fatal 0 / Major 0 / Minor 1。

Minor：显式启动桥采用 URI handler 还是薄 Native Messaging bridge 尚未冻结；该问题被绑定到 V3-1.4 文档/spike，不阻断当前产品方向，但阻断 V3-1.4 实施。

### Round 3：验收与防假绿

- G1..G6 均包含用户场景、操作步骤和量化/明确门槛，没有“三无验收”。
- 真实网页与真实 B站必须同 build 验证；Mock、跨 run 拼接、无确认写入和媒体子链放大声明均为 No-Go。
- 人类只验证体验和可信度，不承担 ASR 听写、合同、清理或秘密扫描。
- 结果：Fatal 0 / Major 0 / Minor 0。

### Round 4：原 V3 计划继承复核

- `V3-0..V3-7` 继续作为技术主干；原媒体、SenseVoice、tabCapture、视觉、Outline/TaskStore、12 页分母、H01-H10 和最终审计均保留。
- 新增工作包仅为 `V3-0X` 产品收敛、`V3-1.4` 本机伴侣和 `V3-4.1` KnowledgeDraft/Know 投影；V3-5..7 只追加分母。
- 已通过阶段不重复开发；失败阶段从原停止记录恢复；任何新验收不得抵消旧失败。
- 结果：Fatal 0 / Major 0 / Minor 0。

## 4. 原型与架构验证

- Archify `showcase` validation：9/9 checks，composition errors=0、warnings=0、proper crossings=0。
- Archify delivery：spec SHA-256 `43b4d1a7aa28ea657c2dc157e61f9fb3ceae0ee7e5dfe6e5007f108ab280db12`；HTML SHA-256 `05b23a9a7a9d5f36baabb36e6a99fa5fe916db80c3223a9eedba0c1bfa213eb4`。
- Archify browser visual-check：1440x900、1600x1000、1920x1080、2048x1320 四个桌面视口 containment/readability/viewer chrome 全 PASS，横向溢出为 0；明暗主题截图已生成。感知质量仍由本轮人类页面审查签署。
- 目标审查页实跑：1440x1000 与 390x844 均 `scrollWidth == clientWidth`；Chat/Know/Settings 切换正常。
- 基线截图与目标原型分开标注；原型不声称连接了真实 Runtime 或真实知识库。

## 5. 当前风险与批准边界

当前产品方向已获用户确认，且没有 Fatal/Major 文档缺口。仍须按原阶段门禁顺序实施：

1. `V3-1.4` 实施前须冻结启动桥技术路线、安装/升级/卸载、配对与会话合同，并完成独立文档审查。
2. 既有 `V3-2.4a -> V3-2.5..7 -> V3-3 -> V3-4 -> V3-5 -> V3-6 -> V3-7` 顺序保持；新增 `V3-4.1` 在 V3-4 后接入，V3-5..7 追加 Chat/Know 分母。
3. 每个未完成子阶段继续遵守单独开发计划、验收计划、实施前审计和出门审计；已通过阶段只做兼容回归，不重复开发或伪造新 PASS。

明确不做：修改产品代码、运行生产 V3 collector、重新封存历史 run、声明 V3/PX/V4/Agent 完成。
