# V3-2-0b-1 Provider Adapter 与 Native Host 验收计划

日期：2026-09-22。固定 `B01-01..B01-16`，不得 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| B01-01 | 构造 Provider contract | TaskAudioRef/segment/transcript 字段闭集，portal/Cookie 字段不存在 |
| B01-02 | 注册冻结 provider | 仅 closed registry 中 ID 可解析；重复注册拒绝 |
| B01-03 | 请求未知 provider/class | fail closed，不动态 import、不执行 |
| B01-04 | 构造 Linux/Windows 命令 | executable 与参数来自 adapter 常量和冻结安装根；0 shell |
| B01-05 | 提交绝对路径、`..`、symlink/hardlink 音频 | 全部拒绝 |
| B01-06 | 提交非 WAV 或非 task-private 文件 | 全部拒绝 |
| B01-07 | 运行子进程 | cwd 限定 task-private；stdin 关闭；stdout/stderr 有上限 |
| B01-08 | 检查环境 | proxy/hub/token/Cookie/Authorization 等敏感变量不继承 |
| B01-09 | 正常完成 | 捕获 exit code、耗时、受限输出；子进程和句柄清理 |
| B01-10 | timeout | terminate 后必要时 kill；返回稳定 failure code；task-private 清理 |
| B01-11 | cancel | 同上；不可留下 child 或部分结果 |
| B01-12 | child crash / 非零退出 | fail closed；stderr 裁剪且不进入公开 evidence |
| B01-13 | 超大 stdout/stderr | 达上限即终止，不造成内存无界增长 |
| B01-14 | 真实 Linux binary usage 探测 | 可执行文件来自 0b-0 已校验归档；输出精确包含冻结的 `-m ... -a ... [--vad ...] [--srt]` 形状；上游 `--help` 实测基线 exit=1 可接受，但不得加载模型、读取音频或发起网络 |
| B01-15 | Provider 生命周期 | load→selfTest→close 可重复；关闭后 transcribe 拒绝 |
| B01-16 | PRD/秘密扫描 | portal 解耦、Tiny 边界不变；公开证据秘密/绝对路径命中 0 |

## 防假绿

- mock child 成功不能替代 B01-14 真实 binary 探测。
- `subprocess` 被调用不能替代 shell/env/path 审计。
- Linux 真实执行不冒充 Windows 真实执行；Windows 只算命令与归档静态覆盖。
- 本阶段输出文本不能冒充 0b-3 timestamp normalizer 或 0b-5 真实质量推理。
