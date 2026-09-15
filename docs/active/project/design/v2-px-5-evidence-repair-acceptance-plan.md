# PX-5 证据修复验收门槛

日期：2026-09-09。状态：待实现前审计闭环，未执行修复后验收。

G1-G7 的冻结指标沿用 `v2-px-5-acceptance-plan.md`；本文件追加本轮发现的证据可信性验收，不降低原门槛。详细正负矩阵见 `v2-px-5-evidence-repair-plan.md`。

## 必须交付

1. 独立新run中的真实宿主网页、产品侧栏主动保存与工作台入口全路径；同一次操作的sourceId、requestId、事件、请求/响应原始字节及截图metadata必须关联。
2. 生产校验路径的专项负向结果：伪trusted gesture、整包hash代响应hash、错误source/operation、跨场景截图、缺Permission/Forget原始查询、固定成功UX、失败命令伪装通过、原始源码违规且report仍0、fixture结果冒充生产。每项从有效基线变异，缺失基线不能记成功。
3. 既有109个合同负例回归；生产语义结果来自实际运行，绑定实际实现hash，不从正例复制。
4. 真实命令执行记录：frontend test/typecheck/build、Runtime V2 API、生产E2E及validator、V2-7回归。保留stdout/stderr和退出状态；V2-7使用隔离run，禁止覆盖历史证据。
5. 各修复步骤完成后的PRD review、架构差异、false-green审计。独立复审需明确执行者、输入hash、实际命令和未验证项，不能由生成器模板声明Major 0。

## 阻断标准

- 任何G1-G7必需原始观察缺失、hash/ID/时间/宿主不匹配，均不得通过机器候选。
- 源码基线未冻结或与实际测试构建不一致，G4阻塞；不能用当前HEAD标识未提交新增文件。
- 注入故障不能计为自然故障，Mock Adapter不能计为真实data_service；二者可保留各自限定测试含义。
- 人工签署pending时最终Report必须false；机器Major尚存时，即使人工体验OK，也不得放行。
- 本轮5组Major逐项关闭且独立复审无新增Fatal/Major后，才恢复PX-5并进入PX-6。

## 当前实测范围

本轮只做了源码阅读、现有JSON深比较、hash重算、旧截图人工检查和文档纠正；未运行修复后Chrome或Runtime测试。不能把本文件当作验收执行结果。
