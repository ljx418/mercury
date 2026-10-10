# V3-2-2 Revision 3 外部文档审查闭环

日期：2026-10-06。

## 审查结论

独立报告：`independent-document-audit.md`。

- 文档：`PASS`。
- 实施：`NO-GO`。
- Fatal：0。
- Major：1，继承项 M-1：B站 `/x/web-interface/nav` 返回 `code=-101/isLogin=false`。
- Minor：1，继承项 m-1：BA07 必须以真实字幕 body 验证；恢复登录后 12 URL 必须从零整组重跑。

## 闭环状态

外审未发现新的合同、范围、缩分母或人工验收时点问题。V3-2-1 外部实施审查和 Revision 3 文档审查均已完成；当前唯一阻断是外部授权会话失效。失败 run `v3-2-sample-probe-20261006T120000Z` 保留为失败证据，不得与后续 run 拼接。

## 恢复门槛

1. 用户更新有效的 B站登录 Cookie。
2. 独立验证 `/x/web-interface/nav code=0/isLogin=true`。
3. 使用全新临时 Chrome profile 和 run 对 12 URL 从零重跑。
4. 生成并校验 `productionReady=true` Revision 3；确认真实字幕 body、当前分 P、hash、授权 probe 和 SenseVoice baseline 均闭合。
5. 重新执行实施前审计；在用户明确授权 V3-2-2 implementation 前不进入凭据字幕或媒体下载实现。
