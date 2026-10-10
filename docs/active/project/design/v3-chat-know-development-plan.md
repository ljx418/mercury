# Navia V3 Chat + Know 开发计划

状态：`DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`  
前置权威：`v3-chat-know-product-convergence.md`

## 1. 总原则

- 原型优先，随后完成带参白盒、合同测试、冒烟和真实流程，再请求人工体验验收。
- 每个阶段单独落盘详细开发计划、验收计划、PRD 检视和审计意见；本文件只冻结总顺序与跨阶段边界。
- 既有 `V3-0..V3-7` 是唯一技术主干，全部计划、合同、实现、失败记录、LIMITED PASS 和固定分母继续有效。
- 本轮只增加产品收敛与整合工作包，不重新设计媒体获取、ASR、视觉证据、Outline/TaskStore，也不要求已通过阶段重新开发。
- 已有 V3 媒体实现统一作为 Chat 的 `MediaPortalAdapter(bilibili)`，这是产品归属调整，不是代码废弃或协议重写。
- 不修改已封存 V2/PX/V3 历史 run；新候选使用新目录和新 seal。

## 2. 既有计划保留矩阵

| 既有阶段 | 已有资产与状态 | 本轮处理 | 是否重做 |
|---|---|---|---|
| V3-0 | PRD、合同、原型、Draw.io、BiliNote 研究 | 增加 `V3-0X` Chat/Know 产品收敛附件 | 否 |
| V3-1.1..1.3 | PortalAdapter、会话能力、Credential Transport；1.3 PASS | `V3-1.4` 在其上增加桌面伴侣生命周期 | 否 |
| V3-2.0..2.3 | SenseVoice baseline、Acquisition Core、Route B3、全长转写；多项 LIMITED PASS | 原样复用，继续修复 V3-2.4a 并完成 2.5..7 | 否 |
| V3-2.4 | tabCapture 实现候选，TC13 失败 | 按既有停止记录进入 V3-2.4a | 只修复失败项 |
| V3-3 | Frame/OCR/VLM 文档候选 | 前序通过后按原计划实施 | 否 |
| V3-4 | MediaTaskStore/VideoOutline/Timeline/Mindmap 文档候选 | 前序通过后按原计划实施 | 否 |
| V3-5 | 双容器、Ask、Evidence、seek、export、H01-H10 | 保留全部分母，追加 Chat/Know 整合检查 | 不缩减，只扩展 |
| V3-6 | 12 页单 run、故障、隐私与 seal | 保留 12 页分母，追加网页/知识闭环绑定 | 不缩减，只扩展 |
| V3-7 | 最终独立审计 | 同时复算原媒体门槛和新增整合门槛 | 否 |

## 3. 增量工作包

### V3-0X 产品收敛冻结

交付权威 PRD 增量、L0 架构、交互原型、总开发/验收计划和风险 ADR。出门只允许用户批准下一阶段，不产生产品通过声明。

### V3-1.4 Manual Companion Runtime

在已通过的 V3-1.3 Browser-to-Runtime credential transport 上增加启动桥、配对句柄、状态与停止合同，再实现桌面启动图标、Runtime 状态 API 和设置页。不得改变 V3-1.3 的 exact-Origin、one-shot channel、短期租约和秘密隔离。白盒覆盖状态机与密钥边界；冒烟覆盖安装、启动、重启、停止；真实流程覆盖浏览器重启后无需重复配置但仍由用户显式启动。

### V3-2.4a..V3-2.7 原计划恢复

严格按既有 V3-2 停止记录修复 TC13 的 production route orchestration，随后完成双容器 transcript 状态、故障矩阵和 12 页出门。原 6+3+1+1+1、真实 trusted capture、清理与隐私门槛全部保留。

### V3-3 与 V3-4 原计划实施

依次实现关键帧/OCR/授权 VLM，再实现 MediaTaskStore、VideoOutline、Timeline 与 Media Mindmap。复用已审查的 Schema、fixture、威胁模型和验收编号；只有发现真实兼容缺口时才通过新 ADR 修改合同。

### V3-4.1 Chat Context + KnowledgeDraft + Know Projection

新增 `ContextEnvelope`、`KnowledgeDraft` 和最小 `KnowledgeItem` 投影。普通网页继续复用 V1 PageContext/Page Reading；视频直接引用 V3-4 的 VideoOutline/MediaTaskStore，不复制媒体事实。实现 Chat 内提取、预览、编辑、取消与保存，以及 Know 的真实列表、详情、标签、自定义字段、排序、归档与普通删除。移除产品路径中的 Mock 成功状态；重启恢复必须使用真实本地数据。

### V3-5 扩展整合

保留原双容器 renderer、Ask、Evidence、seek、export 和 H01-H10。增量收敛一级导航为 Chat/Know，Settings 作为辅助入口，Agent/Debug 不进入生产导航；增加普通网页→Chat、视频→Chat、提取→确认→Know 编辑→来源反跳。原 H01-H10 不改写，新增 `CX-H01..CX-H06` 核验 Runtime/Chat/Know 体验。

### V3-6 扩展生产候选

原 12 页 B站单 run 分母保持不变。在同一 build 追加普通网页固定样本、KnowledgeDraft/KnowledgeItem 事务、Runtime 手动生命周期、Chat/Know UI 证据；不允许用新增网页样本替换任何原 B站样本。继续执行故障矩阵、资源与清理、公开/私有隔离、secret scan 和 seal。

### V3-7 最终独立审计

同时只读复算原 V3-5 H01-H10、V3-6 12 页单 run 和新增 CX-H01..CX-H06/Chat/Know 分母。人类只核验安装/启动感受、Chat/Know 端到端体验、视觉层级和结果可信度；不得要求人类听写 ASR 或代做机器可完成的合同验证。

## 4. 唯一执行顺序

1. `V3-0X` 本轮目标、L0 和原型获得用户确认。
2. `V3-1.4` 本机伴侣详细文档、spike、审计与实现。
3. `V3-2.4a -> V3-2.5..7` 按原计划关闭媒体链。
4. `V3-3 -> V3-4` 按原计划实现视觉和 Outline/TaskStore。
5. `V3-4.1` 增加 ContextEnvelope、KnowledgeDraft 和 Know 最小真实投影。
6. `V3-5` 在原媒体产品验收上增加 Chat/Know 整合，不修改 H01-H10。
7. `V3-6 -> V3-7` 保留原 12 页生产与终审，追加而不替换新分母。

## 5. 兼容与停止条件

- 需要新增高风险系统权限、长期凭据或后台自启动。
- 真实数据门槛失败且只能通过降低阈值、换分母或跨 run 拼接通过。
- 已实现代码与 `ContextEnvelope/KnowledgeDraft/KnowledgeItem` 无法兼容且需改变产品目标。
- 任何变更要求删除、改写或用新分母替换原 V3-0..V3-7 合同和证据。
- V3-5 之前仍无法移除 Mock 成功状态或区分草稿与已保存知识。
