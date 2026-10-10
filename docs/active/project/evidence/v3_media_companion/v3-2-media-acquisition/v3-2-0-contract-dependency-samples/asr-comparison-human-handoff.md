# V3-2-0 人类 ASR 比较交接

日期：2026-09-18。此流程不要求任何人听写全文。

> 状态更新（2026-09-21）：用户已将 `reviewerId=123` 的 24 项结果指定为最终结论。该结果触发 fail-closed，D08=`FAIL / REPLAN`；本页以下双人流程仅适用于未来新模型、新 run，当前 run 不再补做以追求通过。

## Reviewer A / B

1. 各自从空白页面打开同一 standalone review page。
2. 填写不同的非敏感 Reviewer ID。
3. 对 24 个 15 秒区间点击“从此处播放原视频”。
4. 听原视频后选择 A 更准确、B 更准确、等价可接受或两者均不可接受。
5. 分别判断 A/B 是否保留关键含义，勾选错误类型；短备注可空。
6. 点击导出，在结果窗口下载 JSON；若浏览器拦截下载，复制窗口中的完整 JSON 保存为 `.json`。

两名 reviewer 提交前不得查看对方结果。

## Adjudicator

1. 打开“分歧复核”，填写与 reviewer 不同的 Adjudicator ID。
2. 导入两份 JSON；确认 bundle hash 相同且 reviewer ID 不同。
3. 页面只列出实质分歧区间；逐项听原视频并填写最终判断。
4. 生成复核 JSON。`passed=false` 也必须保留，不得重做选择追求通过。

## 回填文件

- 两份 `v3-asr-review-<reviewerId>.json`。
- 一份 `v3-asr-adjudication-<adjudicatorId>.json`。

提交后由机器 verifier 检查 48 项分母、同 bundle、不同 reviewer、每样本阈值、critical 和 neither-acceptable；未通过则返回模型/profile ADR。
