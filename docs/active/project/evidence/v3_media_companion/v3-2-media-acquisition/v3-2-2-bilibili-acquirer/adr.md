# ADR V3-2-2：Revision 3 与 B站受控媒体获取

## Status

Accepted for implementation planning, 2026-10-06.

## Context

Revision 2 把 24-bin 双模型 review/adjudication 固定为 `productionReady`，与 SenseVoice 作为 V3 开发基线、跨模型质量回退移入 V4 的用户决定冲突。同时 V3-2-2 仍需真实 12 页身份、分 P、授权态和路线证据，不能删除样本门禁。

## Decision

1. Revision 2 和历史证据只读；新增 `v3-media-acquisition-sample-registry/v3`。
2. Revision 3 保留 12 URL、6+3+1+1+1、当前分 P、页面/server probe、截图/hash、授权证据类和预期路线。
3. Revision 3 固定 SenseVoice model/revision/weights 为 `development_baseline`，并明确跨模型质量门禁 `deferred_to_v4`。
4. B站下载器只能接收已注册 `mediaId/playbackUnitId/partId`，不接收任意 URL；Cookie 只从同 task 进程内 lease 写入随机 `0600` cookiefile。
5. V3-2-2 只交付字幕和当前分 P 媒体 artifact，不执行 ASR、capture、outline 或画面理解。

## Consequences

V3 可以继续验证真实媒体路线而不伪造跨模型质量认证；V4 仍承担退化检测和质量回退。代价是 revision 3 需要一次全新的授权 Chrome 12 页探测，且旧 revision 2 工具不能作为当前生产输入。
