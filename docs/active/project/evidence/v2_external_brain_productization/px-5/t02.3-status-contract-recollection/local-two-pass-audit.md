# T02.3 本地双轮审计

日期：2026-09-14

## 1. 第一轮：完整性与可重算性

从 sealed raw 和实际 artifact bytes 重新执行：

- Draft 2020-12 Schema meta/instance：PASS；
- captured collector invariant：PASS；
- 91 个 build 文件 path/mode/length/hash：PASS；
- 1158 个 artifact 记录、index、引用与原始字节：PASS；
- 557 Runtime request 的唯一终态、7 Background request 的唯一终态：PASS；
- canonical seal、raw hash、snapshot manifest、collection diagnostic：PASS；
- public/private 边界与公开字节敏感信息扫描：PASS；
- cleanup 4/4：PASS。

本地完整目录与最终公开归档分别执行同一 verifier，均为 34/34。第一轮结论：Fatal 0 / Major 0。

## 2. 第二轮：语义与反证

- T03 输入 readiness：Fatal 0 / Major 0；
- 三入口为 2/2/3；source corpus 为 6 web + 3 local + 3 note；
- 五类 route 的四种恢复全覆盖；普通 invalid/forbidden recovery 为 2；
- durable Forget 为 12 trigger + 12 trusted recovery + 12 authority absence；
- Permission 3、fault 4、四产品视口、Axe 0/0、Keyboard 5/5；
- 新 Status 原始响应 203/203 合法；旧 T02.2 为 178 checked / 7 precise retry errors；
- 四个失败 run 均 unsealed 且 cleanup 4/4，没有进入候选。

第二轮结论：Fatal 0 / Major 0。

## 3. 独立性边界

两轮均由实施代理完成，只能支持 `LOCAL CANDIDATE PASS`。外部审查报告未落盘前：

```text
T02.3 formal PASS: forbidden
T03 baseline replacement: forbidden
T03 implementation resume: NO-GO
PX-5: FAIL / REOPENED
```
