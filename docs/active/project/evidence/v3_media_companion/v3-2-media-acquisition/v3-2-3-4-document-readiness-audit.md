# V3-2-3 / V3-2-4 文档准备度内部审计

日期：2026-10-06。审查性质：当前实施代理的只读交叉核对，不替代外部独立文档审查。

## 1. 审查对象

- `v3-2-3-sensevoice-transcript-development-plan.md`
- `v3-2-3-sensevoice-transcript-acceptance-plan.md`
- `v3-2-3-sensevoice-transcript-threat-model.md`
- `v3-2-3-sensevoice-transcript-preimplementation-audit.md`
- `v3-2-4-trusted-tab-capture-development-plan.md`
- `v3-2-4-trusted-tab-capture-acceptance-plan.md`
- `v3-2-4-trusted-tab-capture-threat-model.md`
- `v3-2-4-trusted-tab-capture-preimplementation-audit.md`
- 上游 PRD §18.2/§18.4/§18.9、V3-2 合同/API 规格、机器 Schema、policy registry 与当前实现实体。

## 2. 一致性结果

| 检查 | 结果 |
|---|---|
| V3-2-3 只消费 V3-2-2 当前分 P artifact，不承担下载/capture/V3-3 | PASS |
| SenseVoice provider/engine/version/model/revision/weights 与 catalog、Revision 3 相等 | PASS |
| ST01..ST16 连续且无 N/A；全长 3/3、覆盖率、hash、取消、清理、隐私均有操作和结果 | PASS |
| 跨模型比较/智能回退继续留在 V4，Tiny 不得冒充本阶段正例 | PASS |
| V3-2-4 只在前三路机器失败后等待可信点击 | PASS |
| grant 30 秒/one-shot、Chrome>=116、Offscreen USER_MEDIA、900 秒、原声回放与停止条件和 policy 一致 | PASS |
| TC01..TC20 连续；真实 Chrome、真实点击、真实 stream、真实 SenseVoice 为正例 | PASS |
| H01..H10 未提前，仍只在 V3-5 | PASS |
| YouTube/小红书未继承 B站权限或通过声明 | PASS |
| 文档格式与 `git diff --check` | PASS |

## 3. 风险分级

- Fatal：0。
- Major：2，均为顺序门禁而非文档设计缺陷：V3-2-2 未通过，因此 V3-2-3 无权威音频输入；V3-2-3 未通过，因此 V3-2-4 不得实施。
- Minor：0。原 m-1/m-2 已关闭：新增 `v3_media_transcript_execution_v2.schema.json`、`v3_media_capture_stream_v1.schema.json`、统一 positive fixture 和语义负例测试；18 项合同/Revision 3 回归通过。

## 4. 决定

`DOCUMENT DIRECTION PASS / IMPLEMENTATION NO-GO`。

两阶段的范围、代码实体、交互、固定验收分母、威胁、机器合同和出门声明已足以进入外部文档审查。它们尚不足以授权代码：必须顺序关闭前序门禁，并在各阶段开始前重建不超过 20 文件的独立审计包取得 Fatal=0/Major=0。V3-2-4 还需用户针对冻结权限边界作明确高风险实施授权。

## 5. 当前允许动作

允许继续执行合同与文档的外部审查准备；禁止实现读取 V3-2-2 私有音频的转写服务、创建 capture ticket、调用 `chrome.tabCapture`、建立 capture WebSocket 或持久化任何原始音频。
