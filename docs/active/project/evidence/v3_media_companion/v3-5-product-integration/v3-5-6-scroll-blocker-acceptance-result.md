# V3-5-6 Chat / Know 滚动阻塞验收结果

日期：2026-10-09。结论：`PASS`。

## 真实扩展验收

使用当前 `chrome-mv3-unpacked`、Playwright 可见 Chromium 和真实鼠标滚轮输入验证，不通过脚本直接写入 `scrollTop` 伪造 wheel 结果。键盘路径在滚轮断言后先归零，再独立执行 `PageDown`。

| 视口 | 面板 | clientHeight | scrollHeight | wheel 后 scrollTop | PageDown 后 scrollTop | 根横向溢出 |
|---|---|---:|---:|---:|---:|---|
| 420x500 | Chat | 374 | 815 | 120 | 327 | 0 |
| 420x500 | Know | 416 | 836 | 120 | 364 | 0 |
| 360x500 | Chat | 374 | 856 | 120 | 327 | 0 |
| 360x500 | Know | 416 | 912 | 120 | 364 | 0 |

命令：

```text
node e2e/v3-sidepanel-scroll-e2e.mjs
NAVIA_SCROLL_VIEWPORT_WIDTH=360 node e2e/v3-sidepanel-scroll-e2e.mjs
```

## 回归

- Frontend：51 files / 340 tests PASS。
- TypeScript：`npm run typecheck` PASS。
- Extension：`npm run build:e2e` PASS。
- 目标组件：`KnowledgeQuickSurface.test.tsx`、`LocalRuntimeAccess.test.tsx` 共 8 tests PASS。

## 边界

- H01..H10 人工判断未自动写入 PASS。
- 修复后的完整真实 B站 fresh run `v3-5-5-real-20261009T085637Z` 已通过 39/39。
- 新人工包绑定 `v3-5-product-20261009T085637Z`、build `e7ad9c05...ba33d`、bundle `e22e266c...ed9f`；旧 bundle 不得继续签署。
- 新人工页面四视口均为 10/10 图片加载、rootOverflow=false、Axe serious=0/critical=0；无预选，未保留自动 QA submission。

