# T02.1 R2 production-input 可访问性风险停止

## 1. 停止结论

```text
T02 原限定 PASS：保持
T02.1 production-input recollection：FAIL / REPLAN
T02.1a accessibility repair：等待用户批准
T03 implementation：NO-GO
PX-5：FAIL / REOPENED
PX-6：BLOCKED
```

`t02-r2-raw-production-input-20260912T004800` 已进入真实 Chrome 主采集，但在结构化 Axe
验收处触发硬失败。继续以相同产品代码重跑只会制造重复失败或诱导降低 G6 分母，因此停止。

## 2. 原始证据

| 证据 | 值 |
|---|---|
| Axe artifact | `runs/t02-r2-raw-production-input-20260912T004800/artifacts/public/structured/axe-core_side-panel_workspace.json` |
| Axe SHA-256 | `bdac399bf73508f63e73bef698ce9c35269c30c3d21ee57433a497638269acc5` |
| Diagnostic SHA-256 | `75af8724b885551267cbadb9a601adcf1f2f337970eaa3e0d6aae6b2d2231b47` |
| Serious / Critical | `1 / 0` |
| Keyboard | `5 / 5`，focus return、Escape、Tab、reduced motion 全通过 |
| Cleanup | browser、Runtime、fixture server、profile 全部已清理 |
| Seal | 不存在；run 作废 |

通过的 prerequisite 仅用于定位，不升级为 T02.1 通过：

```text
fresh build: exit 0
frontend typecheck: exit 0
raw collector tests: 11 / 11
frontend full tests: 22 files / 169 tests
Runtime tests: 307 passed
T01 real Chrome: 36 / 36
```

## 3. PRD 与验收偏差

PRD 和总验收计划均冻结 G6：Axe serious/critical 必须为 0。T02.1-A07 同样要求真实
axe-core 扫描 `Serious=0`、`Critical=0`。当前失败不是证据格式问题，而是用户可见文本
对比度不足：

| 选择器 / 节点 | 前景 / 背景 | 实测对比度 | 门槛 |
|---|---|---:|---:|
| `.source-facts dt`，4 个 `<dt>` | `#71807b` / `#f3f6f5` | 3.80:1 | 4.5:1 |
| `.evidence-summary > p` | `#667570` / `#f3f6f5` | 4.44:1 | 4.5:1 |

受影响代码实体：

```text
apps/chrome-extension/entrypoints/workspace/style.css
apps/chrome-extension/src/modules/knowledge_workspace/SourceDetailReader.tsx
```

组件结构和语义没有失败；问题由 `style.css` 两条文本颜色规则造成。

## 4. 防假绿边界

- 不得忽略 `color-contrast` 或把 serious 降级为 warning。
- 不得只手工计算对比度后声明通过。
- 不得复用第五次 run 的 source、route、Axe 或 keyboard artifact 组成新 run。
- 不得给未 seal 的 run 补写 seal。
- 不得将 T01、键盘或其他 prerequisite 通过扩大为 T02.1/PX-5 通过。
- 不得进入 T03、R3、R4 或 PX-6。

## 5. 恢复条件

仅当 T02.1a 的开发、验收和实施前审计获批后，才允许修改产品 CSS。修复后必须重新创建
一个完整、独立、从零执行全部 prerequisite 和真实 Chrome 采集的 production-input run。
