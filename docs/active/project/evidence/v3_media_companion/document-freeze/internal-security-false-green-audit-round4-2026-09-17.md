# V3 Media Companion 内部审计第四轮：安全、迁移与假绿拒绝

日期：2026-09-17  
方法：对 V3-0 候选执行对抗性静态审计、Schema/fixture 重算、BiliNote clean-commit 原始字节对账和跨文档门禁检查。  
边界：文档门禁审计，不是产品安全测试；未读取真实用户 Cookie，未运行真实媒体处理或模型 Provider。

## 1. 机器合同独立复算

| 项目 | 独立结果 |
|---|---|
| Draft 2020-12 Schema meta-validation | PASS |
| positive root | 1/1 PASS；`evidenceClass=contract_fixture` |
| negative cases / registry | 23 / 23 |
| `(requirementId, requirementKey, failureCode)` 集合 | 精确相等 |
| Schema negatives | 5/5 被拒绝 |
| Semantic negatives | 18/18 变异后保持 Schema-valid |
| case ID 唯一 | PASS |
| failure code 唯一 | PASS |

Schema shape 通过不等于 semantic 通过。V3-1 实现必须按开发与验收计划冻结的确定性算法执行 18 条 semantic case，并返回对应唯一 failure code；不得仅相信 fixture 的 `expected` 字段。

## 2. BiliNote 迁移白名单复算

机器白名单：

```text
docs/active/project/design/v3-bilinote-migration-allowlist.json
```

冻结上游：`JefferyHcool/BiliNote@be3889395afb5346aa4339ae933d3ba2e08f25a8`。独立使用 `git show <commit>:<path>` 读取原始字节后：MIT LICENSE 和六个 allowlisted 文件的 SHA-256、byteLength 全部匹配。

当前本地 BiliNote 工作树存在脏改动；白名单明确 `dirtyWorkingTreeAllowed=false`，因此这些脏字节不能进入 V3。`copyAuthorization=not_authorized_in_v3_0`，六个文件也只允许研究，不构成后续自动复制授权。Cookie manager、下载器持久配置、前端壳、数据库和所有 local dirty diff 均显式拒绝。

## 3. 对抗性风险闭环

| ID | 攻击方式 | 拒绝机制 | 结果 |
|---|---|---|---|
| R4-01 | 把 V2 mock/data_service 页面当成 V3 可用输入 | 真实 Mock 阻塞基线 + `evidenceClass` 分离 + 产品代码状态 `NOT_IMPLEMENTED` | CLOSED |
| R4-02 | 将持久授权等同于每次 capture 手势 | `ConsentPolicy`、`CredentialLease`、`CaptureGrant` 三种 identity 分离；tab capture 必须 trusted gesture | CLOSED |
| R4-03 | Cookie 写入配置、数据库、日志或证据 | 只允许 Chrome Store、内存、任务期 0600 cookiefile；0 persistence/log/evidence events | CLOSED |
| R4-04 | Cookie 失败后静默绕过平台限制 | 固定 fallback 或 blocked；禁止 DRM、地区、会员、风控绕过 | CLOSED |
| R4-05 | 自动后台 tab capture | 每次 fallback 都要求可见可信点击，缺少 grant 返回 `V3_TRUSTED_GESTURE_REQUIRED` | CLOSED |
| R4-06 | 取消后残留 cookiefile、媒体、音频或非证据帧 | cleanup 四类计数必须为 0；清理失败不能进入 completed | CLOSED |
| R4-07 | 同一 URL 重复占满 12 页分母 | 12 个唯一 URL、互斥主分类、V3-1 前注册表冻结 | CLOSED |
| R4-08 | mock VLM / 静态截图冒充视频理解 | 真实 provider/model/request/response hash；OCR/frame/vision evidence 分型 | CLOSED |
| R4-09 | 跨 task 大纲、Ask、Mindmap 或 seek | 所有实体绑定同一 task/outline/evidence；回读播放器 currentTime | CLOSED |
| R4-10 | 将本地导出写成知识库已保存 | `knowledgeImportStatus=deferred_to_v4`，V3 禁止调用 V2 mock 或 V4 adapter 出门 | CLOSED |
| R4-11 | 整仓迁移 BiliNote 或复制本地脏改动 | default-deny source allowlist + clean commit byte hash + 未来逐阶段授权 | CLOSED |
| R4-12 | 用 AI 设计图或原型结果支持生产 PASS | 确定性 HTML 为设计权威；原型固定 `productEvidence=false` | CLOSED |

## 4. 跨文档一致性

PRD、目标架构、开发计划、验收计划、Stage Gate、组件路由、风险 ADR、BiliNote 研究、Schema/fixture 和 Draw.io 均使用同一顺序：

```text
用户五项 scope
-> 可选 B站 cookie/host 权限
-> 同任务短期 credential lease
-> credentialed_media
-> public_or_page_subtitle fallback
-> trusted tab_capture fallback
-> 本地 ASR/关键帧/OCR
-> 选定帧、经授权的真实 VLM
-> 同一 VideoOutline 投影
-> Ask / seek / export
-> 四类终态清理
```

未发现仍以 no-cookie 路线、BiliNote 明文 Cookie 配置、V2 data_service、RAG 或 V4 知识导入作为 V3 实施输入的 active 权威文档。

## 5. 仍需实现阶段验证的风险

以下风险无法在文档阶段消除，但已有明确停机门禁，不能降级：

- B站 Cookie 名称、接口和风控变化；
- Chrome 可选权限和 trusted `tabCapture` 的真实版本兼容性；
- yt-dlp/FFmpeg、ASR/OCR 在 Windows/WSL/Docker 边界的性能；
- 真实 VLM 成本、密钥和证据质量；
- 12 个真实 URL 的样本注册表尚待 V3-1 冻结；
- 锚点视频的真实大纲与 H01-H10 人类结论尚不存在。

这些项目是 V3-1..V3-7 的实现义务，不是 V3-0 文档通过证据。

## 6. 结论

```text
Fatal: 0
Major: 0
Minor: 0
V3-0 security/migration/false-green document candidate: INTERNAL PASS.
Fresh external independent document audit: REQUIRED.
V3-1..V3-7 product implementation: NO-GO pending external Fatal=0/Major=0 and explicit user authorization.
```
