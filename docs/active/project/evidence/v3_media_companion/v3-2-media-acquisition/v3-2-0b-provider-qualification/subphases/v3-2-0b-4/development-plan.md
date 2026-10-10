# V3-2-0b-4 Settings 与真实 Runtime 安装链计划

日期：2026-09-22  
状态：`AUTHORIZED / PREIMPLEMENTATION AUDIT REQUIRED`

## 目标体验

用户在 `Settings > 媒体与语音` 看见四个模型的质量定位与真实资源影响；点击 Paraformer“下载并安装”后打开可访问进度弹窗，真实 Runtime 完成下载、hash、单成员 materialize、自检和 ready。资格通过前选择按钮保持禁用，实际模型仍为 Tiny。

## 实施

1. 更新 TS contract：qualification_pending/production_qualified、runtimeKind、capabilities、gateVersion、平台下载 bytes、安装可用空间、job transition history。
2. 更新卡片：区分“资产可安装”和“生产质量可选择”，显示 Linux/Windows 下载、安装、RAM 政策上限、CPU、VRAM、free space。
3. 保持一键安装进度弹窗、取消、焦点陷阱与失败后的自动重试/离线包/CLI 步骤。
4. Runtime job 记录真实状态历史；remote install 顺序固定 checking→downloading→verifying→self_testing→installing→ready。
5. 重写 V3 Chrome runner：禁止 route intercept，使用隔离 runtime/db/model/profile，通过真实按钮下载官方资产并等待 ready。
6. 同一 Chrome run 验证 catalog/资源/质量、状态历史、Tiny effective、四视口、Axe、键盘、卸载恢复和清理。

## 边界

不开放 Paraformer 选择，不生成三样本转写，不进入质量判断。真实安装可完成，`quality.status` 仍 qualification_pending。
