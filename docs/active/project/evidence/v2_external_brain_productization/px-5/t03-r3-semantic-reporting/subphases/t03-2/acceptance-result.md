# T03-2 验收结果

日期：2026-09-13。结论：`PASS`。Fatal=0，Major=0，Minor=0。

- `pnpm test:v2-px-r3-derived`：2/2 通过。
- T02.2：12 sources（6 web/3 local/3 note）、88 scenario、12 Forget trigger、12 trusted recovery；0 input gap。
- 每个 provenance ID 均存在于同一 raw run；相同输入派生结果字节等价。
- 旧 T02.1：只生成 `T03-IN-09 0/12` diagnostic，CLI exit 2，不生成 DerivedFacts。
- 独立 CLI 实测：positive exit 0，old exit 2。

允许进入 T03-3。

