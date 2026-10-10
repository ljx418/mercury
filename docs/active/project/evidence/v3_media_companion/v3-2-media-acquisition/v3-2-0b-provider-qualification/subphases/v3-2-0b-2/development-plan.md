# V3-2-0b-2 Catalog / Manager / Installer 接入计划

日期：2026-09-22  
状态：`AUTHORIZED / PREIMPLEMENTATION AUDIT REQUIRED`

## 目标

把 `funasr-paraformer-q8` 作为 closed catalog 中可安装但尚不可选择的资格候选接入 `AsrModelManager`。安装完成只表示资产 ready，不表示质量通过；Tiny 始终是 effective fallback。

## 实施

1. 扩展 catalog 的可选 `runtimeKind/capabilities/quality.gateVersion/qualificationRunId` 与安装空间披露，不破坏旧字段。
2. 将 Paraformer 条目冻结到 0b-0 的平台 runtime、Q8、VAD bytes/hash/license；Linux/Windows 按当前 Runtime 平台选唯一 archive。
3. 扩展 `AsrModelFile` 为 source asset → installed file 映射；归档必须先验自身 hash，再只提取冻结成员并复算成员 bytes/hash。
4. installer 使用 `source/` 和 `install/` 隔离，self-test 只读 `install/`；原子发布后删除 source/staging。
5. 默认 self-test 对 FunASR 生成受控 16 kHz mono PCM WAV，通过 0b-1 adapter 真实 load/run/cleanup。
6. 保持 pending 候选 `installable=true/selectable=false`；PATCH selection 必须返回 `V3_ASR_MODEL_NOT_QUALIFIED`。
7. 更新 Schema、positive fixture 与前端类型兼容字段；本阶段不改设置页布局。

## 出门状态

安装成功：`installation.state=ready`、`quality.status=qualification_pending`、requested/effective 仍为 Tiny。只有 0b-7 后 stage-gate owner 才能把质量改为 production_qualified 并开放选择。

## 停止条件

归档 hash/成员 hash 漂移；nested archive 可路径逃逸；发布目录出现非冻结文件；self-test 使用网络/remote code；pending 被选择为 effective；Tiny 不可恢复；或旧 Small/Tiny 安装回归失败。
