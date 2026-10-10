# V3-2-1 Runtime Acquisition Core 验收计划

日期：2026-09-22

| ID | 操作 | 必须结果 |
|---|---|---|
| RC01 | 重跑媒体合同 | Schema/positive/49 cases 全通过；SenseVoice profile 精确 |
| RC02 | 创建合法 B站 task | 返回 `created`；task/source/adapter/part 精确；0 私有路径 |
| RC03 | 重复创建相同 task | 返回同一事实，不创建第二 sandbox |
| RC04 | 同 task 改 identity/part | `V3_MEDIA_TASK_INVALID` |
| RC05 | 非注册 adapter/非法 ID/additional field | closed request，400/404 |
| RC06 | 创建 sandbox | root/task 目录 0700；owner/file 0600；目录名不含 task/media/account identity |
| RC07 | 写入真实私有 WAV 字节 | bytes/hash 精确；公共 artifact ref 无绝对路径 |
| RC08 | 路径 traversal/absolute/symlink/hardlink | 全部拒绝且 root 外文件不变 |
| RC09 | 音频/视频/总配额 | 达边界可写，超 1 byte 原子拒绝且无半文件 |
| RC10 | 注册真实 cancel hook 后 DELETE | hook 恰一次；state 先 cleaning，清理后 cancelled |
| RC11 | 重复 DELETE | 幂等返回同一 cancelled；无新增 hook/文件 |
| RC12 | hook 失败或残留 | 返回 `V3_MEDIA_CLEANUP_INCOMPLETE`，不得伪 cancelled |
| RC13 | Runtime 启动 orphan cleanup | 仅清理由合法 owner manifest 标记的目录；未知/链接目录保留 |
| RC14 | API POST/GET/DELETE | 同一 task 事实；unknown 为 404；响应 `Cache-Control: no-store` |
| RC15 | 清理与隐私 | task 文件/目录/活动 hook=0；公开扫描 Cookie/path/audio=0 |
| RC16 | 回归与规格审查 | ASR/credential/全 Runtime 通过；Fatal=0/Major=0 |

RC01..RC16 不得 N/A。本阶段真实数据是既有私有真实 B站 WAV 的受控字节副本；它只验沙箱与清理，不计字幕/ASR production 成功。

