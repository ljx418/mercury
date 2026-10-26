# GC-B6 详细开发计划

## B6A：评审捕获工具实现

### A0 门禁与基线

1. 校验 B-5 final manifest、registry v2 摘要和 relay-v11 基线。
2. 读取当前 dirty worktree，不 reset/clean/checkout/revert。
3. 证明默认/离线入口启动 0 Chrome、0 Runtime、0 Provider、0 下载。

### A1 捕获合同与纯校验器

在 `scripts/stage_b_b5_3/lib/` 内新增内部 review-bundle 模块，定义私有包版本、
精确键集和 fail-closed 校验器。复用现有 canonical hash、registry、V2.1 schema
validator；不得复制或弱化冻结 schema。

负例至少覆盖：task/revision/source/order/BVID 不符、catalog hash 不符、缺失或
外来 evidenceId、文本 hash 不符、坏 PNG、thumbnail route 非 200、seek 越界、
Provider identity 泄露、绝对路径、原始媒体扩展名、重复文件和 manifest 漂移。

### A2 生产路径捕获适配器

在 runner 的 durable derivative 已读且机器校验通过之后、owner cleanup 之前：

1. 经公共 workspace route 取得 metadata；
2. 从 runner 自有 Runtime 私有根按 workspace 的 relative ref 精确读取派生文本；
3. 经认证公共 thumbnail route 取得 PNG；
4. 生成 seek-map；
5. 原子写私有 source bundle 与 manifest；
6. 重读并校验；
7. 只把 bundle hash/counts 写入机器收据。

禁止目录搜索猜文件、直接 SQL 伪造状态、调用内部 materializer 重新生成内容、
复制原始下载媒体或把 private root 写入公开收据。

### A3 Blind projection 与聚合器

新增纯函数生成 evaluator projection：删除 Provider/model/endpoint/receipt 原文和
运行路径，保留内容审查所需事实。新增 B6 aggregate schema：六行 + sentinel，
四轴分数、critical error code、引用 claim/chapter/evidence 索引、review session
和 prompt/rubric hash。

B6 aggregate 正判要求：六个 source 均四轴 >=4/5、critical error=0；sentinel
两次 review 的 thesis 与 material-claim verdict 不反转；缺行、重复 source、同一
session、Provider identity 可见、rubric hash 漂移均失败。

### A4 离线反假绿测试

- 纯 bundle fixture 正例与逐字段 mutation；
- 真实产品 workspace/thumbnail 路由的 ASGI 组合测试；
- runner fake-boundary 证明捕获点在 publication 后、cleanup 前；
- 捕获失败时 candidate 非零退出且原 owner cleanup 仍执行；
- default/offline 命令零外部动作；
- evaluator projection 隐私扫描；
- sentinel reversal 与 3/5、critical error、缺分数全部拒绝。

### A5 B6A checkpoint

执行一次受影响 Node 套件、必要 Runtime 定向测试、relay baseline/mutations、
secret/path/raw-media 扫描和 cleanup。输出
`GC-B6A REVIEW-CAPTURE IMPLEMENTED AWAITING CODEX CHECKPOINT` 并停止。

不得在 B6A 启动真实六视频、Chrome、下载或 Provider。

## B6B：fresh candidate 与盲态复核（B6A 通过后，另开会话）

### B0 生产 preflight

验证 registry、Cookie、Chrome、Runtime、依赖、Provider lock、私有根权限、磁盘
和执行预算；所有动作计数仍为 0。

### B1 一次 fresh 六视频 candidate

按 registry 顺序运行六个 fresh task。每行除既有 B-5 收据外，必须产生同源私有
review bundle。任何捕获不闭合、>=2 blocked、limited/failed、泄露或 cleanup 非零
立即停止。

### B2 盲态语义复核

使用新的 evaluator session，随机化六项顺序并隐藏 Provider identity。逐视频审查
四轴；对冻结 sentinel 再做一次独立 review。Evaluator 不得改代码、bundle 或分数
阈值，不得访问 Provider receipt 来猜模型质量。

### B3 汇总与公开证据

公开包只保留分数、稳定错误码、对象索引、hash、计数和清理证明，不保留全文、
图片字节或私有路径。状态只能是：

- `STAGE B IMPLEMENTATION CANDIDATE AWAITING INDEPENDENT B7`；或
- `GC-B6 SEMANTIC REVIEW NO-GO`。

不得宣布 Stage B PASS，不得进入 Stage C。

## B7：独立实施出门

由未参与 B5、B6A、B6B 的独立 Codex Agent 只读复算固定分母、调用路径、bundle
绑定、B6 rubric、隐私与 cleanup。Fatal=0/Major=0 后，Codex 主会话才可声明
`STAGE B PASS` 并冻结 Stage C 实施包。
