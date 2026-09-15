"""
LLM 大纲生成验证 - 用模拟 OCR + 字幕文本, 测 generate_video_outline 端到端
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llm_client import generate_video_outline

# 模拟一段 5 分钟的 B 站教学视频 (Python 入门)
SIMULATED_METADATA = {
    "title": "Python 入门教程 - 30 分钟学会基础语法",
    "owner": "CodeMaster",
    "duration_sec": 1800,  # 30 分钟
    "desc": "本视频从零开始讲解 Python 基础语法, 包括变量、数据类型、控制流、函数、模块。适合编程初学者。",
    "bvid": "BV_TEST_SIMULATED",
}

SIMULATED_OCR = """
[0:15] Python 入门教程
[0:30] 讲师: CodeMaster
[0:45] 课程大纲:
[1:00] 1. 变量与数据类型
[1:15] 2. 运算符与控制流
[1:30] 3. 函数与模块
[1:45] 4. 文件操作
[2:00] 5. 综合练习

[2:30] # 变量定义
[2:45] name = "Python"
[3:00] age = 30
[3:15] print(f"{name} {age}")

[5:00] # 数据类型
[5:15] int, float, str, bool, list, dict, tuple, set

[10:00] # if/else 控制流
[10:15] if age >= 18:
[10:30]     print("成年")
[10:45] else:
[11:00]     print("未成年")

[15:00] # 函数定义
[15:15] def greet(name):
[15:30]     return f"Hello, {name}"
[15:45] print(greet("World"))

[20:00] # 模块导入
[20:15] import os
[20:30] import json

[25:00] # 文件读写
[25:15] with open("data.txt") as f:
[25:30]     content = f.read()
"""

SIMULATED_SUBTITLE = """
[0:15] 大家好, 欢迎来到 Python 入门教程
[0:30] 我是 CodeMaster, 今天我们要花 30 分钟学会 Python 基础
[0:45] 课程分成 5 个部分
[1:00] 第一部分, 变量与数据类型
[1:15] 第二部分, 运算符和控制流
[1:30] 第三部分, 函数
[1:45] 第四部分, 模块
[2:00] 第五部分, 综合练习

[2:30] 好, 我们开始第一部分
[2:45] 在 Python 里, 定义变量很简单
[3:00] 比如 name = "Python", age = 30
[3:15] 用 print 函数打印

[5:00] Python 主要有 8 种数据类型
[5:15] int 整数, float 浮点数, str 字符串
[5:30] bool 布尔值, list 列表, dict 字典
[5:45] tuple 元组, set 集合

[10:00] 然后是控制流
[10:15] if/else 语句, 根据条件执行不同分支
[10:45] elif 可以多个条件

[15:00] 函数是组织代码的基本单元
[15:15] def 关键字定义, return 返回值

[20:00] 模块让你复用代码
[20:15] import 关键字导入

[25:00] 最后是文件操作
[25:15] 用 with 语句安全打开文件
"""


def test_provider(provider: str):
    """ 跑一次 generate_video_outline """
    print(f"\n{'='*60}")
    print(f"测试 provider: {provider}")
    print(f"{'='*60}")

    try:
        result = generate_video_outline(
            ocr_text=SIMULATED_OCR,
            subtitle_text=SIMULATED_SUBTITLE,
            metadata=SIMULATED_METADATA,
        )

        print(f"\n[+] 调用成功, 收到结果")
        print(f"\n[*] 顶层 keys: {list(result.keys())}")

        # 验证必要字段
        for key in ["chapters", "mindmap_root", "overall_summary"]:
            if key in result:
                if key == "chapters":
                    chapters = result["chapters"]
                    print(f"\n[OK] chapters: {len(chapters)} 个章节")
                    for i, ch in enumerate(chapters):
                        print(f"  章节 {i+1}: {ch.get('title', '?')} [{ch.get('start_tc', 0)}-{ch.get('end_tc', 0)}s]")
                        print(f"    摘要: {ch.get('summary', '?')[:100]}")
                        print(f"    要点 ({len(ch.get('key_points', []))}个): {ch.get('key_points', [])[:3]}")
                else:
                    print(f"\n[OK] {key}: {result[key]}")
            else:
                print(f"\n[!] 缺字段: {key}")

        # 保存到文件供检查
        out_path = Path(f"/tmp/test_outline_{provider}.json")
        out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n[*] 完整输出: {out_path}")

        return result
    except Exception as e:
        print(f"\n[X] 失败: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    # 现在的 generate_video_outline 内部已经有 mmx→deepseek fallback
    # 跑一次端到端测试
    result = test_provider("auto_fallback")