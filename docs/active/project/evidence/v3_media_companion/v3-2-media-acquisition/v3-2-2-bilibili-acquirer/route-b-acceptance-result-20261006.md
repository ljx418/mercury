# V3-2-2 Route B 自动化验收结果

日期：2026-10-06。候选 run：`v3-2-route-b-20261006T190000Z`。状态：CANDIDATE PASS，等待独立实施出门审计。

## 1. 真实数据结果

- 真实 Chrome：12/12 B站页面；授权临时 profile；结束后 profile 0 残留。
- 字幕：6 个字幕样本及多 P 冻结当前分 P共 7 个真实 body，均由产品 resolver 解析并生成非空 task artifact。
- 媒体：自然无字幕、受控 403、受控空体共 3 个真实当前分 P 音频；产物分别为 141702730、25320602、18323408 bytes，均验证为 mono / PCM S16LE / 16000 Hz 后按策略删除。
- 自然证据：`BV13W41137qV` 同一 run 两次探测均 0 字幕，间隔 44 秒，探测 hash 不同。
- 注入证据：`BV1ZpYd66ELP` 与 `BV1pW421c7DH` 在注入前均由 Runtime adapter 真实发现 2 个候选；每项只注入 1 次故障并进入真实媒体路线。
- 多 P：`BV1PA4m1w7ya` 观测 100 个分 P，只处理冻结 part 1。
- 受限 / 低信号：分别 blocked / degraded，0 artifact。

## 2. 固定门槛

`verification-result.json` 独立计算 RB01..RB20：20/20 PASS。Revision 4 Draft 2020-12 instance errors=0；12 唯一 URL；`6+3+1+1+1`；`1 natural + 2 audited`；403 与 empty 各 1；固定锚点保留。

RB09/RB10/RB16 由 69 项聚焦回归覆盖无 lease、错 task、过期、撤销、身份漂移、域名/URL/参数注入与失败清理；独立出门审查必须重跑或抽样，不得只接受候选自报。

## 3. 回归与安全

- Runtime 全量：441 passed。
- Extension：typecheck PASS；39 test files / 293 tests PASS；production build PASS。
- Route B 聚焦：69 passed。
- 生产故障入口：8 files / 9 needles / 0 hit。
- 私有任务 root、cookiefile、媒体：0 残留。
- 授权 registry 内 9 个 Cookie 值：公开 20 文件前封存扫描 0 hit；`SESSDATA/Cookie:/Bearer/私有字幕主机/本机 Cookie 路径` 0 hit。
- 原始“全部浏览器 Cookie”扫描曾因 1 至 3 字节偏好 Cookie 与普通 JSON 数字碰撞产生误报；它们不在产品九项 allowlist、未被传输。诊断保留，不能把该误报改写成真实泄漏。

## 4. Seal

公开 run 19 项载荷；`public-run-seal.json.contentSha256=aa68e083c994c30ee6c71b505e3c33fd7a7ea4ec0506b6079d94cdc2c0b58ea4`，独立 canonical JSON 重算一致。公开包不含媒体字节，因此 RB13 的媒体 hash/长度/shape 是任务沙箱内流式验证证据，独立复验方式是重新运行真实获取，不是从公开包重建媒体。

## 5. 当前判定

候选 Fatal=0 / Major=0 / Minor=0。只有新的独立实施审查确认 Fatal=0/Major=0 后，才可将 V3-2-2 标记为 LIMITED PASS，并仅允许进入 V3-2-3 实施前恢复审计。
