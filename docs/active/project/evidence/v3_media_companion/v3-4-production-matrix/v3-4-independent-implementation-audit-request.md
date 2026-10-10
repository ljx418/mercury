# V3-4 实施出门独立审查请求

日期：2026-10-08。审查入口：`docs/active/project/external-audit-package/AUDIT_MANIFEST.md`，然后读取 `01-audit-request.md`。

## 决策问题

请独立决定：`V3-4 LIMITED PASS` 是否成立，以及是否只允许 V3-5 进入详细实施前恢复。不要把本次结果扩大为 V3、Chat/Know、PX-6、RKM 或完整产品通过。

## 必须复算

1. 18 项载荷与 manifest SHA-256，及平铺/无子目录/总文件数小于 20。
2. v2 Schema meta 与生产 terminal matrix：01..10 ready，11 blocked 零投影，12 degraded。
3. runner 是否真实重新采集，而非消费 V3-2/V3-3 正文；是否仅前 8 个 task 上传单张 selected frame。
4. Outline 是否完全本地确定性抽取，Timeline/Mindmap 是否纯投影；是否存在 transcript/OCR/raw media 云上传路径。
5. SQLite migration、CAS、同事务 aggregate/event/outbox、idempotency、cancel/retry/recovery 与负例测试。
6. production result canonical hash 与 seal；verifier 20/20 是否可独立复现。
7. 私有库可在不打印正文的条件下只读核查：`/home/administrator/.local/share/navia/private-runs/v3-4-outline-production-20261008T104258Z/`。禁止复制私有 DB/文本到审计包或输出内容。
8. 私有目录中视频、音频、PNG/JPEG/WebP 和开发截图必须为 0；公开 run 只能有 result/seal。
9. 不得打开或输出 Cookie/API key。可验证公开材料没有 Cookie/API key/Authorization/raw transcript/OCR text/绝对路径。
10. V401..V418 逐项 PASS/FAIL，并给出 Fatal/Major/Minor。

## 已知命令结果

- 定向 V3-4：61 passed。
- Runtime 全量（冻结 RapidOCR 路径）：578 passed。
- Extension：47 files / 317 tests passed；typecheck/build exit 0。
- 生产 verifier：20/20 PASS。

第一次 Runtime 全量命令遗漏 RapidOCR 搜索路径，导致仅 4 个 OCR dependency failure；使用与生产 run 一致的冻结路径重跑后 578 passed。前端第一次错误传入 Vitest 不支持的 `--runInBand`，改用仓库原生命令后 317 passed。两者均不得伪装为产品缺陷或从记录中删除。

## 候选锚点

- runId：`v3-4-outline-production-20261008T104258Z`
- result SHA-256：`236e1aa4e87b6d61f17de47da451ab7e91fe7cf37ea4aa91a4957b910a076812`
- seal SHA-256：`c7d983d23d121adf5a5a75036dbf95754089515df4c6569c4fadd373d296f1e8`
- verifier output SHA-256：`a67c60c0e29d240258a527037aa143906583adf7b25f11a9b3ae3d6b78c09f02`
- runner SHA-256：`72eaa71af5b64b1fe9355fdaf3adf8a78efd3ab3390514cb451bb44bdad6620e`
- v2 Schema SHA-256：`e328e12e3cd1e70a0241cd40ebd5c98e934ab3f8a443c876a5906681c4532b4e`

## 落盘要求

将结论写入：

`docs/active/project/evidence/v3_media_companion/v3-4-production-matrix/independent-implementation-exit-audit.md`

外部审查不得修改实现、候选 run、Seal、旧 run 或用户秘密。
