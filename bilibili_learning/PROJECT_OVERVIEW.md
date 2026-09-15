================================================================
BiliNote 项目总览 + 自己玩指南 (2026-08-27)
================================================================

## 一、项目状态: 完全可用 ✅

### 已部署的容器
```
NAMES               STATUS                   PORTS
bilinote-nginx      Up 11+ 分钟            0.0.0.0:3015->80/tcp
bilinote-frontend   Up 11+ 分钟            80/tcp
bilinote-backend    Up 11+ 分钟 (healthy)  8483/tcp
```

### 你要做的第一件事
**浏览器打开** → http://localhost:3015

页面是中文的, 标题"强大的AI视频笔记神器"

## 二、首次配置 LLM (在 BiliNote Web UI 里)

⚠️ 重要: LLM API key **不写 .env**, 是在 BiliNote 的 Web UI 里填

步骤:
1. 浏览器开 http://localhost:3015
2. 进「设置」或「Setting」页 → 「模型供应商」
3. 点"添加 Provider"
4. 填以下信息:

### 推荐: deepseek (中文强, 已验证可用)

  Provider 名称: deepseek
  Provider 类型: OpenAI (兼容协议)
  Base URL:    https://api.deepseek.com/v1
  API Key:    你的 DEEPSEEK_API_KEY (整串复制)
  模型 ID:    deepseek-chat
  → 测试连接: ✓

### 备选: minimax (国内, 已修通)

  Provider 名称: minimax
  Provider 类型: OpenAI (兼容协议)
  Base URL:    https://api.minimaxi.com/v1 (注意末尾 /v1)
  API Key:    你的 MINIMAX_API_KEY (整串复制)
  模型 ID:    MiniMax-M3
  → 测试连接: ✓

## 三、试一个公开 B 站视频

BiliNote 主界面输入:
```
https://www.bilibili.com/video/BV1xx411c7mD
```
(占位, 换成你想要的真实公开视频)

或者直接用:
- https://www.bilibili.com/video/BV1xx411c7mD
- https://www.bilibili.com/video/BV1GJ411x7h7 (老番茄)
- 任何公开视频

⚠️ BiliNote 默认会:
1. 下载视频 (~100MB+)
2. 转录音频 (首次会下载 whisper-tiny ~75MB 模型)
3. 调 LLM 生成大纲 (~30s-2min)
4. 输出 Markdown + 思维导图 + 截图 + 时间戳

## 四、其他功能

### 转写器配置 (在 BiliNote Web UI "音频转写配置")
默认 fast-whisper + tiny 模型 (75MB, CPU 跑)
- 想更准? → 切 base/small/medium (要更大模型下载)
- 想更快? → 切 Groq 在线 (需 Groq API key)

### 浏览器插件
BiliNote 还有 Chrome 扩展 (`BillNote_extension/`)
可以让你在 B 站原页面直接生成笔记
装法: chrome://extensions → 开发者模式 → 加载已解压 → 选 `BillNote_extension/extension/`

### 其他端口
- 3015: Web UI (浏览器访问)
- 8483: 后端 API (内部, 经 nginx 代理)
- 直接打 8483 也能访问, 但路径要加 /api 前缀

## 五、代码位置

### BiliNote 官方仓库 (克隆)
`C:\workSpace\navia\bilinote\`
- backend/          FastAPI 后端
- BillNote_frontend/  React 前端
- BillNote_extension/ 浏览器扩展
- docker-compose.yml  容器编排
- .env               环境变量 (含国内源 override)

### 我们的辅助工具
`C:\workSpace\navia\bilibili_learning\`
- secrets/.env.example / .env    LLM key 管理
- secret_loader.py               加载 + 不打印真值
- llm_client.py                  OpenAI 兼容 LLM 封装
- test_llm_providers.py         连通性测试
- test_video_outline.py         大纲生成验证
- diagnose_minimax.py           minimax 调试
- chrome_launcher.py            启 Chrome + CDP
- cookie_exporter.py            导 B 站 cookies
- bilibili_downloader.py        下视频 (DASH)
- video_analyzer.py             抽帧 + OCR
- deploy_bilinote.sh            一键部署脚本

### 已验证的 LLM Provider
| Provider | Base URL | 模型 | 状态 |
|---|---|---|---|
| minimax | https://api.minimaxi.com/v1 | MiniMax-M3 | ✅ |
| deepseek | https://api.deepseek.com/v1 | deepseek-chat | ✅ |
| openai | https://api.openai.com/v1 | gpt-4o-mini | ⚠️ 未配 key |
| anthropic | https://api.anthropic.com | claude-3-5-sonnet | ⚠️ 未配 key |

## 六、常见问题

### Q: BiliNote 转写失败?
A: 看 docker logs:
  docker logs bilinote-backend | tail -50
大概率是 whisper 模型下载失败, 检查 .env 里 HF_ENDPOINT
默认: HF_ENDPOINT=https://hf-mirror.com (国内源)
如果失败, 改 HF_ENDPOINT=https://huggingface.co

### Q: 重新部署 (改了 .env 后)?
A: bash /mnt/c/workSpace/navia/bilibili_learning/deploy_bilinote.sh
会自动重新 build + up

### Q: 关掉 BiliNote?
A: cd /mnt/c/workSpace/navia/bilinote && docker compose down
要重启: docker compose up -d

### Q: 完全清理 (删除容器 + 镜像)?
A: docker compose down --rmi all --volumes
⚠️ 这会删 SQLite 数据库, 之前配的 LLM provider 也丢

### Q: 我想换 Python 源码自己改 backend?
A: 代码在 ./backend/, 改了后:
  docker compose restart backend  (FastAPI 会 reload, 如果开了 debug)
  或 docker compose up -d --build backend

### Q: minimax 401 错误?
A: key 失效, 去 platform.minimaxi.com 重新签发

### Q: deepseek 429 (rate limit)?
A: 降并发, 或买更高 tier

================================================================
现在你可以自己开 http://localhost:3015 玩 BiliNote 了
================================================================