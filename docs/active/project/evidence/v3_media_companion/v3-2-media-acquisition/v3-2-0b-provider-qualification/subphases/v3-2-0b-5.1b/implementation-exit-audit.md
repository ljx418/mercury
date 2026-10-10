# V3-2-0b-5.1b 实施出门内部审计

日期：2026-09-22。

## 决定

- Fatal：0。
- Major：0。
- Minor：0。
- 固定分母：B051B-01..07 为 7/7 PASS。
- 真实 Chrome：B04-01..16 为 16/16 PASS。
- 决定：质量失败状态传播子阶段出门；V3-2-0b 总体不得出门。

## 独立复算与回归

- Runtime 前置：321 passed / 60 warnings；另一个覆盖 scripts 的 Runtime 全量回归为 389 passed。
- 前端：full test exit 0（293 tests）、typecheck exit 0、extension build exit 0；目标组件 3/3 PASS。
- 官方资产真实下载与安装，不使用 Playwright route interception。
- 5 个真实 Axe 扫描面 0 violation；四视口无横向溢出。
- `result.json` 与 `prerequisites.json` SHA-256 已独立重算；公开证据秘密与宿主绝对路径扫描 0 命中。
- run 私有根、模型目录、Chrome profile 和相关进程清理通过。

## 防假绿

`installation.state=ready` 只表示固定资产完成校验和本地自检。`quality.status=failed_current_gate`、`selectable=false`、`effectiveModelId=faster-whisper-tiny` 和 `claimsV3_2A06=false` 同时成立。不得把本子阶段 PASS 外推为 Paraformer、V3-2-0b、V3-2 或 V3 PASS。

下一技术路线是统一固定 15 秒预切片；它改变生产推理合同与威胁模型，未获本子阶段授权。
