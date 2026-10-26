# WP0 R4 Runtime / Worker Recovery Phase Receipt（2026-10-17）

Candidate: `wp0-r4-2026-10-17`
前置：`60-codex-r3-checkpoint.md` 判定 `R3 PASS / R4 MAY START`
授权边界：**仅 R4；不得进入 R5，不启动 Chrome，不播放声音**
状态：**R4 AWAITING CODEX CHECKPOINT — 命中 61 §5 停止条件（冻结文件摘要退化）**

R5 未启动。

## 0. 停止摘要（先读这一段）

R4-1..R4-5 的实现与测试**全部完成并通过**，共 **62 个真实独立 Uvicorn 进程**
（62 个唯一 PID、62 个唯一随机端口）。集中回归 13 项中 **11 项 exit 0**，两项失败：

| 项 | 退出码 | 结果 |
|---:|---:|---|
| v10 baseline | **2** | **46 / 50** ← 阻塞 |
| v10 mutations | **2** | **14 / 15** ← 同一根因的级联 |

四个失败检查中，**根因只有一个**：

```
sourceEvidenceHashesCurrent  ← 唯一真实失败
```

`docs/active/project/fixtures/v3-media-capture-internal-relay-v10-fixtures.json`
的 `sourceInventoryEvidence.scopes[]` 以 **SHA-256 冻结了
`services/local-runtime/navia_runtime/app.py` 的字节**。R4 为关闭一个真实的跨连接
cleanup 归属缺陷必须修改该文件（§1.1），摘要随之改变：

| 文件 | 冻结摘要 | 当前摘要 |
|---|---|---|
| `app.py` | `518c853dadaf…3f4e6a66a8` | `51791f0568ea…00d3f0a` |

另外三项（`sourceScopeExtractorsValid`、`sourceEmitSetEqualsFrozenInventory`、
`discoveredCodeUniverseClosed`）是**级联**，不是独立缺陷。verifier 在摘要不匹配时
`continue`，直接跳过该文件的 AST 抽取，于是恰好一个码「消失」：

```
sourceInventoryDiff.missing = ["V3_MEDIA_CAPTURE_ORIGIN_MISMATCH"]
```

已独立验证：该码在修改后的 `app.py` 中**仍存在 2 处**，并未被本轮删除或改名；
本轮的三处改动只涉及一个布尔标志与一个 `and` 子句，不新增、不删除、不重命名任何
`V3_MEDIA_*` 常量。**变的只是文件字节，失败码集合未变。**

mutations 的唯一失败用例是 `non_boundary_lexical_string_control`：它期望 baseline
**exit 0**，而 baseline 现在诚实地是 exit 2，于是该 control 被判失败。这是同一根因的
级联，不是新的对抗性发现。

**已按用户常设规则立即停止，未修改冻结材料**（未改 schema、fixture、FailureCode
registry、20/40 inventory、固定阈值、公共 endpoint/API、Origin、ticket TTL、
SourceAuthority 与产品 terminal 定义）。是否重冻结该摘要属于 Codex 决策。

这与 R3 的 `MediaCaptureController.ts` 情形同类：Codex 当时按「冻结证据过期」执行了
一次受限重冻结（仅更新该 scope 的 SHA-256 与由整对象推导的 authority digest）。

## 1. 本轮修复的两个真实生产缺陷

### 1.1 跨连接 cleanup 归属缺陷（R4-1 直接发现，Major）

`app.py` 的 capture WebSocket handler 以**连接**为单位做 fail-closed：

```python
finally:
    if not terminal:
        runtime_capture_sink.abort()
```

`RuntimeCaptureSink` 是**进程单例**。因此任何一条从未成功 `begin()` 的连接——重放的
ticket、binding 不符、第二个 socket——在握手失败后走到这个 `finally`，都会把**别人
正在进行的 capture** 一起 abort 掉。

R4 的双轮/重放用例实测复现：主连接 `started` 后，用同一 ticket 从第二条连接重放，
第二条正确返回 `V3_MEDIA_CAPTURE_TICKET_REPLAYED`，但随后主连接发送的下一个 chunk
收到的是 `failed` 而不是 `chunkAccepted`——合法 capture 被一个无归属的重放请求杀死。

修复（`app.py` 三处，最小改动）：以**连接**为归属单位

```python
owns_capture = False
...
runtime_capture_sink.begin(...)
owns_capture = True
...
finally:
    if not terminal and owns_capture:
        runtime_capture_sink.abort()
```

未改变任何公共合同：endpoint、消息、失败码、阈值、Origin、ticket TTL 全部不变。

### 1.2 无 staging 时 recovery 误判为不可验证（R4-2 直接发现，Major）

`TaskAudioStager.recover_cleanup()` 先调用 `_validate_recovery_owner()`，而后者要求
owner manifest 存在。于是在**staging barrier 之前**被硬杀的 capture（注入点
`after_sink_finalize` / `transcript_create` / `before_stage`）永远无法恢复：

```
POST /v1/media/acquisitions/recover → 500 V3_MEDIA_CLEANUP_INCOMPLETE
"Interrupted ASR staging cleanup failed."
```

这是把「**根本没有 staging**」与「**有 staging 但无法证明归属**」混为一谈。前者没有
任何东西需要证明，也没有任何东西需要删除，其残留本就为 0；而这会让每一个 barrier 前
中断的真实 capture 永久卡死，并把它背后的 acquisition sandbox 一起拖住。

修复：缺失的 staging root 直接返回零残留收据，与 `cleanup()` 自身的缺失分支一致。

```python
if not task_root.exists() and not task_root.is_symlink():
    self._delete_receipt(task_id)
    return {"removed": False, "residualCount": 0}
```

**fail-closed 语义未被削弱**：只要 staging root 存在，八类损坏矩阵中的任意一类仍然
全部 fail closed（R4-3 实测 8/8）。

## 2. 真实进程边界

R4 明确禁止用 `TestClient` 或 mock WebSocket 替代真实进程边界。本轮的取舍：

`app.py` 由 fixture 以 SHA-256 冻结，**不能编辑**；但六个注入点大多位于 handler 内部。
因此本轮采用**在 owned 子进程内、import 时安装故障触发器**的方式：

- 子进程是一个**独立 PID** 的真实 `uvicorn`，在**随机空闲端口**上服务，harness 只终止
  自己记录的 PID；
- 客户端是真实的 `httpx` 与 `websockets.sync.client`，走真实 TCP 与真实 WS 握手；
- 触发器只负责**抛异常或 `os._exit`**，被验收的 handler、sink、stager、owner manifest、
  SQLite receipt、transcript service、coordinator、authority store **全部是出厂生产类**；
- 五个真实 hard kill 用 `os._exit(137)`，跳过全部 `finally` / atexit / context manager。

唯一被替换的是**外部二进制依赖**：冻结的 SenseVoice 模型在本机未安装，而 R5（不是 R4）
才是证明真实 PCM→SenseVoice 的阶段。R4 需要让 durable product 边界可达，故以一个确定性
in-process provider 替换**模型二进制**；validator、SRT normalizer 与其周围所有状态机
仍是真实生产类。

## 3. 测试

新增四个 suite，共 **45 例**，全部驱动真实 owned 进程：

| 文件 | 覆盖 | 结果 |
|---|---|---:|
| `test_wp0_r4_real_uvicorn.py` | R4-1 | **19 / 19** |
| `test_wp0_r4_injection_points.py` | R4-2 | **8 / 8** |
| `test_wp0_r4_manifest_matrix.py` | R4-3 | **9 / 9** |
| `test_wp0_r4_restart_and_security.py` | R4-4 / R4-5 | **9 / 9** |

详见 `20-test-results.md`、`30-prd-review.md`、`40-handoff.md`。

## 4. 合同变化

- **内部合同变化**：有 2 项（§1.1 连接级 cleanup 归属、§1.2 缺失 staging 的零残留收据）。
- **公共合同变化**：**none**。endpoint、API、Origin、ticket TTL、九消息、20 码
  FailureCode registry、40/20 inventory、固定阈值、SourceAuthority 与产品 terminal
  定义全部未改。
- **冻结材料**：**未修改**。schema、fixture、inventory 均未动；唯一触碰的是 fixture 所
  **冻结**的一个实现文件的字节，这正是停止原因。

## 5. 严重度

| 级别 | 数量 | 说明 |
|---|---:|---|
| Fatal | 0 | — |
| Major（已修复） | 0 | §1.1、§1.2 两个生产缺陷 |
| Minor | 0 | — |
| **待重冻结** | **1** | `app.py` 摘要需 Codex 决策 |

## 6. 停止点

状态 **R4 AWAITING CODEX CHECKPOINT**。命中 61 §5「需要改变…固定分母」与用户常设规则
「若确实必须修改冻结材料，立即停止并报告 Codex」。不进入 R5，不宣布 R4 PASS，
不进行独立文档外审或阶段 closeout。
