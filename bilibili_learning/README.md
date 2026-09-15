# bilibili_learning

B 站视频学习助手 —— 把 B 站教程视频下载到本地, 抽帧分析, 生成大纲/思维导图/时间戳索引, 让你"按图索骥"快速定位到原视频的关键片段。

**这个目录不属于 navia 项目本体**。它只是借用了 `C:\workSpace\navia\` 这个工作空间的便利, 不应被提交到 navia 的 git 仓库。

---

## 为什么放这里?

- 跟 navia 工作空间共享 Python venv (避免重复装包)
- 跟 navia 项目目录树放一起方便管理
- 子目录有自己的 `.gitignore`, 产物不会污染 navia 的 git 状态

---

## 文件清单

| 文件 | 用途 |
|---|---|
| `chrome_launcher.py` | WSL → Windows Chrome + CDP 9222, 自动开 bilibili.com |
| `cookie_exporter.py` | 通过 CDP 拿已登录 Chrome 的 cookies, 写到 `cookies/bilibili_cookies_latest.json` |
| `bilibili_downloader.py` | 用 cookies 鉴权, 下载视频 (DASH 模式优先, 单 mp4 fallback) |
| `video_analyzer.py` | 调本地 cv2+rapidocr pipeline 跑镜头/关键帧/OCR (事实层) |
| `README.md` | 本文件 |
| `cookies/` | cookies 存放目录 (git ignore) |
| `bv_list.txt` | 你要学的视频 BV 号列表 (git 跟踪, 自己手动维护) |

---

## 完整使用流程

详见 `README.txt` (用 `cat` 或记事本打开)。

**快速版**:
1. `pip install requests playwright && python3 -m playwright install chromium && sudo apt install ffmpeg`
2. 终端 1: `python3 chrome_launcher.py` → 手动登录 B 站 → Ctrl+C
3. 终端 2: `python3 cookie_exporter.py` → 看到 SESSDATA/bili_jct/buvid3 都 [OK]
4. 编辑 `bv_list.txt`, 写入要学的 BV 号
5. `python3 bilibili_downloader.py --from-file bv_list.txt --output-dir /mnt/d/0-B站视频学习`
6. `python3 video_analyzer.py "/mnt/d/0-B站视频学习/"`

---

## 注意

- cookies 文件含你的 B 站登录态, **绝对不要分享**
- 下载的视频仅供个人学习, 用完即删
- step 6 的 OCR 输出是事实层 (可信), 后续若需要语义理解, 走对话发我关键帧让我用 vision_analyze 看 —— 但 vision_analyze 在我这边历史幻觉率较高, 需要你交叉验证
