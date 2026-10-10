# V3-2-4a 候选内部审计

日期：2026-10-07。审计性质：实现代理内部只读复核；不能替代独立 reviewer。

## 结论

`CONDITIONAL GO TO INDEPENDENT IMPLEMENTATION EXIT AUDIT`。Fatal=0、Major=0、Minor=2。

## 已闭环风险

1. Chrome stream ID 必须在扩展用户调用上下文签发：改为 arm -> action/command -> startArmed 两步协议。
2. Side Panel 默认 action 行为吞掉 click：显式关闭默认行为并在捕获处理后打开面板。
3. 静音 PCM 假绿：加入非零采样与峰值门禁。
4. Runtime 多线程 `preexec_fn` 令 SenseVoice 以 `-11` 崩溃：改由单线程 sandbox launcher 设置限制并 exec。
5. `/mnt/c` 无法可靠满足 0700：真实任务根迁移到 WSL ext4 `/tmp`，完成后删除。

## Minor

- M-1：真实正例只有一个 B站页面；十二页覆盖属于 V3-2-7，不得提前声明。
- M-2：历史失败诊断 run 私密区可能含诊断 WAV；它们未封存、不得进入公开包，独立审查应确认成功 run 和公开 tar 均不包含该文件。

## 防假绿检查

- 没有注入 route failure 或跳过 prerequisites。
- 捕获由 Chrome UIAutomation 调用真实扩展 action，不是 controller 直调或合成 DOM 点击。
- transcript 来自冻结 SenseVoice 进程，不是 fixture 或人工听写。
- 公开 secret scan、清理和终态均由同一 run 记录；未跨 run 拼接。
