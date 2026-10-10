# V3-2-1 PRD 规格检视

日期：2026-09-22  
结论：`PASS / NO MATERIAL DRIFT`

## 已达成

- Runtime 成为 media task 的单一事实源，create/get/cancel 使用冻结 task identity。
- 任务私有字节只进入随机 0700 目录和 0600 文件；公开响应不含绝对路径。
- 同一 task 幂等，修改 source/media/playback/part/policy 会 fail closed。
- 取消遵循 hook -> cleanup -> cancelled；失败时明确 failed/cleanup incomplete。
- 重启清理只删除有效 owner manifest 标记的受控 orphan，不扫描或删除未知用户目录。
- coordinator 的 adapter/policy registry 可扩展到未来 YouTube/小红书，但当前只注册 B站，没有通用任意 URL 接口。

## 未达成且未声称

本阶段没有访问 B站网络、创建 cookiefile、运行 yt-dlp/ffmpeg/SenseVoice、生成字幕、执行 tabCapture 或实现前端任务状态。真实 WAV 只验证 artifact 生命周期，不计 acquisition/ASR production success。

## 下一阶段风险

V3-2-2 需要 production sample registry。当前 revision 2 Schema 仍把旧 24-bin/双 reviewer 质量材料固定为 `productionReady=true` 前置，与 2026-09-22“跨模型退化和质量回退移入 V4”的新决策不一致。直接编码会导致规格双轨，必须先冻结 revision 3 或显式修订 v2 并独立审计。

