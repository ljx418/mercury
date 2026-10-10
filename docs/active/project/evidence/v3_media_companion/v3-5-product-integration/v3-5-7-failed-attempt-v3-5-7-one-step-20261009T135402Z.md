# V3-5-7 失败尝试记录

run：v3-5-7-one-step-20261009T135402Z。状态：INVALID / DO NOT REUSE。

- 产品 build、真实 B站页和 Runtime 均已启动；Runtime 观察到当前视频 sourceIdentity 查询。
- runner 在等待 media-companion-launch 时失败。根因是受限 E2E DOM 白名单尚未包含新 test id，bridge 按设计拒绝读取并由驱动折算为 count=0。
- 该失败不证明产品流程通过，也不作为产品失败归因；本 run 不封存、不拼接、不复用截图或结果。
- 修复：只补充四个统一启动流程 test id 到既有 E2E allowlist，重新 build 并创建全新 profile/run。

