# V3-2-5 Transcript 产品体验威胁模型

日期：2026-10-07。范围仅为双容器 task UI 与 Runtime 产品投影；原威胁分母保持不变。

| 威胁 | 防线 | 验收 |
|---|---|---|
| 前端伪造完成状态 | Runtime task/revision 唯一权威；终态停止 polling | A02/A03/A10 |
| 自动触发捕获 | 可见按钮、trusted event、Background sender/tab/page 复核 | A05/A06 |
| 取消假成功 | cleaning barrier 和 cleanup receipt 后才 cancelled | A07 |
| 旧 task/artifact 重放 | retry 必须新 taskId；旧 authority 不复用 | A08/A11 |
| 双容器状态分叉 | 同 taskId、同 revision、陈旧响应丢弃 | A02 |
| 聚合接口泄露私有 acquisition 字段 | closed-set projection DTO；禁止 artifact path、lease、grant、ticket、streamId | A03/A14 |
| 跨门户/跨来源 task 混淆 | sourceIdentity 与 adapterId 精确绑定；按来源查询只返回该来源最新 task | A01/A11 |
| 秘密进入 UI/截图 | public DTO closed-set；secret/path scan | A14 |
| 可访问性状态不可感知 | live region、焦点恢复、文本+图标双编码 | A12/A13 |
| scope 过度声明 | forbidden claim scan；禁止大纲/OCR/VLM/Mindmap | A09/A14 |

没有通过独立审查的真实 V3-2.4a task、真实 Chrome 截图和 cleanup receipt 时不得生成通过 receipt。
