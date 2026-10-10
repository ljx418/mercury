# V3-2-0b-6 实施前审计

日期：2026-09-22  
结论：`GO FOR V3-2-0b-6a..6d MACHINE MATERIALS ONLY`

## 输入门槛

- 用户已授权 `V3-2-0b implementation`，0b-0..5 已按顺序实施；0b-5 accepted run 为 `v3-2-0b-5-20260922T063133Z`，独立 verifier 16/16 PASS。
- 私有根存在且权限为 0700；三个 WAV、candidate 与 handoff 为 0600。handoff hash 已固定。
- Faster-Whisper Small 本地模型与冻结 manifest 存在。0b-6 不允许联网下载或变更 revision。
- 资格 schema 固定两名不同 reviewer、24 bins/人、48 总判断及质量阈值；不得降低分母。

## 风险闭环

1. 旧比较页把 `labelMap` 嵌入浏览器数据，并使用旧 A/B schema，存在身份泄露和合同漂移。处理：新增专用页面，公开 bundle 只含 A/B；私有映射仅供离线汇总。
2. 直接在页面导出 `candidateMeaningPreserved` 会要求页面知道候选是哪一侧，从而可被源码检查发现。处理：review 页面导出盲侧判断，受信任汇总器在两份 review 完成后用私有映射转换为冻结资格 schema；公开 review 不携带映射。
3. 同一个 Agent 不能构成两名独立人类 listener。处理：自动化仅生成、验收材料；到 0b-6e 必须停止等待两个不同 reviewerId。
4. 旧 QA 脚本曾检查旧模型名但未覆盖新 candidate/provider 标识。处理：静态与运行时扫描完整 deny list，并验证页面脚本/JSON 中无映射。
5. 音频和正文属于私有验收输入。处理：公开 evidence 只包含 A/B 比较文本和 B站公开标识；WAV、原始输出、label map、绝对私有路径不入公开包，权限维持 0700/0600。
6. 比较文本本身需要交给人类审阅，不能与 Cookie/本地私有路径等 secret 等同；其公开范围限定为本地审查页面，不进入通用外部审计包，直至脱敏扫描通过。

Fatal=0 / Major=0 / Minor=1。Minor M-1：两名人类 reviewer 尚不存在；这是设计中的高风险人工门槛，不阻断 0b-6a..6d 机器材料生成，但硬阻断 0b-6e 通过和 0b-7。

## 授权边界

允许新增本子阶段脚本、模板、私有 baseline/label-map 和本地审查页面；允许运行冻结 Small 模型与真实 Chrome QA。禁止更改产品默认模型、设置候选可选、标记 production qualified、伪造 review/adjudication、进入 0b-7。
