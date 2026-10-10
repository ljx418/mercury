# V3 Media Companion 内部文档审计第一轮

日期：2026-09-16  
范围：V3-0 PRD、架构、开发/验收计划、Stage Gate、组件/路由设计、风险 ADR、合同、fixture、交互原型和 8 页 Draw.io。  
边界：仅审计并修订文档与审查原型，未修改或运行 V3 产品实现。

## 1. 审计问题与闭环

| ID | 级别 | 发现 | 处置 | 当前状态 |
|---|---|---|---|---|
| R1-M01 | Major | PRD/架构/开发计划仍残留“VLM/OCR 延后到 V3.x”和旧 `V3.0-*` 实施输入 | 统一为 V3 B站首版：字幕、本地 ASR、关键帧、本地 OCR、授权云端 VLM；旧工作包明确废止 | CLOSED |
| R1-M02 | Major | 3 个 semantic case 指向不存在的 `validation.*`，时间线 case 不能对正例执行 | Schema 增加 `ProductionValidationInputs`；positive 增加实际字段；所有 case 改为可执行路径 | CLOSED |
| R1-M03 | Major | fixture 无封闭 requirement registry，跨 task 身份、duration 和 completed/failure 未覆盖 | 建立 18 项 registry/case；5 schema + 13 semantic；增加唯一失败码和确定性算法 | CLOSED |
| R1-M04 | Major | BiliNote 研究仍使用 `MediaIngestRun`，且知识服务/云端画面边界与当前 V3 不一致 | 统一为 `MediaTask`，补关键帧/OCR/VLM 链路，并固定 V3 本地 Store/V4 导入边界 | CLOSED |
| R1-m01 | Minor | 原型存在嵌套 `main`、禁用按钮视觉不清、离线 HTML 的 Lucide 内联冲突 | 改为单一 `main`；增加 disabled 状态；生成已静态内联 SVG 和图片的自包含审查页 | CLOSED |
| R1-m02 | Minor | 12 页分母可能被重复 URL 占位，V3-3 表格把 10 OCR 和 8 VLM 写成同一阈值 | 固定 12 个唯一 URL、互斥主分类；明确 10 OCR / 至少 8 真实 VLM | CLOSED |

## 2. 机器复核

- Draft 2020-12 Schema meta：PASS。
- contract positive root：1/1 PASS。
- requirement registry/case：18/18，ID、key、layer、failureCode 集合精确相等。
- Schema negatives：5/5 实际 invalid。
- Semantic negatives：13/13 变异后仍 Schema-valid，留给冻结算法按唯一 failureCode 拒绝。
- Draw.io：8 页；每页 ID 唯一；0 broken edge reference；0 越出 1600x900。
- 原型真实 Chrome：360/420 Side Panel 与 768/1280 Workspace 均匹配目标宽度；主流程可键盘激活；Axe violations=0；console/page error=0；移动审查页 0 横向溢出。
- 自包含原型：4 张图像均可解码，静态 Lucide SVG 可见，授权、任务完成、Workspace 和反馈表可操作，console/page error=0。
- 产品代码边界：本轮变更仅在 `docs/` 与顶层 README 文档范围，V3 产品模块仍 `NOT_IMPLEMENTED`。

## 3. PRD 与架构检视

- Side Panel 仅承担识别、授权、启动、进度、取消和快速摘要；Workspace 承担完整大纲、时间线、Mindmap、Ask、证据、历史和导出。
- 前端只经 `runtimeClient -> Runtime -> Adapter/Governance`；不得直连 B站媒体接口、ASR、OCR、VLM 或 V4。
- `VideoOutline` 是图文、时间线和 Mindmap 的唯一语义源；Ask 与反跳只消费同 task evidence。
- 持久产品授权不替代每次可信 capture 点击；原始音频和非证据帧清理失败阻止成功终态。
- V2/PX-6/RKM 保持暂停且未完成；Query、Graph、Durable Forget、知识导入和维护只属于 V4。

## 4. 第一轮结论

修订后：Fatal=0，Major=0，Minor=0。第一轮仅判定内部一致性通过，不等于独立外审或 V3 产品代码授权。

