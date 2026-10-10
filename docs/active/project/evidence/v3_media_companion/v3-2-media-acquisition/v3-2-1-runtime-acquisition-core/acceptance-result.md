# V3-2-1 Runtime Acquisition Core 验收结果

日期：2026-09-22  
正式 run：`v3-2-1-core-20260922T145000Z`  
决定：`PASS`（仅 Runtime core）

| ID | 结果 | 证据 |
|---|---|---|
| RC01 | PASS | 媒体 Schema/positive/49 semantic+schema cases 全通过；ASR profile 为 SenseVoice |
| RC02 | PASS | 合法 B站 task 返回 created，公开字段精确且无 path |
| RC03 | PASS | 重复 create 返回同一 task，sandbox count=1 |
| RC04 | PASS | 同 task 修改 identity/part 返回 `V3_MEDIA_TASK_INVALID` |
| RC05 | PASS | 未注册 adapter、identity mismatch、policy mismatch、非法 ID/additional field 全拒绝 |
| RC06 | PASS | 随机目录不含 task/media/account；目录 0700，owner/artifact 从创建瞬间 0600 |
| RC07 | PASS | 私有真实 B站 WAV `3840078` bytes，SHA-256 `f4f61c...f7cc97b` 精确；public ref 无 path |
| RC08 | PASS | traversal/absolute logical kind、目录/文件 symlink、hardlink、跨 task ref 全拒绝 |
| RC09 | PASS | audio/video/task 总配额边界和超 1 byte 负例通过，无 `.part` 发布 |
| RC10 | PASS | cancel hook 恰执行 1 次；清理后才返回 cancelled |
| RC11 | PASS | 重复 DELETE 幂等，hook 不重放 |
| RC12 | PASS | hook 失败返回 `V3_MEDIA_CLEANUP_INCOMPLETE`，task=failed，未伪 cancelled |
| RC13 | PASS | startup 删除 1 个合法 orphan；未知目录和 symlink 目录保留 |
| RC14 | PASS | POST=201、GET=200、DELETE=200、closed request=400；全部 no-store |
| RC15 | PASS | 私有 run root 删除；公开结果 0 Cookie/path/audio/transcript；0 相关进程 |
| RC16 | PASS | 定向 14 passed；Runtime 全量 346 passed；Fatal=0/Major=0 |

RC01..RC16：`16/16 PASS`，无 N/A。

首轮定向运行曾因 V3 string failureCode 误用旧 `ErrorCode` helper 而异常；已改成专用结构化 envelope 并完整复跑。该失败未被删除或解释成产品通过。

公开机器结果：`runs/v3-2-1-core-20260922T145000Z/result.json`。

