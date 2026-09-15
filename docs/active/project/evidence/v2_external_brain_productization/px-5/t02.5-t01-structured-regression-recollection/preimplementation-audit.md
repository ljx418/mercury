# T02.5 实施前审计

日期：2026-09-14。决定：`GO / REVISED AFTER FAIL-CLOSED PROBE`。Fatal=0，Major=0，Minor=0。

- 缺口已由 T03-A13 精确复现：T02.4 T01 command event 的 `structuredResult=null`，stdout/stderr 均为空；`.infra` T01 JSON 虽有 36/36，但未被 raw seal 绑定。
- 最小修复位于 P7 collector/derived/validation，不触及 P0-P6 产品行为。
- 新结构化 artifact 必须来自本次 T01 命令生成文件，不接受常量 36、自报 exitCode 或旧 run 文件。
- 隐私：只保留 assertion ID/pass，禁止复制 `detail`、extensionRoot、runtimeUrl、token 或用户路径。
- 停止条件：需要改产品代码/合同分母；真实 T01 非 36/36；新 run 其他 T02.4 分母回退；公开扫描命中；T03 仍需读取未封存 `.infra`。
- 首次 run `t02-r2-t01-structured-production-input-20260914T125102` 在 seal 前停止：36 个检查均 passed，但只有 34 个唯一 ID，`sidepanel_token_input_cleared` 重复三次。该 run 不得作为候选。
- 根因修复限定为 `chrome-v2-t01-r1-frontend.mjs` 的三个阶段化 assertion ID；没有删除检查、降低唯一性门槛或修改产品代码。隔离快照由 `5c75c4fd...` 前进到 `430cddcb7ff618978851af1f3b9a3c48f2370d36`。

允许实施并完整重采；失败则回到本计划，不进入 T03-5。
