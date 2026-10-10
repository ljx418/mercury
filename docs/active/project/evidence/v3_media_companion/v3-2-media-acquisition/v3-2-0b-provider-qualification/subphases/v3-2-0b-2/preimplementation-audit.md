# V3-2-0b-2 实施前审计

日期：2026-09-22

## 结论

```text
V3-2-0b-2: GO
Fatal=0 / Major=0 / Minor=1
```

## 门禁

- 0b-0 供应链 12/12、0b-1 Provider 16/16 已通过。
- Linux executable 成员：bytes=`2424840`，SHA-256=`aec677df...7c0c2`。
- Windows executable 成员：bytes=`1510400`，SHA-256=`5448c33f...bf0fc`。
- 采用 source/install 双目录与单成员提取；不直接解压整个上游 archive。
- Paraformer 安装与选择明确分离，pending 不可 effective。

## Minor

M-1：当前 Linux 宿主只能真实执行 Linux self-test；Windows 路径以真实 archive/member hash + unit contract 覆盖，不能声明 Windows 运行通过。

M-1 已进入 B02-06 与防假绿边界。无 Fatal/Major，可实施。
