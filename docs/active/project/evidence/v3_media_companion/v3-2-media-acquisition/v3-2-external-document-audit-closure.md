# V3-2 外部文档审查意见闭环

日期：2026-09-18。对象：`v3-2-independent-document-audit.md` 的 M-1..M-3。结论：`CLOSED FOR V3-2-0 PREIMPLEMENTATION`。

## 1. 门禁基线

- 独立审查：`V3-2 DOCUMENT CONDITIONAL GO`，Fatal=0、Major=0、Minor=3。
- 用户授权：`v3-2-implementation-authorization.json`，范围 V3-2-0..7，仍要求逐子阶段审计。
- 本闭环不宣称 V3-2-0 或 V3-2 已通过，也不放行 V3-2-1 产品代码。

## 2. M-1：fixture mutation 未实跑

处置：新增 `apps/chrome-extension/e2e/v3-media-acquisition-contract-audit.py`，实际应用每个 JSON Pointer mutation，执行 Draft 2020-12 Schema、固定顺序 semantic validator、requirements/cases 映射和 FailureCode 闭集核对。

实测：Schema meta PASS；positive Schema errors=0；positive semantic failure=null；requirements=49；cases=49；49/49 PASS；failed=0。首次运行发现 4 个 `oneOf` 子错误被粗化为 `SCHEMA_ONEOF`，审计器修复为展开 context 后重新全量通过，未修改原 48 项声明结果。

## 3. M-2：V3-1.3 三项 Minor 未显式继承

处置已写入 `v3-2-development-plan.md §7`：

1. V3-2-0/V3-2-7 逐字段复算 V3-1.3 A01..A20。
2. 实施证据抽样五类 observation payload，而非只看 summary。
3. Cookie 仅供一次性授权 Chrome harness；以真实服务器探测证明有效，产品代码和公开证据不得读取、复制或散列原值。

## 4. M-3：Chrome 权限子集未冻结

处置：Schema 新增 `ChromeManifestPermissions`；positive、policy registry 和第 49 个 Schema 负例同步绑定。目标 required permissions 为 `activeTab/scripting/sidePanel/storage/tabs/offscreen/tabCapture`；`cookies` 与 B站 host 保持 optional；Runtime loopback host 保持 required；Web Accessible Resource 只允许 B站视频域；显式拒绝 `<all_urls>` 与全站通配。

审查建议中把 `cookies` 混入常驻 permissions 与现有按需授权设计冲突，因此未照抄。当前 `wxt.config.ts` 仍是 V3-1.3 实际基线；`offscreen/tabCapture` 只在 V3-2-4 经其实施前门禁后加入，不提前扩大权限。

## 5. 结论

```text
External document audit comments: CLOSED
Fatal: 0
Major: 0
Open Minor blocking V3-2-0: 0
V3-2-0 preimplementation planning/audit: GO
V3-2-1 implementation: NO-GO until V3-2-0 PASS
```
