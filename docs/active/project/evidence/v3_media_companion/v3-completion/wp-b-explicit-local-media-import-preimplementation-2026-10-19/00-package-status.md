# WP-B 显式本地视频导入实施前冻结包

日期：2026-10-19  
坐标：`V3 post-R7 / WP-A PASS / WP-B explicit local media import / preimplementation`  
状态：`PREIMPLEMENTATION PASS / WP-B IMPLEMENTATION MAY START`

## 事实基线

- WP-A 已通过单次 Codex checkpoint：A01-A24 `24/24`、A23/A24 真数据通过、v11 `50/50 + 16/16`。
- 自动字幕、受控下载与公开字幕均失败时，产品诚实进入 `awaiting_capture`，且不会静默启动 experimental tabCapture。
- `TaskArtifactSandbox` 已提供私有任务目录、2 GiB 视频上限、流式复制、SHA-256、原子发布和终态清理。
- 当前没有用户可达的本地视频接续入口；这正是 WP-B 的唯一产品缺口。

## 本包冻结内容

1. 一次显式单文件选择的用户体验与非目标。
2. `LocalMediaImportManager`、认证 loopback API、既有沙箱/SourceAuthority/ASR/视觉链路的所有权。
3. 两个公共 JSON Schema、一个内部 durable schema、五个 fixture、资产 registry、18 个失败码与状态机。
4. B0-B8 实施顺序、B01-B30 固定验收矩阵和反假绿规则。
5. 唯一 ClaudeCode 实施 goal、证据目录与停止条件。

## 不授权

- 默认本地文件访问、目录扫描、路径输入、拖入目录、历史文件自动恢复。
- 原始视频/音频云上传、知识库自动导入、Provider 接收文件名或路径。
- 修改 WP-A、relay v11、Cookie、SourceAuthority 身份语义或 tabCapture 支持级别。
- 以 WP-B 宣布 V3 全阶段 PASS、进入 WP-C、commit 或 push。

首轮独立 Codex 审查及一次 focused recheck 的全部意见已集中闭环；最终 verifier `95/95`、Archify showcase `9/9`、Fatal/Major/Minor=`0/0/0`。ClaudeCode 仅可按 `10-codex-implementation-gate.md` 与唯一 goal 实施 WP-B。
