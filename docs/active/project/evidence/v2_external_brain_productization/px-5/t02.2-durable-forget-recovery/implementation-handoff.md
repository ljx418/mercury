# T02.2 实施交接

日期：2026-09-12
状态：`READY FOR EXTERNAL INDEPENDENT AUDIT`

## 1. 完成内容

T02.2 已在隔离 worktree 中完成 durable Forget 原始证据采集修复和全量真实 Chrome 重采。新 run 独立完成 build、typecheck、collector、前端、Runtime、T01、双容器 Axe/Keyboard、12 source、route/fault/Permission/Forget 采集、seal 与 cleanup。

候选关键身份见 `acceptance-candidate.md`。机器复核文件：

- `local-verification.json`：33/33；
- `public-package-verification.json`：公开归档解包后 33/33；
- `t03-input-readiness.json`：Fatal 0 / Major 0 / ready true；
- `raw/raw-run.json`：1321 events / 1105 artifacts；
- `raw/collection-diagnostic.json`：passed / missingObservations=[]；
- `cleanup-manifest.json`：4/4 closed。

## 2. 外部审查必须重算

1. 审计包 19 个 payload 与 manifest 的 SHA-256；
2. raw Schema meta/instance、captured collector invariants 和 canonical seal；
3. 所有 public artifact bytes、index、path/hash/length 与公开字节泄漏扫描；
4. 530 Runtime 与 7 Background request 的 exact-one terminal；
5. 3 source × 4 mode 的 `SOURCE_NOT_FOUND -> trusted action -> Source Library` 同 navigation 链；
6. trigger authority 为同 source `forgotten`，recovery authority 的 source list 为 absent；
7. 旧 T02.1 run 仅以 `T03-IN-09` 和精确 24 个缺失 fail closed；
8. 新旧 run 无拼接，五个失败 run 均未进入候选；
9. 产品/Runtime/API/Schema 0 修改与 PRD 无偏移；
10. cleanup、privacy、Axe/Keyboard、四视口和 prerequisite 分母。

## 3. 允许与禁止

外部审查 `Fatal=0 / Major=0` 后，只允许：

```text
T02.2 limited PASS
进入 T03 实施前审计更新
```

仍禁止：直接运行或升级旧 generator/production validator；把本候选扩大为 T03、T04、PX-5、PX-6、V2、RAG 或 RKM 通过；修改旧 T02/T02.1 run；跨 run 拼接；以本地审计替代外部独立审查。

## 4. 剩余风险

- 当前同一实施代理的双轮审计不具备组织独立性；外部审查是唯一剩余 Major 门禁。
- T02.1 审查记录提到 Workspace 另有三个约 4.45:1 的选择器；本 run Axe 覆盖结果为零违规，但后续扩大页面状态覆盖时仍需持续扫描。
- T03 尚未更新 sourceRunId/seal/snapshot，也未重新完成实施前审计；因此 T03 代码实现仍是 NO-GO。
