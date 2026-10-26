# GC-B6 验收计划

## B6A 固定分母

| 组 | 数量 | 正控 |
|---|---:|---|
| Bundle identity/hash closure | 12 | 全部通过 |
| Evidence/text closure mutations | 10 | 每项稳定拒绝 |
| Thumbnail/seek mutations | 8 | 每项稳定拒绝 |
| Blind projection/privacy | 8 | 无 Provider/secret/path/raw media |
| Lifecycle/cleanup | 6 | 捕获失败仍 cleanup，非零退出 |
| B6 aggregate/sentinel | 10 | 阈值 exact 与 one-under 均被驱动 |

具体测试数可以增加，不得合并或降低上述 54 个义务。

## B6B 每视频 rubric

每项 1..5，四项均需 >=4：

1. **事实与证据准确性**：brief、material claims、chapter thesis 均由所引派生
   evidence 直接支持；截图与声明匹配；seek 到达相应时段。
2. **全片覆盖**：opening/middle/ending 均有实质覆盖，没有把长视频压缩为首段
   摘要，没有用跨章证据伪造覆盖。
3. **内容价值与适配**：brief 相关、概括而非摘抄；claims 有区分度；证据不足时
   拒绝过度断言；输出对 companion reading 有实际价值。
4. **章节边界质量**：边界对应主题变化，顺序单调，标题/论点准确，章节不过度
   碎片化或失衡，前后关系合理。

评分锚点：5=无实质问题；4=有轻微缺陷但不改变理解；3=至少一项明显缺失或需
修改；2=多个严重缺陷；1=不可用或误导。任何 3 分及以下均不通过。

## Critical error

任一即 Major，不能由平均分抵消：

- material fact contradiction；
- claim 引用的 evidence 不支持或反向支持；
- screenshot/seek 指向错误内容或错误 source；
- 只覆盖首段或遗漏结论性后段；
- 未标注的证据冲突、人物/数字/因果反转；
- 跨 task/source/run 拼接；
- 原始媒体、秘密或私有路径泄漏。

## Sentinel

从六项中按冻结规则选择一项（registry order 由 review plan 固定，不能运行后挑选）。
使用不同 evaluator session、不同随机位置重复审查。若 thesis 判定或 material claim
正确性发生反转，记 Major；单项分数相差 >1 也失败并要求人工仲裁，不得取平均。

## 出门条件

- B6A：54/54 obligation，Fatal=0/Major=0，零外部动作；
- B6B：6/6 四轴 >=4，critical=0，sentinel 稳定，B-5 machine gate 仍正，cleanup
  与隐私全绿；
- B7：独立审计 Fatal=0/Major=0。

只有 B7 后才是完整 `STAGE B PASS`。
