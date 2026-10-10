# V3-3-6 真实视觉生产矩阵开发计划

日期：2026-10-08。前置：V3-3-5 LIMITED PASS。

## 固定输入和目标

唯一 registry：`v3-3-dependency-freeze/v3-3-vision-sample-registry.json`，机械来自 sealed V3-2 run `v3-2-production-20261007T174158Z`。固定 10 个应成功样本：6 subtitle + 3 ASR + 1 multipart；前 8 个 `cloudVisionTarget=true`。

在一个新 run namespace 内逐样本重新下载当前分 P 的真实 8 秒媒体段，执行 frame sampling、1 个 selected frame、本地 OCR；前 8 个再执行 1 次真实 MiniMax VLM。每个样本独立 task/consent/budget/cleanup，但共享同一 runId、build、registry 和工具清单。禁止复用 V3-3-1..5 结果计数。

## 实施顺序

1. 冻结 runId、registry SHA、工具/依赖/provider/model/build 指纹。
2. 验证 10 个 registry 样本集合、分类与 cloud target 精确等于冻结文件。
3. 为每个样本创建独立 task；Cookie 只转为一次性私有 Netscape 文件。
4. 下载当前 P 真实 8 秒视频；绑定实际 bytes/hash/duration。
5. 确定性采样并抽取首个 selected frame；10/10 运行 RapidOCR。
6. 前 8 个 task 分别 grant，真实调用 MiniMax-M3 一次，生成 8/8 governed observations。
7. 每个 task 生成 Schema-valid receipt，删除非证据帧并最终删除整个 task root。
8. 写 public summary/index/seal；不写 caption 原文、原帧、Cookie、密钥或绝对路径。
9. 运行固定 verifier、秘密扫描、Runtime/Extension/V3-1/V3-2 回归。
10. 失败即保留去敏诊断并令 run 无 seal；不得跨 run 补齐。

