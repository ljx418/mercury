# V3-3-0a 视觉 Provider 密钥管理验收计划

日期：2026-10-08。

| ID | 用户场景与操作 | 必须结果 |
|---|---|---|
| VP-A01 | Runtime 在线，在设置页输入视觉 API Key 并点击保存 | 密钥写入系统凭据库，SQLite 只含 `secretRef`，UI 清空输入 |
| VP-A02 | 刷新设置页 | 仅显示已配置状态和掩码，不回显完整密钥 |
| VP-A03 | 点击“保存并测试” | 真实 adapter 使用中性图片；成功返回模型、用量与延迟，不返回原始响应或密钥 |
| VP-A04 | 删除 Provider | 系统凭据与元数据都删除，重复删除不泄密 |
| VP-A05 | 系统凭据库不可用 | 保存失败并显示可操作错误；SQLite 无 Provider 残留 |
| VP-A06 | 无/过期 Runtime 会话调用写、测、删 API | 401；错误不含密钥 |
| VP-A07 | 非精确扩展 Origin 调用任一 vision API | 403 |
| VP-A08 | 非法 Provider、模型、超长密钥或额外字段 | fail-closed，不写密钥与元数据 |
| VP-A09 | 扫描 DB、extension storage、日志、响应与公开证据 | API Key 0 命中 |
| VP-A10 | Runtime/前端既有测试、typecheck、build | 无致命或重大回归 |

出门条件：VP-A01..A10 全部通过；真实 Provider 凭据尚未配置时，A03 可保持 `PENDING_USER_CREDENTIAL`，但其 mock transport、认证、Schema 与泄密负路径必须通过。本子阶段此时只能取得 `LIMITED PASS`，不得扩大为 V3-3 PASS。

