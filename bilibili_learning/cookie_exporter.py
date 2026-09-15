"""
B 站 cookies 导出 - 通过 CDP 连接到用户已登录的 Chrome, 导出 cookies 到 JSON

用法:
  python3 cookie_exporter.py

前提:
  - chrome_launcher.py 已经启动过 Chrome, 且用户已经登录 B 站
  - CDP 端口 9222 可达

输出:
  cookies/bilibili_cookies_<时间戳>.json
  也打印必要字段 (SESSDATA, bili_jct, buvid3) 是否齐全
"""
import json
import time
import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, Error as PlaywrightError

CDP_URL = "http://localhost:9222"
# 始终跟脚本同目录, 避免在不同 cwd 跑时找不到 cookies
SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = SCRIPT_DIR / "cookies"
OUTPUT_DIR.mkdir(exist_ok=True)

# B 站关键 cookies (用于下载接口鉴权)
REQUIRED_COOKIES = {
    "SESSDATA": "登录态核心, 失效就掉登录",
    "bili_jct": "CSRF token, 写操作需要",
    "buvid3": "设备指纹, 反爬基础",
    "DedeUserID": "用户 UID",
    "sid": "会话 ID",
}

def main():
    print("=" * 60)
    print("B 站 cookies 导出")
    print("=" * 60)

    try:
        with sync_playwright() as p:
            print(f"[*] 连接 CDP: {CDP_URL}")
            browser = p.chromium.connect_over_cdp(CDP_URL)
            print(f"[+] CDP 连接成功")

            # 拿第一个 context (Chrome 默认一个)
            if not browser.contexts:
                print("[X] Chrome 没有 context, 请确认 Chrome 窗口开着")
                return

            ctx = browser.contexts[0]

            # 拿 cookies
            print("[*] 读取 cookies ...")
            all_cookies = ctx.cookies()
            print(f"[+] 总共 {len(all_cookies)} 个 cookies")

            # 筛 B 站相关
            bilibili_cookies = []
            for c in all_cookies:
                domain = c.get("domain", "")
                if "bilibili.com" in domain:
                    bilibili_cookies.append(c)

            print(f"[+] B 站相关 cookies: {len(bilibili_cookies)} 个")

            if not bilibili_cookies:
                print()
                print("[!] 没找到 bilibili.com cookies. 可能原因:")
                print("    1. Chrome 窗口还没打开 bilibili.com (用 chrome_launcher.py 启动会自动开)")
                print("    2. 用户还没登录 (登录后 bilibili.com 会写 SESSDATA)")
                print("    3. 你用了其他 Chrome 窗口, 不是 chrome_launcher.py 启的那个")
                print()
                print("[*] 所有 cookies 的 domain 列表 (供排查):")
                for c in all_cookies:
                    print(f"    - {c.get('domain', '?')}")
                return

            # 检查关键字段
            print()
            print("[*] 检查关键字段:")
            existing = {c["name"]: c["value"] for c in bilibili_cookies}
            missing = []
            for key, desc in REQUIRED_COOKIES.items():
                if key in existing:
                    val = existing[key]
                    # 脱敏显示
                    if len(val) > 12:
                        masked = val[:6] + "..." + val[-4:]
                    else:
                        masked = val
                    print(f"    [OK] {key:14s} = {masked}  ({desc})")
                else:
                    print(f"    [缺] {key:14s}  ({desc})")
                    missing.append(key)

            if missing:
                print()
                if "SESSDATA" in missing or "bili_jct" in missing:
                    print(f"[!] 关键字段缺失: {missing}")
                    print("[!] 大概率你还没在 Chrome 窗口里登录 B 站")
                    print("[!] 请回到 Chrome 窗口, 完成登录后再跑这个脚本")
                    return
                else:
                    print(f"[*] 缺 {missing}, 但有 SESSDATA, 下载应该能用")

            # 保存
            ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            out_path = OUTPUT_DIR / f"bilibili_cookies_{ts}.json"
            out_path.write_text(
                json.dumps(bilibili_cookies, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )

            # 另存一个 latest 副本, 给下载脚本用
            latest_path = OUTPUT_DIR / "bilibili_cookies_latest.json"
            latest_path.write_text(
                json.dumps(bilibili_cookies, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )

            print()
            print(f"[+] Cookies 已保存:")
            print(f"    时间戳版: {out_path.absolute()}")
            print(f"    最新版:   {latest_path.absolute()}")
            print()
            print("[*] 下一步: 用 bilibili_downloader.py 下载视频")

    except PlaywrightError as e:
        print(f"[X] Playwright 错误: {e}")
        print()
        print("可能原因:")
        print("  1. Chrome 没启, 或 CDP 端口不是 9222")
        print("     → 重新跑 chrome_launcher.py")
        print("  2. user-data-dir 冲突 (有人用了相同的目录)")
        print("     → 杀掉所有 chrome.exe 再重试")
        print()
        print("Windows 排查命令 (另开 PowerShell 跑):")
        print("  Get-Process chrome | Where-Object { $_.CommandLine -like '*9222*' }")
    except Exception as e:
        print(f"[X] 未知错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
