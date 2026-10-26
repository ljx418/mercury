# ClaudeCode 交接检查表

- [ ] 确认工作目录为 `/mnt/c/workSpace/navia`。
- [ ] 记录基线 `a303551a5bf89c26ff36b24ac06c7e30c334db27` 和既有脏工作树；禁止 reset/checkout/clean。
- [ ] 确认没有遗留 B-5-3 runner、sequencer、隔离 Runtime 或对应 Chrome。
- [ ] 阅读 `01-current-state.md`，不得把 V3 或 Stage B 误报为完成。
- [ ] 不使用被中断的 `stage-b-b5-3-recovery-20261014T132500Z` 作为验收输入。
- [ ] Phase 0 先审计/测试 runner，再创建新的六视频 run。
- [ ] 所有 Chrome 参数包含 `--mute-audio`。
- [ ] 每个子阶段单独落盘计划、验收、实施前审计、结果和 PRD 检视。
- [ ] 每个实现阶段由 `navia-审查` 独立出门复核。
- [ ] 最终 V3 收口包含 drawio 同步、HTML 验收报告、人工最小路径、Git 提交和项目进度同步。
- [ ] 最终 V3 同时复核媒体 H01..H10、12 页单 run、CX-H01..CX-H06 与 Chat/Know；V4/V5+ 延期项不混入 PASS。
