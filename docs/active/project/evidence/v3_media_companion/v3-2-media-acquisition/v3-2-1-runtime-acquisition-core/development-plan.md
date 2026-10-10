# V3-2-1 Runtime Acquisition Core 开发计划

日期：2026-09-22  
状态：`AUTHORIZED`（依据用户本轮“继续下一阶段的开发实现”）

## 1. 目标与用户结果

建立媒体任务的单一 Runtime 事实源。用户发起任务后，Side Panel/Workspace 后续都只能读取同一个 task；取消必须先终止工作并清空任务私有文件，再显示 cancelled。该阶段不连接 B站下载器，不声称已获得字幕或媒体。

## 2. 实施顺序

| 子阶段 | 代码实体 | 出门条件 |
|---|---|---|
| `2-1-0` | SenseVoice policy/fixture 与 49-case audit | 49/49；旧失败证据不改写 |
| `2-1-1` | `TaskArtifactSandbox` / owner manifest | 0700/0600、配额、随机目录、路径/链接拒绝 |
| `2-1-2` | `MediaAcquisitionCoordinator` | create/get/cancel；同 task 幂等；身份冲突拒绝；单一终态 |
| `2-1-3` | cancellation hooks / cleanup barrier | hook 完成后清理；残留时不得返回 cancelled |
| `2-1-4` | startup orphan cleanup | 只删除受控 root 下有效 Navia owner manifest 目录；未知目录保留 |
| `2-1-5` | Runtime API | POST/GET/DELETE 冻结路径；closed request；公共响应无路径/秘密 |
| `2-1-6` | 真实文件与回归 | 私有真实 B站 WAV 字节进入沙箱后取消并归零；全量测试 |
| `2-1-7` | PRD review / exit audit | Fatal=0/Major=0；只允许 V3-2-2 规划审计 |

## 3. 文件边界

- 新增：`navia_runtime/modules/media_companion/acquisition/`。
- 修改：`navia_runtime/app.py`，只接入三条 acquisition API 和受控 root。
- 新增对应 Runtime tests 与本阶段 evidence。

不修改 Browser Cookie transport、B站页面 adapter、下载器、ffmpeg、ASR 推理、前端 capture 或 V2/PX/RKM。

## 4. 失败策略

任意路径越界、symlink/hardlink、超过配额、身份冲突、取消 hook 失败、清理残留或启动扫描越权均 fail closed。不得把本地 fixture 成功升级成 V3-2 production pass。

