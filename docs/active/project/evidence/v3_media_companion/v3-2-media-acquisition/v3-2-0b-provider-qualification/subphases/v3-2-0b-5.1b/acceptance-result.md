# V3-2-0b-5.1b 验收结果

日期：2026-09-22。结论：`PASS`，仅限质量失败状态传播。

权威 run：`v3-2-0b-5.1b-20260922T084116Z`。

## 固定分母

| ID | 结果 | 实测证据 |
|---|---|---|
| B051B-01 | PASS | Runtime catalog 返回 Paraformer `failed_current_gate` |
| B051B-02 | PASS | `installable=true`、`selectable=false`；安装成功不解锁选择 |
| B051B-03 | PASS | 安装前后 `effectiveModelId=faster-whisper-tiny` |
| B051B-04 | PASS | Settings 显示“当前真实质量门禁未通过”和红色“已安装 · 质量未通过”，未声称双人盲评完成 |
| B051B-05 | PASS | 官方远端资产经历 checking/downloading/verifying/self_testing/installing/ready；卸载、离线包入口和资源披露保持 |
| B051B-06 | PASS | Runtime tests 321 passed；前端 full test、typecheck、build 均 exit 0；真实 Chrome B04-01..16 为 16/16 PASS |
| B051B-07 | PASS | `claimsV3_2A06=false`、`productionSelectionEnabled=false`；V3-2-0b 继续 FAIL/REPLAN |

固定分母：`7/7 PASS`。Fatal=0、Major=0。

## 真实浏览器证据

- 四视口：Side Panel 360/420、Workspace 768/1280 均 `scrollWidth=clientWidth`。
- Axe：安装弹窗及四视口共 5 个扫描面，violations 均为 0。
- 安装状态：`checking -> downloading -> verifying -> self_testing -> installing -> ready`。
- 安装资产：FSMN-VAD、native runtime、Paraformer Q8 的字节数与 SHA-256 均精确匹配闭合 catalog。
- 质量失败卡片浏览器计算色：`rgb(180, 35, 24)`；选择按钮禁用。
- 卸载后模型目录、run 私有根、Chrome profile 和 Runtime/Chrome 进程均无残留。
- 公开证据 8 文件秘密/绝对路径扫描 0 命中。

## 证据哈希

- `result.json`：`9c8e8ec2baf43ecd6549bbdd81c0b648abda07b175193f32104d06220d35d2a4`
- `prerequisites.json`：`36ec702ddf4eecfef5f586345c0f069f5de299ce3791d2a87cd0609fb76da8d9`
- 360px 最窄视口截图：`97dfeb0bcb69b21a8e4baf157be5648e24eaaee8786882a999337563f5ccff71`

## 作废 run 隔离

- `073933Z`：前置输出含宿主绝对路径，已作废。
- `080229Z`：安装终态诊断不足，已作废。
- `081143Z`：卡片“可用”与质量失败并列，已作废。
- `082243Z`：测试把安装后文案错误绑定到安装前观察，已作废。
- `082910Z`：文案正确但质量失败状态继承绿色，视觉审计作废。

所有作废 run 均保留 `invalidated.json` 或对应停止记录，不得与权威 run 拼接。

本 PASS 不修复 Paraformer 的真实非静音 bin 遗漏，不改变 V3-2-A06。
