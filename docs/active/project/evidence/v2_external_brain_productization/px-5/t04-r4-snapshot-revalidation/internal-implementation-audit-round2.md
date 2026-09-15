# T04 实现方内部审计第二轮

日期：2026-09-14  
对象：`t04-r4-snapshot-revalidation-20260914t105407z`  
方法：按冻结公式重新读取 detached snapshot 与 staging bytes，不调用 T04 runner。

## 结果

- dependency closure：1151 文件，raw path/mode/hash/length 0 mismatch，closure SHA-256 可重算。
- source index：3386 entries，canonical source tree 与 path index 均可重算，acceptance commit=`e0e7ca9a...`。
- snapshot Git bundle hash、T02.5 raw/seal 固定绑定：PASS。
- 使用相同封闭 NUL member list 独立重建 public tar，原始字节 SHA-256 与候选 `bedb0932...` 完全一致。
- final snapshot identity、主工作树 before/after 绑定：PASS。

结论：`Fatal=0 / Major=0 / Minor=0`。T04 实现候选具备送外部实现审查条件；Human Review、G7、final 与 PX-5/PX-6 状态不变。
