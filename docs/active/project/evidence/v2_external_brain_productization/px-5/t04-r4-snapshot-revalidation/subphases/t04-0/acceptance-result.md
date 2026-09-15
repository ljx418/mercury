# T04-0 合同与依赖闭包冻结验收结果

日期：2026-09-14  
状态：`PASS / T04-1 MAY START`

## 1. 正式结果

- run：`t04-r4-snapshot-revalidation-20260914t084940z`。
- `t04-0-result.json` SHA-256：`6779c67b6ffe5662936dfc7b329cc32c81c57b9643a855e1132c25e99f17e086`。
- `dependency-closure.json` SHA-256：`d7eb43a4d2d3f1096b8e8e6dd7b58d8123d07bff8e98f9f8835eb0c76da828cf`。
- `schema-verification.json` SHA-256：`334ca6e53ebf738c1b394bfe5228f0c033d64cebf3a05ec101379d567939444f`。

| 验收项 | 结果 |
|---|---|
| T04 授权与外审原始字节绑定 | PASS |
| 三份 Draft 2020-12 Schema 元校验 | 3/3 PASS |
| 固定验收 ID | 14/14 |
| mandatory negative registry | 25/25 |
| failure code registry | 22/22 |
| 依赖闭包文件 | 1149，由工具实测而非手填 |
| 相对 ESM import edge | 34 |
| T04 授权实现/测试文件 | 6/6 |
| `missingEdges` / `undeclaredReads` / `unexpectedFiles` | 0 / 0 / 0 |
| Node tests | 9/9 PASS |
| 冻结 Schema 修改 | 无 |
| 产品代码、Runtime、package/lock 修改 | 无 |

## 2. 失败尝试隔离

`t04-r4-snapshot-revalidation-20260914t084657z` 因只包含 2 个 ESM 可达 T04 文件、遗漏 comparison 与测试文件而作废。该输出未覆盖、未拼接，原因记录于 `failed-attempt-20260914T084657Z.md`。

## 3. 结论

T04-0：`Fatal=0 / Major=0 / Minor=0`。依赖闭包已形成可机器读取的实际集合，允许进入 T04-1 隔离快照构建。T04 整体、PX-5、PX-6、V2 仍未通过。

## 最终候选重执行

最终 run `t04-r4-snapshot-revalidation-20260914t105407z` 从空目录重新执行 T04-0 并通过。该结果取代开发 checkpoint 作为最终执行链起点；25 个 requirement 与 T04-A01..A14 分母未缩减。
