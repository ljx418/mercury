# V3-4 实施前审计

日期：2026-10-08。审计性质：v2 合同修订后的内部文档与机器合同审查；未运行 V3-4 产品代码。

## 0. 决定

`V2 CONTRACT INTERNALLY PASS / IMPLEMENTATION NO-GO`。

Fatal=0，Major=0，Minor=2。

## 1. 已闭合项

- 复用现有本地 SQLite/EventStore，不引入独立数据库服务或并行事实权威。
- v1 合同 SHA-256 `75f88ea0c366132ba9a2008038062c6984a19295b048698a32746140153438f4` 保持不变；v2 增加 `blocked`、可空投影和 typed publish receipt。
- `V401..V418` 覆盖迁移、事务、崩溃、取消、12 页、路由恢复和 V4 边界。
- 负例拒绝跨 task、未知 evidence、时间逆序、projection drift、路径逃逸和终态/发布位错配。
- Outline 冻结为本地确定性抽取，不新增 transcript/OCR 云上传。

## 2. 已关闭的 Major

### 原 M-1 前序证据不存在

V3-3 已取得 sealed LIMITED PASS。其 seal 只作 qualification baseline；V3-4 通过全新单 run 重建正文，禁止 fixture 或旧 private 目录替代。

### 合同 M-2 受限页被迫生成假大纲

v2 明确 `blocked` 零 evidence/零投影；`ready/degraded` 才要求真实 evidence 与三视图闭合。合同测试 `48 passed`，覆盖 C01..C09。

### 原 M-3 Outline Provider 未冻结

Outline 使用本地确定性抽取，不调用云端文本 Provider。MiniMax 仅用于既定 selected-frame 视觉观察。

## 3. Minor

- M-1：本地抽取的大纲表达质量只能在 V3-5 人工内容验收中最终判定，不能由合同测试宣称质量通过。
- M-2：MiniMax 中性图实时复验成功只证明当前接口可用；V3-4 真实 selected-frame 调用仍需新的 task-scope 授权，且 Provider 运行中失败必须使当前 run 无 seal。

## 4. 防假绿判断

Schema-valid fixture 只证明数据模型一致；不证明 SQLite migration、crash recovery、12 页生成质量或路由恢复。V3-2/V3-3 seal 不含可消费正文，不能与 V3-4 结果跨 run 拼接。现有前端 Mindmap、V2 knowledge store 或静态原型均不能计入 V3-4 分母。

## 5. 恢复条件

1. V3-4 v2 修订文档包独立审查 Fatal=0/Major=0。
2. 用户明确批准 `V3-4 implementation`。
3. 用户明确批准 V3-4 新 run 最多 8 张 selected frame 的 MiniMax task-scope 上传；不上传原始视频、音频、完整 transcript 或 OCR 文本。

满足前述条件前，仅允许合同、迁移设计、fixture、verifier 和审计包开发。
