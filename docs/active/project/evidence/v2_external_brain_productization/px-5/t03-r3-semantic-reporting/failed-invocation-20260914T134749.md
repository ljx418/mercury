# T03 候选调用语法失败记录

`t03-r3-production-exit-candidate-20260914T134749` 在参数解析阶段因字面量 `--` 被拒绝，exit 1。失败发生在创建输出目录和执行 derive 之前，没有候选 artifact、没有 seal、没有被后续 run 复用。

后续使用 canonical Node 入口创建全新 run `t03-r3-production-exit-candidate-20260914T134804`。本记录不属于产品失败，也不能从验收分母中删除。
