# V3-2-0b-6 失败尝试：20260922T064418Z

状态：`INVALIDATED / DO NOT REUSE`

第一个 Small worker 在冻结音频、模型和隔离边界下 exit 0，并写出私有 transcript 与 GNU time 资源文件；汇总器随后以第一个冒号切分 metrics 行，`Elapsed (wall clock) time (h:mm:ss or m:ss): 0:21.79` 被错误拆分，触发 `KeyError`。

该问题是证据解析器缺陷，不是模型或样本失败。run 未生成 bundle/result/page；已写 `invalidated.json`，私有 partial transcript/metrics 不得被下一 run 引用。

最小修复：按完整固定前缀读取 Maximum RSS、CPU percent 和 elapsed。新 run 必须从三个 worker 全量重跑，其他合同与验收分母不变。
