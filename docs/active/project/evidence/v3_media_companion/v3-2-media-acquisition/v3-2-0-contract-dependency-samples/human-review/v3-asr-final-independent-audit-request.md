# V3-2-0 ASR 最终人类结论独立审查请求

日期：2026-09-21。请从平铺包 `AUDIT_MANIFEST.md` 开始，只读审查。

## 决策对象

用户提交 `reviewerId=123` 的 24 项原视频听辨结果，并明确要求“以此结论作为最终结论进行验收”。本轮不是请求把单份 review 升格为通过，而是验证 fail-closed 处理是否正确：不伪造第二 reviewer、不伪造 adjudication、不把 23/24 外推为 46/48。

## 必查项

1. 原始 review 是否通过 Draft 2020-12 Schema，bundle hash 是否一致，24 个 `(bvid, binIndex)` 是否唯一且覆盖三样本各 8 项。
2. A/B 到 `production_small` 的映射是否与冻结 bundle 一致，production 含义保留是否确为 23/24，逐样本是否为 7/8、8/8、8/8。
3. critical=1、neither-acceptable=1、production preferred=16、baseline preferred=4、equivalent=3 是否可由原始 review 独立重算。
4. PRD 冻结通过门槛是否仍为 44/48、每样本 15/16、critical=0、neither=0。
5. 用户“最终结论”是否被正确解释为可以提前拒绝，但不能缩小通过分母或产生伪造通过证据。
6. Stage Gate、总验收计划、V3-2 验收和公开证据是否统一为 D08=`FAIL / REPLAN`、V3-2-0=`FAIL / REOPENED`、V3-2-1+=`BLOCKED`。
7. 旧机器材料 PASS 是否仍被限制为页面/材料可用，不得覆盖人类质量失败。

## 候选事实

- review SHA-256：`29313674ac457dd8df72b9f84834e8379968884a6704777d1e157f02de785d77`。
- final decision SHA-256：`4b91470a8efc0eab14d570b800ef5860f69484ed653abb11a3b27b4d6fe38c85`。
- decision verification SHA-256：`8a4f95490b60ce88bd4314b323456d5c2a438708576dd541e22dd5d5c178f029`。
- verification：9/9 PASS；其含义仅是失败判定可复算，`productPassed=false`。

## 允许的结论

最高只允许：

```text
FINAL REJECTION EVIDENCE: PASS
D08: FAIL / REPLAN
V3-2-0: FAIL / REOPENED
V3-2-1+: BLOCKED
```

不得声明 ASR 质量通过、V3-2-0 PASS、V3-2-1 GO 或 V3 ready。

审查结果请落盘到：

`docs/active/project/evidence/v3_media_companion/v3-2-media-acquisition/v3-2-0-contract-dependency-samples/human-review/v3-asr-final-independent-audit.md`
