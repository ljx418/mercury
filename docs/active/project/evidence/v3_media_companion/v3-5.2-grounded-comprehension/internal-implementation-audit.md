# V3-5.2 内部实施审计

日期：2026-10-11。结论：`IMPLEMENTED CANDIDATE / MACHINE PASS / HUMAN QUALITY PENDING`。

## 审计结论

- Fatal：0。
- Major：2。独立人类内容质量与 8 个视觉节点尚未签署；同步大纲生成最高约 345 秒、跨章问答最高约 31.5 秒，尚无后台进度/持久检查点，不得进入 V3-6。
- Minor：2。MiniMax-M3 没有可靠 JSON mode，当前依赖提示词、对象扫描、严格语义校验和三次重试；长视频 10 章由灾难回退压缩生成，标题可读性仍需下一次 fresh synthesis 验证新 2..10 章 merge 指令。

## 已关闭风险

- 本地抽取模式明确标成预览，不再作为完整理解候选。
- Provider 输入类型不接受文件、Cookie、URL、路径或二进制，只接受派生 evidence 字段。
- 模型输出必须满足 2..12 章节、字段长度、关系枚举、真实 evidence ID 和时间顺序。
- 模型失败前不写新投影；私有结果用临时文件原子替换并尝试设为 `0600`。
- 高质量投影生成后清除旧问答缓存。
- 旧 v1 projection 与历史任务仍可读。
- 四种风格均绑定显式风险；未冻结的营销风格 fail closed。
- grounded Ask 使用完整章节、独立提示词、零温度、合同重试和内部 ID 泄漏门禁。

## 已执行验证

- Runtime comprehension 定向测试：18 passed。
- Runtime 全量测试：694 passed（1 个既有 warning）。
- Extension typecheck：PASS。
- Workspace 定向：6 passed。
- Extension 全量测试：52 files / 351 passed。
- Extension production build：PASS（保留既有大 chunk warning）。
- Runtime import 与新 endpoint 注册 smoke：PASS。
- `git diff --check`：PASS。
- 三视频结构化投影：3/3；四风格真实对照：4/4。
- 最终单 run 36 问：36/36，公开摘要 SHA-256 `a4ade25a5920e6964df0192606d0af5830b9f1414a23f8776e733f42fbfaa992`。

## PRD 检视

实现没有扩大到跨视频 RAG、V4 知识导入、全平台或全量视频云上传。它直接修复 V3-5.1 的章节、概括、问答和同源投影质量缺口；机器候选已关闭，但人类质量与同步等待体验仍未关闭。
