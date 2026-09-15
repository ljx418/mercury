# V2-PX PX-1 False-Green Audit

## Result

```text
False-green blockers: 0
Residual risks: 3, all explicitly deferred
Disposition: PASS for PX-1 technical scope
```

## Controls

1. E2E 使用真实 WXT production output，不使用 Vite localhost 或 review prototype。
2. 真实数据来自当前 PRD 原始字节，经真实 Runtime save/build/trace 路径进入 `ws_default`。
3. Route source ID 从浏览器 URL 读取，并与 setup 返回的 Runtime source ID 和详情 DOM 三方比较。
4. 五类 route 每次 direct-open 后执行 reload，再检查 URL 与实际 route DOM。
5. Runtime offline 使用浏览器 transport fault injection，要求页面壳仍真实加载；不信任报告自报 offline。
6. 重复打开通过浏览器 page count 比较；ingest 通过 context 级真实网络请求计数，不能由代码说明代替。
7. 截图为真实 headless Chrome product surface，并绑定原始文件 SHA-256。
8. invalid/missing route 不加载 fixture；必须呈现 canonical error 并由用户恢复。
9. 全量回归、PX-0.2 validator 和 Runtime API 测试均重新执行。

## Rejected Evidence

- `contract_fixture` positive payload。
- 自包含 review prototype。
- 旧 V2-7 screenshots。
- data_service Console。
- 手工输入 URL 但没有 Side Panel 生产入口。
- “代码中没有 save 调用”这种无网络观察的自报结论。

## Residual Risks

- `FORBIDDEN` 只有 Router 可注入分支，当前 mock Runtime 没有真实 auth/forbidden 路径；不计为真实 PX-1 error screenshot。
- PX-1 只证明单窗口单入口复用；多窗口/关闭/重连矩阵属于 PX-3。
- Ask/Permissions 当前是阶段壳；不计为 PX-4 组件验收。

以上风险都在对话批准的阶段拆分内，不会被 PX-1 完成声明掩盖。

