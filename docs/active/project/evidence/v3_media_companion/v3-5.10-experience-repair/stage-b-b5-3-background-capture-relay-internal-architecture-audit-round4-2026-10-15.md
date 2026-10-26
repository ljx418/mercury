# P0 Background Capture Relay 第四轮独立架构审查与 v3 修订记录

日期：2026-10-15。状态：`V1/V2 REJECTED / V3 DOCUMENT CANDIDATE / IMPLEMENTATION NO-GO`。

## 1. v2 独立结论

固定 v2 包经不同只读 subagent 复算为 18/18 hashes、verifier 19/19，但结论仍是 `DOCUMENT REPLAN`：Fatal=1、Major=5、Minor=1。

- Fatal：stop 后禁止 chunk 与 drain 非空 producer queue 互相冲突，正常完成路径不可达。
- Major：sink-zero 证据未冻结 Runtime 全局单 sink；marker 字段/TTL 不一致；sender 来源不明确；机器合同未定义实际消息；verifier 只核部分字段/映射。
- Minor：chunk 在 Port-unacked/Runtime-inflight 之间重复计数风险，“达到”与“超过”阈值不一致。

## 2. v3 闭环

- 正常终止改为 `quiesce source -> drain existing queue under credit -> stopped -> Runtime finalize`；只有 `runtime_stop_sent` 后拒绝 chunk。
- chunk 所有权固定为 `local_queued XOR credit_consumed/runtime_inflight`；producer 以 local+consumed 计数，在下一 enqueue 将导致超限前 abort。
- JSON Schema 直接定义 start/credit/quiesce/abort/ready/chunk/quiesced/stopped/capture_error 九类消息，全部拒绝多余字段；chunk 固定 canonical Base64、偶数 raw length 与边界。
- sender 六字段均取 Chrome MessageSender/extension context，不接受 payload 自报；documentId 必须存在且首次绑定。
- marker TTL 改为 1,080,000 ms，首次固定且 phase 更新不续期；phase 与 transition 闭集化。
- Runtime 明确进程级全局单 active sink，`begin` 成功后才发 `started`，WebSocket finally 固定 abort；observer 同时检查旧 task cleanup receipt 两项 0、private temp 0 和 fresh started。
- trace 扩展为 21 步，负例扩展为 RLY3-N01..N30；streamId 第二 start、settle 后重用、abort 后重用、chunk/credit/log/marker/storage 泄漏分别覆盖。
- anti-false-green verifier 逐字段核实际消息、canonical Base64/decoded length、全部 30 映射、trace state/credit/sequence/length、phase/expiry、sender、ownership 和 Runtime observer 不变量。

## 3. 当前复算与边界

v3 verifier 当前 24/24 PASS。这仍只证明文档与 fixture 静态一致；真实 Chrome MessageSender 字段、Base64 Port 吞吐、quiesce/drain、worker restart、Runtime cleanup 与产品终态必须在代码实施后用真实静音 Chrome/Uvicorn 证明。

当前等待：重新封存 v3 外审包并由 ClaudeCode CLI 独立文档外审。Fatal=0/Major=0 与用户明确授权前，R0-R7、P0 和 P1 均 NO-GO。
