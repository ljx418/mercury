# WP0 R5 测试结果（2026-10-18）

Candidate: `wp0-r5-2026-10-17`
状态：**R5 NO-GO**（R5-0 全绿；R5-2 未运行，用户可达媒体面真实路径失败）

## 1. 分层执行记录（§5.1A）

| 层 | 动作 | 次数 |
|---|---|---:|
| 门禁核验 | R4 PASS + 证据 manifest + v10 双 verifier | 1 |
| R5-0 离线预检 | 按 61 §2 逐项 | 1 |
| 64 UX 纠偏 | 先补定向测试，再实现 | 1 |
| 环境可达性侦察 | **不启动 capture，不消耗 canary 配额** | 多次 |
| R5-2 真实 canary | **未进入** | **0** |
| 收口集中回归（§5） | 一次 | 1 |

**未重复 R4 的 62-process 故障矩阵。未做独立文档外审。**

## 2. 门禁核验

| 命令 | 退出码 | 结果 |
|---|---:|---|
| `sha256sum -c 50-payload-manifest.sha256`（R4 证据） | 0 | **4 / 4 OK** |
| fixture SHA-256 | — | `a89c8f09…19d74` ✅ 与 checkpoint 一致 |
| verifier SHA-256 | — | `c4dd95d7…c55191` ✅ 与 checkpoint 一致 |
| `python3 -B …/verify-…-v10-contract.py` | **0** | **50 / 50** |
| `python3 -B …/verify-…-v10-mutations.py` | **0** | **15 / 15** |

## 3. R5-0 离线预检逐项

| # | 预检项 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | R4 PASS + baseline 50/50 + mutations 15/15 | 0 | ✅ |
| 2a | `npm run typecheck` | **0** | ✅ |
| 2b | production build | **0** | ✅ Σ **4.66 MB**，98 files |
| 2c | Runtime focused（capture/transcript/outline/fault/product/asr） | **0** | ✅ **247 passed** / 583 deselected |
| 2d | relay static | **0** | ✅ **42 / 42** |
| 2e | media 子树 | **0** | ✅ **229 / 229**（23 files） |
| 3 | 端口 `17861` bind preflight | 0 | ✅ FREE，无 listener，无残留 Runtime |
| 4 | **SenseVoice verified/ready/effective** | HTTP 200/200 | ✅ **通过** |
| 5 | manifest / build / 权限 / 启动方式 / runner | — | ⚠️ 除媒体面外均就绪 |

## 4. 模型证据（61 §2 第 4 项 —— 本轮通过）

| 观察点 | 值 |
|---|---|
| `effectiveModelId` | **`funasr-sensevoice-small-q8`** |
| `installation.state` / `verifiedAt` | **`ready`** / `2026-10-17T16:57:53.727286Z` |
| frozen `revision` | `90c1c61912018b70ada0fcc024ea24aca62f2e63` |
| `fallbackActive` / `fallbackReason` | `false` / `null` |
| 下载三件套 SHA-256 vs 64 §4 | **3/3 逐字节一致** |
| 已安装 model/VAD SHA-256 vs 64 §4 | **2/2 逐字节一致** |
| `llama-funasr-sensevoice` 执行 | ✅ rc=0 |
| 模型位置 | Windows 持久卷；不在 WSL 虚拟磁盘；未被 Git 跟踪 |

## 5. 64 UX 纠偏定向测试（9 / 9）

| 用例 | 覆盖 |
|---|---|
| discloses the frozen Windows persistent directories | 64 §1 三目录 + 「不在 WSL 虚拟磁盘」 |
| auto-selects only after a self-tested ready state | `asrAutoSelectEnabled` 仅 `ready` 为真；「已安装并启用」必须 effectiveModelId 相等 |
| categorises install failures into distinct actions | hash/self_test/space/network/permission/qualification/unknown 七类，各有动作 |
| never claims a Navia release page package exists | 断言文案**不含**「发布页」，且列出三个冻结文件名与 `.navia-asrpack` |
| offers a companion start action when Runtime offline | 「启动 Navia 本机伴侣」 |
| shows unavailable instead of a silent fallback | `effectiveModelId=null` → 「无可用模型」 |
| 3 条既有用例按主动作/分类更新 | 「下载、安装并使用」；hash 失败归类为 `hash` |

## 6. 环境可达性侦察（**未启动 capture，配额 0**）

| 探测 | 结果 |
|---|---|
| headless（旧 headless / `--headless=new`） | 旧 headless 不支持扩展；`--headless=new` 可加载扩展 |
| headless 下浏览器加速键 | ❌ 无任何派发 |
| 有头 + 生产 flags 下合成加速键 | ❌ `acceleratorFired: false` |
| WSL → Windows CDP | ✅ `Chrome/155.0.8059.84` |
| `--load-extension` | ❌ Chrome 137+ 已失效（`ERR_BLOCKED_BY_CLIENT`、`chrome.tabs` 未定义） |
| CDP `Extensions.loadUnpacked` | ✅ id `gcifeacdafknfikkfccniigjdcofpcha` |
| 固定 BVID 加载 | ✅ 标题《日本内需死局：试遍全球救市剧本…》 |
| Playwright 暴露侧边栏 target | ❌ `context.pages()` 不含 side panel |
| 原生 CDP attach 侧边栏 | ✅ |
| `chrome.sidePanel.open({tabId})` | ✅ ok |
| 视频页成为面板 active tab | ✅ |
| 媒体面出现 | ✅ `media-companion-launch` / `-enable` / `media-connection-settings` |
| **可信点击**（`Input.dispatchMouseEvent`） | ✅ **有效**：Chat→Know 切换生效 |
| **原生 owned-PID `execute-action`** | ✅ **真实派发** `method=owned-pid-execute-action-shortcut` |

## 7. 阻塞：R5-2 用户可达媒体面

| 观察 | 结果 |
|---|---|
| 面板状态行（50 s 内 10 次轮询） | 恒为 `Runtime online · Page unknown · idle` |
| `media-companion-launch` `innerText` | **`""`** |
| `media-connection-settings` `innerText` | **`""`** |
| 「启用并分析当前视频」可信点击 | **状态零变化**，无原生弹窗，无 Runtime 请求 |
| Know 标签页文案 | `Companion Runtime request was rejected.` |
| 同一 target 上无关标签点击 | ✅ 生效（排除输入投递失效） |
| 生产构建 `getE2ETabId()` | `__NAVIA_E2E_BRIDGE__` 为 false 时**直接返回 null**（`main.tsx:3610-3613`） |

## 8. R5-2 canary 未运行（配额 0）

61 §5 的十一条强制 oracle 中，**第 3–9 条全部无观测值**：PCM 非空、SenseVoice 真实推理、
非空带时间戳 transcript、acquisition `succeeded` 先于 materialize、跨层 identity 一致、
revision/fence 单调、SQLite `ready|degraded` 与 UI 一致、退出 busy。本轮**不提供**任何该类断言。

可证明的仅：oracle 1（fresh Runtime/build 身份）、oracle 2（成功路径直调 = **0**）、
oracle 10（本轮 owned 清理 = 0）、oracle 11（secret = 0）。

## 9. 收口集中回归（§5，一次）

| # | 命令 | 退出码 | 结果 |
|---:|---|---:|---|
| 1 | `npm run typecheck` | **0** | PASS |
| 2 | `npx vitest run src/modules/media_companion/tests/ --maxWorkers=2` | **0** | **229 / 229** |
| 3 | `npx vitest run --maxWorkers=2` | **0** | **568 / 568**（67 files） |
| 4 | `npm run build` | **0** | Σ **4.66 MB** |
| 5 | `pytest -k "capture or transcript or outline or fault or product or asr" -q` | **0** | **247 passed** |
| 6 | `node --test …/relay_ownership_contract.node-test.mjs` | **0** | **42 / 42** |
| 7 | `python3 -B …/verify-…-v10-contract.py` | **0** | **50 / 50** |
| 8 | `python3 -B …/verify-…-v10-mutations.py` | **0** | **15 / 15** |
| 9 | secret / raw-media / private-path scan | — | **0 命中** |
| 10 | owned cleanup scan | — | Runtime **0** · owned Chrome **0** · 端口已释放 · WSL `/tmp` 已清空 |

**全量 568/568**（较 R4 的 562/562 多 6 条，正是本轮新增的 6 条 UX 测试）。

## 10. secret / raw-media / private-path

- 扫描 R5 变更源 `SESSDATA` / `bili_jct` / `buvid` / `cookie=` / `Bearer <值>` /
  `sk-…` / `api_key` → **0 命中**。
- 证据仅含：模型 ID、冻结 revision 字符串、SHA-256、状态枚举、资源字节数、
  build tree hash、端口、PID、目录名、testid 名。
- **不含** Cookie、API key、ticket、原始媒体/音频、transcript 全文或绝对私有路径。

## 11. 环境事实（非产品缺陷）

1. 本轮中途主机 `/` 曾被其它并发会话占满，导致一段时间内无法执行任何命令；
   恢复后另发现把 pytest `--basetemp` 放在 `/mnt/c`（NTFS 挂载）会使 `stat()` 无法呈现
   `0700`，触发 sandbox 私有目录校验失败——属**测试 scratch 位置**问题，非产品缺陷。
2. 本轮一次 `/tmp/r5*` 通配清理误删了正在写入的 mutation 输出与两条回归日志，
   已按同一命令重跑并如实记录（第 8 项与第 1/2/4 项）。
