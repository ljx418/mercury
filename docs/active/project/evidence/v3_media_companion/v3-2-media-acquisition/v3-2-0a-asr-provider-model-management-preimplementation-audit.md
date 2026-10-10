# V3-2-0a ASR Provider 与模型管理实施前内部审计

日期：2026-09-21。审查范围：开发计划、验收计划、威胁模型、现有 PRD/架构/V3-2 门禁和代码基线。

## 结论

`V3-2-0a IMPLEMENTATION GO WITH FROZEN SCOPE`。

- Fatal：0
- Major：0
- Minor：3

本结论只允许实施 `V3-2-0a-0..7`，不恢复 V3-2-1，不改变 A06 失败事实。

## 核查结果

1. PRD 一致：仍为本地 ASR、无云端上传；最低模型只提供兜底。
2. 架构一致：Extension 只通过 Runtime API；provider/model 是 closed-set；不污染门户 adapter。
3. 验收可执行：16 项均有用户操作、机器结果和停止条件，无 N/A。
4. 防假绿：requested/effective 分离；tiny/small 的质量状态不能被安装成功覆盖。
5. 供应链：固定 revision/hash、staging、自检、原子发布和离线包拒绝矩阵已冻结。
6. 资源边界：8 cores/8 GiB/no GPU 是唯一低资源门槛；高资源模型不进入该分母。

## Minor

- M-1：`funasr-paraformer-zh` 的 exact runtime/version/license/file hash 尚未冻结，因此只能显示 `qualification_required`。
- M-2：发布系统尚未定义最终安装器中 bundled tiny 的物理目录；本阶段以 `NAVIA_BUNDLED_ASR_ROOT` 和 release preparation script 冻结逻辑接口。
- M-3：当前没有可公开保留的 V3 真实音频；本阶段可验证模型管理和真实短音频推理，但 V3-2-A06 仍必须等待新 production run。

以上三项不造成虚假通过，因为分别由不可安装状态、显式构建输入和 A06 独立门禁 fail closed。

