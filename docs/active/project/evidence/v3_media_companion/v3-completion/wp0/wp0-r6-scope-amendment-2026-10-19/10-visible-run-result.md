# R6 G2 单窗口正控结果

2026-10-19 只执行一次 owned Windows Chrome：独立 profile、真实 unpacked extension、真实 B站页、真实 Side Panel、owned Runtime，Chrome 显式 `--mute-audio`。

结果：0/7 接受。原生 owned-PID action 调用返回成功，但生产 Controller 未消费 armed capture；N01 进入 `R6_G2_STATUS_TIMEOUT`，后续场景均未建立 capture。所有场景 active sink、raw audio 和 residual raw audio 为零。运行结束后 owned Chrome、Runtime、17861/9222 端口、profile 与 scratch 均清理。

判定：安全收口有效，功能可达性不合格。禁止把该运行写成 R6 PASS，也不再通过重复可见运行碰运气。

