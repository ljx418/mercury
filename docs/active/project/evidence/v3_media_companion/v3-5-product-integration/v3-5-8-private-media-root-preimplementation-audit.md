# V3-5-8 本机媒体私有目录修复实施前审计

日期：2026-10-09。决定：`GO`。

- Fatal：0。
- Major：0。
- Minor：1：用户现有 Companion 需要重启后才加载新默认路径。

## 审计结论

推荐路线是把敏感临时 artifact 放到 WSL 私有文件系统，而不是针对 `/mnt/c` 特判或放宽权限位。该路线同时满足真实 Windows 使用、Linux 权限合同和后续其他门户适配器复用。

`TaskArtifactError` 当前仅在 create 阶段转换，write 阶段可逃逸为 500；补齐 endpoint 边界属于错误合同闭环，不改变正常成功结果。允许进入实现。

