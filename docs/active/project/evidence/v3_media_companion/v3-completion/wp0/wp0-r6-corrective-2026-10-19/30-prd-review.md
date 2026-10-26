# WP0 R6 PRD 与体验复核

## 当前覆盖

- G1 extension 协议负例：29/29。
- G2 可见浏览器生命周期：0/7 接受，等待单次正控。
- G3 真实 Runtime/transport：8/8。
- G4 durable handoff/recovery：21/21。
- R6 固定分母：58/65。

R6 只证明标签页捕获路径的安全性与故障收口，不能证明 capture 是产品上最优或唯一 fallback，也不能用下载路线成功替代这 7 个生命周期场景。

## 用户 fallback 裁决

产品目标顺序建议为：自动字幕 -> 受控下载与本地 ASR -> 用户显式选择“导入已下载视频”或“捕获当前标签页”。禁止三条自动路线失败后静默进入 capture。

“用户下载/选择文件后接续解析”相对当前静默 capture 的优势是透明、可恢复、可重复，不依赖标签页持续存活或完整实时播放；劣势是多一步下载和选文件、可能复制大文件，并扩大本地文件、磁盘、格式、清理与 SourceAuthority 边界。因此它是更优的显式 fallback，但不是自动路线的替代品，也不应塞入 R6。

详细路线裁决见 `../wp0-r6-route-decision-2026-10-19/10-route-decision.md`。

## 出门条件

下一次可见正控必须在一个 owned、静音 Chrome 会话中完成 N01/N02/N03/N05/N06/N07/N10；每个场景使用新 task/grant，读取生产状态与 Runtime cleanup oracle。任何一项未命中精确边界，R6 继续 NO-GO。

