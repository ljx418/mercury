# V3-5-7 侧边栏一键媒体流程实施前审计

日期：2026-10-09。决定：`GO FOR V3-5-7 IMPLEMENTATION`。

## 审计结论

- Fatal：0。
- Major：0。
- Minor：2。
  - M-1：Chrome optional permission 与 trusted tabCapture 均要求用户手势，目标体验必须保留各自真正必要的一次动作。
  - M-2：现有历史 E2E runner 依赖旧按钮 test id；产品流程改造后需保留合同级旧测试并更新当前产品集成 runner，不能用删除测试规避失败。

## PRD 与架构检查

- 本改动收敛 Chat 的视频理解入口，没有新增 PRD 外能力。
- 自动 Runtime bootstrap 已存在，本轮只改变呈现和编排，不扩大 Runtime 权限。
- policy、permission、credential envelope、acquisition 仍按既有单向链路执行；不把 Cookie 交给 React 或持久化层。
- 专业诊断与撤销能力仍可达，符合可撤销治理要求。

## 出门条件

只有 A01..A10 全部通过，且真实 Chrome 未出现重复任务、权限假绿或 secret 暴露，才可判定 V3-5-7 PASS。否则回到计划阶段并保留失败 run。
