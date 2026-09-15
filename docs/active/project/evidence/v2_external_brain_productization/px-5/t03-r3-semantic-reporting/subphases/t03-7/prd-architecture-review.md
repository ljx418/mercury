# T03-7 PRD、架构与 false-green 检视

日期：2026-09-14  
结论：`LOCAL PASS / EXTERNAL REVIEW REQUIRED`

## PRD

T03 未创造新产品体验，只从 T02.5 的真实 Chrome 原始证据重算三入口、五 route 四恢复、无效 route 回库、三来源 durable Forget、Permission、四故障、四视口、Axe、Keyboard 与 T01 36 assertions。RAG、RKM、PX-6 人工签署仍明确排除。

## 架构

实现保持 P7 单向 DAG：raw -> reader -> derived -> shared validation -> pending human -> report -> package -> invocation。生产 Architecture Manifest 不再内嵌源码；AST scanner 仍在内存中读取同一冻结 commit 的 Git blob，因此隐私边界与真实扫描同时成立。

## False-green

本轮本地 verifier 实际发现并阻断了旧候选的 Architecture Manifest Schema 漏验，证明不能只相信 `G4=passed`。修复后新增三层约束：生成器公开/内存视图分离、validator 写入时根 Schema 校验、出门 verifier 独立用 Git blob 重算。42 mutations 与 T02.4 exit-2 负路径均保持。

Fatal=0，Major=0，Minor=0（本地技术范围）。组织独立性与 Human Review 仍 pending。
