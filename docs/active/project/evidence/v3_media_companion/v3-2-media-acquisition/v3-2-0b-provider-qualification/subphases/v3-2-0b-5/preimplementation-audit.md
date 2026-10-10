# V3-2-0b-5 实施前审计

日期：2026-09-22  
结论：`GO FOR V3-2-0b-5 ONLY`

## 输入门槛

- 0b-0..3：PASS；候选资产、native host、normalizer 已冻结。
- 0b-4 accepted run `v3-2-0b-4-20260922T054533694Z`：16/16；独立 verifier 12/12；真实安装链与三文件 hash 通过。
- 样本 registry 仍为原三个 BVID/cid/P1/30s..150s，没有替换分母。
- 桌面 `myCk.txt` 存在；仅允许私有进程验证结构，不在文档中记录内容。
- frozen yt-dlp、ffmpeg、ffprobe 与 candidate asset 均存在且 hash 与合同一致。

## 独立风险核查

1. WSL `unshare -n` 不可用，不能把失败的 namespace 调用冒充断网。首轮 systemd `IPAddressDeny=any` 探测曾因代理路径偶发成功，因此不能单独作为硬门槛；已改为 `RestrictAddressFamilies=AF_UNIX` 拒绝 AF_INET/AF_INET6，真实 HTTPS 请求稳定失败，并叠加 `IPAddressDeny=any`。单独 `DevicePolicy=closed` 也不能隐藏 WSL `/dev/dxg`；已增加 `PrivateDevices=yes`，实测单元内设备节点 absent/denied。`taskset`/`prlimit` 固定 CPU/地址空间。
2. systemd 单元输出的 Memory peak 不能单独代替进程峰值；同时用 `/usr/bin/time -v` 记录 maximum resident set。
3. 音频在 0b-5 后暂时私有保留是 0b-6 同源比较的必要输入；保留边界和 0b-6 后强制删除已写入计划，公开扫描拒绝任何 WAV/GGUF。
4. worker 只收 task-local WAV 与 frozen install root，不收 URL、Cookie、argv 扩展或任意路径；产品 `NativeAsrProcessHost` 仍执行 link/shape/name 校验。
5. 三样本输出质量未知。0b-5 只判运行、资源和结构；文本优劣必须由 0b-6 两名 reviewer 48 判断决定。

Fatal=0 / Major=0 / Minor=1。Minor M-1：systemd user service 的内核网络/设备策略依赖当前 Linux/WSL 环境，Windows 等价策略不在本阶段实测；不阻断当前 linux-x64 资格 run，也不得扩大为 Windows 资格通过。
