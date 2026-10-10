# V3-1P B站真实样本探测开发计划

日期：2026-09-17  
状态：`AUTHORIZED / PREIMPLEMENTATION TOOLING ONLY`

## 1. 目标与边界

本子阶段只关闭 V3-0 外审 M-1：在任何 V3-1 产品代码实施前，用全新临时 Chrome profile 探测并冻结 12 个互不重复的 B站视频 URL。它不读取用户现有 Chrome profile，不请求 `cookies` 权限，不生成凭据租约，也不修改 Extension、Runtime 或产品 UI。

固定主分类：

- `subtitle`：6 个公开或页内字幕可用样本；
- `asr`：3 个无公开/页内字幕、预期进入本地 ASR 的样本，必须包含 `BV1ZpYd66ELP`；
- `multipart`：1 个 `partCount > 1` 的样本；
- `restricted`：1 个登录、会员、地区或平台策略限制并预期 `blocked` 的样本；
- `low_signal`：1 个预期进入 `degraded` 的低语音/低信息样本。

## 2. 实现产物

1. `v3-bilibili-sample-registry.schema.json`：固定 revision、12 个唯一 URL/BVID、精确分类计数、观测来源和原始响应哈希。
2. `apps/chrome-extension/e2e/v3-bilibili-sample-probe.mjs`：真实 Chrome 只读探测器。
3. `runs/<runId>/raw-observations.json`：每个候选的页面/API 原始观测摘要，不含 Cookie 或凭据。
4. `runs/<runId>/screenshots/*.png`：最终 12 个样本的真实页面截图。
5. `sample-registry.json`：通过 Schema 与语义校验的 revision 1 注册表。
6. `v3-1p-sample-probe-exit-audit.md` 与 `v3-1p-prd-review.md`。

## 3. 探测算法

1. 使用系统真实 Chrome 与全新随机 `user-data-dir`，禁止复用登录 profile。
2. 对候选 URL 真实导航，等待 B站页面完成首轮渲染。
3. 从 URL、页面 bootstrap JSON、DOM 和同页公开 player API 交叉读取 `bvid/cid/partCount/duration/title/author/subtitle`。
4. 保存原始观测的 canonical JSON SHA-256；只输出 Cookie 名称计数为 0，不读取值。
5. 分类必须由观测事实支持；无法证明的候选保持 `unclassified`，不得强行填槽。
6. 满 12 个唯一槽位后才生成 registry；否则 exit 2 并保持 V3-1 NO-GO。

## 4. 停止条件

- B站要求验证码、登录或人工操作才能完成公开探测；
- 无法真实证明 6 个字幕样本或 restricted/low-signal 分类；
- 任何输出包含 Cookie、token、Authorization、真实 profile 路径或查询秘密；
- 通过修改分母、复用 URL、把搜索摘要冒充 Chrome 观测来补齐注册表。

上述任一项发生时，V3-1P FAIL，不进入产品代码。
