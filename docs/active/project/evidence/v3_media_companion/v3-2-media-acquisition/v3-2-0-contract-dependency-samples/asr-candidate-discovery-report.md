# V3-2-0 ASR 候选真实发现报告

日期：2026-09-18。证据级别：`PRIVATE REAL-DATA DISCOVERY`。本报告只证明候选可供 revision 2 人工 gold 审查，不证明 V3-2 ASR 质量门禁通过。

## 1. 发现结论

授权 Cookie 主路径使 revision 1 的三个 ASR 样本暴露 2/4/7 个字幕项，因此旧分母失效。后续 discovery 使用全新临时 Chrome profile、用户授权 B站 Cookie、冻结版 yt-dlp、系统 ffmpeg 和离线 `faster-whisper-small`，得到 3 个中文主候选和 2 个备选。

| 角色 | BVID / 目标分 P | 授权态字幕 | 目标时长 | ASR 语言 | 150s 段数 / 语音秒 / 字符 | 结论 |
|---|---|---:|---:|---|---|---|
| 主 1 | `BV1sMNtzJE5B` P1 / `30592600559` | 0 | 5989s | zh 0.984769 | 67 / 149.36 / 797 | 合格 |
| 主 2 | `BV1xz4y1S7yF` P1 / `286754257` | 0 | 251s | zh 0.990825 | 54 / 142.86 / 673 | 合格 |
| 主 3 | `BV1Bb411w741` P1 / `61744125` | 0 | 258s | zh 0.985244 | 69 / 144.63 / 574 | 合格 |
| 备选 1 | `BV13741117Nz` P1 / `175202227` | 0 | 436s | zh 0.998908 | 37 / 106.38 / 352 | 合格，不计正式分母 |
| 备选 2 | `BV1mx411x7pm` P1 / `23161171` | 0 | 267s | en 0.983988 | 50 / 149.98 / 2815 | 合格，仅下载/多语言回归 |

所有音频窗口为媒体 `30s..180s`。正式 gold 窗口固定为其中的 `30s..150s`，恰好 120 秒；当前尚未人工双审。

## 2. 页面证据绑定

| BVID | page run | raw SHA-256 | observation SHA-256 | screenshot SHA-256 |
|---|---|---|---|---|
| `BV1sMNtzJE5B` | `v3-2-asr-web-discovery-20260918T125759Z` | `c1e860cb8ea94c41c8a882695b676661f05dd22ec026c1742a4ac873583b8675` | `37f91bdeadaf0d923efd0e08b77655f8779c58021593b5390d64796f73154571` | `ede905eb1b0ca5dd2307a2dd9d9c0f232005c9ad131f33052fccdb145e8e5cf5` |
| `BV1xz4y1S7yF` | `v3-2-asr-explicit-no-subtitle-discovery-20260918T200100Z` | `09b9b8e03313c48404976a56a31a32bc092d06c94584940f067e1cb587480775` | `7c5898350259d51cb8b577f8e346faf2277f954aff0681065000d3ae4b49a38b` | `9d069bae076b26f192c2e0e03733607210d5862ee920c249afb7fd3e9364d777` |
| `BV1Bb411w741` | `v3-2-asr-chinese-collection-discovery-20260918T211000Z` | `7a99ca369f1d59ad7cf925e1f1ad89242236d19b3014a3f32447e33b47949146` | `ae15ebc52d939cabcb48b8ceeeca625be3bfa7a4e9c204e3205558a312c549f6` | `8c698f6f2f096df1676c58dad33a508c1993e3a35fc9c5e7777e946415fb4d70` |
| `BV13741117Nz` | 同上 | 同上 | `d056d7585b51395713e38782c2e654f3e49b87f6b7ad3c2128b02485b1dd4db6` | `6a4474d3ae3eeeb95de067d1edd170b2b0aa6a8510cdec32bc7796dbdeea7ff7` |
| `BV1mx411x7pm` | `v3-2-asr-explicit-no-subtitle-discovery-20260918T200100Z` | `09b9b8e03313c48404976a56a31a32bc092d06c94584940f067e1cb587480775` | `6e7279441c046bc8aecd31ae3d619694d2eabff9c193a402c7181b750c267b51` | `05bff7433725a2cb18d52942cc6037994d426ed856e928338d724979e8f3dbfe` |

## 3. 音频与 ASR 证据绑定

| BVID | result SHA-256 | source SHA-256 | 150s segment SHA-256 | transcript SHA-256 |
|---|---|---|---|---|
| `BV1sMNtzJE5B` | `1ad9a719cc003039e994b63b63abb22ad720f807b57956d45185769085a94722` | `48f273518ce52752412e593272d044d0d02e354d85d5e8ec8559828b42709e77` | `8f5b6f0186c64d67951f9ea8a696b1e343c243edd77b6058b23447b6282f37cc` | `00191b804016c97a1bc042d9d86c5652dc918b4c655a2a25cf9d2345505c0204` |
| `BV1xz4y1S7yF` | 同上 | `4bf23ef39a7762a90eb3c05c63a260ff31e3ac1408311d105f4c71fd875749da` | `cb136c128ccb65e358998a66d61ef9f6f4f8835f82933a340c7943639bbdbe82` | `c643aa50175943ce6af3ebf0e85c5daaab65d683dc7293a2cda738682cef0042` |
| `BV1Bb411w741` | `a64facd5f34bb882f5a2709fce08493e2005ea6e3de32983ed28c442ed9d1044` | `866a1f23642e97b35fb9830e558fd7c356493cf34452d3dfdb2dc6dab150e276` | `f829f2e3027ea98f15be9e92b9301274df8db68724a6d4ba35444a0a7baa9b23` | `09c17733ac061c8f4bda1a2f375f5759d56e4485cb88c317a533fcdc4f665d67` |
| `BV13741117Nz` | `877bbefd6bd75ad5a6ef523a4f9ce30c89a9be997228ee03006590b62eaa1bbc` | `f0416bce6e160b3e85ab5d3eb89db43bbe6622c26b8761064649b874534d66a2` | `89a2f1e191bb0077a84bb20ecf9a443c28650c1f429608c9359fd1985a011bae` | `8c693403205041ec6dae13652f085a4d943a4e5cf7c557a2b728aa3d64bb8eaa` |
| `BV1mx411x7pm` | `1ad9a719cc003039e994b63b63abb22ad720f807b57956d45185769085a94722` | `74115ef25d193eb5bebc227b12b72ebc40aa59117c7220645139d157cc60c44f` | `cf7a77c175f3048dde84d86884432a8132138080d2bb04c232c9f5b7281c9a44` | `f357c9b7649a89bdca5851856b3c07d2c0eb53f200c6873bbad7ed7f35bd4990` |

## 4. 工具与隐私

- yt-dlp：`2026.08.19`，SHA-256 `1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6`。
- 探针：`apps/chrome-extension/e2e/v3-asr-candidate-audio-probe.py`，SHA-256 `23917e6893f6dade2d22b770c690b9b9008889f80919ad15007838f874837146`。
- 凭据仅写入 `0600` 临时 Netscape 文件；每个 run 终态 `cookieFileDeleted/sourceMediaDeleted/segmentAudioDeleted/privateWorkDeleted=true`。
- 音频探针 0 Cookie 原值命中；页面 run 的独立 secret scan 均为 0 hit；所有对应临时 Chrome profile 已删除，0 相关 Chrome 进程。
- 机器 transcript 未落盘，只保留长度、语言、时间统计和 SHA-256；它不是人工 gold。

## 5. 不可升级的结论

本报告不证明全长 ASR、CER、真实 tabCapture、产品 UI、清理五终态或 V3-2 PASS。三个主样本仍需两位独立人类对 `30s..150s` 进行逐字转写和 adjudication。
