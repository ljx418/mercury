# V3-5-8 本机媒体私有目录修复验收结果

日期：2026-10-09。决定：`PASS`。Fatal=0，Major=0，Minor=1。

真实通过 run：`v3-5-8-real-20261009T150325Z`。

| ID | 结果 | 证据 |
|---|---|---|
| A01 | PASS | 默认根为 `/home/administrator/.cache/navia/media-tasks` 与 `media-asr-tasks`，均不在 `/mnt` |
| A02 | PASS | 两个根实测 mode=`0700`；sandbox 私有目录/文件测试通过 |
| A03 | PASS | 人工注入 `TaskArtifactError` 得到 HTTP 500 JSON，FailureCode=`V3_MEDIA_TEMP_FILE_MODE_INVALID`，无裸异常 |
| A04 | PASS | 真实 B站页自动建立 session、lease、acquisition；未显示 policy/offline 假错误 |
| A05 | PASS | `/execute` HTTP 200，UI 自动到达 `processing`，Runtime log 无 500/mode error/traceback |
| A06 | PASS | 101 files / 54,646,572 bytes / 0 secret hit；profile 与 secure root 均删除 |
| A07 | PASS | Runtime 24/24、LaunchCard 4/4、typecheck、WXT build 全部通过 |

## 失败尝试隔离

- `v3-5-8-real-20261009T145947Z`：日常 Companion extension binding 与隔离 Chrome ID 冲突，作废。
- `v3-5-8-real-20261009T150109Z`：真实 execute 已关闭目录错误，但 runner 在 execute 完成前扫描私有 Cookie staging，命中 4；作废。runner 改为等待真实 execute 200 后再扫描，未降低 0-hit 门槛。

## Minor

M-1：Chrome 已加载的 unpacked extension 需要用户在 `chrome://extensions` 点击一次重新加载，才能使用最新前端错误说明；Runtime 后端修复已经通过桌面 Companion 重启生效。

