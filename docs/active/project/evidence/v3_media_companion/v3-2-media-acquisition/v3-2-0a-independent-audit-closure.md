# V3-2-0a 独立实施审查闭环

日期：2026-09-21。

## 1. 审查输入

- 冻结入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`
- 独立报告：`v3-2-0a-independent-implementation-exit-audit.md`
- 审查时载荷：19 个 payload + 1 个 manifest；报告独立确认 19/19 哈希与权威源一致。

外部审计包是本次审查的不可变快照。审查结束后的状态同步不重建、不覆盖该包，避免改变已经签署的审查输入。

## 2. 闭环决定

```text
V3-2-0a LOCAL LIMITED PASS
Fatal=0 / Major=0 / Minor=3
```

该决定只覆盖本地 ASR provider/模型管理、bundled Tiny fallback、资源说明、校验安装、离线恢复和低资源自检。

## 3. 不得扩大的边界

```text
V3-2-0/A06: FAIL / REOPENED
V3-2-1..7: BLOCKED / NO-GO
V3-3+: NOT_IMPLEMENTED
```

Small 安装成功和 Tiny 自检都不是生产 ASR 质量通过证据。下一步必须冻结新的 production model/profile，并对相同真实样本生成全新、不可跨 run 拼接的比较证据；不得降低 critical、neither-acceptable 或逐样本阈值。

## 4. 保留的 Minor

1. 最终 installer/Docker release wiring 尚未冻结。
2. UI 拦截式 transport 与真实 Runtime 公网安装是两组独立证据，尚非同一条 E2E。
3. Small 质量门禁失败，Paraformer/large 尚未 qualification。

以上均不撤销 V3-2-0a 的限定通过，也不构成 V3-2-1 的放行依据。
