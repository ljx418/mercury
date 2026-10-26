# 风险与反假绿规则

| 风险 | 约束 |
|---|---|
| 只审 schema/derivative 文案 | 必须闭合到完整 evidence text、thumbnail 和 seek |
| 事后重建冒充同 run evidence | bundle 必须在同 task cleanup 前捕获并绑定 catalog hash |
| 评审知道 Provider 后产生偏见 | evaluator projection 不含 Provider/model/endpoint |
| 同一会话造工具又评分 | B6A 与 B6B 使用不同会话；B7 再独立 |
| 公开证据泄漏全文/图片 | 私有根保存内容；公开包只留 hash/score/code/index |
| 捕获逻辑改变产品状态 | 捕获器只读；静态与运行测试禁止 owner mutation |
| 缩略图只是文件存在 | 必须经认证产品 route 返回 PNG 并校验字节摘要 |
| seek 只是时间非空 | exact boundary、one-over、错误 source/task 均需拒绝 |
| 分数平均掩盖错误 | 每轴 >=4 且 critical=0，不使用平均分补偿 |
| sentinel 重复不独立 | 不同 session 和随机位置；反转即 Major |
| B6 修复污染 B-5 artifact | B6B evaluator 禁止代码修改；失败回 Codex 新建纠偏包 |

## 停止条件

- 需要新增公共 API/schema/FailureCode 或改变上传政策；
- 无法在 cleanup 前取得同源 evidence；
- 私有 bundle 出现原始媒体、Cookie、key、bearer 或绝对路径；
- 离线测试启动 Chrome/Runtime 媒体任务/Provider；
- B6B 出现内容 Major、两个 blocked、cleanup 非零或 sentinel 反转；
- 需要重跑时没有新的代码、环境或输入变化。

触发后必须写 NO-GO，不得降低 rubric、删除视频或用 R8/R9 横向拼接。
