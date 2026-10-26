# Stage B DeepSeek 严格结构适配器实施出门记录

日期：2026-10-14。结论：**DS-1..DS-5 LIMITED PASS；B-5 尚未启动。**

## 1. 研究结论

| 路径 | 结果 | 决策 |
|---|---:|---|
| DeepSeek Chat JSON Object | 0/3 Schema-valid | 禁止用于 Stage B |
| DeepSeek beta strict tool 初测 | 3/3 Schema-valid | 进入资格复测 |
| DeepSeek Responses JSON Schema 初测 | 3/3 Schema-valid | 保留为候选，不接入本轮生产 |
| 固定 `deepseek-chat + beta strict tool` | 20/20 Schema-valid | 批准严格适配器 |
| 新适配器真实合成数据请求 | 1/1，单次成功 | 生产请求封装可用 |

严格工具保证受支持 Schema 子集中的字段、类型、必填项和枚举；长度、时间覆盖、事实正确性与证据蕴含仍由本地 Schema 和 Stage B 语义验证器负责。不得把结构成功描述成内容正确。

## 2. 已实现

- `DeepSeekStrictGroundedSynthesisProvider`：强制 `/beta/chat/completions`、`strict=true`、固定命名 tool call。
- 任务白名单：分块候选、V2 合成、两类 V2 修复、证据问答；未知任务在网络前拒绝。
- evidenceId 被编入任务 Schema 枚举；额外字段、缺 tool call、非法 JSON、本地 Schema 失败均拒绝。
- 普通 `message.content` 即使包含合法 JSON 也不读取，不存在 JSON mode fallback。
- Settings 中 DeepSeek 的“测试”升级为严格结构能力测试；只有 `deepseek-chat` 可获资格标记。
- 媒体 factory 默认仍使用已验证 MiniMax。仅当用户在 Settings 的 Chat Provider 中手动选择带严格资格标记的 DeepSeek 时，任务才锁定 DeepSeek。
- 保存 DeepSeek 配置不自动选择；首次使用供应商展示保持中性。

## 3. 实施中发现并关闭的问题

首次生产封装合成请求返回字段结构正确，但 `brief.text` 为 157 字，本地 `maxLength=100` 正确拒绝。根因是旧通用提示的“summary 2 至 4 句”与 Stage B brief 20 至 100 字冲突。适配器增加 Stage B 任务优先约束后，真实合成请求一次成功：brief 36 字、claims 3、chapters 3。合同未放宽，失败关闭路径保持。

## 4. 自动化验收

- Provider/Settings/Stage B/vision 后端：60 passed。
- DeepSeek strict 适配器正负例包含：命名 tool、无 content fallback、额外字段、未知任务、本地 Schema。
- 前端 Provider 选择与诊断：17 passed。
- TypeScript typecheck：PASS。
- WXT production build：PASS；仅保留既有大 chunk 警告。
- 未运行浏览器，未播放音频。
- 真实 DeepSeek 调用仅使用合成证据；真实项目视频、音频、截图、转写、OCR 上传为 0。

## 5. 下一门禁

B-5 必须等待用户在 Settings 中手动完成 DeepSeek 配置、选择 `deepseek-chat`、执行严格能力测试并显式切换。之后固定六视频必须以 fresh Runtime/database/profile/task 执行，单个任务不得混用 MiniMax 与 DeepSeek。若用户不切换，系统继续以 MiniMax 为默认，不允许自动 fallback 到 DeepSeek。

用户随后单独授权安全迁移与导入。结果见
`chat-provider-secure-secret-migration-and-deepseek-import-2026-10-14.md`：
DeepSeek 已写入 Windows Credential Vault、strict capability 已验证，但仍未选中；
MiniMax 保持默认。该授权仍不包含自动切换或真实项目派生文本上传。
B-6、B-7、Stage C/D 继续 NO-GO。
