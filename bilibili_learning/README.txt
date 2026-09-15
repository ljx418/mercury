================================================================
B 站视频学习助手 - 完整流程
================================================================

【零、事前准备】(一次性)

  1. 安装 WSL Python 依赖 (在 WSL 终端跑一次):
       pip install requests playwright
       python3 -m playwright install chromium

  2. 安装 ffmpeg (WSL):
       sudo apt install ffmpeg

  3. (推荐) 安装 D:\0-日本之行\_tools\vision\ 工具链:
       完整 cv2 + rapidocr + PyAV (OCR 中文/英文/日文)
       详见 skill: video-vision-local
       没装也能跑, 但 OCR 部分会退化

  4. 在 Desktop 新建工作目录 (Windows):
       D:\0-B站视频学习\

【一、登录 B 站 - 拿 cookies】

  终端 1 (WSL):
    cd /mnt/c/Users/Administrator/Desktop/bilibili_learning
    python3 chrome_launcher.py
    # 弹出 Chrome 窗口, 自动开 bilibili.com

  手动:
    1. Chrome 窗口里扫码/账号密码登录 B 站
    2. 登录成功 (看到自己头像) 后关掉这个终端的脚本 (Ctrl+C)
    3. Chrome 窗口**保持开着**

  终端 2 (WSL):
    cd /mnt/c/Users/Administrator/Desktop/bilibili_learning
    python3 cookie_exporter.py
    # 输出: cookies/bilibili_cookies_latest.json
    # 应该看到: SESSDATA, bili_jct, buvid3 三个字段都 [OK]

【二、下载视频】

  准备: 把要学的视频 BV 号写到文件 (一行一个):
    bv_list.txt:
      # 我想学的 B 站视频
      BV1xx411c7mD
      BV2yy411c7nE

  WSL 跑:
    cd /mnt/c/Users/Administrator/Desktop/bilibili_learning
    python3 bilibili_downloader.py \
        --from-file bv_list.txt \
        --output-dir /mnt/d/0-B站视频学习

  输出:
    /mnt/d/0-B站视频学习/
      <标题>_BV1xx411c7mD/
        metadata.json     # 标题/UP主/时长/简介
        <标题>.mp4        # 合并后的最终视频
        video.m4s         # (中间文件, 合并后会删)
        audio.m4s         # (中间文件, 合并后会删)

【三、分析视频 (事实层 - 镜头/关键帧/OCR)】

  WSL 跑:
    cd /mnt/c/Users/Administrator/Desktop/bilibili_learning
    python3 video_analyzer.py \
        "/mnt/d/0-B站视频学习/<标题>_BV1xx411c7mD/<标题>.mp4"
    # 或批量:
    python3 video_analyzer.py "/mnt/d/0-B站视频学习/"

  输出:
    <视频目录>/_analysis/
      analysis.json        # 完整数据 (镜头/关键帧/OCR)
      shots_timeline.txt   # 人读时间线
      keyframes/           # JPG 关键帧
        f001.jpg
        f015.jpg
        ...

【四、视觉理解 (语义层 - 仍需手动触发)】

  ⚠️ 这一步会调 vision_analyze (LLM 视觉), 历史幻觉率较高

  建议从 analysis.json 里挑 5-8 个代表性关键帧:
    - f001.jpg (开场)
    - 镜头切点附近的帧 (中段)
    - 最后一张 (结尾)
    - OCR 文本最多的帧 (说明有标题/重点)

  手动流程 (你现在看到的对话):
    1. 把 5-8 张 JPG 路径发给我
    2. 我用 vision_analyze 看, 给你:
       - 每帧描述 (场景/物品/光线/叙事位置)
       - 综合视频结构 (大纲)
    3. 你核对 - 幻觉的地方告诉我

【五、产出最终产物】

  确认分析无误后, 我会生成:
    1. 大纲.md          - 文字版结构
    2. 时间戳索引.json  - 每个知识点对应视频时间
    3. 关键帧拼图.jpg   - 5-8 张关键帧横向拼起来
    4. 思维导图.mmd     - Mermaid 源码 (可粘到任何 mermaid 渲染器)
    5. 单文件 HTML       - 一键跳转 B 站原视频时间戳

【六、批量扩展】

  上面 1-5 跑通一个视频后, 你给我更多 BV 号就能批量复制流程.

================================================================
常见问题
================================================================

Q: cookies 失效怎么办?
A: 重新跑 step 1 (chrome_launcher + cookie_exporter)

Q: 下载 403/412 错误?
A: 大概率 IP 被风控了, 等几小时或换网络 (开手机热点试)

Q: vision_analyze 把视频看错了?
A: 这是已知的幻觉问题. 用 OCR 文字 + 镜头切点做交叉验证.
   实在不行发视频 URL, 我让你手动复制 B 站官方字幕

Q: 进度卡在哪一步?
A: 跟我说"我跑完 step X 了" / "我跑完 step Y 出错了, 错误信息是..." 
   我会基于你反馈推进, 不替你跑 wsl 命令

================================================================
文件清单
================================================================

  chrome_launcher.py     # 启动 Chrome + CDP
  cookie_exporter.py     # 导 cookies
  bilibili_downloader.py # 下载视频
  video_analyzer.py      # 镜头/关键帧/OCR
  bv_list.txt            # (你手动建) BV 号列表
  cookies/               # 自动生成
    bilibili_cookies_latest.json
  README.txt             # 本文件

================================================================
