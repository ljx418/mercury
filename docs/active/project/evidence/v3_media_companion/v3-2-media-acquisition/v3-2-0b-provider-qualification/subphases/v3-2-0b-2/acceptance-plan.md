# V3-2-0b-2 Catalog / Manager / Installer 验收计划

日期：2026-09-22。固定 `B02-01..B02-16`，不得 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| B02-01 | 校验更新后 public Schema/fixture | Draft 2020-12 PASS；旧必填兼容，新字段闭集 |
| B02-02 | GET catalog | 恰有四模型；Paraformer ID/provider/revision/license/runtimeKind 精确匹配 |
| B02-03 | 查看质量状态 | Tiny fallback_only、Small failed_current_gate、Paraformer qualification_pending、Large not_evaluated |
| B02-04 | 查看资源 | 平台下载 bytes、安装 bytes、1 GiB free、8 GiB RAM、0 VRAM 与冻结值一致 |
| B02-05 | 安装 Paraformer | source archive/Q8/VAD 三资产 bytes/hash 全匹配 |
| B02-06 | materialize runtime | 只提取平台冻结 executable；成员 bytes/hash/mode 匹配 |
| B02-07 | 查看发布目录 | 仅 executable + Q8 + VAD 三文件，无 archive/README/script |
| B02-08 | 执行真实 self-test | 使用 provider adapter load/run/cleanup；状态进入 ready |
| B02-09 | 选择 qualification_pending | 返回 V3_ASR_MODEL_NOT_QUALIFIED；requested/effective 不变 |
| B02-10 | 安装完成后读取 settings | Tiny 仍 effective，Paraformer ready 不等于 production qualified |
| B02-11 | 损坏 archive/成员/Q8/VAD | fail closed，不发布半成品，不替换 Tiny |
| B02-12 | nested archive path/link 攻击 | 拒绝且 staging 清理 |
| B02-13 | cancel/restart/uninstall | staging/child 清理；Tiny 可恢复 |
| B02-14 | 旧 Tiny/Small 安装测试 | 全部回归通过 |
| B02-15 | API 客户端提交 URL/hash/path/class | 全部拒绝；closed catalog 不变 |
| B02-16 | PRD/秘密扫描 | 未开放选择、未关闭 A06；公开证据秘密/绝对路径 0 命中 |

## 防假绿

安装状态 ready 与质量状态 production_qualified 必须分离。mock archive、mock self-test、仅 schema 通过、仅 UI 显示均不能替代 B02-05..08 的真实链路。
