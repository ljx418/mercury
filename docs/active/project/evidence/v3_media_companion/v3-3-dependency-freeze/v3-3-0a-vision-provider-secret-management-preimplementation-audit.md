# V3-3-0a 实施前安全审计

日期：2026-10-08。结论：`GO`。Fatal=0，Major=0。

## 威胁闭环

| 威胁 | 严重度 | 控制 |
|---|---|---|
| 扩展存储或 SQLite 泄密 | High | 仅系统凭据库持久化；DB 只存引用 |
| 任意网页调用 localhost 密钥 API | Critical | 精确扩展 Origin + Companion bearer 双门槛 |
| API 回显或日志泄密 | High | DTO 白名单、掩码、统一错误、secret scan |
| 任意 Base URL 导致 SSRF | High | V3-3 只注册冻结 OpenAI adapter 与固定 API base |
| 系统无安全 backend 时降级明文 | High | backend 能力检测并 fail-closed |
| 删除元数据但遗留密钥 | Medium | 先删凭据，成功后删元数据 |
| 自动测试产生费用 | Medium | 网络测试必须由显式用户动作触发 |

## 审计决定

- 用户已明确授权本子阶段实施。
- 既有 V3 计划、12 页分母和最多 8 帧上传授权保持不变。
- 实现后必须单独落盘出门审计；真实 capability probe 在用户配置凭据前保持 pending。

