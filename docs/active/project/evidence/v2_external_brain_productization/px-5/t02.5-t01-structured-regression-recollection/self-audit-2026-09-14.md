# T02.5 自审

日期：2026-09-14。模式：`SELF_AUDIT_USER_AUTHORIZED`。Fatal=0，Major=0，Minor=1。

- `verify-t02.5-candidate.py` 对完整本地 run 执行 37/37 PASS；raw/schema/seal/artifact/build/snapshot/event/route/Forget/fault/status/offline/security/cleanup 均重算。
- T01 结构化结果从同 run `.infra` 原始文件派生，source SHA-256 一致，36 ID 唯一且全过。
- T03 DerivedFacts 读取该 artifact 后 `gaps=[]`；旧 T02.4 精确产生 `T03-IN-11`。
- Minor：本审查不具备组织独立性；T03 实现完成后仍需新的独立 reviewer 出门审计。

决定：T02.5 limited PASS；允许恢复 T03，不扩大为 PX-5/PX-6/V2 PASS。
