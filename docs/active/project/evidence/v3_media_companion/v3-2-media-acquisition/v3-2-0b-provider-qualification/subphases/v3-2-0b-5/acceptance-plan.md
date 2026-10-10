# V3-2-0b-5 低资源真实推理验收计划

日期：2026-09-22。固定 `B05-01..B05-16`，无 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| B05-01 | 核对三个 sample registry | sampleId/BVID/cid/P1/window 精确等于冻结值 |
| B05-02 | 核对工具与候选资产 | yt-dlp、ffmpeg、ffprobe、runtime/model/VAD bytes+hash 全匹配 |
| B05-03 | 读取授权 Cookie | 仅 B站域固定九名称；原值不落公开 evidence |
| B05-04 | 获取并 trim 三样本 | 各 120±0.05 秒、mono PCM S16LE 16kHz；源媒体随即删除 |
| B05-05 | 建立低资源单元 | 8 CPU affinity、8 GiB MemoryMax/address space、swap 0 |
| B05-06 | 验证推理期网络拒绝 | 同属性单元中真实 HTTPS 请求失败；worker 继承 `RestrictAddressFamilies=AF_UNIX` + `IPAddressDeny=any` |
| B05-07 | 验证无 GPU | `PrivateDevices=yes` 单元内 `/dev/dxg`/DRI 不存在或不可读；CUDA_VISIBLE_DEVICES=-1；候选 requiresGpu=false |
| B05-08 | 运行三个 candidate worker | 全部 exit 0、无 timeout/OOM/crash，provider/model ID 精确 |
| B05-09 | 规范化输出 | 每样本非空 timestamped segments，0 逆序/重叠/越界/重复 |
| B05-10 | 固定窗口覆盖 | candidate duration=120000ms；segments 全在 0..120000ms |
| B05-11 | 资源测量 | 每样本 elapsed、RTF、peak RSS、CPU time 均为实测非空 |
| B05-12 | 资源硬门槛 | 每样本 peak RSS <= 8 GiB；安装目录 <= 512 MiB；0 OOM |
| B05-13 | 0b-6 私有 handoff | 三 WAV hash、三 candidate hash、相同 runId/manifest hash；权限 0700/0600 |
| B05-14 | 清理敏感中间物 | Cookie 临时文件和 source media=0；worker task roots=0；无子进程残留 |
| B05-15 | 公开证据扫描 | Cookie 值、正文、WAV/GGUF、绝对 private path 命中 0 |
| B05-16 | PRD 边界 | 仅证明真实低资源推理可运行；A16 质量、production_qualified 与模型选择仍 pending |

出门要求：16/16 PASS，Fatal=0，Major=0。任何失败都作废整 run 并返回计划阶段。
