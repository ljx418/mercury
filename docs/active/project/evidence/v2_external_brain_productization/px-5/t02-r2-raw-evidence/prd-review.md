# T02 R2 PRD 规格检视

日期：2026-09-11  
结论：T02 范围一致，等待独立审查后决定子阶段 PASS。

| PRD / PX-5 目标 | T02 证据 | 判断 |
|---|---|---|
| 用户从 Side Panel 三入口进入 Workspace | 三 origin 各 2 次真实 trusted click，Background 链可追踪 | 符合 |
| 独立 Workspace 的稳定 route 与 ID | 五 route 均有 direct/reload/Back/reopen，route/container 引用本 navigation Runtime authority | 符合 |
| Runtime 是知识状态权威 | 420 个知识请求全部终结为 403 个实际 response entity 或 17 个 transport failure；无孤儿、重复终态或伪 response | 符合 |
| PermissionRoot 显式授权 | 三份真实文件完成 grant/scan/import/revoke，私有路径只进入 private artifact | 符合 |
| Forget 用户主动发起且四面消失 | 三个 source 均重新查询 Library/Ask/Graph/Trace，并覆盖四种同源恢复 | 符合 |
| 四域服务状态可区分 | adapter、data_service、source、Runtime 四类 fault 分别成对记录并截图 | 符合 |
| 双容器目标视口 | 原生 Side Panel 360/420；Workspace 768/1280 | 符合 |
| 不做虚假完成声明 | raw run 不含 G1-G7、HTML、Human Review 或产品完成布尔 | 符合 |

本轮只完成 PX-5/T02 R2 原始证据层。它不证明 R3 语义派生、R4 独立总审查、PX-6 人工签署、真实 data_service、RKM 自动维护、完整外脑或 V2 ready。
