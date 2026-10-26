# GC-B6A 实施前审计

## 结论

`GC-B6A REVIEW-CAPTURE IMPLEMENTATION MAY START`

Fatal 0 / Major 0 / Minor 2。

## 已关闭的规格问题

- 明确了为何 R8 derivative 单独不足以完成 B-6；
- 选择同 run cleanup 前私有捕获，拒绝非确定性事后重建；
- B6A 工具实现、B6B evaluator 和 B7 审计分离；
- 冻结了四轴阈值、critical error、sentinel 和公开/私有证据边界；
- 明确 B6B 必须形成新的完整 candidate，不能与 R8 拼接。

## Minor

1. 私有 review root 的最终物理位置由 B6B preflight 从显式环境变量解析；文档只
   冻结安全属性，不冻结用户目录路径。
2. B6 evaluator 是宿主 LLM 语义判断，不能像 schema 一样完全确定；sentinel、
   独立 session、逐轴锚点和 B7 复算用于约束该不确定性。

## 授权边界

当前只授权 B6A 离线工具实现。B6A 不得启动真实 Runtime 媒体任务、Chrome、
下载、Cookie 读取、Provider 或六视频运行。B6B 的真实动作在 Codex checkpoint
通过后再沿用用户阶段授权并进行一次集中运行。

公共合同变更：none。外部文档审查：本包未请求，按项目规则留到 Stage B
closeout/B7；B6A checkpoint 使用实现定向测试和一次合并复核。
