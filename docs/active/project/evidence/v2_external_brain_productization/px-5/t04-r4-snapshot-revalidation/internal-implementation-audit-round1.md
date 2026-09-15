# T04 实现方内部审计第一轮

日期：2026-09-14  
对象：`t04-r4-snapshot-revalidation-20260914t105407z`  
方法：独立 Python/jsonschema/tar/XML/原始字节复算，不调用 T04 runner。

## 结果

- SnapshotInputManifest、SnapshotRevalidation、ExitManifest、fresh raw 四份 Schema meta/instance：PASS。
- fresh raw canonical seal、ExitManifest content hash、全部 Exit artifact refs：PASS。
- T04-A01..A14：14/14；T04-N-001..025：25/25 且 expected=observed。
- R4-P：4 steps、10 exact、1 normalized、8 logs；唯一 ignored pointer `/recordedAt`。
- R4-E：12=6+3+3、20 route combinations、12 Forget、Axe 0/0、Keyboard 5/5、63/109/42。
- public tar：1348 唯一成员，与 index 相等；不含 ExitManifest 或独立实现审查。
- 外审包：20 个平铺文件；19/19 payload hash/length/source bytes 一致。
- Drawio：8 页；T04 Node tests：14/14；Windows Chrome runtime root 已清理。

初次审计脚本的 Markdown 行正则未匹配 manifest 表格，产生 2 项审计工具 false-negative；改用字段分割后 19 行全部通过。该错误未修改候选。

结论：`Fatal=0 / Major=0 / Minor=0`。允许进入第二轮内部复算，不等于独立实现出门审查通过。
