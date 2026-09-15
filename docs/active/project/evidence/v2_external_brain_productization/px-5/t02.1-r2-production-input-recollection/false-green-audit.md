# T02.1 False-Green 审计

日期：2026-09-12  
结论：`LOCAL MACHINE CHECKS PASS / INDEPENDENT REVIEW PENDING`

## 1. 已拒绝的假绿路径

| 风险 | 防线 |
|---|---|
| 复用或拼接旧 T02 run | new raw 中旧 runId 命中 0；旧 raw/seal 独立复算不变 |
| generator 补 source/entry/route error | 分母从 raw event、Runtime body 和 structured artifact 重算 |
| 只信 `passed=true` 或计数 | 31 项验证器不读取 Gate 布尔；重算 request terminal、route、corpus、fault、截图 |
| Axe 降阈值或日志冒充 | typed artifact 必须由 exit 0 command 引用；engine=axe-core，serious/critical=0 |
| error 页面或回库页面单边冒充 recovery | 同时要求 canonical error、命名 recovery、trusted 按钮和 Source Library observation |
| 重复 source 扩大分母 | sample/source/operation/fingerprint 四类 ID 均恰好 12 个唯一值 |
| 截图 metadata 自报尺寸 | 逐 PNG 检查 magic/IHDR、hash、metadata 和 observation refs |
| request 孤儿或双终态 | 454 Runtime 与 7 Background 请求全部 exact-one terminal |
| private bytes 泄漏 | 947 public 原始字节重扫；6 private_local_only 独立分类 |
| 本地 PASS 冒充独立 PASS | acceptance result 保持 A12 Pending，T03 保持 NO-GO |

## 2. 反向回归

同一版 `audit-t03-input-readiness.py` 对新 run 退出 0、Major 0；对原 accepted run 仍退出 2，并报告：

```text
T03-IN-01 trusted entry 缺口
T03-IN-02 12-source corpus 缺口
T03-IN-03 route recovery 缺口
T03-IN-04 typed Axe/Keyboard 缺口
```

因此本轮未通过降低 threshold 或删除检查使新 run 变绿。

## 3. 保留限制

- T01 36 项原始结果位于 run 的 `.infra`，本地验证器已逐项读取；外部公开归档不公开其中带本地绝对路径的原始详情。独立 CLI 可在仓库权威 run 上只读复算。
- Axe 自动扫描不等于人工屏幕阅读器或完整 WCAG 认证。
- Mock Adapter、controlled fault 和本地 fixture server 均明确标记，不冒充真实 data_service。
- T03 shared semantic/AST validator 尚未实现；本轮不生成 production report。
