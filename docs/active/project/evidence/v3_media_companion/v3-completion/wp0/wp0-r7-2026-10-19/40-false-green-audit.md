# WP0 R7 反假绿审计

## 审计结论

Fatal 0 / Major 0 / Minor 0。

## 已核验

1. 原 R6 固定分母未删除、未缩小、未重命名：58/65。
2. G2 可见浏览器 7 项均保持失败：0/7；没有声明 R6 PASS。
3. R7 没有重新运行 Chrome，没有跨 run 拼接，也没有用单元测试冒充用户可达正控。
4. 生产调用点没有传入 `experimentalEnabled`；默认关闭由组件默认值、组件测试和调用点静态扫描共同证明。
5. relay v11 安全源码没有因需求裁剪而删除；baseline 50/50、mutations 16/16、静态合同 45/45。
6. 没有把“用户选择本地文件”写成当前能力；它只存在于后续 workpack。
7. 没有把文件存在、fixture 解析或固定字符串当作行为成功。
8. 没有声明所有 B站视频、直播、全平台、BiliNote/Monica parity 或整个 V3 已通过。

## 保留失败

R6 G2 的原生 action 调用虽返回成功，但生产 Controller 未消费 armed capture，首场景超时，后续场景未建立 capture。该结果保留在 `wp0-r6-scope-amendment-2026-10-19/10-visible-run-result.md`，是把能力降为 experimental 的直接依据。
