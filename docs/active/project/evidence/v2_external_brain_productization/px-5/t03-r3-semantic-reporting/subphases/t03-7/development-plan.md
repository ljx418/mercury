# T03-7 父编排与出门候选开发计划

日期：2026-09-14。

1. 新增唯一入口 `run-v2-px-r3-validation.mjs`，必填 source run、空 output root、validation run ID。
2. 顺序调用 derive、validate、report、package；子进程使用绝对脚本路径和 extension cwd，InvocationRecord 只保留 portable path/token。
3. 捕获四步 stdout/stderr 为 validation-run artifact，并复制实际 implementation bytes；最后写 InvocationRecord。
4. 任一步非零立即停止；derive exit 2 原样返回且不得生成 validation/report/package/invocation PASS。
5. 成功候选仍是 Human Review pending、final=false；T03 出门后只允许进入 T04 规划与独立审计。

不启动 Chrome、不修改 sealed T02.5、不运行旧 report-shaped production generator/validator。
