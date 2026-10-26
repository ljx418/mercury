# Navia V3 当前项目坐标

日期：2026-10-17

## 1. 层级坐标

```text
Navia
└─ V3 Media Companion 完成主线
   └─ WP0 / P0 Background Capture Relay v10
      ├─ R0 合同与冻结基线                         PASS
      ├─ R1 Background Runtime Transport           PASS
      ├─ R2 Offscreen Producer / Port / Bounds     PASS
      ├─ R3 Controller Integration                 PASS
      ├─ R4 Runtime/Worker 恢复与真实故障矩阵        MAY START（当前唯一工作包）
      ├─ R5 单视频真实 visible muted Chrome canary  NOT_STARTED
      ├─ R6 真实故障与资源清理矩阵                   NOT_STARTED
      └─ R7 immutable candidate / P0 出门           NOT_STARTED
```

当前不能声明 V3 完成，也不能开始 P1。R7 出门后才依次解锁：

```text
P1 六视频 fresh run
P2 Stage B 收口
P3 内容质量
P4 状态恢复体验
P5 视频工作台（brief/章节/图文大纲/时间线/概念图/五种导出）
P6 Chat/Know
P7 综合交互
P8 V3-6 单一 12 页 production run
P9 V3-7 最终审查、人工验收和 Git 同步
```

V2/PX-6/RKM 保留历史证据但暂停；Query、Knowledge Graph、Durable Forget 属 V4；Agent 属
V5+，均不阻塞当前 V3。

## 2. 最近门禁事实

- R3 最终决定：`R3 PASS / R4 MAY START`。
- R3：Fatal `0`、Major `0`、Minor `0`、待重冻结 `0`、公共合同变化 `none`。
- R3 已关闭 Controller 单一 owner、两阶段停止、idle/error 清理、双轮隔离和 24 步生产链。
- Codex 对 Controller scope 执行一次受限重冻结；baseline `50/50`、mutations `15/15`。
- 本轮没有 Chrome、Provider、六视频、真实产品 run 或声音。

## 3. 当前唯一下一动作

由 ClaudeCode CLI 按 `12-r4-development-and-acceptance.md` 实施 R4-1..R4-5，完成后状态写
`R4 AWAITING CODEX CHECKPOINT` 并停止。Codex 再做一次 R4 checkpoint；不得提前进入 R5。

