# V3-2-0b 实施授权记录

日期：2026-09-22  
授权原文：`approved V3-2-0b implementation`  
授权来源：当前用户会话

冻结审查输入：

- 外部审查 SHA-256：`fa5c5dec8292603064f2d3dfdf698cd49ab67d207df9eb91f9b6210fea70d160`
- Major 闭环后 manifest SHA-256：`d31ba7749350df5f84e80999c611738f65da0222319346a676b81862aca1cf39`

## 授权范围

- 允许按冻结的 `v3-2-0b-development-plan.md` 顺序实施 V3-2-0b-0..V3-2-0b-7。
- 允许下载并校验候选清单中冻结的官方 runtime / model 资产，执行无 GPU、8 GiB 地址空间上限的真实数据资格验证。
- 允许实现通用 ASR Provider 接口、FunASR llama.cpp adapter、受治理安装/删除/失败恢复，以及设置页资格状态。
- 允许为 3 个冻结真实 B站样本生成新盲评包和人工对比页。

## 未授权范围

- 不允许把 `qualification_pending` 预标为 `production_qualified`。
- 不允许跳过双 reviewer 48 项固定分母、独立出门审计或 secret scan。
- 不允许实施 V3-2-1..V3-2-7、V4、PX-6 或 RKM。
- 不允许把 Cookie、音频、媒体、模型二进制或宿主绝对路径写入公开 evidence。

## 前置门槛

外部审查 Major-1 必须先按 `v3-2-0b-external-audit-major-closure.md` 客观关闭。每个子阶段必须先落盘开发计划、验收计划和实施前审计，完成后再落盘真实验收与 PRD 检视。
