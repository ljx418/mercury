# V3-1 路线 A 合同与假绿内部审计

日期：2026-09-17。性质：第二轮内部攻击性审计，不替代外部独立审查。

## 1. 机器检查结果

| 检查 | 结果 |
|---|---|
| Schema v3 Draft 2020-12 meta-validation | PASS |
| contract positive root | PASS，0 errors |
| requirement registry / negative cases | 25 / 25，ID/key/layer/failureCode 精确一致 |
| Schema negatives | 5/5 invalid |
| Semantic negatives | 20/20 在 Schema 层保持 valid |
| portal registry 原始字节绑定 | PASS，SHA-256=`4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6` |
| fixture 内 portal registry hash | PASS，与原始文件一致 |
| registry adapter | 仅 `bilibili`，revision=1，build-time closed set |
| 全站匹配 | registry 中 0 `<all_urls>`、0 `http://*/*`、0 `https://*/*` |
| 通用 context 平台泄漏 | Schema 中 0 `bvid`/`cid` 属性 |
| route A 权限 | static/WAR 仅 `https://www.bilibili.com/video/*`；session 仅 optional cookies + B站 host |

## 2. 新增 semantic 防线

- `portal_adapter_binding`：context 的 adapterId/platform/revision 必须与 portal registry descriptor 一致；未知、错绑或被替换实现返回 `V3_PORTAL_ADAPTER_BINDING_INVALID`。
- `source_identity_matches_page_context`：task identity 必须由同一 context 确定性生成 `portal:<adapterId>:<mediaId>:<playbackUnitId>:<part.id>`；不一致返回 `V3_SOURCE_IDENTITY_MISMATCH`。

生产 validator 还必须重算 portal registry 原始字节 SHA-256，不能相信 fixture 中的 hash 或只检查 adapterId 字符串。

## 3. 假绿攻击

| 攻击 | 必须结果 | 候选防线 |
|---|---|---|
| 把 `<all_urls>` 改写为两个全站 HTTP(S) pattern | FAIL | manifest 与 registry 归一化 host-scope 扫描 |
| 在代码注册未写入 registry 的 YouTube adapter | FAIL | build-time registry 与 import graph 对账 |
| 把 B站 context 的 adapterId 改成 youtube | FAIL | V3-N-024 |
| 保持 task identity 指向另一个视频 | FAIL | V3-N-025 |
| UI 直接读取 bvid/cid | FAIL | 通用 TypeScript contract + AST 边界扫描 |
| 新 adapter 继承 B站 Cookie policy | FAIL | registry sessionProfile 独立、权限审计和 consent scope 对账 |
| 用 V3-1P observation 填充产品 collector 输出 | FAIL | evidenceClass/source run 检查与真实产品 E2E |
| 用 fixture positive 声明生产通过 | FAIL | `evidenceClass=contract_fixture` 永不支持生产声明 |

## 4. 当前文件哈希

```text
02b363327501da22f4293f6bfd7f1bee946bfda84ac56d8721d3c21c8b7bee73  v3_media_companion_contracts.schema.json
4c3a21037d1c6199e9bd968ed51b9741884d655f96ce1aa3a4bc6b1b5f60bce6  v3-media-portal-registry.json
e05c72f0339084c4b9db5a36c45edc1032a8be5b4a40d5a96a19e2622cfc36ad  v3-media-companion-contract-fixtures.json
4efed988b1c18cf1262f1753db5dc5f1706ceee328f0e5238ad9bf279696f5cf  v3-media-companion-gap.drawio
```

## 5. 结论

Fatal=0，Major=0，Minor=0。

Schema/fixture/registry 候选可以提交外部独立审查。产品代码保持 NO-GO，直到外审重新计算本文结果并确认权威文档无冲突。
