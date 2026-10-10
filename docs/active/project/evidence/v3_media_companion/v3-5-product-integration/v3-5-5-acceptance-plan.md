# V3-5-5 自动 UI 与可访问性验收计划

日期：2026-10-09。固定分母：`V3-5-5-A01..A12`，不得 N/A。

| ID | 操作 | 必须结果 |
|---|---|---|
| A01 | 从固定真实 B站页创建 fresh task | Runtime 实际 pipeline 完成，task ready/degraded 事实如实显示 |
| A02 | Side Panel 360x900 | 产品面可操作，`scrollWidth<=clientWidth`，无水平根溢出 |
| A03 | Side Panel 420x900 | 同 A02；身份、状态、Workspace 入口可见 |
| A04 | Workspace 768x900 | Overview/Outline/Evidence/Ask/Export 可达，无水平根溢出 |
| A05 | Workspace 1280x900 | 同 A04，布局不被窄屏补丁破坏 |
| A06 | 四视口 Axe | 每个视口 serious=0、critical=0；不得禁用规则或删节点绕过 |
| A07 | Side Panel 键盘 | Tab 可达主操作，Enter/Space 可激活，不依赖鼠标 |
| A08 | Workspace 键盘 | route tab、Ask、Export 可达；Evidence 打开后 Escape 关闭并把焦点返回触发器 |
| A09 | reduced motion | `prefers-reduced-motion: reduce` 下主流程仍可操作，无无限动画 |
| A10 | 截图/元数据 | 4 张产品面 PNG 非空，解码尺寸与 viewport/metadata 一致，SHA-256 可复算 |
| A11 | 隐私与清理 | 截图无 Cookie/key/私有路径；临时媒体/ASR/profile/安全根清理，公开扫描 0 hit |
| A12 | 回归与规格 | V3-5-1..4 核心检查仍通过；Fatal=0/Major=0，且不生成 Human PASS |

任一项失败则 `FAIL / REPLAN`，禁止生成可提交的人类 review bundle。最终验收截图属于 V3-5-6 输入，不是开发过程截图；其余截图必须删除。
