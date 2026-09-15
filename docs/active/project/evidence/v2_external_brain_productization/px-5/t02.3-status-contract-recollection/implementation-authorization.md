# T02.3 实施授权摘要

```json
{
  "authorizationVersion": "v2-px-t02.3-implementation-authorization/v1",
  "authorizedAt": "2026-09-13T00:00:00+08:00",
  "userId": "repository_owner_current_chat",
  "instruction": "按停止记录启动 T02.3 故障状态合同修复和完整真实 Chrome 重采，然后恢复 T03",
  "scope": [
    "controlled fault Knowledge Status mapping",
    "offline status evidence validation before raw seal",
    "collector regression tests",
    "new isolated full R2 production-input run",
    "T02.3 audit package",
    "T03 baseline update and resume after independent PASS"
  ],
  "constraints": {
    "oldRunsReadOnly": true,
    "crossRunMergeForbidden": true,
    "knowledgeStatusSchemaChangesAllowed": false,
    "productBehaviorChangesAllowed": false,
    "legacyGeneratorOrValidatorAllowed": false,
    "t04Allowed": false
  }
}
```

`authorizedAt` 记录当前审计日期而非外部签名时间；权威授权文本为当前用户消息，独立审计必须同时核对本文件和会话交接记录。
