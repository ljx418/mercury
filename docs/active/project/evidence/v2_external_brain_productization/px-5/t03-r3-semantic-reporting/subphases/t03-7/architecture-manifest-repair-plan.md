# T03-7 Architecture Manifest 最小修复计划

## 范围

仅修复 T03 P7 证据实现：

1. `buildArchitectureSnapshot` 同时生成内存扫描视图与 Schema 合规的公开 production manifest。
2. 内存扫描视图保留从冻结 commit 读取的 `inlineSource`；公开 manifest 删除该字段并固定 `symlinkPolicy=hash_link_target_utf8`。
3. Production mutations 只修改内存扫描视图，继续证明真实 AST scanner 执行。
4. validator CLI 在写入后、生成 ProductionValidation 前校验 Architecture Manifest 根 Schema。
5. 测试同时断言公开 manifest 无源码正文、内存视图有可重算源码字节、AST scan 仍为真实执行。
6. 从空目录生成新 T03 validation run；旧失败 run 不覆盖、不拼接。

不修改 Runtime、前端产品交互、T02.5 sealed input、63 RuleId、109 requirements、42 mutation 分母、G1-G7 或 Human Review 状态。

## 验收

- Architecture Manifest v2 Schema meta/root instance：PASS。
- 28 个 tracked path 由 `git show <snapshot>:<path>` 重算 hash 全匹配；公开 JSON 中 `inlineSource` 命中数为 0。
- G4 AST scan scope valid、violations=0；六类 G4 源码 mutation 继续被检测。
- 新 run：61 passed + 2 pending、109/109、42/42、G1-G6 pass/G7 pending、Report/Package final=false。
- 旧 T02.4：只生成 `T03-IN-11` diagnostic、exit 2。
- 本地 verifier Fatal=0/Major=0；组织独立审计仍 pending。
