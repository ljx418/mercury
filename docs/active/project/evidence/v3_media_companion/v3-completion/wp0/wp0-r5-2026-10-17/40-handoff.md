# WP0 R5 Handoff（2026-10-18）

Candidate: `wp0-r5-2026-10-17`
阶段结论：**R5 NO-GO** —— R5-0 全绿并已证明模型就绪；R5-2 用户可达媒体面真实路径失败，canary 未运行
证据目录：`docs/active/project/evidence/v3_media_companion/v3-completion/wp0/wp0-r5-2026-10-17/`

## 0. 需要 Codex 决策的事项

R5 的模型侧阻塞已解除，但**产品 UI 侧的用户可达路径在本环境失败**，需要裁决：

> 在真实 Chrome 侧边栏中，`media-companion-launch` 与 `media-connection-settings`
> 渲染为**空容器**（`innerText === ""`），其主动作「启用并分析当前视频」在被
> **可信点击**（`Input.dispatchMouseEvent`，`isTrusted=true`，同一 target 上无关标签
> 点击已证明有效）后，**50 秒内 10 次轮询状态零变化**，且不产生原生弹窗或任何
> Runtime 请求；面板状态行恒为 `Page unknown`，Know 标签页报
> `Companion Runtime request was rejected.`

同时发现两个**产品侧事实**，可能需要 Codex 一并裁决：

| # | 事实 | 影响 |
|---:|---|---|
| A | 生产构建下 `getE2ETabId()`（`entrypoints/sidepanel/main.tsx:3610-3613`）在 `__NAVIA_E2E_BRIDGE__` 为 false 时**直接返回 null**，因此 `?naviaE2ETabId=` 对生产构建无效 | 生产构建的媒体面**只能**依赖 `chrome.tabs.query({active:true})`，无法被指向指定标签页；自动化与人工都必须让视频页保持 active |
| B | Chrome 137+ 已使 `--load-extension` 失效；本轮改用 CDP `Extensions.loadUnpacked` 才装上扩展 | 仓库既有 e2e harness 仍依赖 `--load-extension`，在当前 Chrome 上已不工作 |

请 Codex 择一：

1. 判定这是**环境/账号态问题**（例如 Companion Runtime 会话未建立、门户未注册），指明恢复条件后我重跑 R5-2；
2. 判定这是**产品缺陷**（媒体卡片空渲染 / 授权动作无响应），转入缺陷修复后再执行 R5；
3. 授权使用 `build:e2e`（`NAVIA_E2E_BRIDGE=1`）以启用 `naviaE2ETabId` 路径跑 canary —— 但这**不是 §4 要求的 production build**，需 Codex 明确豁免；
4. 其它指示。

在得到指示前不重跑 canary（§6：条件未改变禁止重跑；本轮配额仍为 **0**）。

## 1. changed files

### 生产代码（UI / 编排，公共合同 none）

```
apps/chrome-extension/src/modules/media_companion/settings/AsrModelSettingsPanel.tsx
  211d3fc8f779d56fa889db3aa382d6660c62257ecf9e99a729d506bbea525fdb
apps/chrome-extension/src/modules/media_companion/settings/AsrModelSettingsPanel.test.tsx
  1310f17ce351038f89e58c383d337b6caf48920dfdfc264d7a0c8f7e1d9eea03
```

### 新增 R5 资产（探针 / canary 驱动器，均不进入生产包）

```
apps/chrome-extension/e2e/lib/rawCdp.mjs
  50a593c14eaf0c9b11e46941c32eb35dbafce527cb4d794ea2ca3553c7f14f49
apps/chrome-extension/e2e/r5-headless-feasibility-probe.mjs
apps/chrome-extension/e2e/r5-accelerator-probe.mjs
apps/chrome-extension/e2e/r5-loadext.mjs
apps/chrome-extension/e2e/r5-canary-stage1.mjs
apps/chrome-extension/e2e/r5-canary-a.mjs … r5-canary-r.mjs
```

### 明确未修改

`services/local-runtime/**` 全部；extension 其余源码；v10 schema / fixture /
20-40 inventory / FailureCode / 阈值 / 公共 API / Origin / ticket TTL /
SourceAuthority / 产品 terminal 定义；R0–R4 全部历史证据目录。

## 2. 合同变化

**公共合同：none。** 仅内部新增纯函数与一次性 UI 编排。

## 3. 全部命令与退出码

### 门禁

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `sha256sum -c 50-payload-manifest.sha256`（R4 证据） | 0 | 4 / 4 OK |
| fixture / verifier SHA-256 | — | 与 `60-codex-r4-checkpoint.md` 逐字一致 |
| `python3 -B …/verify-…-v10-contract.py` | **0** | **50 / 50** |
| `python3 -B …/verify-…-v10-mutations.py` | **0** | **15 / 15** |

### R5-0 预检与 64 纠偏

| 命令 / 观察 | 退出码 | 结果 |
|---|---:|---|
| `npm run typecheck` | 0 | PASS |
| `npm run build` | 0 | Σ 4.66 MB，98 files |
| `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | 229 / 229 |
| `pytest -k "capture or transcript or outline or fault or product or asr" -q` | 0 | 247 passed |
| `node --test …/relay_ownership_contract.node-test.mjs` | 0 | 42 / 42 |
| 端口 17861 preflight | 0 | FREE |
| `GET /v1/asr/catalog` / `GET /v1/asr/settings` | 200 / 200 | ready + verified + effective |
| `PATCH /v1/asr/settings {"requestedModelId":"funasr-sensevoice-small-q8"}` | 200 | effectiveModelId 生效 |
| 64 UX 定向测试 | 0 | **9 / 9** |

### 收口集中回归（§5，一次）

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `npm run typecheck` | 0 | PASS |
| `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | 0 | **229 / 229** |
| `npx vitest run --maxWorkers=2` | 0 | **568 / 568**（67 files） |
| `npm run build` | 0 | Σ 4.66 MB |
| `pytest -k "capture or transcript or outline or fault or product or asr" -q` | 0 | **247 passed** |
| `node --test …/relay_ownership_contract.node-test.mjs` | 0 | **42 / 42** |
| `python3 -B …/verify-…-v10-contract.py` | 0 | **50 / 50** |
| `python3 -B …/verify-…-v10-mutations.py` | 0 | **15 / 15** |
| secret / raw-media / private-path scan | — | **0 命中** |
| owned cleanup scan | — | Runtime **0** · owned Chrome **0** · 端口释放 · WSL `/tmp` 清空 |

## 4. 脱敏身份证据

| 项 | 值 |
|---|---|
| build 根 / 文件数 | `apps/chrome-extension/chrome-mv3-unpacked` / 98 |
| build tree sha256 | `f5b7f976c774f57e78b10bc7702f42b261824166301ff3d36b2975beef65f7bf` |
| manifest | Navia 0.1.0，MV3 |
| permissions | activeTab, offscreen, scripting, sidePanel, storage, tabCapture, tabs |
| host_permissions | `http://127.0.0.1:17861/*`、`http://localhost:17861/*` |
| modelId / providerId | `funasr-sensevoice-small-q8` / `funasr_edge_local` |
| frozen revision | `90c1c61912018b70ada0fcc024ea24aca62f2e63` |
| installation.state / verifiedAt | `ready` / `2026-10-17T16:57:53.727286Z` |
| effectiveModelId | `funasr-sensevoice-small-q8` |
| model SHA-256 | `4ae45c94…844b7c5`（model）· `1270f255…f5719f5479`（VAD）· `c41a53b0…e64c30edd`（binary） |
| Runtime PID / 端口 | 761733 / 17861（均已终止/释放） |
| Chrome PID / 端口 / profile | 56980 / CDP 9222 / `navia-b5-3-profile-r5canary`（均已终止/删除） |
| extension id | `gcifeacdafknfikkfccniigjdcofpcha` |
| 固定 BVID | `BV1pohR6rEEh`（已加载，未开始分析） |
| run / task / capture id | **无**（canary 未运行） |
| 截图索引 | **无** |

## 5. 真实 run 计数

| 项 | 次数 |
|---|---:|
| **R5 canary** | **0** |
| capture 启动 / PCM / ACK / ASR / transcript | **0 / 0 / 0 / 0 / 0** |
| acquisition / materialize / product terminal | **0 / 0 / 0** |
| 声音播放 | **0**（每次 Chrome 均带 `--mute-audio`） |
| 云 Provider | **0** |
| 六视频 | **0** |
| owned Chrome 实例 / owned Runtime | 1 / 1（均已清理） |
| 固定 BVID 访问 | 1（仅加载与侦察） |
| runner 成功路径直调 Controller/materialize/db/store/grant/transcript/terminal | **0** |

## 6. PRD 覆盖

见 `30-prd-review.md`。R5-0 六项中 5 项通过、第 5 项部分；64 五项缺口**全部完成**；
61 §5 十一条 oracle 中 4 条可判定（#1 部分、#2 = 0、#4 = 通过、#10 = 0、#11 = 0），
**#3、#5、#6、#7、#8、#9 无观测**（canary 未运行）。

## 7. secret / cleanup

- 公开证据中 Cookie / API key / ticket / 原始媒体 / 转写全文 / 绝对私有路径：**0**。
- 扫描 `SESSDATA` / `bili_jct` / `buvid` / `cookie=` / `Bearer <值>` / `sk-…` /
  `api_key` → **0 命中**。
- 模型与下载缓存保留在 Windows 持久目录（用户资产，未删除）；本轮 profile 与 scratch
  已删除。
- owned Chrome 14 进程、Runtime、端口 17861/9222、profile、WSL `/tmp` scratch
  **全部清理**；本机原有 Chrome（PID 18968，`--no-startup-window`）**未触碰**。

## 8. 剩余风险

| # | 风险 | 等级 | 说明 |
|---|---|---|---|
| 1 | 用户可达媒体面真实路径失败 | **高** | 见 §0，阻塞 canary |
| 2 | 生产构建忽略 `naviaE2ETabId` | 中 | 使媒体面只能依赖 active tab，自动化与人工都受限 |
| 3 | Chrome 137+ `--load-extension` 失效 | 中 | 仓库既有 e2e harness 在当前 Chrome 上需改用 `Extensions.loadUnpacked` |
| 4 | 无视觉 Provider 时只能得到冻结合同允许的 `degraded` | 低（预期） | 届时须披露视觉证据缺失，不得声称 ready |
| 5 | 本轮未消费 canary 配额 | 低 | 条件未变，重跑仍受限但未用尽 |

## 9. 交接检查项

| 项 | 状态 |
|---|---|
| changed files | ✅ §1（含 SHA-256） |
| 合同变化 | ✅ 公共 **none** |
| 命令 / 退出码 | ✅ §3 |
| build hash | ✅ `f5b7f976…5f7bf`（98 files） |
| 脱敏 Runtime/Chrome PID、端口、profile owner | ✅ §4（均已清理） |
| run / task / capture / model identity | ✅ model 完整；run/task/capture **未产生** |
| 真实 UI 步骤 | ⛔ canary 未运行，**0 步** |
| PCM / ASR / acquisition / materialize / product terminal | ⛔ **无观测** |
| revision / fence | ⛔ **无观测** |
| 截图索引 | ⛔ **无** |
| secret / cleanup | ✅ 命中 0；owned 残留 0 |
| Fatal / Major / Minor | **0 / 1 / 0** |
| 剩余风险 | ✅ §8 |
| commit / push / reset / clean / checkout / revert | ✅ **均未执行** |
| HEAD | ✅ 未变（`a303551a5bf89c26ff36b24ac06c7e30c334db27`，`main`） |
| dirty worktree | ✅ 保留，未覆盖，历史失败证据未删除 |
| 冻结材料 | ✅ 未修改 schema / fixture / inventory / 阈值 / 公共合同 |

## 10. Automation 停止原因

1. **61 §6 停止条件**：真实路径失败 → 立即 `R5 NO-GO`，保留失败证据，不重复碰运气；
2. 媒体卡片在真实侧边栏渲染为空容器且主动作无可观测响应 → 用户可达路径不可用；
3. **未绕过**：成功路径对 Controller / materialize / database / store / grant /
   transcript / terminal 的直接调用数全程为 `0`；
4. canary 配额仍为 **0**，条件未改变不重跑；
5. 未进入 R6，未宣布 R5 PASS，未做独立文档外审或阶段 closeout。

状态写为 **R5 NO-GO**。
