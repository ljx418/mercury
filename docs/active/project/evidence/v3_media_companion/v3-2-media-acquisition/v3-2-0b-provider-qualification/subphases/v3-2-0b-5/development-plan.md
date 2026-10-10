# V3-2-0b-5 低资源真实推理开发计划

日期：2026-09-22  
状态：`AUTHORIZED / PREIMPLEMENTATION AUDITED`

## 目标

用固定三个真实 B站 P1 的同一 `30s..150s` PCM 音频窗口，在 8 CPU、8 GiB、无 GPU、推理期网络拒绝的环境运行 `funasr-paraformer-q8`，生成可供 0b-6 双盲比较使用的私有 timestamped transcript，并公开不含正文/音频/路径的资源与结构证据。

## 固定输入

| sampleId | BVID | cid | window |
|---|---|---|---|
| v3-asr-comparison-01 | BV1sMNtzJE5B | 30592600559 | P1, 30s..150s |
| v3-asr-comparison-02 | BV1xz4y1S7yF | 286754257 | P1, 30s..150s |
| v3-asr-comparison-03 | BV1Bb411w741 | 61744125 | P1, 30s..150s |

来源 registry 固定为 `v3-2-0-contract-dependency-samples/asr-comparison-candidates.json`。授权 Cookie 只用于 yt-dlp 获取原始音频，不能进入推理进程、命令日志或公开证据。

## 实施实体

1. `v3_asr_qualification_worker.py`：单样本 worker，只调用 `FunAsrLlamaCppProviderAdapter` 与 `normalize_srt`，输出私有 segments；不下载、不读 Cookie。
2. `v3_asr_low_resource_runner.py`：校验 frozen assets/yt-dlp/ffmpeg/Cookie registry；下载后仅保留三个 120 秒 WAV；逐样本启动隔离 worker；汇总公开 evidence 与私有 0b-6 handoff。
3. 推理进程固定封装：`systemd-run --user --wait --pipe -p RestrictAddressFamilies=AF_UNIX -p IPAddressDeny=any -p PrivateDevices=yes -p DevicePolicy=closed -p MemoryMax=8589934592 -p MemorySwapMax=0`，内部再执行 `taskset -c 0-7 prlimit --as=8589934592 -- /usr/bin/time -v ...worker`。`RestrictAddressFamilies` 是拒绝 AF_INET/AF_INET6 的主防线，`PrivateDevices` 隐藏宿主 `/dev/dxg`/DRI，其他属性为附加防线。
4. 每个 worker 的 `CUDA_VISIBLE_DEVICES=-1`；Provider child 继续使用最小环境，零代理/零 token、`shell=False`。
5. 资源口径：`/usr/bin/time -v` 的 maximum resident set、wall elapsed、normalized candidate duration，`RTF=elapsed/120`；同时记录 systemd 成功、CPU affinity、memory/address-space ceiling、GPU device deny 与 network deny probe。

## 生命周期

- 获取阶段允许 B站网络；Cookie 置于一次性 Netscape 文件并在下载后立即删除，源媒体 trim 后立即删除。
- 推理阶段由 systemd `RestrictAddressFamilies=AF_UNIX` 拒绝 AF_INET/AF_INET6，叠加 `IPAddressDeny=any`；三个 worker 不接收 URL/Cookie。
- accepted run 的三个 WAV、candidate transcript 和 label map 仅保留在 `.navia/v3-asr-provider-qualification-private/<runId>/`，权限 0700/0600，供紧接的 0b-6 同 run lineage 生成比较包。
- 0b-6 bundle 生成后必须删除 WAV、模型副本、Cookie 临时文件和 source media；公开 evidence 永不包含这些对象。

## 停止条件

任一样本不能下载/trim 到 120 秒、worker 非零、OOM/超时、RSS > 8 GiB、RTF 缺失、GPU 可读、network deny probe 未拒绝、SRT 为空/逆序/重叠/越界、Cookie/source/private path 泄漏，均使 0b-5 FAIL/REPLAN。不得只跑剩余样本或跨 run 拼接。
