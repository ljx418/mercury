# V3-2-4 实施前 Major 闭环

日期：2026-10-07。结论：`IMPLEMENTATION GO FOR V3-2-4-0..7 ONLY`。

- 前序 V3-2-3：`LIMITED PASS / Fatal=0 / Major=0`。
- 文档与合同：development、TC01..TC20、threat model、capture stream v1 Schema/fixture 已冻结；外部文档审查 Fatal=0/Major=0。
- 高风险授权：用户已明确授权，SHA-256=`de6faffa97305c894b8135cbd144254cae014cfe4c77e3d0dd290a920758b4f2`。
- 当前 manifest 尚无 `tabCapture`/`offscreen`，不存在提前扩大权限。
- Runtime 全量 474 passed，capture pipeline 合同 31 passed；无新增 Fatal/Major。

实施门禁：Fatal=0、Major=0、Minor=0。允许从 V3-2-4-0 合同与权限增量开始；每个子阶段完成后必须写验收与 PRD 检视。真实 Chrome 正例必须使用可见浏览器、真实 B站、真实可信点击和真实 stream，禁止 fixture/预录音频/JS 事件计正例。
