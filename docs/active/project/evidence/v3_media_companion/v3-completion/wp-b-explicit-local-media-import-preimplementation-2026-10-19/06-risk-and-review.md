# WP-B 风险与实施前审查

## 架构选择

| 路线 | 体验 | 架构/安全 | 结论 |
|---|---|---|---|
| 浏览器显式单文件 -> 认证流式导入 | 一次选择、真实进度、无需路径 | 短期 File 权限；复用私有沙箱 | 采用 |
| 用户输入路径 -> Runtime 读取 | 输入简单 | 任意文件读取、路径泄漏、WSL/Windows 歧义 | 拒绝 |
| 整文件 JSON/Base64/multipart buffer | 易实现 | 1 GB 内存放大、取消与进度不可靠 | 拒绝 |
| 继续 tabCapture | 无需本地文件 | 可信动作/浏览器版本不稳定、等待播放、录音感知差 | 保持 experimental |
| 云端上传解析 | 跨设备 | 违反原始媒体不出本机 | 拒绝 |

## 主要风险与防线

| 风险 | 影响 | 冻结防线 | 停止条件 |
|---|---|---|---|
| 任意文件访问 | 隐私越界 | 只接 File bytes；request/store 无 path/name | 出现路径 API、目录扫描、handle 持久化 |
| transport chunk 误判 | 合法大块被拒或内存放大 | 接受合理 ASGI chunk；writer memoryview 切 <=1 MiB | 单块 >1 MiB 被拒或二次全量复制 |
| 大文件资源压力 | OOM/磁盘占满 | 2 GiB/quota、空间预检、RSS/heap 门槛 | 全量 body 或资源无上界 |
| Origin/auth 漏洞 | 网页或其他扩展写本机 | privileged path + exact Origin/id + bearer + one-shot token | writer 在认证前创建 |
| 重启状态丢失 | GET 404、残留、假成功 | SQLite FULL/CAS、startup scan、manifest-aware cleanup | token/path 落盘或重启记录消失 |
| 双消费者早清理 | 有转写无截图或反之 | audio/visual receipts + T1-T4 + barrier 单 cleanup owner | 任一消费者单独清共享输入 |
| 恶意媒体 | ffmpeg 风险 | verified binary、严格 argv/deadline/JSON whitelist | shell=True、任意参数、stderr 出界 |
| SourceAuthority 分裂 | 串页/重复结果 | 同 task/source bind，不建 file authority | 新 authority key 或跨 source attach |
| 大文件假绿 | 稀疏/填零不代表实际流式处理 | 私有有声动态 seed + 真转码 + st_blocks + ASR/frame oracle | sparse/truncate/padding/mock |
| UI 假进度 | 用户误判卡死 | upload 原生 bytes；其他阶段只显示阶段+计时 | 伪百分比或 >10s 无活动状态 |

## 审查闭环

首轮独立 Codex 审查结论为 Fatal=0/Major=5/Minor=3，已集中修订：

1. 新增 `LocalMediaImportStore` SQLite schema、事务、startup scan 与 restart GET oracle。
2. 冻结 `LocalMediaConsumerBarrier`、ImportedVisualReceipt、T1-T4、route-aware cleanup 和五类 hard-kill。
3. 将 1 MiB 改为 writer 内部分片，不再作为 ASGI chunk 拒绝阈值。
4. 补 exact Origin/CORS/bearer 顺序和 `AUTH_REQUIRED/ORIGIN_MISMATCH`，闭集为 18 码。
5. 补私有真实种子、确定性真转码、allocated ratio、ASR/动态帧与资源阈值 registry。
6. 架构图显式拆出 store、双沙箱、barrier、ASR/视觉消费者；原型补 tab ARIA。

最终独立审查只允许对上述修订做一次 focused recheck；Fatal/Major 清零后即进入实现门限，不重复发起全文外审。实施中只有公共合同/安全边界变化才升级回 Codex。
