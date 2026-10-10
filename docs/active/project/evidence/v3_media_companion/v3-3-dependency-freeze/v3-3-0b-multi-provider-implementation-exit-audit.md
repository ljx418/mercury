# V3-3-0b 多视觉 Provider 实施出门审计

日期：2026-10-08。

## 结论

`V3-3-0b MULTI-PROVIDER SETTINGS LIMITED PASS / REAL MINIMAX PROBE PENDING`

Fatal=0，Major=0。允许用户在本机设置页录入 MiniMax Key 并执行一张中性图片能力测试；真实 probe 通过前，不允许扩大为真实视频帧调用或 V3-3 PASS。

## 实现核验

- Runtime 闭集：MiniMax `https://api.minimax.io/v1` + 默认 `MiniMax-M3` / M Plan 可选 `MiniMax-M3.1-Flash-Preview`；OpenAI 保留既有冻结项。
- MiniMax adapter：`POST /chat/completions`、Bearer、`image_url` Data URL、低 detail、typed observation 归一化。
- Provider 隔离：各自 `secretRef`；删除一个配置不影响另一个；SQLite 不含密钥。
- 当前路由：未经 capability test 返回 409；测试通过后才可选择；删除当前项后清空，不静默回退。
- 网络边界：未知 Provider、未知模型、自定义 base URL 均在写凭据前拒绝。
- Extension：服务商与模型两级选择；MiniMax 为初始推荐；离线时允许先选择和临时输入，只有提交需 Runtime 在线；checking/offline 到 online 不再清空输入；保存/测试/选择/删除路径完整。

## 自动验收

- Runtime 全量：`589 passed`。
- 前端全量：`47 files / 316 passed`。
- TypeScript typecheck：PASS。
- WXT production build：PASS；仅保留既有 chunk-size warning。
- 真实 Chrome：最终 run `v3-3-0b-2026-10-08T034132149Z`，360/420 两视口均完成真实密码框键入/清空、Provider/模型读取，UI 2/2、Axe serious/critical 0/0。
- 最终公开证据秘密扫描：0 hit。
- `git diff --check`（本阶段文件）：PASS。

证据目录：`v3-3-0b-multi-provider-settings/v3-3-0b-2026-10-08T034132149Z/`。

## 剩余门槛

用户必须在本机 Runtime 在线时进入 `Settings > 媒体与语音 > 画面理解模型`，选择 MiniMax 与模型，输入 Key 并点击“保存、测试并使用”。测试应只上传 Navia 生成的中性色块图。成功后才能把 MiniMax 标为真实可用并推进 V3-3 真实帧阶段。
