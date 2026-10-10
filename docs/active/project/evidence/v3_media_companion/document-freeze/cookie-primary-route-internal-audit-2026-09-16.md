# V3 Cookie 主路径修订内部审计

> 历史检查点：本文件记录 2026-09-16 初次 Cookie 路线修订。浏览器待办、原型 hash 和 Draw.io hash 已由 2026-09-17 第三/第四轮内部审计及 readiness audit 取代；不得单独使用本文件判断当前候选。

日期：2026-09-16  
范围：仅文档、合同、Draw.io 与审查原型；未修改或运行 V3 产品代码。  
结论：`INTERNAL PASS / EXTERNAL RE-REVIEW REQUIRED / PRODUCT CODE NO-GO`

## 1. 决策与边界

本轮按用户决策把 V3 B站采集路线冻结为：

```text
用户五项授权 + 点击开始
-> Background BilibiliSessionBroker
-> 同任务短期 BilibiliCredentialLease
-> Runtime BilibiliMediaAcquirer
-> 凭据字幕或任务期临时音频/视频
-> 回退 1：公开/页内字幕
-> 回退 2：可信点击 chrome.tabCapture
```

Cookie 值只允许存在于 Chrome Cookie Store、进程内存和任务期随机 `0600` Netscape cookiefile。Chrome 权限限于可选 `cookies` + `https://*.bilibili.com/*`，Broker 再按冻结名称白名单过滤；秘密经认证 loopback 的一次性 envelope 交付，request body 不记录或重放。禁止写入配置、数据库、EventStore、Trace、日志、合同实例和公开证据。平台拒绝、Cookie 失效、地区/会员/DRM/风控限制不得绕过，只能 fallback 或 blocked。

BiliNote 只提供字幕、yt-dlp、ASR、抽帧和任务编排的参考；其明文 `CookieConfigManager`、`config/downloader.json`、账号/数据库/应用壳不进入迁移允许范围。

## 2. 文档一致性检查

| 检查 | 结果 |
|---|---|
| PRD、目标架构、开发计划、验收计划、Stage Gate 同一路线 | PASS |
| 风险 ADR 与 BiliNote 研究明确“能力迁移、秘密存储不迁移” | PASS |
| 组件设计区分 policy、credential lease、capture grant | PASS |
| 可选窄域权限、Cookie 名称白名单、认证 loopback 一次性 envelope | PASS |
| 原型展示五项授权、短租约、双回退和清理 | PASS |
| V4 知识边界、12 页分母、OCR/VLM、Ask/jumpback 未退化 | PASS |
| 产品状态仍为 `NOT_IMPLEMENTED`，未把文档写成实现证据 | PASS |

## 3. 合同检查

- Schema：`v3-media-companion/v2`，Draft 2020-12 meta-validation PASS。
- 正例：1/1 通过根 Schema，使用 `credentialed_media` 和无秘密值租约。
- 负例：23 个 case 与 23 个 registry 条目在 ID/key/layer/failure code 上精确相等。
- Schema negatives：5/5 被拒绝。
- Semantic negatives：18/18 在 Schema 层保持合法，交由冻结语义算法拒绝。
- 新增防线覆盖：租约存储类型、同 task、主路径必须有租约、tabCapture 必须有可信 grant、未授权凭据访问、Cookie 持久化、Cookie 证据泄漏、临时媒体残留和四类 cleanup。

关键载荷 SHA-256：

```text
2ba21b128d298738ed2c4ef44b3a76677f1e75606547732b95131d84b85a5389  v3_media_companion_contracts.schema.json
948b858dcbce836a7e3b8c22bfa1575f162883535759516ec03d549b2c7bd6d5  v3-media-companion-contract-fixtures.json
eb063f71893119747b3f52c27d404e39f83f5d925d2d0894b2ae4c08249cca4a  v3-media-companion-prototype-self-contained.html
e6d99aa692b71b1c3c55808c2f206492fc30dae5bb09a8f8b6fc45bfb8bf712a  v3-media-companion-gap.drawio
```

## 4. Draw.io 与原型检查

- Draw.io：8 页、113 vertices、53 edges；每页 ID 唯一，0 broken edge reference，0 图元越出 1600x900。
- 第 04 页已改为 `Cookie媒体与双回退`，明确 `SessionBroker -> CredentialLease -> MediaAcquirer -> fallback`。
- 多文件原型与自包含原型均包含五项授权、短租约、受控媒体获取、回退与凭据/临时媒体清理文案。
- 自包含原型无 `assets/` 外部引用，四张 PNG 与 Lucide 脚本已内联。

本轮尝试用仓内 Playwright 1.60.0 重新运行真实 Chrome 四视口检查，但 Chromium 因宿主缺少 `libnspr4.so` 在启动前退出；未得到页面结果，也未把该基础设施失败写成产品失败或 PASS。因此旧 no-cookie 原型的浏览器/Axe/键盘结果不得自动继承为本候选的新鲜证据，该项必须由具备完整浏览器依赖的外审或下一轮原型 QA 重跑。

## 5. 风险结论

Fatal：0。  
Major：0。  
Minor：1。

Minor-1：Cookie 名称、B站接口、Chrome 可选权限、yt-dlp 与平台风控兼容性只能在 V3-1/V3-2 的真实 Chrome 与真实账号环境中验证；本 session 的 Playwright 又被缺失 `libnspr4.so` 阻断。文档通过 fallback/blocked、0 secret persistence 和清理门禁消减风险，但不能在文档阶段证明平台兼容性或新鲜视觉 QA。

## 6. 门禁

```text
V3-0 cookie-primary document revision: INTERNAL PASS.
Previous no-cookie independent audit: SUPERSEDED FOR CURRENT AUTHORITY.
Fresh external independent document review: REQUIRED.
V3-1..V3-7 implementation: NO-GO until external Fatal=0/Major=0 and explicit user authorization.
```

外审必须重点验证：最小权限是否足够、秘密是否可能通过异常路径落盘、租约和任务 identity 是否闭合、回退顺序是否可执行、终态清理是否可机器验收，以及该路线是否仍忠实于 PRD 的 B站优先目标。
