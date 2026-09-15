# T02 R2 测试与真实数据结果

日期：2026-09-11  
Run：`t02-r2-raw-20260911T143100`  
隔离提交：`c2409206e4a337314b2995665780da1ca86c7a8d`

## 前置命令

| 命令 | 结果 |
|---|---|
| `pnpm build:e2e` | PASS，fresh WXT E2E build |
| `pnpm typecheck` | PASS |
| `pnpm test:v2-px-r2-raw-collector` | PASS，10/10；含 13 kind Schema 负例和 request 终态负例 |
| `pnpm test` | PASS，22 files / 169 tests |
| `python3 -m pytest -q` | PASS，307 tests / 55 warnings |
| T01 real Chrome regression | PASS，36/36，独立 cleanup PASS |

上述六条均作为 `command_result` 写入同一 sealed raw run，exitCode 全为 0、signal 全为 null。

## 原始证据统计

```text
segments: 2
events: 1033
artifacts: 861
scenarios: 64
public artifacts: 855
private_local_only artifacts: 6
```

13 种 event kind 均存在。三入口 Background origin 为 `open_workspace=2`、`view_source=2`、`open_in_workspace=2`。五类 route 均覆盖 direct-open、reload、Back、reopen；Permission 与 Forget 各 3 组，Forget 每组均有四面重读和同源四类恢复；四类 fault 各有成对区间。Runtime 重启产生第二 segment，PID、runtimeSessionId 和 sequence 范围均不同。

R2 transport 分母为 420 个 `/v1/knowledge/*` request，其中 403 个 `runtime_response`、17 个 `transport_failure`，孤儿或重复终态为 0。6 个 Background request 也各有且仅有一个 response。独立 `validateRawRun` 返回 0 错误，Draft 2020-12 Schema 元校验通过且实例 0 错误。

真实输入为本仓 PRD、架构、验收计划三份原始文档字节及真实网页 fixture。Adapter 明确为 mock；本轮不声称真实 data_service。

## 图片与清理

8 张 PNG 均可解码，实际尺寸与 metadata 的 decodedWidth/decodedHeight 一致，图片字节 SHA-256 与事件及 metadata 一致。产品视口包括原生 Side Panel 360/420，以及 Workspace 768/1280；另有四类故障截图。最终公共字节复扫 855 个 artifact，加 4 个 run 级公开文件，共 859 个文件，私人值/Bearer 命中 0。

`cleanup-manifest.json`：browserClosed、runtimeStopped、fixtureServerClosed、profileRemoved、passed 均为 true。事后进程表未发现本 run Chrome、Runtime 或 runner。

## 关键 SHA-256

```text
ade431410ec375b7ab48e9de7e41472c2b9e7baa72fce30373809b807a493f2e  raw/raw-run.json
3fff4bd32f13a971d28705bc9f29e14058ba766e6c5d32b21442f32bae7a57fd  raw/artifact-index.json
26adb72c48bfa2903e35cf0d49d44619d3a2567fdaabed6632192af0f7b9e735  raw/collection-diagnostic.json
f5d3c965b410f327aa35647225e873d87b03b4890ac8ab9dcd62b303c48499f4  cleanup-manifest.json
276a5c60e4df852006cc24154141854ba1342153e3077fa8416e42b623948bd5  input/snapshot-input-manifest.json
349f4c52203e5504a8cc48762592c95d6e5cc88820a00510dc6185f3b2ad0bc7  input/build-index.json
```

这些 hash 仅属于最终 run。早期正式尝试还暴露了两个 Runtime request 无终态、观察 ACK 竞争和构建复制 `EINTR`；对应问题均先写入独立失败 diagnostic，再从新冻结提交完整重跑，未将失败尝试的产物拼接到最终 run。

## 独立审计 Minor 补充复核

执行：

```text
python3 docs/active/project/evidence/v2_external_brain_productization/px-5/t02-r2-raw-evidence/verify-independent-audit-minors.py
```

结果：PASS。

```text
T01 checks: 36 / 36 passed
Runtime transport: 420 request = 403 response + 17 transport failure
Runtime transport orphan or multi-terminal: 0
Background: 6 request / 6 response / 0 schema error / 0 pairing error
Background origin: open_workspace=2 / view_source=2 / open_in_workspace=2
Background outcome: created_new=1 / focused_existing=5
```

`logs/runtime.log` 的 2 条 access line 是进程 stdout 诊断，不是 Runtime 传输分母；420 条分母来自浏览器内 `runtimeClient` 的 E2E transport observation，经 Background bridge 只读传递并由 collector 封存。两层证据不得相互替代。
