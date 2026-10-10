# V3-2-2 B站字幕与媒体 Acquirer 验收计划

日期：2026-10-06。固定分母：`BA01..BA16`，不得 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| BA01 | 校验 revision 2 与 revision 3 Schema | v2 字节不变；v3 meta PASS；v3 不含 comparison/reviewer/adjudication 字段 |
| BA02 | 授权 Chrome 单 run 重探测 Amendment 1 的 12 URL | 12 唯一 URL，6+3+1+1+1，identity/part/page/server/screenshot hash 可复算；锚点当前为 subtitle；任一分类漂移即整体失败 |
| BA03 | 检查 ASR baseline | SenseVoice model/revision/weights 精确；cross-model gate 为 V4 |
| BA04 | 无 lease 调用凭据 route | `V3_MEDIA_LEASE_REQUIRED`，0 文件/子进程 |
| BA05 | 错 task/过期/撤销 lease | 分别 fail closed，0 cookiefile/media |
| BA06 | 创建 cookiefile | 随机名称、0600、任务 0700、只含白名单域/名称；命令行和日志无值 |
| BA07 | 凭据字幕样本 6 个 | 6/6 当次 API subtitleItems 非空并取得真实字幕 body；有序非空 segment，时间在媒体范围内，source/hash 闭合 |
| BA08 | 公开/页内字幕回退 | 只有凭据字幕明确不可用后执行，route sequence 连续 |
| BA09 | 凭据媒体样本 2 个 | 只获取目标分 P 音频，artifact byte/hash 可复算且在配额内 |
| BA10 | multipart 样本 | 只处理 registry 指定 part，其他 part 0 artifact |
| BA11 | restricted 样本 | 明确 blocked/platform rejected，不绕过、不 capture、不伪成功 |
| BA12 | 任意 URL/未注册 adapter/identity drift | 全拒绝，下载器未启动 |
| BA13 | downloader 超时/403/超限/ffmpeg 失败 | 封闭失败码、唯一终态、cleanup 后 0 残留 |
| BA14 | 取消竞态 | 子进程回收、句柄关闭、cookiefile/media 删除后才返回 cancelled |
| BA15 | 公私证据扫描 | Cookie 值、token、cookiefile/媒体绝对路径、原始字幕 body 0 命中 |
| BA16 | 回归和审计 | 媒体合同、Runtime 全量、V3-1.3 回归通过；Fatal=0/Major=0 |

真实验收只能使用当前授权会话原本可访问的内容。合同 fixture 只能计负例，不能计 BA07..BA11。
