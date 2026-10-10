# V3-2-0b Provider / Native ASR 威胁模型

日期：2026-09-22。状态：`DOCUMENT CANDIDATE`。

| Threat | Control | Required negative evidence |
|---|---|---|
| 模型或 binary 供应链替换 | 固定 official URL/revision/bytes/SHA-256/license；原子发布 | 错 hash、错 revision、截断、404、重定向越界全部拒绝 |
| GGUF/压缩包路径攻击 | 隔离 staging；拒绝 symlink/hardlink/traversal/超限文件 | zip-slip、文件数/体积超限不产生 ready 模型 |
| remote code / shell 注入 | native binary 固定；`remoteCode=false`；argv 数组；无 shell | 客户端 argv/path/provider class 被拒绝 |
| child process 逃逸或残留 | 最小环境变量、task-private cwd、timeout/cancel process group、cleanup barrier | cancel/crash/restart 后 0 child、0 private file |
| 推理期联网或 token 泄漏 | 安装与推理分阶段；不继承代理/HF token；OS 能提供隔离时 deny network，否则以进程 socket 观测为硬门槛，出现任一外联即资格失败 | socket/环境扫描 0，公开 secret scan 0；无法证明 0 外联时不得通过 |
| 资源耗尽 | 8 GiB address-space cap、8 threads、单任务、输入时长上限 | OOM/timeout 转 failed，不杀 Runtime，不误报 ready |
| 时间戳伪造或解析混淆 | 只解析冻结 SRT/text；segment 单调/范围/ID 校验 | 空、逆序、重叠、NaN、超窗全部失败 |
| 盲评标签泄漏 | label map 私有；HTML 无 provider/model/repository；导出无 transcript | 静态和浏览器字节扫描 0 命中模型标识 |
| Cookie/音频进入公开证据 | 私有 run 与 public evidence 分离；清理 receipt 先于终态 | Cookie 原值、绝对路径、媒体/音频正文 0 命中 |
| 质量状态假绿 | installation state 与 quality state 分离；adjudication 只产生待审结果，只有 A01..A18 与独立出门审查全部通过后 stage-gate owner 才可写 `production_qualified` | 安装/self-test/单 reviewer/adjudication 单独触发状态晋级必须失败 |
| 双 reviewer 分母被重复或裁剪 | Semantic validator 从两份不可变 review 重算两份 hash、48 个 reviewer+sample+bin 唯一键、24 个 sample+bin 键和 numerator；不信任 summary 自报；分歧记录不改写原判断 | 重复 bin、同 reviewerId、同 review hash、缺 bin、伪造 summary、用 24 条 resolved 结果替代 48 条原判断均拒绝 |

本阶段不新增 Cookie 权限、不扩大 B站域名、不上传音频、不实现平台绕过。未来 YouTube/小红书只复用 `AsrProviderAdapter`，各自媒体获取策略仍须独立授权和真实矩阵。
