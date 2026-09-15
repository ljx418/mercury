================================================================
BiliNote LLM 配置指南 (minimax / deepseek)
================================================================

⚠️ 重要：BiliNote 的 LLM API key 不写进 .env 文件
   而是通过 Web UI 在「模型供应商」页录入，保存在 SQLite

────────────────────────────────────────────────────────────────
Step 1: 浏览器打开 BiliNote
────────────────────────────────────────────────────────────────

  http://localhost:3015

  (端口是 .env 里的 APP_PORT, 默认 3015)

────────────────────────────────────────────────────────────────
Step 2: 进入"模型供应商"页 → 添加 Provider
────────────────────────────────────────────────────────────────

  在 BiliNote 设置/Setting 页面里有:
  - 模型供应商 (Provider)
  - 模型列表 (Model)

  点击"添加"或"+", 填以下字段 (按你选哪个 provider 走对应路径)

────────────────────────────────────────────────────────────────
路径 A: 用 minimax (你的主用)
────────────────────────────────────────────────────────────────

  Provider 名称: minimax (任意, 自己记住)
  Provider 类型: OpenAI (兼容协议, 选这个!)

  Base URL:    https://api.minimaxi.chat/v1
              (注意: minimaxi.com 不是 minimax.com)
              (如果你 .env 里写的是 api.minimaxi.com 也行, 那个是香港节点)

  API Key:    你 secrets/.env 里的 MINIMAX_API_KEY (整串复制)

  模型 ID:    MiniMax-M3 (跟 .env 里一致)

  测试连接: 应该返回 ✓ 成功

────────────────────────────────────────────────────────────────
路径 B: 用 deepseek (中文强, 推荐)
────────────────────────────────────────────────────────────────

  Provider 名称: deepseek
  Provider 类型: OpenAI (兼容协议)

  Base URL:    https://api.deepseek.com/v1

  API Key:    你 secrets/.env 里的 DEEPSEEK_API_KEY

  模型 ID:    deepseek-chat

  测试连接: 应该返回 ✓ 成功

────────────────────────────────────────────────────────────────
Step 3: 配置转写器 (音频转文字)
────────────────────────────────────────────────────────────────

  BiliNote 默认用 fast-whisper (本地, 跑 tiny 模型 ~75MB)
  首次启动会自动下载模型到 ~/.cache/huggingface/

  如果你想用在线转写 (免下载, 但要 API):
  - Groq (免费额度, 快): 转写器选 "groq", 需 Groq API key
  - 必剪: 转写器选 "bcut", 国内可用

  没 GPU 的 WSL 建议先用 fast-whisper tiny/base

────────────────────────────────────────────────────────────────
Step 4: 配置 B 站 cookie (可选, 但推荐)
────────────────────────────────────────────────────────────────

  如果你要处理登录态视频 (大会员/付费/1080P+), 需要传 B 站 cookies

  你 bilibili_learning 已经有 cookie_exporter.py 生成 cookies/bilibili_cookies_latest.json

  把里面 SESSDATA / bili_jct / buvid3 的值, 在 BiliNote 的
  "平台 cookie 配置" 里填 (B 站部分)

────────────────────────────────────────────────────────────────
Step 5: 测试一个视频
────────────────────────────────────────────────────────────────

  复制这个 URL 到 BiliNote 输入框:
    https://www.bilibili.com/video/BV1xx411c7mD
    (公开视频, 不用登录, 用 BiliNote 默认设置就能跑)

  或你自己的公开视频

  流程:
    输入 URL → 选 Provider → 选 Model → 提交 → 等 1-3 分钟 → 看输出

  产出:
    - Markdown 笔记
    - 思维导图 (markmap)
    - 自动截图 (每个章节 1-3 张)
    - 时间戳跳转链接

────────────────────────────────────────────────────────────────
故障排查
────────────────────────────────────────────────────────────────

Q: 浏览器打不开 localhost:3015 ?
A: docker compose ps 看 3 容器都 running 吗
   docker compose logs nginx 看 nginx 日志

Q: 后端 API 报错 502 ?
A: backend 容器没起来或健康检查失败
   docker compose logs backend

Q: 转写器报"模型下载失败"?
A: docker exec -it bilinote-backend bash
   # 在容器里 export HF_ENDPOINT=https://hf-mirror.com 重启 backend
   # 或者挂代理 (见 .env.example)

Q: LLM API key 报错 401 ?
A: Base URL 不对 / Key 失效 / Model name 不对
   先在 BiliNote 的 Provider 测试连接按钮验证

================================================================