# V3-2-2 路线 B 威胁模型

日期：2026-10-06。数据分类：Cookie/字幕私有 URL/临时媒体为 private；hash、失败码、公开 artifact ref 为 public-safe。

| STRIDE/风险 | 严重度 | 攻击或假绿场景 | 控制 | 验收 |
|---|---|---|---|---|
| 故障开关进入生产 | Critical | 用户请求或环境变量可强制下载媒体 | 故障类型只在 E2E；生产模块零 import/参数；静态 allowlist | RB06 |
| 伪造字幕失败 | High | 不先访问真实字幕便直接走媒体 | Revision 4 强制 discovery hash/items>=1/时序 | RB05/RB07/RB08 |
| fixture 冒充真实媒体 | High | 复制 WAV 通过回退 | 下载产物绑定 task/media/cid/part、yt-dlp receipt 与 byte hash | RB13 |
| Cookie 泄漏 | Critical | argv/log/evidence 暴露值 | lease、随机 0600 cookiefile、值 needle scan、redaction | RB09..RB11/RB19 |
| URL/重定向 SSRF | High | 任意 URL、私网 redirect、file scheme | adapter 构造 URL；HTTPS/host allowlist；redirect 逐跳验证 | RB16 |
| 多 P 越权 | High | 下载全集或错误 cid | identity 与目标 part 精确绑定；`--no-playlist` | RB13/RB14 |
| 受限内容绕过 | High | 通过额外参数规避付费/地区限制 | 默认拒绝；不重试规避；blocked 终态 | RB15 |
| 残留与竞态 | High | 取消后进程继续写、cookiefile 残留 | cancel token、子进程回收、cleanup barrier、owner manifest | RB17 |
| 平台漂移假绿 | High | AI 字幕异步出现导致自然样本失真 | 双探测、同 run、类型计数、漂移即失败 | RB02..RB05 |
| 证据重放 | Medium | 拼接旧 run/hash | run/build/dependency/model/schema/seal 单一绑定 | RB20 |

## 剩余风险

B站 API、风控与媒体格式仍可能变化；V3-2-2 只对冻结样本与时间点作限定声明。自然样本较长会增加验收时长，但不提高资源上限。独立审查者只能验证公开证据没有秘密，不能读取 Cookie 真值。

