# V3-2-0 合同、依赖与生产样本冻结开发计划

日期：2026-09-18。状态：`PREIMPLEMENTATION CANDIDATE`。本子阶段不实现媒体获取产品代码。

## 1. 目标

把 V3-2 后续实现所依赖的机器合同、工具链、模型、Chrome 权限目标和 12 个真实 B站样本冻结成可复算输入。输出必须区分“已探测事实”“预期路线”和“需人类对照原视频判断的 comparison window”，不得把机器输出升级为人工真值或媒体转写成功。

## 2. 实施顺序

1. 执行 49 项合同审计，保存完整结果与文件 hash。
2. 从官方来源选择并隔离安装 exact `yt-dlp` stable；冻结版本、来源、license、wheel/entrypoint hash，验证 no-config/no-plugins/no-update/no-exec 参数策略。
3. 冻结系统 `ffmpeg/ffprobe` 版本、可执行字节 hash、codec 能力；后续 adapter 只允许 task-private 本地输入。
4. 冻结 `faster-whisper 1.2.1`、其直接运行依赖、`small` 模型精确 revision 与受控 cache 文件清单/hash；进行一次完全离线加载探测。
5. 用 V3-1.3 一次性凭据通道和全新 disposable Chrome profile 重探测 revision 1 的同 12 个 URL，生成 revision 2；不读取产品外的任意 Cookie 来源。
6. 为 3 个 ASR 样本各固定一个 120 秒窗口；机器生成 small/base 两套输出和 24 个盲评 bin，两个独立人类审查者与分歧复核完成后才能标记 comparison passed。
7. 运行 Schema、secret/path scan、PRD 对账并生成 V3-2-0 出门报告。

## 3. 输出

- `dependency-manifest.json`：工具、模型、来源、license、hash 和离线能力。
- `sample-registry-revision2.json`：12 URL/identity/part/duration/route expectation 与探测证据引用。
- `comparison-bundle.private.json`：3 个待人工双审窗口与双模型输出，只留在私有 run，不含 Cookie、绝对路径或原媒体。
- `contract-audit.json`：49/49 mutation 结果。
- `acceptance-result.md`、`prd-review.md`、`preimplementation-audit.md`。

## 4. 不得实施

本子阶段不得新增 Runtime acquisition API、下载任务状态机、yt-dlp/ffmpeg 产品 wrapper、ASR adapter、tabCapture/offscreen 产品代码或媒体 UI。不得复制 BiliNote dirty diff/denylist 文件，不得规避 DRM、付费、地域或账号限制。

## 5. 停止条件

- 官方依赖无法固定版本、来源、license 或字节 hash。
- 模型不能在网络关闭后从受控 cache 加载。
- 12 个 URL 无法维持冻结的 6 subtitle + 3 ASR + 1 multipart + 1 restricted + 1 low_signal 主分类。
- Cookie、Cookie 文件路径、profile 路径、stream ID 或原始媒体进入公开材料。
- 任一合同 case 失败，或机器输出被冒充为人工真值/自动通过。
