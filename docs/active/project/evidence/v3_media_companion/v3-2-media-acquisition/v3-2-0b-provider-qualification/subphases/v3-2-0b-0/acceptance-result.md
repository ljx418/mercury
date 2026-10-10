# V3-2-0b-0 供应链冻结验收结果

日期：2026-09-22  
runId：`v3-2-0b-0-20260922T042400Z`

## 结论

```text
B00-01..B00-12: 12/12 PASS
Fatal=0 / Major=0 / Minor=0
V3-2-0b-0: PASS
```

## 真实资产结果

| 资产 | bytes | SHA-256 | 最终分发 host |
|---|---:|---|---|
| Linux runtime | 8,014,474 | `779967de1c528c2be966bcc47f246e7d3e6fcdb748d9491263062f4120f35e52` | `release-assets.githubusercontent.com` |
| Windows runtime | 4,967,457 | `f6a73a548413ba9fbaf2145263ea66ec53cbdad1fb11790dbeeee493e339492e` | `release-assets.githubusercontent.com` |
| Paraformer Q8 | 236,929,024 | `42bf76ea1575a336aaca4c1b7c01a82b79113e6d04d0d6b799561bfcf07ee011` | `us.aws.cdn.hf.co` |
| FSMN-VAD | 1,720,512 | `1270f2559c495f4e7b6e739541151027d360761a3fda43fc147034f5719f5479` | `us.aws.cdn.hf.co` |

两个 runtime 归档共 17 个成员，危险路径/设备/FIFO/越界链接为 0。许可复核：FunASR runtime=MIT，Paraformer Q8/FSMN-VAD=Apache-2.0，固定 revision 全部匹配。

## 证据

- `runs/v3-2-0b-0-20260922T042400Z/asset-verification.json`
- `runs/v3-2-0b-0-20260922T042400Z/archive-inventory.json`
- `runs/v3-2-0b-0-20260922T042400Z/license-verification.json`
- `runs/v3-2-0b-0-20260922T042400Z/dependency-manifest.json`
- `runs/v3-2-0b-0-20260922T042400Z/secret-scan.json`
- `runs/v3-2-0b-0-20260922T042400Z/acceptance-result.json`

二进制仅位于 gitignored `.tmp`，没有复制到 evidence 或审计包。
