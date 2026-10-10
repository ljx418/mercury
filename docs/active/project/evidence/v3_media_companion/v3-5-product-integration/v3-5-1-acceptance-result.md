# V3-5-1 验收结果

日期：2026-10-08。结论：`PASS`。生产正例：`v3-5-1-real-20261008T135559Z`。

## 固定分母

| ID | 结果 | 证据 |
|---|---|---|
| S01 | PASS | 原生 Side Panel 可信点击启动，真实 B站 taskId 全链一致 |
| S02 | PASS | SenseVoice 真实转写完成；Materializer API 只接收 taskId |
| S03 | PASS | 1 个受控私有 transcript evidence JSON；公开结果无正文、绝对路径或凭据 |
| S04 | PASS | 无视觉证据时明确 `degraded / VISUAL_EVIDENCE_UNAVAILABLE` |
| S05 | PASS | 单元合同覆盖 terminal 幂等回读 |
| S06 | PASS | task/source/segment/body 负例 fail closed |
| S07 | PASS | Side Panel 显示本地 ASR 资源影响；临时媒体 0、ASR 临时文件 0 |
| S08 | PASS | 快速摘要来自 Runtime published outline，不在前端生成 |
| S09 | PASS | `#/media/tasks/:taskId` 打开同一 Runtime task |
| S10 | PASS | 终态明确；既有取消、失败、清理合同保持通过 |
| S11 | PASS | Runtime 590、Frontend 332、typecheck、build:e2e 全部通过 |
| S12 | PASS | 真实播放、可信 tabCapture、SenseVoice、Profile/安全临时根清理全部通过 |

机器摘要：[v3-5-1-real-chrome-result.json](v3-5-1-real-chrome-result.json)。原始 Cookie、音视频、转写正文、Runtime DB、浏览器 Profile、截图和运行日志均未进入审计材料。

## 失败尝试隔离

- 直接打开 `sidepanel.html` 的普通标签页被 `V3_MEDIA_POLICY_NOT_GRANTED` 拒绝，证明既有 sender 安全边界生效；该入口未用于正例。
- 一次通过运行暴露旧 residual 检查把持久私有 evidence JSON 当作临时媒体。最终门槛按文件类型区分：仅允许当前任务 `product-evidence/evidence/<taskId>/*.json`，音视频、帧、Cookie 文件和 ASR 临时文件仍必须为 0。
- projection v1 的未授权 `resources` 增量被全量回归拒绝并撤回；UI 使用冻结 SenseVoice 基线资源值，未修改 v1 Schema。

## 清理

最终 run 的结构化无敏感摘要已落盘。原始临时运行目录已删除；无过程截图、原始音频、视频或帧留存。
