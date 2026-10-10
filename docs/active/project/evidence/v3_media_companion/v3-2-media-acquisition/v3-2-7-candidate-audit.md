# V3-2-7 候选内部独立复算

日期：2026-10-08。模式：实现完成后的只读复算；不修改候选 JSON，不重跑旧 PX generator/validator。

## 复算

- Exit/UI/Fault 三类实例通过 `v3_media_transcript_exit_v1.schema.json` Draft 2020-12 校验。
- seal 内 5 项 hash 与磁盘字节一致，canonical seal hash 一致。
- A01..A20 全部 true；12 个 sourceIdentity 与 URL hash 唯一。
- 路由精确：6 `credentialed_subtitle`、3 `credentialed_media_asr`、multipart 成功、restricted blocked、low-signal degraded。
- transcript `3/3`，fault `14/14`，UI `passed=true`，public tar `34` 个唯一成员。
- public byte scan 0 命中；secure private root 不存在。

## 审计分级

Fatal 0；Major 0；Minor 1：本审计与实施属于同一 agent session，不满足最终“不同 reviewer session”组织独立性。

决定：`EXTERNAL INDEPENDENT AUDIT REQUIRED`。候选保持 `pending/false`。
