# V3 Media Companion 内部文档审计第二轮

日期：2026-09-16  
方法：从假绿、阶段依赖、生产证据、隐私、许可证、恢复和范围外声明角度重新对抗性审查第一轮候选。

## 1. 对抗性检查

| 风险 | 可能的错误实现 | 已冻结拒绝条件 | 结果 |
|---|---|---|---|
| 样本缩分母 | 同一视频同时占字幕、多 P、低信号名额 | 12 个互不重复 URL，主分类互斥；V3-1 前注册表未满即 NO-GO | CLOSED |
| 标题冒充理解 | 无字幕时用标题/简介/常识生成大纲 | 无字幕必须由可信点击启动本地 ASR；没有有效证据则 degraded/blocked | CLOSED |
| Mock Provider 假绿 | mock VLM 填 `executionMode=real` | production 验证要求真实 provider/model/request/response hash；contract fixture 永不支持生产声明 | CLOSED |
| 静态截图冒充画面理解 | 普通时间截图被计为 VLM evidence | OCR、普通 frame、vision frame 分型；画面结论必须绑定选定帧和真实响应 | CLOSED |
| 授权替代手势 | 一次持久授权后后台自动 capture | 每次 capture 必须绑定可信点击的短期 grant；撤销阻止新处理/上传 | CLOSED |
| 清理假绿 | 取消后仍上传或保留原始媒体 | completed/cancelled 前必须删除原始音频和非证据帧；失败阻止成功终态 | CLOSED |
| 路由缓存假绿 | reload/Back/reopen 展示旧 task | 8 条 route × 4 恢复；task/evidence 从 Runtime/Store 回读，旧缓存不能作权威 | CLOSED |
| Ask 幻觉 | answered 无证据或跨 task 引用 | answered 至少一个同 task evidence；否则 `insufficient_evidence` | CLOSED |
| 反跳自报 | 只声明 seek 成功，不回读播放器 | located 必须回读 currentTime，误差不超过 2 秒 | CLOSED |
| 自动下载越权 | 复用 Cookie 抓媒体 URL | direct media download 和 cookie export 计数必须为 0 | CLOSED |
| V2/V4 污染 | 把本地导出写成知识库保存 | `knowledgeImportStatus=deferred_to_v4`；V3 不调用 mock 或真实知识 adapter 出门 | CLOSED |
| BiliNote 整仓迁移 | 使用 dirty diff、账号/数据库/下载器 | 只允许固定 clean commit 的文件级 allowlist；MIT 归属；拒绝 dirty diff 与整仓嵌入 | CLOSED |

## 2. 阶段依赖与自动开发充分性

顺序为 `V3-0 -> V3-1 -> ... -> V3-7`，无反向依赖。V3-Y1 只在 V3-6 后冻结。每个实现子阶段都要求独立开发计划、验收计划、实施前审计、真实数据证据、PRD review 和出门审计。

V3-0 冻结的是 12 页分母及注册表合同，不虚构尚未探测的 11 个 URL。V3-1 实施前必须用真实 Chrome 填满 `sampleId/url/bvid/primaryClass/expectedOutcome/observedAt`，否则不得进入实质开发。此安排消除了文档门禁依赖未来页面事实的循环。

## 3. 残余风险

- B站页面、字幕和播放器会变化：以 revision 和真实 Chrome 探测处理，不静默换样。
- `chrome.tabCapture`、本地 ASR、OCR 和云端 VLM 的性能/兼容性尚未实测：分别由 V3-2/V3-3 的真实阶段门禁承担，不能由文档消除。
- 云端 VLM 成本和密钥属于实现环境风险：文档已冻结选帧预算、scope、hash 和公开证据脱敏；没有真实 Provider 时 V3-3 必须停止。
- 人类对视觉方向尚未签署：交互原型和 Draw.io 已可打开，签署不由自动审计代替。

这些是未来真实实现验证义务，不构成当前文档规格歧义，也不能被降级或跳过。

## 4. 第二轮结论

Fatal=0，Major=0，Minor=0。当前文档候选足以提交独立外部文档审查；在外审 Fatal=0/Major=0 且用户另行授权前，V3-1 产品实现继续 NO-GO。

