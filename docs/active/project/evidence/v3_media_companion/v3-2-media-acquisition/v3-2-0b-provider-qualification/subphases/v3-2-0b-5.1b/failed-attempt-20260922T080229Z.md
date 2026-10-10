# V3-2-0b-5.1b 安装终态诊断缺口失败记录

日期：2026-09-22。

候选 run `v3-2-0b-5.1b-20260922T080229Z` 已通过前置、失败质量标签和资源检查，但真实安装 job 进入终态后，页面未在 30 秒内显示“可用”。runner 没有在失败材料中保存 terminal state/failureCode，而是报告 locator timeout，无法区分下载/安装失败和 UI 刷新失败。

该 run 作废。修复为：terminal job 非 `ready` 时立即以机器 failureCode 失败；失败记录只保存 state、failureCode、history，不保存 job ID、路径或资产正文。全新 run 必须再次使用官方远程资产。
