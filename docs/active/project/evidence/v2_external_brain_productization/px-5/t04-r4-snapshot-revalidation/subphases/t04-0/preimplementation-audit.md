# T04-0 合同与依赖闭包冻结实施前审计

日期：2026-09-14  
状态：`GO / AUTHORIZED`  
范围：仅 T04-0；不授权提前执行 T04-1..T04-7。

## 1. 授权与前置门禁

- 用户指令：`approved T04-0..T04-7 implementation`。
- 用户指令 SHA-256：`b7979d5a8627a5524089351b772def6cc581e57c7d6eb66b5e77547bb2da5cb2`。
- 外部文档审查：`Fatal=0 / Major=0 / Minor=4`。
- 外审原始字节 SHA-256：`ac052cee337a18b63dde1a0465e6d699a32dba6ff0c1146bafb061eb2281f18d`。
- canonical 授权摘要 SHA-256：`5dd521998890c44b8f2362fb9b5e004ad11af1cb12c2973a534c29bf88f245eb`。
- T03 唯一正候选：`t03-r3-production-exit-candidate-20260914T134804`。
- T02.5 raw/seal/product commit：`ce272df479499e10092bc5d6a24610ebcd91782c87d4be34dceb09f296a5f0c3` / `fed6155ace6c0132c70c86bd3daccef987bd7c441df8960811e734274ea1b70f` / `430cddcb7ff618978851af1f3b9a3c48f2370d36`。

门禁结论：授权发生在外审通过之后，路径、范围和 hash 均满足 SnapshotInputManifest governance 要求。

## 2. 实施前复算

| 检查 | 结果 |
|---|---|
| SnapshotInputManifest Draft 2020-12 元校验 | PASS |
| SnapshotRevalidation Draft 2020-12 元校验 | PASS |
| ExitManifest Draft 2020-12 元校验 | PASS |
| authorizationRecord `$defs` 实例校验 | PASS |
| 授权 JSON canonical 编码 | PASS：UTF-8、无 BOM、无尾换行、对象键 Unicode code point 升序 |
| T04 replay/comparison/orchestrator 目标入口 | 均不存在，允许新增 |
| 当前主工作树 HEAD | `ae28b627eb0aba91ff0e9f950066a688d8d13d13` |
| 当前 porcelain-v2 原始字节 SHA-256 | `76945018de11789bc58a8e1e418c2de186d4c26bf38acc2534b983329db70ffe` |

主工作树存在大量本阶段之前的 tracked/untracked 变更。T04 不清理、不回退、不提交这些变更；T04-1 必须从固定 product base 创建独立 detached worktree，并单独证明主工作树前后状态不变。

## 3. T04-0 允许变更

- 新增 replay、comparison、orchestrator 及对应 Node tests。
- 读取但不放宽三份冻结 Schema。
- 实现 ESM 相对 import graph、声明 artifact closure、hash/index、authorization/audit 绑定和 25 项 failure registry。
- 生成 T04-0 实测依赖闭包；文件数量以解析结果为准，不使用文档中的观察值。

禁止修改 P0-P6 产品实现、Runtime、Adapter、`package.json`、`pnpm-lock.yaml`、T02.5 sealed run、T03 baseline、已审计文档包和外审报告。

## 4. 风险与停止条件

- 任一冻结 Schema 无法被合法根实例满足：停止并返回文档门禁。
- 相对 import 无法解析、读取未声明输入或需要修改产品依赖：停止，T04-0 FAIL。
- 授权或外审 hash 漂移：返回 `T04_INDEPENDENT_AUDIT_REQUIRED`，不得继续。
- 只信任输出中的 `passed`、`violations` 或 hash 自报而不重读原始字节：视为 Major false-green。

实施前分级：`Fatal=0 / Major=0 / Minor=0`。T04-0 可以开始。
