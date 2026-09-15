================================================================
BiliNote 部署方案 - 决策包
================================================================

【现实约束】(实测发现, 非猜测)
  1. WSL 里 docker 命令没装 (Windows 有 Docker Desktop 但 WSL 集成未开)
  2. 你的 WSL 命令环境对 curl/wget 网络探测有 deny 倾向
  3. C 盘已用 ~34GB, BiliNote Docker 镜像 + Whisper 模型再吃 5-10GB 是常态
  4. 你没有真 GPU (WSLg 软件渲染), Whisper 只能跑 tiny/base

【BiliNote 三种部署路径】

  路径 1: Docker Desktop for Windows (你 Desktop 上有这个图标)
    适合: 你愿意花 10-30 分钟搞定环境
    步骤:
      a. 双击 Desktop 上的 Docker Desktop.lnk 启动
      b. Docker Desktop → Settings → Resources → WSL Integration → 开 Ubuntu-24.04
      c. 重启 WSL 终端 (wsl --shutdown, 再开)
      d. 在我们这个目录跑:
           docker compose -f docker-compose.bilinote.yml up -d
      e. 浏览器开 http://localhost:3001 (BiliNote Web)
    优点: 一键, 跟 BiliNote 官方文档完全一致
    缺点: 镜像下载可能需要国内镜像加速

  路径 2: Windows 原生部署 (跳过 docker, 直接装 Python + Node)
    适合: 你不想开 Docker Desktop, 想看源码/改源码
    步骤:
      a. 装 Python 3.11+ (Windows 版, 已有)
      b. 装 Node 18+ (Windows 版, 你之前装过类似工具应该有)
      c. git clone https://github.com/JefferyHcool/BiliNote.git
      d. cd BiliNote/BiliNote_backend → pip install -r requirements.txt
      e. cd BiliNote/BiliNote_frontend → npm install && npm run build
      f. 双起 backend (uvicorn) + frontend (vite preview)
    优点: 没有 docker 依赖, 启动快, 源码可改
    缺点: 手动步骤多, 跨 Windows 路径 + 中文容易踩坑

  路径 3: 用我们现有 WSL Python 直接 pip install (轻量降级)
    适合: 你只想跑通核心功能, 不在乎 Web UI
    步骤:
      a. pip install fastapi uvicorn faster-whisper openai
      b. 我帮你写一个 100 行的简化版 BiliNote (只保留 B站字幕+总结)
      c. 不做 Web UI, 用 CLI: python3 bilinote_lite.py BVxxx
      d. 输出 .md 文件, 包含大纲+时间戳+截图+思维导图
    优点: 不依赖 docker/node, 跟现有 chrome_launcher/cookie_exporter 复用 cookies
    缺点: 没有 GUI, 不能浏览器里操作

【我需要你拍板的事】

  Q1: 走路径 1/2/3?
      1 = Docker Desktop (推荐, 但要开 Docker)
      2 = Windows 原生 (源码可改, 步骤多)
      3 = 我写简化版 CLI (最轻量)

  Q2: 即使装了 BiliNote, 自研脚本怎么处理?
      a. 全保留 (BiliNote 跑一遍看产出, 自研留着对比学习)
      b. 删 chrome_launcher/cookie_exporter (BiliNote 自带 cookie 同步)
         保留 bilibili_downloader (它更稳, BiliNote 用 yt-dlp 可能被风控)
      c. 删全部自研脚本 (BiliNote 全包了)

  Q3: 那两段视频 (BV1DP8j6zEBo / BV1kE8j6FEe5) 怎么处理?
      A. 你手动打开浏览器, 复制粘贴两段视频的标题+分P列表+简介给我
         (网络方案 B, 不让我爬 B 站)
      B. 我再试 web_extract/yt-dlp (可能再超时, 但你能省事)
      C. 跳过这两段, 随便找个公开 B站视频先跑通流程

================================================================
我的建议 (你不一定要听)
================================================================

  Q1 = 路径 3 (最稳, 不依赖 docker, 复用现有环境, 30 分钟跑通)
  Q2 = a (全保留, 知识资产最大化)
  Q3 = A (你贴分P列表, 我做最关键的事, 不浪费 token 在 B 站反爬上)

但你拍板, 我只是把选项摆出来.
================================================================
