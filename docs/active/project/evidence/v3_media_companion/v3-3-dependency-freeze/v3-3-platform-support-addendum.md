# V3-3 OCR 平台支持与轮子冻结补充

日期：2026-10-08。目标：关闭外部审计 Minor m-1，不扩大 V3-3 产品实现状态。

## 1. 支持矩阵

| 平台 | V3 地位 | Python | 说明 |
|---|---|---|---|
| Windows 11 x86_64 | 目标“Navia 本机伴侣”平台 | CPython 3.12 | wheel hash 已冻结；真实安装/推理仍必须在 V3-3 实施 run 执行 |
| Linux x86_64 / WSL2 | 开发与自动验收平台 | CPython 3.12 | 已完成真实离线 OCR probe |
| macOS x86_64/arm64 | V3 不承诺 | - | 不得用 Linux/Windows PASS 宣称 macOS ready；后续需独立 wheel/资源/E2E 门禁 |

## 2. 冻结 wheel

| package | platform tag | filename | SHA-256 |
|---|---|---|---|
| rapidocr 3.9.2 | universal Python | `rapidocr-3.9.2-py3-none-any.whl` | `04d6b8d151f823d930bd91910555f57bea897c0c44fa6794267b94cf9c1ef9a0` |
| onnxruntime 1.28.0 | Linux x86_64 CPython 3.12 | `onnxruntime-1.28.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl` | `0a83bdb70d143cede762b677789bf2a7acca54b3fb82565601d5c30695aa933c` |
| opencv-python 5.0.0.93 | Linux x86_64 ABI3 | `opencv_python-5.0.0.93-cp37-abi3-manylinux_2_28_x86_64.whl` | `c8de2dec111122a02e8beb28e16c31904992dfd6186560b142a92c71403c1039` |
| onnxruntime 1.28.0 | Windows x86_64 CPython 3.12 | `onnxruntime-1.28.0-cp312-cp312-win_amd64.whl` | `c35064f9b3c43c81c5d5d282091401d0f1ff22796d93ccade4ea2ece5e137ab8` |
| opencv-python 5.0.0.93 | Windows x86_64 ABI3 | `opencv_python-5.0.0.93-cp37-abi3-win_amd64.whl` | `f90ba04b8f73bc5c3814037699739f0156f597338a98f05956c684e7c3ca10d2` |

下载来源固定为 PyPI 官方 project release files；实施器必须先验证 wheel hash，再安装和运行 self-test。当前不将 wheel 或三份第三方 ONNX 权重提交到 Git；权威性由固定官方 wheel hash + wheel 内单资产 bytes/SHA-256 + 安装后 self-test 三层校验提供。

## 3. 决定

- 外审 m-1（只有 Linux wheel）在文档和依赖供应链层面关闭；Windows 真实运行仍是 V3-3 实施验收项，不提前报 PASS。
- 外审 m-2（ONNX 二进制未进包）接受为有意的供应链边界，不通过提交 31 MiB 第三方权重消除；下一独立审查需从固定 wheel 自行解包复算三份资产。
