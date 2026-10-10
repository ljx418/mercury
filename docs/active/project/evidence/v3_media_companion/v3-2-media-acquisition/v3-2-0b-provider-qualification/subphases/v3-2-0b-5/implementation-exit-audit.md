# V3-2-0b-5 实施出门审计

日期：2026-09-22

`verify_v3_asr_low_resource_run.py` 独立读取公开 result、Linux 私有 handoff、三 WAV、三 candidate、三 metrics 和授权 Cookie registry，并重新执行网络/GPU负探针。`B05-01..16` 逐项 16/16 PASS。

- Fatal：0
- Major：0
- Minor：0
- accepted run 无 `invalidated.json`
- 私有根 0700；全部敏感文件 0600
- A16/production_qualified/selectable：仍 pending/false/false

决定：`V3-2-0b-5 PASS`。允许进入 0b-6 文档、机器生成比较 bundle 与人类审查页面；没有两名不同 reviewer 的完整 48 判断前必须停止，禁止进入 0b-7。
