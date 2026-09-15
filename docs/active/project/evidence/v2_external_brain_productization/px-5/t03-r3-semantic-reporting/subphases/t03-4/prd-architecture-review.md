# T03-4 PRD 与架构复核

日期：2026-09-13。结论：FAIL / REPLAN。

- PRD 要求四类故障都展示合同内、可执行的恢复动作；通用 `retry` 不是冻结状态合同中的用户动作。
- Semantic Validator 要求 Report/Screenshot statusObservation 完整通过 Knowledge Status 合同。
- 若报告层把 `retry` 静默改成其他值，会切断 Runtime response 原始字节与报告事实的等价关系并造成 G5 假绿。
- 缺陷来自 R2 受控故障注入器，不允许修改已 sealed 的 T02.2 raw；必须修复采集器后创建全新 run。

建议 canonical 映射需在新 R2 计划中复核：adapter_blocked -> configure_adapter；data_service_unreachable -> reconnect；source_failed -> retry_source_build。
