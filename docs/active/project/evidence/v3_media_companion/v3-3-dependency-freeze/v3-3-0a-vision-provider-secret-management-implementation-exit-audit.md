# V3-3-0a 视觉 Provider 密钥管理实施出门审计

日期：2026-10-08。结论：`LIMITED PASS`。Fatal=0，Major=0，Pending=1。

## 1. 实施结果

- Settings > 媒体与语音新增“画面理解模型”，支持密码输入、保存并测试、掩码状态和删除。
- Runtime 新增 `VisionProviderStore`、`SecretStore` 与 `OpenAIResponsesVisionAdapter`。
- WSL 真实环境通过 Windows Credential Vault 往返探测；随机一次性值 hash 相等且删除后不存在。
- SQLite 只含 `secretRef`；Windows PowerShell argv 不含密钥；E2E 请求观测对 vision body 强制 redacted。
- `/v1/vision/providers*` 全部要求精确扩展 Origin 和 Companion bearer，响应 `Cache-Control: no-store`。

## 2. 验收结果

| 分母 | 结果 |
|---|---|
| Runtime 定向安全/API | 6 passed；联合 Companion 12 passed |
| Runtime 全量 | 518 passed |
| 前端定向 | 2 passed |
| 前端全量 | 47 files / 315 passed |
| typecheck / production build | exit 0 / exit 0 |
| Windows Vault 真实往返 | set/get/hash/delete PASS，0 secret output |
| API 真实 Vault 往返 | save/test/list/delete 200；DB+response 0 secret hit；测试 adapter 为确定性 typed transport |
| 真实 Chrome | `v3-3-0a-2026-10-08T002253695Z`，360/420 UI 2/2、Axe serious/critical 0/0、截图 2 |

## 3. PRD 与假绿复检

- 保持原 V3-3、12 页、10 OCR、8 VLM 与最多 8 帧授权，不替换原计划。
- UI、密钥存储和真实 Windows Vault 已实现；测试 adapter 只验证 transport/Schema，不冒充真实 OpenAI capability。
- `VP-A03` 的真实 OpenAI 中性图调用仍为 `PENDING_USER_CREDENTIAL`。用户在设置页录入有效密钥并点击“保存并测试”后才能关闭。
- 未调用真实 B站证据帧，未宣称 V3-3 PASS。

## 4. 停止边界

本子阶段取得 `LIMITED PASS`。下一步只能由用户通过设置页录入真实视觉 Provider 密钥，执行一次已授权中性 probe；probe 成功并落盘无秘密证据后，才进入 V3-3 frame/OCR/VLM `-1..-7` 实施。
