# R1 实现期独立审查与修复交接

日期：2026-09-09。性质：当前 session 对 R1 工作树实际实现的独立只读审查 + 隔离诊断复现。
基准：HEAD `ae28b62` + 工作树实际未提交修改 + `design/v2-px-5-repair-execution-contract.md` v1 + `v2_local_permission.schema.json` + `v2_memory_contracts.schema.json`。
本文件不是产品验收报告，也不是修复提案本身；是供独立审查者 / 后续 R2-R4 / 用户决策使用的客观问题清单与最小修复边界。

---

## 0. 状态总结

PX-5：FAIL / REOPENED。PX-6：BLOCKED_BY_PX5_MAJOR。本轮在 R1 实现基础上确认三项已记录 Major 全部可复现，并新发现三项 Major，共六项必须先关闭才能继续 R1 后期门禁。22 项 pytest 全部 passed，但本轮确认这 22 项不覆盖任何一项新发现 Major，不能作为 R1 通过证据。

已确认 PYTHONPATH 与 22 项 passed 一致：

```text
PYTHONPATH=services/local-runtime pytest -q test_v2_local_permissions.py test_v2_memory_knowledge_api.py
→ 22 passed, 6 warnings in 7.75s
```

本轮没有运行旧报告生成器、也没有运行旧生产 validator、没有启动浏览器或 Runtime、没有修改主工作树、没有新建 commit。

---

## 1. 严重度排序（按修复优先级）

| ID | 严重度 | 位置 | 摘要 |
|---|---|---|---|
| F-1 | **Major（R1-M1 已记录，已复现）** | `services/local-runtime/navia_runtime/modules/memory/permissions.py:300-348` | 缓存命中分支绕过 `_active(root, epoch)` 复核；撤销后 replay 仍返回 sources |
| F-2 | **Major（R1-M2 已记录，已复现）** | `services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:257-300` + `app.py:789-797` | Forget 接受空对象、伪造 `requestedByUser`、硬编码四面 `*Absent` |
| F-3 | **Major（R1-M3 已记录，已复现）** | `services/local-runtime/navia_runtime/modules/memory/permissions.py:321-323` | 列表推导先构造全部 dict 再切片；200 行输入构造 200 个 EvidenceRef |
| F-4 | **Major（新发现）** | `services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:273` | Forget 接受**任意** `confirmationText`（实测 `'EVIL'`、`'delete'`、`''`、缺字段全部成功） |
| F-5 | **Major（新发现）** | `services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:275-284` | 四面 `*Absent` 硬编码 `True`，未按合同重新查询四个面 |
| F-6 | **Major（新发现）** | `services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:130-147` + `app.py:675-695` | Adapter `save_source` 直接接受 `authorized_local_document` + `contentSnapshot` + `permissionRootId`；HTTP 层 `app.py:675` 有把关但 Adapter 是信任边界，下游 Python 代码可绕过 |
| F-7 | Minor | `services/local-runtime/navia_runtime/modules/memory/permissions.py:151-159` | `list()` 不过滤 `state == "revoked"` 的 root；前端 `PermissionRootManager.tsx:52` 自行禁用 import 按钮 |
| F-8 | Minor | `services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:286-293` | forget operation `createdAt/updatedAt` 用同一 `now`，与 `permissions.revoke` / `grant` 风格不一致（合同未要求，标记即可） |
| F-9 | Minor（合同一致性） | `services/local-runtime/tests/test_v2_local_permissions.py:174` | 测试 `forget_source(..., {})` 期望空 `{}` 成功 → 把缺陷固化为"通过"；修复 F-2 时必须同步修改 |
| F-10 | Minor（测试遗漏） | `services/local-runtime/tests/test_v2_local_permissions.py`（缺） | 无任何测试覆盖：撤销后 cache hit 重放、空 / 错 / 缺 Forget 确认、EvidenceRef 构造上限、Adapter 拒绝 `authorized_local_document` 直通 |

---

## 2. 逐项：实际复现 / 影响 / 最小修复

### F-1（R1-M1）缓存命中分支绕过撤销复检

**文件 / 行**：`services/local-runtime/navia_runtime/modules/memory/permissions.py:300-348`

**实际复现**（隔离临时目录，200 行文本，本地 `MockKnowledgeServiceAdapter`，屏障注入 `_verify_path` 返回后与第二次 `import_files` 进入 `with root.lock: prior = root.imports.get(key)` 之前）：

```text
first import permission state: granted
first import idempotentReplay: False
after revoke, public state: revoked
after revoke, root.epoch: 1
REPRO R1-M1: replay returned SUCCESS despite revoked_permission
  permission state: revoked
  resp.idempotentReplay: True
  resp.sources[0].sourceId: src_00000000000000000000000001
  source still readable: True
```

复现手法要点：
1. grant → scan → import 一次，使 `root.imports[key]` 写入缓存。
2. 在第二次 `import_files` 进入 `_verify_path` 返回后、缓存分支取得锁前，注入屏障并调用 `revoke(root)`。
3. `import_files` 在 `root.lock` 内命中 `prior`，直接 `return self._replay(prior[1])`，未调 `_active`；`_replay` 只检查 `source["status"] == "forgotten"`，不检查 root 状态。

**影响**：撤销后同 Idempotency-Key 重放仍返回 sources 与 `idempotentReplay=true`；攻击面：本地 CLI + 缓存 Idempotency-Key 在撤销窗口可继续 replay，且仍走 202。**合同冲突**：`v2-px-5-repair-execution-contract.md` 第 5 条"同请求重放仍先检查授权，撤销后 403"。

**最小修复**：
- `permissions.py:300-306` 缓存命中分支在 `return self._replay(prior[1])` 之前强制 `self._active(root, root.epoch)`（不要用捕获的旧 epoch；或重新调 `_verify_path`）。
- 或把缓存 key 与 epoch 绑定，命中期望的 epoch 不等时拒绝。
- 增加失败回归 `test_cache_hit_after_revoke_raises_403`：屏障注入并 `revoke(root)` → 屏障释放后断言 `PermissionFailure("revoked_permission")` 且 `adapter.sources` 中无新 source。

---

### F-2（R1-M2）Forget 接受空对象并伪造用户意图

**文件 / 行**：`services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:257-300`，`app.py:789-797`

**实际复现**（隔离目录，本地 `MockKnowledgeServiceAdapter`，源类型 `authorized_local_document`）：

```text
source created, status: trace_ready
contentSnapshot present? True

Forget with empty {} body:
  status: forgotten
  contentSnapshot still present? False
  forgetRequest.requestedByUser: True
  forgetRequest.confirmationText: 'forget'
  verification.libraryAbsent: True
  verification.askAbsent: True
  verification.graphAbsent: True
  verification.traceAbsent: True

Forget with WRONG confirmation:
  source.status before: trace_ready
  source.status after: forgotten
  forgetRequest.confirmationText: 'delete'

Forget with EMPTY confirmationText:
  source.status before: trace_ready
  source.status after: forgotten
  forgetRequest.confirmationText: 'forget'
```

复现手法：直接 `adapter.forget_source(sid, body)` 三次，body 分别为 `{}` / `{"confirmationText": "delete"}` / `{"confirmationText": ""}`；或经 `client.post(/v1/knowledge/sources/<sid>/forget, json=...)` 走 HTTP。

**影响**：任何能调用 forget 端点的客户端可删除 source 快照、生成 `requestedByUser=true` 的伪造审计记录。配合 R1-M1 cache 命中或简单的 Authorization 失配，攻击面扩展到已撤销但仍可读的来源。**合同冲突**：合同"用户主动发起、二次确认并完成 Library / Ask / Graph / Trace 四面验证"、"Forget 仍需用户确认并重新查询四面，而不是信任 verification 布尔值"。

**最小修复**：
- Adapter `forget_source` 起始处：
  ```python
  body_text = str((body or {}).get("confirmationText") or "")
  if body_text != "forget":
      raise PermissionFailure("invalid_request", 400)
  requested = bool((body or {}).get("requestedByUser"))
  if not requested:
      raise PermissionFailure("invalid_request", 400)
  ```
- 四面 `*Absent` 必须真实调用 `self.list_sources` / `self.query` / `self.graph` / `self.trace` 各一次并比对；任一未缺席时返回 `verificationStatus="partial"` 并 `*Absent=False`。
- HTTP 层 `app.py:789` 同样在 `forget_source` 入口做 `confirmationText == "forget"` 校验并拒绝 `requestedByUser=False`。
- 增加失败回归覆盖空 / 错 / 缺 confirmationText 四种情况。

---

### F-3（R1-M3）EvidenceRef 全量构造后才切片

**文件 / 行**：`services/local-runtime/navia_runtime/modules/memory/permissions.py:321-323`

**实际复现**（用 `opaque` 计数器，200 行文件输入）：

```text
Total evidence dicts constructed (200 lines input): 200
Adapter-kept refs: 12
Limit declared: 32
REPRO R1-M3: list-comprehension constructed 200 dicts before slicing to 12
```

附注：当前 `[…][:32]` 在 `permissions.py` 把上限声明为 32，但 `_normalize_evidence_refs`（`runtime/__init__.py:334`）二次 `[:12]` 钳制，导致对外行为 12 条而**构造期间**仍是 200 次。

**影响**：内存与 CPU 在大文件场景被放大；与合同"生成与 Adapter 保留上限，验证构造次数有界"冲突。

**最小修复**：
- 改为 `itertools.islice` 或显式 break：
  ```python
  refs = []
  for index, line in enumerate(content.splitlines(), 1):
      if len(refs) >= 32:
          break
      if not line.strip():
          continue
      refs.append({"evidenceRefId": opaque("ev_"), ...})
  ```
- 统一 `_normalize_evidence_refs` 上下限（建议 Adapter 端取消二次 `[:12]`，以 `permissions.py` 声明的 32 为唯一上限）。
- 增加失败回归：200 行输入时 `opaque("ev_")` 调用计数 ≤ 32。

---

### F-4（新 Major）Forget 接受任意 confirmationText

**文件 / 行**：`services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:273`

**实际复现**（HTTP 端点 `client.post(.../forget, json={'confirmationText': 'EVIL'})`）：

```text
status_code: 202
forgetRequest.confirmationText: 'EVIL'
source.status after: forgotten
```

**影响**：后端不强制 `confirmationText == "forget"`。任何 confirmationText 都接受并照实记录到审计字段 `forgetRequest.confirmationText`。即使前端 `ForgetSourceDialog.tsx:22` 限制了 `disabled={confirmation !== "forget"}`，绕过 UI 即可触发任意字符串"确认"。

**最小修复**：与 F-2 合并处理；增加失败回归覆盖 `("EVIL", 400)`、`("delete", 400)`、`("", 400)`、`(None, 400)`。

---

### F-5（新 Major）四面 verification 硬编码未真实查询

**文件 / 行**：`services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:275-284`

**实际复现**：见 F-2 输出，`verification.{library,ask,graph,trace}Absent=True` 在所有 forget 调用中恒为 True，与 source 实际状态无关。

**影响**：审计证据不可信；前端 `ForgetSourceDialog.tsx:21` 显示的 `Library/Ask/Graph/Trace X` 全部来自 server 端恒 True 字符串。**合同冲突**：`v2-px-5-repair-execution-contract.md` 第 6 条"数据释放由 Adapter 完成"，verification 必须真实查询。

**最小修复**：与 F-2 合并；Adapter 在 forget 后实际调用四个面的查询；任一仍包含该 source 时 `*Absent=False` 并返回 `verificationStatus="partial"`。

---

### F-6（新 Major）Adapter 接受 authorized_local_document 直通

**文件 / 行**：`services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py:130-147`

**实际复现**：

```text
Bypass save_source accepted authorized_local_document without import flow:
  sourceId: src_00000000000000000000000001
  sourceType: authorized_local_document
  permissionRootId: perm_x
  contentSnapshot present? True

HTTP-level POST authorized_local_document (no token, service disabled):
  status_code: 403 (good)
```

**影响**：HTTP 层 `app.py:675-679` 有把关，但 Adapter 是 Python 内部信任边界；任何下游 Python 代码（测试、新 endpoint、CLI、调试脚本）复用 Adapter 即可绕过。这与"Adapter 增加批次原子入口，sources/operations/workspaces/idempotency 在同一 adapter 锁内共同提交"的合同增量不一致。

**最小修复**：
- Adapter `save_source` 起始处：
  ```python
  if (candidate.get("sourceType") in {"authorized_local_document", "pdf"}
          or "contentSnapshot" in candidate
          or "permissionRootId" in candidate
          or str(candidate.get("idempotencyKey", "")).startswith("local-import:")):
      raise PermissionFailure("path_not_allowed", 403)
  ```
- 或要求 `authorized_local_document` 必须由 `PermissionService` 通过专用入口调用并提供 `permission_root_id` 与 `epoch` 上下文。
- 增加失败回归：从 Python 直接调 `adapter.save_source(..., sourceType="authorized_local_document")` 期望 403。

---

### F-7（Minor）`list()` 不过滤已撤销

`permissions.py:151-159` 返回的 records 中包含 `state == "revoked"` 的 root；前端 `PermissionRootManager.tsx:52` 用 `item.state === "granted"` 自行禁用 import 按钮。这是合理设计，但 `revoke` 之前已被 in-flight scan 缓存到 `root.scans` 的内容被 `root.scans.clear()` 清除（`permissions.py:167`），与"撤销后 Library/Ask/Graph/Trace 仍可读取已导入来源"不冲突——只是 contracts 的 listing 语义需要在文档中明确。

---

### F-8（Minor）forget operation 时间戳

`__init__.py:286-293` 把 `createdAt/updatedAt` 写成同一 `now`。与 `grant_permission`、`revoke_permission`（`__init__.py:228-234`、`246-253`）只写 `createdAt/updatedAt` 不区分时间语义一致，但合同没要求 `forget` operation 保留事件时间线，标记即可。

---

### F-9（Minor）`test_changed_file_forged_id_and_idempotency_conflict` 把 bug 固化为 PASS

`test_v2_local_permissions.py:174`：

```python
service.adapter.forget_source(result["sources"][0]["sourceId"], {})
with pytest.raises(PermissionFailure, match="idempotency_conflict"):
    service.import_files(root, body, "same-key-import")
```

此测试中 `forget_source(..., {})` 是 F-2 的现场：把第一个 source 删掉，然后期待 replay 抛 `idempotency_conflict`。如果按 F-2 修复使 `forget_source(..., {})` 抛 400，整个测试流就会失败。修复 F-2 时必须同步修改这条断言，改为 `forget_source(..., {"confirmationText": "forget", "requestedByUser": True})`。

---

### F-10（Minor）测试矩阵遗漏

现有 `test_v2_local_permissions.py` 与 `test_v2_memory_knowledge_api.py` 共 22 项 passed，覆盖矩阵：

| 合同要求 | 现有测试 |
|---|---|
| 撤销后 cache hit replay 拒绝 | **缺** |
| 空 / 错 / 缺 `confirmationText` 拒绝 | **缺** |
| `requestedByUser` 必须显式 | **缺** |
| 四面 verification 真实查询 | **缺** |
| EvidenceRef 构造次数有界 | **缺** |
| Adapter 不接受 `authorized_local_document` 直通 | **缺**（HTTP 层有，Adapter 无） |
| `redactedPath` 不出现在 grant 响应 | `test_authenticated_real_file_api_and_read_protection:253` `assert str(document) not in response.text` ✓ |
| Origin 精确匹配 + 空 Origin + token | `test_default_disabled_and_exact_origin_authentication` ✓ |
| 撤销后 Library/Ask/Graph/Trace 仍读旧 source | `test_real_content_import_revoke_and_retention` 部分覆盖 ✓ |
| POSIX 路径 / symlink / `..` 拒绝 | `test_symlinks_and_traversal_are_denied` ✓ |
| 根 / 祖先替换拒绝 | `test_root_and_ancestor_replacement_are_denied` ✓ |
| 并发同 key 只提交一次 | `test_concurrent_same_request_imports_once` ✓ |
| 撤销在读 IO 前发生则读不执行 | `test_revoke_before_file_open_prevents_read_and_commit` ✓ |
| 批次原子回滚 | `test_batch_failure_rolls_back_and_retry_succeeds` ✓ |
| 新 Runtime 无旧权限 | `test_permission_expired_in_new_runtime` ✓ |

---

## 3. PRD / 合同 / 一致性

| 合同 / PRD 条款 | 实现 | 一致 |
|---|---|---|
| `v2_local_permission.schema.json` 字段集（grant/scan/import/PermissionRoot/ScanResult） | `permissions.py` 与 schema 字段对齐；`Draft202012Validator` 在 `test_authenticated_real_file_api_and_read_protection` 通过 | ✓ |
| `v2_memory_contracts.schema.json` ForgetRequest 要求 `requestedAt/requestedByUser/forgetRequestId/sourceId/workspaceId` | Adapter 输出包含 5 个字段 | ✓（**但** `requestedByUser` 恒为 True 是错的，见 F-2） |
| `v2-px-5-repair-execution-contract.md` 第 5 条"缓存命中分支在锁内执行 `_active(root, epoch)`" | 实现未执行 `_active` | ✗ |
| 同 第 6 条"verification 重新查询四面" | 硬编码 True | ✗ |
| 同 第 8 条"每个容器独立内存 token、不通过 Chrome 消息传递" | `runtimeClient.ts:276` 模块级 `let localRuntimeToken`——两个 HTML 页面各有 JS 上下文，因此**实例不同**，独立内存；token 经 `chrome.runtime.sendMessage` 转发到 `background/index.ts:proxyRuntimeFetch` → fetch 时仍在 Authorization header，**不在 URL** | ✓（background 路径无日志；contract "禁止 URL/localStorage/日志/截图" 通过；"不通过 Chrome 消息传递"措辞待与独立审查者对齐） |
| PRD 1.0 "默认不读取本地文件 / 默认未启用时原网页伴读接口不变" | 服务禁用时 forget 端点无 auth（仅 Origin 校验） | ⚠️ 接口不变但与 F-2 叠加后风险放大 |
| PRD "Permission grant/Forget 须显示用户确认，不伪造" | forget 接受空对象 | ✗ |
| AGENTS.md "不允许绕过 D Adapter Layer" | Adapter 自身是信任边界但未禁 `authorized_local_document` 直通 | ✗（F-6） |

---

## 4. 前端凭据与容器隔离

| 关注点 | 实现位置 | 状态 |
|---|---|---|
| Token 仅在内存（模块级变量） | `apps/chrome-extension/src/runtimeClient.ts:276-278` | ✓ |
| Token 不入 URL / localStorage / chrome.storage | grep 验证无持久化 | ✓ |
| Token 不入 console.log / 截图 | `runtimeClient.ts` + `background/index.ts:proxyRuntimeFetch` 无 console | ✓ |
| Side Panel / Workspace 独立内存 token | 两个 HTML 页面独立 JS 上下文 → `localRuntimeToken` 是各自实例 | ✓ |
| 容器刷新后丢失 token | 模块级变量被销毁；`LocalRuntimeAccess.tsx:6` 重置 `connected=false` | ✓ |
| 403 显示"需要连接本地文件会话"，不冒充 Runtime offline | `LocalRuntimeAccess.tsx:21` "认证未通过或 Runtime 不可达" | ⚠️ 含糊，未区分 403 与 Runtime offline；测试器在 sidepanel/workspace 真实双容器未完成 |
| 不通过 URL / Chrome 消息传递凭据 | `chrome.runtime.sendMessage` 把 headers 透传给 background.ts；**该路径包含 `Authorization` header** | ⚠️ 结构化克隆未泄漏到日志，但合同措辞"不通过 Chrome 消息传递"严格说应不含 Authorization 在 chrome message payload 内；需在 R2 与独立审查者对齐 |

---

## 5. 是否可继续 R1？

**结论：当前工作树不能继续 R1 后期门禁。**

理由：

1. **F-1（cache hit 撤销竞态）**：合同第 5 条硬约束"撤销后 403"、"同请求重放仍先检查授权"。当前实现直接违反。R1 实现前审查（`r0-independent-review.md`）明确把"撤销 IO 竞争"列为方案 Major；本复现证实竞争窗口存在。
2. **F-2/F-4/F-5（Forget 三件套）**：合同要求"用户主动发起、二次确认并完成 Library/Ask/Graph/Trace 四面验证"、"Forget 仍需用户确认并重新查询四面"。当前实现不仅接受空对象还接受任意字符串，且 verification 硬编码。
3. **F-3（EvidenceRef 资源放大）**：合同要求"生成与 Adapter 保留上限，验证构造次数有界"。当前实现构造次数不有界，200 行输入构造 200 个 dict。
4. **F-6（Adapter 直通）**：HTTP 层有把关但 Adapter 自身无校验，与"Adapter 增加批次原子入口"合同增量不一致；该 Adapter 是 Python 内部信任边界，下游任何代码路径复用都构成绕过。
5. **22 项 pytest passed 不证明 R1 闭环**：F-1/F-2/F-3/F-4/F-5/F-6 全部没有对应失败回归测试；22 passed 是"无测试约束"的通过。
6. **前端真实双容器认证未完成**：`LocalRuntimeAccess` 类型检查通过 ≠ 真实 UI 两次输入 token 完成保存 → 查看来源；`r1-implementation-risk-stop-2026-09-09.md` 明确指出"当前前端仅编译检查，不声称安全或交互闭环"。

**最小可继续 R1 的前置条件**：

1. 实现 F-1/F-2/F-3/F-4/F-5/F-6 六项最小修复，每项均新增确定性失败回归测试（不能只断言 absence，必须断言拒绝原因）。
2. 修改 `test_v2_local_permissions.py:174` 等把 bug 固化为 PASS 的断言。
3. 完成真实 Chrome 双容器认证 + 真实文件操作 E2E（不是旧生成器）。
4. 由独立审查者（Huygens 01a0846e / Carson 01a08470）对修复后的代码进行第二轮复审，并要求显式给出"F-1..F-6 全部关闭"。

**严禁**：在本轮修复完成 + 独立复审 PASS 之前，不得：
- 跑旧报告生成器或旧生产 validator 重生成 PASS。
- 把 22 项 pytest 通过升级为 R1 / PX-5 通过。
- 启动 R2 真实宿主采集 / 新 run 原始证据。
- 启动 R3 共享校验与生产字节变异负例。
- 进入 PX-6 人工签署或 HTML / Drawio 重绘。

---

## 6. 文件 / 行号索引

| 文件 | 关键行 | 内容 |
|---|---|---|
| `services/local-runtime/navia_runtime/modules/memory/permissions.py` | 92-99 | `authenticate`：常量时间比较 ✓ |
| 同 | 125-144 | `grant`：精确字段集、路径合法性、workspace 存在性 ✓ |
| 同 | 161-171 | `revoke`：加 epoch、关 fd、清 scans ✓ |
| 同 | 173-183 | `_verify_path`：在 root.lock 内 _active + 重新打开验证 chain ✓ |
| 同 | 212-241 | `_read`：root.lock 内 64KiB 分块 + UTF-8 + size/mtime 检查 ✓ |
| 同 | **300-306** | **F-1**：缓存命中分支不调 `_active` |
| 同 | **321-323** | **F-3**：列表推导先构造全部 dict 再 [:32] |
| 同 | 333-342 | commit 前再 `_active(root, epoch)` ✓ |
| 同 | 344-348 | `_replay` 仅检查 forgotten，不检查 root 状态（**F-1 加重**） |
| `services/local-runtime/navia_runtime/modules/memory/runtime/__init__.py` | 73-86 | `close()`：root.lock 内关 fd + 加 epoch ✓ |
| 同 | **130-147** | **F-6**：`save_source` 不拒绝 `authorized_local_document` |
| 同 | **257-300** | **F-2 / F-4 / F-5**：`forget_source` 接受空对象、补 confirmationText、硬编码 *Absent |
| `services/local-runtime/navia_runtime/app.py` | 71-106 | `origin_allowlist` + auth middleware ✓ |
| 同 | 89-99 | `protected` 计算：`/v1/knowledge/permissions` 总是保护；其他路径仅在 service enabled 时保护 |
| 同 | **675-679** | HTTP 层禁 `authorized_local_document` / `pdf` / `file:` / `contentSnapshot` / `permissionRootId` / `local-import:` 前缀 |
| 同 | **789-797** | **F-2 / F-4 上游**：`forget` 端点不校验 confirmationText |
| `apps/chrome-extension/src/runtimeClient.ts` | 276-278 | 模块级 `localRuntimeToken`，in-memory ✓ |
| 同 | 747-769 | `runtimeJson`：仅当 `localRuntimeToken` 且路径为 `/v1/knowledge/` 时添加 Authorization；content script 抛"会话凭据仅允许在 Navia 扩展页面使用" |
| `apps/chrome-extension/src/modules/knowledge_workspace/LocalRuntimeAccess.tsx` | 5-32 | 凭据输入 + 失败回退清空 token ✓ |
| `apps/chrome-extension/src/modules/knowledge_workspace/PermissionRootManager.tsx` | 45-50 | 路径输入 `autoComplete="off"`；按钮 `disabled` 依据 `name.trim()` 与 `path.trim()` ✓ |
| `apps/chrome-extension/src/modules/knowledge_workspace/ForgetSourceDialog.tsx` | 19, 22 | 输入框 + `disabled={confirmation !== "forget"}`（UI 防线，**后端未对应**——见 F-2 / F-4） |
| `apps/chrome-extension/entrypoints/background/index.ts` | `proxyRuntimeFetch` | 不打印 token ✓；但消息体内含 `request.headers.Authorization`（结构化克隆），合同措辞待对齐 |
| `services/local-runtime/tests/test_v2_local_permissions.py` | 92 | `forget_source(..., {"confirmationText": "forget"})` happy path |
| 同 | **174** | `forget_source(..., {})` 期望成功（F-2 bug 固化） |
| 同 | 211-229 | `test_batch_failure_rolls_back_and_retry_succeeds` ✓ |
| 同 | 239-269 | `test_authenticated_real_file_api_and_read_protection` 端到端 HTTP 验证 ✓ |
| `services/local-runtime/tests/test_v2_memory_knowledge_api.py` | 105-137 | forget happy path；不校验空 / 错 confirmationText |

---

## 7. 未在本次覆盖的 R1 范围（需在 R2 / R3 前明确）

- `apps/chrome-extension/src/modules/knowledge_workspace/workspaceAuthority.ts` 与 `WorkspaceRouter.tsx` 的 authority 决策未审计。
- `KnowledgeWorkspaceShell.tsx` / `KnowledgeQuickSurface.tsx` / `SourceLibraryPanel.tsx` / `SourceDetailReader.tsx` / `EvidenceTraceDrawer.tsx` / `KnowledgeGraphCanvas.tsx` / `AskWithSourcesPanel.tsx` 等组件级 props 与运行时契约未审计。
- `entrypoints/background/index.ts` 中 `openOrFocusWorkspace` 与 `workspaceOpen.ts` 的路由权威逻辑未审计。
- 共享 semantic validator 与 R3 新 Schema 未在本轮读取。
- 隔离 Git 快照的 `snapshotCommit` / `build index` / 原始 run 封存顺序未在本轮独立验证（属于 R3 / R4）。

---

## 8. 本轮修改验证

- 复现脚本均在 `/tmp/navia-review/` 运行，未污染主工作树。
- `git status` 未变化（仅 `git diff AGENTS.md` 等历史修改仍存在）。
- 22 项 pytest 完整复跑确认通过；但本轮确认该 22 项**不构成** R1 通过证据。
- 没有运行旧报告生成器或旧生产 validator。
- 没有启动浏览器或 Runtime 实例。
- 没有修改产品代码、验收实现或公共合同。

---

## 9. 交接建议

1. **下一位独立审查者**：建议先复现本文件第 2 节给出的三个隔离脚本；如复现失败，再回到本审查结论并要求当前会话重新提交可复现脚本。
2. **修复者**：按 F-1..F-6 顺序修复；每项修复后新增失败回归，并把 `test_v2_local_permissions.py:174` 等"固化 bug"的断言改对。
3. **用户决策**：是否允许 R1 修复后立刻进入 R2？建议是 **否**：修复后必须先独立复审 + 真实 Chrome 双容器 E2E，再决定 R2 范围。
4. **后续阶段**：R2 真实宿主采集、R3 共享校验、R4 隔离 Git 快照全部属于本次 PX-5 修复之外的下一轮；本轮工作树不能直接继续。
