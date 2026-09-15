"""
B 站登录辅助 - 启动 Chrome (WSL → Windows, 带 CDP, 自动开 bilibili.com)

用法:
  python3 chrome_launcher.py

做什么:
  1. 杀掉占用 9222 端口的旧 Chrome (避免冲突)
  2. 启动一个新 Chrome 窗口 (windowed, 非 headless), 开 bilibili.com
  3. 窗口会一直保持打开, 你手动扫码/账号密码登录
  4. 登录完成后关掉这个窗口即可

输出:
  控制台打印 CDP 端口 + 等待时间, 另一个脚本 (cookie_exporter.py) 会通过 CDP 拿 cookies

注意事项 (跟 chrome-login-and-cookie-export skill 保持一致):
  - 不使用 --headless=new (B 站风控会检测)
  - 使用独立 user-data-dir (避免跟你日常 Chrome 冲突)
  - 窗口保持打开, 别关 (关掉就掉登录态 + 掉 CDP 连接)
"""
import subprocess
import time
import os
import sys
from pathlib import Path

# 配置
CHROME_PATH = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
USER_DATA_DIR_WIN = "C:\\Windows\\Temp\\bilibili_login_profile"
CDP_PORT = 9222
TARGET_URL = "https://www.bilibili.com/"

# WSL → Windows 路径转换
def win_to_wsl(win_path: str) -> str:
    """C:\\foo\\bar → /mnt/c/foo/bar"""
    p = win_path.replace("\\", "/")
    if len(p) >= 2 and p[1] == ":":
        p = "/mnt/" + p[0].lower() + p[2:]
    return p

def kill_existing_chrome():
    """杀掉之前可能残留的 bilibili_login_profile Chrome, 避免 user-data-dir 冲突"""
    result = subprocess.run(
        ["powershell.exe", "-Command",
         f"Get-Process chrome -ErrorAction SilentlyContinue | "
         f"Where-Object {{ $_.CommandLine -like '*{USER_DATA_DIR_WIN}*' }} | "
         f"Stop-Process -Force"],
        capture_output=True, text=True, timeout=10
    )
    if result.stdout.strip():
        print(f"[*] 清理旧 Chrome: {result.stdout.strip()}")
    time.sleep(1)

def launch_chrome():
    """启动带 CDP 的窗口 Chrome"""
    cmd = [
        CHROME_PATH,
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={USER_DATA_DIR_WIN}",
        "--window-size=1280,900",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-blink-features=AutomationControlled",  # 减少自动化指纹
        TARGET_URL,
    ]

    print(f"[*] 启动 Chrome: {' '.join(cmd[:3])} ...")
    print(f"[*] 自动打开: {TARGET_URL}")

    # CREATE_NEW_PROCESS_GROUP 让窗口独立, 不跟随脚本退出
    proc = subprocess.Popen(
        cmd,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        # 不等子进程, 立刻返回
    )
    return proc

def wait_for_cdp():
    """等 CDP 端口就绪"""
    import socket
    print(f"[*] 等待 CDP 端口 {CDP_PORT} ...")
    for i in range(15):
        try:
            with socket.create_connection(("127.0.0.1", CDP_PORT), timeout=1) as s:
                print(f"[+] CDP 已就绪 (用了 {i+1} 秒)")
                return True
        except (ConnectionRefusedError, socket.timeout):
            time.sleep(1)
    print("[!] CDP 端口 15 秒内未就绪, 可能 Chrome 没启起来")
    return False

def main():
    print("=" * 60)
    print("B 站登录 - Chrome 启动器")
    print("=" * 60)

    # 1. 清理
    kill_existing_chrome()

    # 2. 启动
    proc = launch_chrome()

    # 3. 等 CDP
    if not wait_for_cdp():
        print("[X] CDP 启动失败, 请检查 Chrome 是否被拦截")
        sys.exit(1)

    # 4. 提示用户
    print()
    print("=" * 60)
    print("接下来你要做的事:")
    print("  1. 找刚才弹出的 Chrome 窗口 (会自动开 bilibili.com)")
    print("  2. 登录 B 站 (扫码或账号密码)")
    print("  3. 登录成功 (看到你头像) 后, 不要再动这个窗口")
    print("  4. 在另一个终端跑 cookie_exporter.py")
    print("=" * 60)
    print()
    print("[*] 这个脚本可以现在关掉 (窗口不会跟着关), 也可以留着监控.")
    print("[*] 按 Ctrl+C 退出此脚本 (Chrome 窗口会保持打开)")

    try:
        # 不阻塞 Chrome, 只挂起这个脚本
        while True:
            time.sleep(60)
            # 简单心跳, 告诉用户进程还在
            print(f"[{time.strftime('%H:%M:%S')}] 仍在等待... Chrome 窗口应该还开着")
    except KeyboardInterrupt:
        print()
        print("[*] 脚本退出 (Chrome 窗口保持打开, 你可以继续用)")

if __name__ == "__main__":
    main()
