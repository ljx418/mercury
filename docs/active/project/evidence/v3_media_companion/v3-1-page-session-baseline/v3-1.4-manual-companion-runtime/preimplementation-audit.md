# V3-1.4 实施前内部审计

日期：2026-10-07。审查范围：开发计划、验收计划、威胁模型与既有 V3-1.3 实现。

## 结论

`GO FOR V3-1.4-0..7 IMPLEMENTATION`。Fatal=0，Major=0，Minor=2。

## 逐项结论

1. 新设计继承 V3-1.3 的 exact-Origin、one-shot channel、短期 lease 和 secret isolation；没有改写已通过合同。
2. Runtime 启动权威唯一：桌面入口由用户显式触发；扩展只 bootstrap session，不能启动进程。
3. 上层媒体/Chat 调用只依赖 bearer authenticator，新增 broker 不要求重写媒体 acquisition。
4. A01..A14 均包含用户场景、操作与确定结果；真实 Chrome、真实进程、重启、停止、清理和 secret scan 均为硬门槛。
5. 失败后不得回退到手工 token 作为产品主路径；手工 token只允许诊断构建保留。

## Minor

- M-1：正式 Windows/macOS 安装包不在当前原型仓库内；本阶段以可执行 launcher 与安装脚本证明手动入口，V3-7 前需冻结发布包装。
- M-2：本机同账户恶意进程不在当前威胁边界；需要更强对手模型时采用 Native Messaging，不得静默扩大当前声明。

## 审计边界

本审计只允许 V3-1.4 实施。V3-2.4a 之后仍按原阶段门禁；不得据此声明 V3、Chat/Know 或完整 Media Companion 通过。

