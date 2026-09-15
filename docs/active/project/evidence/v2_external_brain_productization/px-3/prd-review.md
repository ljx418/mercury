# PX-3 PRD 规格检视

| PRD 要求 | 证据 | 结论 |
|---|---|---|
| action 合同和稳定 ID | 单元测试与 Chrome 双容器 source/operation ID | PASS |
| 单/多窗口确定性复用 | sender/focused/lowest tabId 单元测试 | PASS |
| 并发与 tab reuse | 8 请求 1 created + 7 focused | PASS |
| tab close 后恢复 | 用户再次触发创建，随后复用 | PASS |
| Service Worker 生命周期 | 新 coordinator 重新 query 既有 tab；不依赖持久队列 | PASS |
| poll/reconnect | 立即请求、退避、无重叠、stop 单测；Chrome offline->online | PASS |
| 不以缓存冒充权威 | offline 清空 source/graph；reconnect 重新调 Runtime authority | PASS |
| 打开不重复 ingest | Chrome 网络计数 0 | PASS |

PX-3 不声明 durable operation recovery、多窗口停靠 UI、PX-4 管理组件或 PX-5 产品总验收。
