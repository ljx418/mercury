# T04-3 R4-E 新鲜真实 Chrome 复验实施前审计

日期：2026-09-14  
结论：`GO WHEN FINAL SNAPSHOT IS FROZEN`

## 输入与隔离

- 唯一运行源必须是 T04-1 最终 detached acceptance commit，不得从主工作树执行。
- 使用全新的 `t04-r4-fresh-raw-*` runId、Extension build、Chrome profile、Runtime、database 与 output root。
- `NAVIA_T02_SKIP_PREREQUISITES` 必须删除；Node、Python wheelhouse、Chrome 与 Playwright revision 必须来自 SnapshotInputManifest。
- T02、T02.1、T02.2、T02.5 的既有 raw/seal 只作不可变对照，不得复制、链接或拼接到 R4-E。

## 固定验收

真实 Chrome runner 必须从零执行 build、typecheck、collector、frontend、Runtime、T01 36 assertions、三入口、12 source（6 web + 3 local + 3 note）、五 route 四恢复、两类 invalid recovery、3 source x 4 durable Forget、四 fault、四 viewport、真实 Axe 0 serious/0 critical 与 Keyboard 5/5。每个 Runtime 请求只有一个终态，orphan=0；cleanup 四项全部成功。

## 停止条件

任何产品缺陷、真实 Chrome 失败、分母不足、Axe/Keyboard 失败、seal 不可重算、cleanup 不完整或需要修改 T04 六文件之外的产品代码时，立即作废该 run 并停止请求用户批准修复。失败 run 不 seal、不进入后续泳道。
