# V3-2-0b 内部文档审查第二轮

日期：2026-09-22。审查视角与第一轮分离为：PRD 规格映射、架构可实现性、交互/可访问性、供应链与 false-green。该分离是逻辑独立，不构成组织独立；外部 Claude Code CLI 复审仍必要。

## 1. 结论

`DOCUMENT CANDIDATE READY FOR EXTERNAL AUDIT`。Fatal=0、Major=0、Minor=3。当前不授权实施。

## 2. PRD 与范围

- 保留既有三样本、30s..150s、24 bin、双 reviewer=48 判断和 44/48、每样本 15/16、critical=0、neither=0；没有降低失败门槛。
- 人类只做匿名机器结果比较，不承担听写、文本修正或模型安装诊断。
- Tiny 是默认低资源兜底；Small 是失败基线；Paraformer Q8 仍是 `document_candidate_not_qualified`，不存在提前成功声明。
- V3-2-1..7 继续 NO-GO；0b 通过最多允许返回 A06 复验。

## 3. 架构与开放性

- 单向链路为 `Settings -> AsrModelManager -> AsrProviderRegistry -> ProviderAdapter -> NativeAsrProcessHost -> TimestampedTranscript`。
- 前端只传 modelId/jobId；不接触 URL/hash/path/class/argv；native 进程无 shell，固定 argv，最小环境，进程组清理。
- Provider 与 Portal 正交。B站、YouTube、小红书只能经 `TaskAudioRef` 输入；每个平台的媒体获取、Cookie/permission 和真实矩阵保持独立。
- 机器状态分开：manifest 文档生命周期、catalog quality 状态、installation 状态和 effective fallback 不互相冒充。

## 4. 交互与验收

- 自包含 HTML 含真实 V3-2-0a 基线截图、目标架构、设置组件、安装/取消/离线恢复、匿名比较、操作路线、组件映射和人类方向回填。
- 四视口无根溢出；Axe serious=0/critical=0；AX tree 有 main、20 个 heading、19 个 button；焦点进入弹窗并在关闭后返回触发按钮。
- 精确展示 Windows/Linux 下载量；磁盘/RSS 是政策上限并标明实测待定，不把预算写成实测。
- 验收计划 A01..A18 每项都含场景、操作和必须结果；失败时回退 Tiny 并保持后续阶段阻塞。

## 5. False-green 与供应链

- Schema 支持 production candidate，且 `passed=true` 的四个核心阈值由条件 Schema 约束。
- Semantic validator 必须从两份不可变 review 重算 48/24 唯一键和 numerator，不信任 summary。
- runtime/model/VAD 的 URL、revision、bytes、SHA-256、license 均冻结；本轮只冻结元数据，没有声称资产已下载或运行。
- 原始音频、Cookie、private path、argv 和 secret 不进入公开证据；cleanup 在终态前完成。

## 6. Minor

- M-1：官方资产哈希来自当前元数据核对，仍须在实施 0b-0 实际下载后逐字节复算；这是实现门槛，不是文档缺口。
- M-2：原型完成 Chrome AX tree 与 Axe 自动检查，但未由真实屏幕阅读器用户操作；实施出门的人类 UX 验收需补充。
- M-3：两轮内部审查由同一自动化代理完成，只有逻辑视角隔离，没有组织独立性；必须提交 Claude Code CLI 外审。

## 7. 决定

允许重建不超过 20 文件的外部文档审计包；禁止进入 V3-2-0b 产品实现。外审 Fatal=0/Major=0 后仍必须由用户另行明确授权。
