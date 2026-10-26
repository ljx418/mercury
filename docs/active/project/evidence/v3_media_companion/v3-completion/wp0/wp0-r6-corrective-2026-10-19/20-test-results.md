# WP0 R6 限定纠偏测试结果

| 验证 | 结果 |
|---|---|
| Extension typecheck | exit 0 |
| R6 G1 TypeScript 子树 | 9 files / 41 tests，exit 0 |
| RLY11-N07 定向 | 7/7，exit 0 |
| RLY11-N18 定向 | 2/2，exit 0 |
| RLY11-N22 定向 | 3/3，exit 0 |
| producer bootstrap 定向 | 3/3，exit 0 |
| relay 静态合同 | 45/45，exit 0 |
| relay v11 baseline | 50/50，exit 0 |
| relay v11 mutations | 16/16，exit 0 |
| extension build | exit 0，4.67 MB |
| G3/G4 Python 集合 | 首轮 27/28；唯一失败为子进程 `ENOMEM`，同一 N09 定向复跑 1/1 |
| G2 owned Chrome | 0/7 接受；首次运行真实失败，未重复运行 |

## 反虚假验收说明

- 不以 fixture 解析、代码存在、固定字符串或 test-side 布尔值替代生产行为。
- G2 驱动器修正后尚未重新执行可见正控，因此不能从“驱动器可运行”推导 G2 通过。
- Python 组如实保留首次 `27/28 + ENOMEM`，不改写为一次干净的 28/28。
- 测试全程未播放声音；唯一 Chrome 命令显式包含 `--mute-audio`。

