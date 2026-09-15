# V2-RKM 用户场景与出门验收计划

修订：2026-09-10，纳入第二轮独立复审S-1..S-16及G-1..G-7。以下是未来验收要求，当前没有执行RKM产品测试，不存在真实服务PASS。S00/DOC-Closure为本轮文档验收；S01..14为未来真实功能验收。量化阈值冻结为目标，失败需修复，不得把结果反向调成门槛。

## 1. 真实语料、分母与质量

固定corpus至少24个唯一来源：12个真实网页、6份显式授权UTF-8 md/txt、6份真实用户笔记/markdown。记录sampleId与Runtime sourceId分别建映射，originRef、原始bytes/hash、采集时间及授权证明；查询/对话不能凑来源数量。至少3个workspace、3个明确开启记忆的真实审查对话及1个关闭对话，使用公共项目材料构造问题而非制造产品事实。

24来源至少20条完成真实ingest/build/trace；blocked/degraded单列且不能计真实生成成功；三种来源类型均至少1条完整通过。声明仅限支持的类型，不以PDF/音视频等替代。网页可使用实际采集且保留origin/time/hash的可复现snapshot；至少3条端到端保存必须经当前真实网页launcher，不能全部snapshot替代。

问答24题：12条有答案（至少6条需要两个source）、6条无证据、6条冲突/不确定性。gold在模型执行前绑定原始span与可接受主张，由未参与生成的审查者复核。检索命中率=找回必要gold source的有答案问题数/12，>=0.9；groundedClaimRate=被真实span支持的实质主张/全部实质主张，>=0.9；引用可解析率=可回读同source/revision/span的引用/全部引用，=1。无证据6/6拒答，冲突6/6呈现冲突而非虚构统一结论。fallback不能计真实生成成功；空主张/空引用分母为0不记1，记未通过。

新增必要结论完整性：每道有答案题的gold预先列出非空requiredClaims及每个claim的requiredSourceIds/原始span。只有回答明确表达全部requiredClaims且真实引用支持对应来源，才记该题answerComplete=true；完整回答率=count(answerComplete)/12>=0.9。六道固定跨来源题全部6/6必须完整，且回答/引用链实质使用gold要求的至少两个不同source，不以检索结果出现两个source或附上无关引用替代。负例：检索齐全但漏掉另一source关键结论、只贴第二条引用却不表达必要结论、同一来源别名冒充两个source，均不得过跨来源门槛。此为REQ05已有体验的可观测验收，不将新增指标写成已测通过。

维护至少20份摘要修订、20个组织建议（tag/virtual_folder/archive各至少3），至少10次实际应用及10次恢复。摘要主张支持率>=0.9；组织建议适用率=gold判定正确且scope合规建议/全部建议>=0.9；恢复成功率=恢复后状态与before一致且无覆盖新revision的案例/10=1。10个并发/冲突负例均应拒绝旧写入。归档不等于重复源删除，不用删除数量评价质量。

## 2. 场景步骤与硬门槛

所有场景产物包含runId/segmentId/scenarioId、实际操作事件、必要请求响应、前后状态、源码/工具hash、截图与metadata。下表每条步骤必须成为独立断言；注入故障必须标记faultMode，不冒充自然故障。

| 场景 / 需求 | 前置与用户步骤 | 预期及门槛 | 失败与证据 |
|---|---|---|---|
| S00 文档追踪 | 从PRD需求打开图纸实体 -> 开发任务 -> 验收用例 -> 门禁 | 全部RKM-REQ-01..14有唯一对应；八页不溢出；所有当前实体存在，新增明确未实现 | 悬空/冲突/缺步骤即文档失败；gap.md追踪表/readiness-audit静态检查 |
| S01 双容器认证 | 本地文件开启；宿主launcher打开侧栏 -> 输入token连接 -> 打开Workspace另行输入 -> 分别刷新/断开 | 令牌不跨容器、URL、消息/日志/存储；403显示认证而非offline；断开后正文缓存与在途结果不能回流；误token/重启换token均可恢复 | DOM动作、实际403/transport、截图；未输入直接注入token不计用户路径 |
| S02 保存与持久 | 真实网页保存一次 -> 查看同source -> 关闭页 -> 重启Runtime/DS -> 重新认证重开 | 24/20语料门槛，ID/hash/revision稳定；same key不增source；未知远程提交不自动换key重发 | 保存前后及重启HTTP、双服务ID映射；source消失或重复即失败 |
| S03 路由恢复 | 三入口各点击>=2次，view_source trace-ready>=3；五route逐个direct/reload/Back/reopen；新增三route同样覆盖 | 20个旧route恢复组合+12个新组合全过；ID保持，非法/无权>=2可恢复；重复入口聚焦同tab且零新增ingest | trusted动作、tabID、前后Runtime读取；缓存冒充重读失败 |
| S04 服务状态 | 断Runtime、断DS、错DS密钥、错能力版本、失败build后用户重试 | 五故障分别显示；offline权威null/unchecked/unknown；能力缺失不显示ready；fallbackMode明确 | 同截图时点响应或transport；mock与真实不可混用 |
| S05 带证据问答 | 按24题提问 -> 打开每条引用 -> 核对原始span -> 对比跨来源/冲突回答 | 上述检索/grounding/引用/拒答阈值；真实provider/model可核查 | gold先冻结、模型原始输出、检索/引用响应；非空refs不算语义通过 |
| S06 图谱来源 | 浏览三个workspace图谱 -> 选择节点/边 -> 打开支持来源 | 所有展示事实有服务side provenance；无来源边不能显示为事实；零跨workspace泄漏；超cap明确截断 | API图谱/Trace/截图；前端造边、静默truncate失败 |
| S07 引用失效 | 原网页变化/不可访问 -> 引用回跳；本地原文件修改 -> 查看已导入快照 | located必须真定位+语义匹配；否则fallback_shown/blocked，不伪located；快照hash不随原文件变化 | 页面marker、DOM/原始span、前后hash和三态一致截图 |
| S08 文件/云/会话授权 | grant -> scan -> select/import -> revoke；另撤销cloud或memory consent，在出站与提交设置屏障 | grant/scan不自动导入；三个root各撤销后新scan/import403；未经cloud同意外发0；关闭memory后新提取0；在途结果不应用；已出站如实记录 | 实际IO/HTTP计数和拒绝；旧root或跨scope成功即失败 |
| S09 永久Forget | 三来源分别确认 -> 观察级联 -> 查询Library/Ask/Graph/Trace -> direct/reload/Back/reopen -> 重启 -> 尝试旧job提交 | 四面absent且同源四种重开SOURCE_NOT_FOUND；共享item仍有supportingSourceIds；失败/残留不得verified；宿主原件/聊天不删除 | 至少3有序链；错误/坏shape/空异常结果不算absence；保存tombstone/操作日志 |
| S10 对话记忆 | 未启用先聊天 -> 单独启用三会话 -> 完成turn -> 看记忆出处 -> 重放事件 -> 关闭再聊天 | 未启用/启用前消息零提取；同turn最多一次；每memory绑定实际messageId；推断不当用户事实；跨会话不串写 | 同意版本、turn提交、提取任务/来源；合成对话只可做负例，不计真实覆盖 |
| S11 可逆维护 | 默认关闭查看空态/历史 -> 配置范围并开启suggest_only生成建议 -> 授权reversible_auto -> 生成摘要/tag/archive -> 拒绝/接受 -> restore；并发修改后再应用旧建议 | 关闭时新生成/应用0；20摘要/20建议质量达标；10应用/恢复全过；10旧revision冲突全拒绝；隔离不默认检索且可恢复；自动永久删除和宿主文件写入0 | before/after、原始引用、snapshot/revision、恢复结果；不是toast证明 |
| S12 调用量与模型 | 手动触发小批Ask/维护 -> 注入1次超时/1次429 -> 查看用量；模拟未知usage/费率与极高估算 | 次数等于真实请求数；重试单列；unknown=null；高估算金额不阻断；安全撤销/用户暂停仍停止新调用 | 请求账本/实际usage/估算来源；不能只改数字证明没有金额阈值 |
| S13 UX与证据 | 实际侧栏360/420、Workspace768/1280，逐个操作菜单/表单/Drawer/Dialog/维护页 | PNG解码尺寸=捕获metadata；side_panel与workspace映射正确；axe serious/critical=0，键盘断言100%，overflow/overlap/blocker=0 | 同run截图/DOM/axe/键盘原始记录；合成对照图不计产品证据 |
| S14 隔离交付 | 从双仓快照构建 -> 启动两服务 -> 完整回归 -> 查看中文报告 -> 人工逐路径体验 | 双仓commit/tree与构建/AST scan一致；合同109负例及新RKM负例全过；机器无Fatal/Major后人工签署 | 缺日志/hash/来源字节、错误scan根、source违规但报0、伪手势皆拒绝；human pending final=false |

## 3. 规则与统计可执行性

机器Schema只能证明shape。跨字段scope/ID、顺序、revocation/Forgetting因果、summary分母、截图surface/尺寸、原始hash、source-tree/扫描算法必须作为semantic规则登记。每个非Schema规则至少有一条修改原始bytes/事件的隔离负例；负例base先通过，不能从失败报告变异后宣布用例成功。

T05/RKM-0交付新的规则/requirement registry与机器合同；不能把原PX的63规则/109负例集合冒充新增维护覆盖。顶层注册表固定39项：S01..14十四项、S-01..16十六项、RC-01a/RC-01b/RC-02a/RC-02b/RC-03/RC-04六项、IR-01..03三项。表内每个步骤对应稳定断言ID，固定规范要求->断言->输入->算法->阈值->失败码->产物；子场景不改变顶层分母，不允许自由日志正则代替未定义指标。

G4保留旧三个前端根，并追加E07..19的Navia治理及DS变更实体作为RKM边界。扫描必须实际读取快照源码，负例插入违规import/网络调用且同步hash、report仍0时也拒绝。Graph首期max_nodes=120，与DS接口绑定；超过明确truncated及返回数量，不声称完整覆盖。

## 4. 审计等级与结论

contract_fixture、真实公开语料验收、授权私有语料验收分开。私有字节不进入公开HTML、外部ChatGPT包或截图；原始证据保留受限本地路径，外部只能核查脱敏件时如实声明局限。模型费用只估算，不设硬上限。

产品最终通过需要全部S01..14及下述补充断言达标、PRD/架构一致、独立审查无新Fatal/Major、用户签署。仅文档审计通过不能宣布上述测试完成。允许的最终目标声明限“V2-RKM 在冻结语料和授权范围通过真实知识服务、指定对话记忆及可逆维护验收”，不声称全站全格式/自动永久遗忘/完整自主外脑/V3完成。

## 5. 独立审查补充断言与阶段适用矩阵

S08-A：同空间只允许A外发，问题命中B；逐次检查DS检索集合和模型请求体，B原始字节/派生贡献为0。显式source deny不得被workspace grant覆盖。

S08-B分成两个不同断言：S08-B-protocol在T06通过DS公共接口设置隔离/恢复并查询，验证默认证据和上下文排除隔离B、恢复后重新验证当前同意；T07仅验证对DS既有retention状态的读取/过滤，不要求产品创建隔离建议。S08-B-product在T09由用户在Navia接受隔离建议 -> 查询 -> restore -> 再查询，验证完整界面/治理状态及同意；T10重跑两者。协议spike通过不能代替后期产品操作。

S08-C..F分别在Navia本地校验后、DS排队后、DS离线时、DS内部重试前撤销。以contracts3.2的DS ack屏障为远程停止点：屏障后新dispatch=0，屏障前已发送列表完整且返回应用=0；DS离线必须保持revoking，不可显示全链路完成。不得把点击到ack期间已经出站的请求隐去。

S10-A/S11-A：全新以及既有session/workspace首次进入设置，GET404 -> POST默认关闭revision1 -> PUT显式开启；并发两个创建仅一对象；相同key重放不新增；409后GET恢复。没有POST或初始revision不得以预置fixture代替首次操作。

| 里程碑 | 必须验收的稳定范围 | 明确留给后续的断言 |
|---|---|---|
| 原PX R1/R2/R3/R4/PX-6 | 完全按原PX修复合同/场景；S01..14只作目标关联，不是新增出门义务 | 不执行RKM云同意、持久级联、新路由、记忆/维护断言，不扩大旧Major修复范围 |
| RKM-0 | 新合同/原型与全部S01..14断言映射、正负实例、创建/授权/撤销设计审计 | 不声明真实服务/E2E通过 |
| RKM-1 | DS接口级spike：真实auth/version/status、幂等、source集合过滤、检索/dispatch屏障、级联与共享支持关系、真实模型usage；对应S04/S08-A..F/S09/S12的服务协议部分 | 不要求生产E12重启恢复、真实产品UI、对话turn与维护工作流；不得标完整S08/S09/S12通过 |
| RKM-2 | S01..09按本行冻结适用范围，S03先验证五旧路由20组合；S08仅文件/云同意及DS既有retention状态过滤，不含记忆关闭或S08-B-product；S09覆盖已导入web/file/note，S12的Ask usage；S13覆盖已有页面 | S08-B-product、三新路由、记忆source级联、维护与完整S12留RKM-3/4 |
| RKM-3 | S10/S10-A全部；S08记忆同意关闭及在途；S09扩展conversation_memory，S13新增MemoryConsentPanel | 三个维护路由及维护质量仍未覆盖 |
| RKM-4 | S11/S11-A、S12全部；S03新增三路由12组合；S08策略/维护撤销及S08-B-product；S09扩展摘要派生贡献；S13新增管理页及后台不抢焦点 | 独立快照全量复跑与最终签署留RKM-5 |
| RKM-5 | S01..14及所有补充断言全量执行，不允许沿用阶段partial为全绿 | 无未验功能；human pending则final=false |

RKM-1以隔离接口spike工具验证DS协议，不前移完整E12产品持久化；若协议必须依赖Navia生产事务才可验证，则返回RKM-0调整阶段，不静默提前实现RKM-2。每阶段在执行前冻结requiredAssertionIds及其分母；其中任一failed/pending/deferred都阻止该阶段通过，不能通过更改状态移出分母。只有事前冻结为后续阶段/不适用的断言才不进入本阶段分母，其依据须指向本表并标not_applicable，不由报告生成器临时裁剪。强制负例：把一个本阶段必需失败项改成deferred并伪改summary，校验器必须同时拒绝集合变化与阶段通过。

## 6. 第二轮复审的证据合同补强

以下为RKM-0必须转换为机器合同/fixture的设计要求，不代表现在已有可运行检测器。S01..14对应的E实体见第7节；负例全部先验证基础正例，再变异原始事实，不能只改report的passed字段。

### 6.1 认证与操作状态（S-1/S-9/S-10/S-11）

S01-A逐项执行contracts3.3矩阵：未配置token、缺/错/过期token、错/缺Origin、功能关闭、文件功能关闭但RKM可用、DS缺/错key及匿名/dev bypass。必须观察真实拒绝状态及零正文外发；不得用403冒充Runtime offline。

S08-G观察queued/running -> aborting -> aborted及DS离线持续aborting，不得出现aborting -> succeeded；重授权只能新operation/context。S09-A用真实A/B共同支持item：Forget A -> B仍支持的claim保留，A独有贡献清除；全部支持删除则item/边移除。逐项验证SharedSupportVerification与API/span一致，空/错误响应不作absence。

### 6.2 用量的独立分母（S-2）

E19在每次dispatch前持久记录intentId/attemptId/requestId/contextId/generation；不能记账则禁止开始发送，记录审计不可用而非费用超限。重试有新的attemptId，同一次不重复计数。E15汇聚UsageRecord并保留DS dispatch关联，不能用自己的行数自证请求数。

S12从E20隔离捕获与E19/E12权威记录重建四类sourceEventId集合K/M/T/P，比较E15账本满足`ledger sourceEventIds = K ∪ M ∪ T ∪ P`且一事件一记录；丢失、重复、孤儿或跨集合复用均失败。provider发送子集P记录send_started/response_received/transport_failed/unknown；无法确认是否发送不伪算成功或0费用。DS在send_started与实际传输之间崩溃必须unknown待对账，不能把全部intent算实际调用；仅intent_created且未取得发送资格不进入P。provider usage未知为null；请求尝试数不等于计费成功数。

stageBucket必须按contracts3.10从原始eventKind重算：knowledge_transport、memory_task、maintenance_task、provider_request分别唯一映射knowledge_operation、memory_extraction、maintenance_dispatch、model_request。维护或记忆任务触发的模型发送必须作为独立provider_request计入model_request，并以runId/taskId关联父任务；不得把同一sourceEventId放入两个桶，也不得只保留父任务行吞掉真实模型发送。四种正确映射各至少一个正例；错桶、双桶、sourceEventId复用/遗漏/孤儿、父任务冒充模型请求、模型请求并入父任务各至少一个负例。

负例应关闭/丢弃E15一条记录而真实dispatch保留、绕过E19审计路径发送、重复attempt、重试被合并、崩溃未知被填成功。对模型的真实收费调用仍需事先资料同意和实施批准；合同故障测试用明确标记的隔离接收端，不能替代真实模型质量样本。

### 6.3 截图新鲜度与文档图隔离（S-3/S-8）

每个产品capture冻结runId/segmentId/scenarioId/captureId、captureSurface/viewport、browserContextId/pageId、navigationGeneration、触发actionId、captureRequestId、单调事件序号、capturedAt、imagePath/imageSha256、metadataPath、captureResponseArtifact{path,sha256}和collector源码hash。原始捕获请求/返回必须在本次run启动之后及结束之前，与当前页面/动作/截图字节绑定。按顺序解码原始捕获返回得到PNG，必须与report.screenshotPaths[i]、metadata.imagePath及实际文件字节一致；拒绝路径别名/链接跨证据根。

历史PNG哈希相同只能触发来源复查，不能作为唯一拒绝依据：静态页面两次真实截图可能完全相同。必须拒绝“把旧PNG/旧捕获记录改名移入新run”或文档/合成图冒充产品capture；也必须有“本次真实捕获与旧PNG恰好同hash仍通过新鲜度检查”的正例。新runId字符串或文件mtime本身不证明新鲜度；有原始捕获链仍不等于能抵御恶意宿主伪造，E20实现/隔离源码和负例需独立审查。

PX证据仅在 `evidence/v2_external_brain_productization/`；RKM生产证据固定 `evidence/v2_real_knowledge_maintenance/runs/<runId>/`，spike在 `.../spikes/<runId>/`，contract fixture在 `.../contract-fixtures/<suiteId>/`，文档预览在 `.../documentation/`。各run新建、不覆盖，实际路径解析后不可越界或链接PX目录。RKM报告可引用PX基线为参考，不得将其场景/截图/计数计入RKM新分母；共享只读语料可以显式hash引用，操作证据不可复用。

### 6.4 Gold与图谱事实（S-4/S-5）

T05/RKM-0冻结`goldManifest.json`设计：goldSetId、goldVersion、corpusManifestArtifact{path,sha256}、goldPayloadArtifact{path,sha256}、authorId、reviewerId、reviewSessionId、reviewAt、decision、signoffHash、reviewRecordArtifact{path,sha256}、sourceSnapshotIds。gold payload含题目/必要source-revision-span/可接受主张/拒答冲突标签，不含模型答案。作者不得自审；至少一名独立审查者先审，decision=approved并冻结原始字节后才允许执行模型质量场景。两名审查者不是当前PRD硬要求，若以后提升治理等级须另作决定。

signoffHash=SHA-256(UTF-8 compact JSON，键排序，无BOM/尾换行，字段仅goldSetId、goldVersion、两个Artifact的path/sha256、authorId、reviewerId、reviewSessionId、reviewAt、decision、sourceSnapshotIds)；不含自身或reviewRecordArtifact，避免自引用。源记录应绑定实际审查session/tool日志。hash只绑定内容、不证明审查者身份；身份/独立性另从审查记录核验，不能由生成器代签。gold变更必须生成新goldVersion并重跑受影响题目，不后改gold迎合答案。

S06按Runtime/DS图谱原始响应重建允许的node/edge语义集合，与DOM/图实例导出的node/edge ID、关系类型、支持来源逐项比较：展示可以过滤，不能新增事实节点/关系或删除provenance后仍称事实。布局坐标、聚类容器、loading占位不算知识事实，须独立标型。截断数量及标记与服务端一致。

G4扫描冻结的前端入口/knowledge_workspace源码，以AST数据流和模块边界验证图数据只经runtimeClient进入；变量名mockGraphNodes/seedGraph不是封闭识别规则。负例在原始源码中注入不同命名的静态图、动态拼装关系或替换服务端边，同步源码hash并保持report=0仍必须被AST或上述运行期集合对照拒绝；合法布局变化与有provenance的服务端图应通过。

### 6.5 撤销屏障与宿主保护（S-6/S-7）

`revocationTimePoint`固定为after_local/after_ds_queue/ds_offline/before_ds_retry，分别绑定S08-C/D/E/F。隔离spike可在E11本地校验完成、E19队列入队、dispatch开始、响应返回和retry取得发送资格处设置具名屏障。每次记录hookId、事件序号、授权代际、requestId、transport state、ack及release事件；不能用sleep猜测时点。

after_local在请求发往DS前暂停；after_ds_queue在队列取得dispatch资格前暂停；ds_offline先真实停止隔离DS连接并观察revoking，恢复后先对账；before_ds_retry使用受控失败让重试待定再撤销。另用隔离接收端确认已收到请求头/体后暂停响应，证明“已发送未返回”，不能仅凭函数已调用就填inFlight。测试hook默认禁用，仅隔离spike配置启用，不能成为生产鉴权旁路；任何hook修改必须计入spike工具hash和执行模式。

S09/S11在专用真实样本副本上记录宿主文件before/after原始SHA-256、字节数、mtime_ns、文件标识和写入/重命名/删除事件；结束及重启后比对。测试期间禁止其他写入者，发生无关修改则该次证据失效重跑，不能掩盖为通过。原始聊天以目标session的messageId集合、顺序和正文/附件引用hash比对，不比较整个SQLite数据库文件hash（操作日志变化不等于聊天删除）。Navia/DS自有备份不得覆盖/迁入宿主样本目录；反例含改写后回填mtime、删除后还原同内容和恢复覆盖新revision，单靠最终hash一致不够。

## 7. 场景到实体的反向索引（S-15）

需求/任务/图页的完整连接仍以gap.md中心表为准；下表是它的S->E投影，变更必须同步。

| 场景 | 满足该场景的实体 |
|---|---|
| S01 | E01..06 |
| S02 | E07/E09..12/E17 |
| S03 | E02..05/E16/E20 |
| S04 | E05/E06/E10/E11/E19 |
| S05 | E11/E15/E17..19 |
| S06 | E04/E11/E17/E18 |
| S07 | E01/E04/E11/E15/E18 |
| S08 | E06/E08/E11..14/E17/E19/E20 |
| S09 | E06/E11/E12/E17/E18/E20 |
| S10 | E03/E07/E12/E13/E16 |
| S11 | E12/E14..18 |
| S12 | E15/E16/E19/E20 |
| S13 | E03..06/E16/E20 |
| S14 | E01..20 |

第6节新增反例的唯一requirementId、ruleId、输入Schema、预期主失败码、正例base、JSON Patch或原始bytes变异方式、复验命令均由RKM-0机器注册表逐项冻结。当前只冻结规范需求和可观测算法，不报告这些尚未实现的fixture“已通过”。

## 8. 风险再核查的生命周期断言（RC-01..04）

以下均为未执行的硬门槛，不是新增顶层需求或提前扩大原PX范围。RKM-0需交付每行的正例/负例及闭合失败码，不接受只在文档末尾列关键词；RKM-5全量执行，任何deferred使最终验收不通过。

| 断言 / 承接规格 | 前置与操作 | 确定性出门门槛与原始证据 | 首次实际验收 |
|---|---|---|---|
| RC-01a / S11 默认与终态 | 全新policy关闭 -> 尝试run/应用 -> 配范围开启suggest_only -> 生成建议不接受 -> 全成功/部分失败/全失败各一次 | 关闭时零新dispatch/应用；三个终态分别completed/degraded/failed，finishedAt/null规则一致；pending建议不冒充应用，也不使已生成完run永不完成。任务结果/HTTP/DB事务/截图逐项配对 | RKM-4 |
| RC-01b / S11 调度与恢复 | 同workspace并发触发 -> daily错过时点 -> Runtime重启而DS保持运行 -> 等pauseAck -> 用户resume；分别注入DST重复/缺失与revision变化 | 一活动run、零补跑；Runtime恢复后resume前本地零新提交；DS屏障后旧epoch零新发送/发布，屏障前队列发送/提交如实登记对账，不冒充屏障后违规或零发送。重复日期最多一次；过期输入已对账后终结degraded/failed，不永久占槽 | RKM-4 |
| RC-02a / S10 授权游标 | turn开始后才启用 -> 完成该turn -> 新turn -> 关闭/重开 -> 重放关闭期旧事件 | 跨开启边界的旧turn和关闭期消息零提取；新turn仅一次；按服务端sequence/epoch比较而非时间字符串；对话原始ID/hash保持 | RKM-3 |
| RC-02b / S10 事务交接 | 在完成消息提交前、提交后E12登记前、登记后E07 ack前分别终止隔离Runtime，再重启；加一次消费前撤销 | 提交失败不声称成功；已提交且仍授权的事件不丢；重复ack/重放不重复source或模型调用；撤销事件suppressed；提供E07事务/outbox、E12唯一键、E19调用关联，不以进程内队列长度自证 | RKM-3 |
| RC-03 / S01/S08 控制面 | DS停机/执行功能关闭 -> 已认证读取同意 -> 关闭/撤销 -> 恢复DS；再测试无token及E12不可写 | 本地可写时关闭持久、revoking可见；ack前不显示全链路撤销；恢复先对账再外发。无token403；E12写失败明确失败，不返回撤销成功；同provider改scope也须旧ack+新确认 | RKM-2（memory/policy部分在RKM-3/4补齐） |
| RC-04 / S09/S11 恢复边界 | A/B共享摘要和建议 -> 保存restore快照 -> Forget A -> restore旧建议 -> 重启及恢复旧备份；另删除独占来源 | 旧restore409且零重导入；A独有摘要/理由/快照内容不可回读；B真实支持部分重算。备份缺删除账本不能开放；宿主原件/原始聊天保持。对账公共API和受控备份记录，不用单toast或列表空值验证 | RKM-2基础删除/备份；RKM-4完整维护派生材料 |

### 8.1 本轮独立审查新增的三组强制断言

| 断言 / 场景 | 用户操作与观测链 | 判定要求 | 首次实际验收 |
|---|---|---|---|
| IR-01 / S08 同scope重授权 | A的ask/maintenance授权 -> 整体撤销并ack -> 只重新确认ask -> 再发两个purpose；并发两次替代同槽；另新增workspace grant | ask按新Slot放行、maintenance仍拒绝；旧记录保留但不参与已替代key冲突；并发仅一次CAS成功、另一409且零新对象；workspace grant不覆盖source deny。检查E12当前槽与DS实际上下文，不只看按钮成功 | RKM-1协议；RKM-2控制面 |
| IR-02 / S08/S11 普通pause | DS已排队/重试前pause，另DS离线pause -> 恢复取得run级ack -> resume -> 注入旧epoch晚回包，同时进行无关Ask | 本地pending与远程ack区分；ack后该run旧epoch发送/发布0，旧迟到draft应用0；新epoch仅余下任务、旧已提交结果先对账不重做；无关Ask权限不因普通pause撤销 | RKM-1协议；RKM-4维护UI |
| IR-03 / S11 释放旧run | 暂停处理A的run -> policy范围改为B或撤回原授权 -> ack/对账 -> 新建B的run；另使DS结果未知 | 已知结果后旧run降级/失败终结并释放槽，B用新snapshot/context；不裁剪旧run、不复用aborted操作；未知DS结果仍pending，不为腾槽伪造终态。提供任务/operation/epoch有序记录 | RKM-1屏障能力；RKM-4完整任务槽 |

IR-01..03均须在T05转为D01..06正负合同：同槽旧deny误挡新确认、非同槽越权替代、缺pause ack宣称停止、旧epoch回流、作用域改动仍占槽/伪释放分别独立变异。只改report字段不能证明协议执行；普通pause与Consent撤销的屏障不得混为同一个workspace停机行为。

RC-01..04的Schema字段、转换API和原始事件形状尚未发布；上述阶段适用说明与第5节共同约束，协议spike不替代生产事务/备份/真实Chrome验证。新增事件与状态只能属于RKM，不能反向声称原PX已具备durable operation或取消恢复能力。

## 9. 逐阶段验收执行卡（计划，非执行报告）

本节与development6的T01..10一一对应。每张卡实施前须复制到该阶段的独立验收文档，绑定准确snapshot/合同版本、样本、命令和审查者。AC01..04只依赖原PX合同/修复前置，不依赖D01..09；AC05负责产出并验收D01..09，不能把自身交付当启动前置；AC06..10才依赖T05实际冻结且适用的D产物。本节不能替代当前尚未交付的机器合同。旧PX严格使用原PX包/profile，RKM使用独立run目录，不能互借通过数。

| 卡 / 阶段 | 用户操作与故障顺序 | 必需产物 | 出门条件 / 不通过处理 |
|---|---|---|---|
| AC01 / T01 | launcher -> 侧栏连接 -> 保存 -> Workspace再次连接 -> 查看source；grant/scan/select/import/revoke；断开时注入晚到响应，Forget注入坏shape/服务错误 | 两容器真实trusted动作、HTTP/transport、file IO及scope、PNG/metadata，R1回归log及PRD检视 | 原R1后端和前端矩阵全过，三root撤销新scan/import拒绝，失败不伪verified；独立审查无新增Major才R2 |
| AC02 / T02 | 同一真实路径捕获 -> reload -> Runtime重启新segment -> 再认证；另制造缺响应/旧代际/伪手势 | 新run的raw索引、事件序列、原始entity bytes、PNG、诊断包 | 每一步证据可定位；故障必须诊断缺项，不生成成功值；完整raw冻结后才R3 |
| AC03 / T03 | 对sealed run派生两次 -> 比较事实结果 -> 跑109例及新生产变异 -> 更换validator版本 | reader/profile/registry和源码hash、实际规则集合、负例结果、invocation记录、candidate报告 | 派生确定性；原始字节未改；任何缺项不洗绿，human pending final=false；失败回R3计划 |
| AC04 / T04 | 隔离快照构建启动 -> 原PX全链路 -> 审查HTML及图 -> 用户体验签署 | snapshot/build/raw/validation/HTML/exit manifest/hash、独立复审、人审记录 | 原PX机器无Major且真实human已签署；签署不是T10的RKM签署，不提前开始RKM实现 |
| AC05 / T05 | 逐PRD点走新增交互原型 -> 每个创建/错误/关闭/重试/恢复例按合同解释 -> schema正负与semantic测试设计双向映射 | D01..09明确路径与hash、原型review-only行为证据、RFC6902或raw mutation、API diff、迁移/事务ADR | 字段/状态/路由/权限/规则无互斥；每规范性断言有唯一requirement/规则层/正例base/失败期望；文档复审不冒充服务验收 |
| AC06 / T06 | 独立DS namespace：错key -> 正确连接 -> 导入/超时/同key对账 -> build/query/trace -> 授权过滤/撤销 -> A/B删除重启 -> usage | 固定DS版本/API快照、真实原始HTTP、持久ack/派生支持验证、模型身份/usage和spike工具hash | 服务协议逐项全过，不能仅capability自报；先修目标合同/API差异再续实现，不能宣称完整UI或RKM质量通过 |
| AC07 / T07 | 24来源保存 -> 双服务重启 -> 三入口/五route恢复 -> 24题问答/引用 -> 图谱 -> 授权撤销 -> 三来源Forget/备份恢复 | 真实corpus与独立gold、ID映射、检索/模型/引用原文、四面before/after与恢复原始事件 | 至少20/24全构建且三类型均覆盖；检索/grounding/完整回答率>=0.9，跨来源6/6包含必要结论及双方证据；引用=1、拒答与冲突各6/6；五route20恢复组合全过；S01..09仅按第5节适用集合，不含S08-B-product |
| AC08 / T08 | 三会话开启、一会话关闭 -> 提取/看出处 -> 关闭重开 -> 重放 -> 三提交点崩溃 -> Forget记忆 -> 检查原聊天 | Consent sequence/epoch、E07事务outbox、E12任务及远程对账、真实message/source映射、聊天前后hash | S10/RC-02全部及记忆相关S08/S09；旧消息/跨会话0提取，有效任务不丢不重复；unknown外部结果不能强填成功 |
| AC09 / T09 | 关闭空态 -> 配范围启用建议 -> 授权自动 -> 20摘要/20建议 -> 10应用/恢复 -> 10并发冲突 -> 暂停/重启/日程 -> 极高费用估算 | 任务快照及状态、原始span/gold评分、应用/恢复记录、调度键、usage独立分母、三新route/组件截图 | S11/12及RC-01/03/04全过；质量>=0.9；10恢复全过/10冲突全拒绝；新route12恢复组合；高金额不硬停；自动永久删除/宿主写0 |
| AC10 / T10 | 从新双仓快照走全部S01..14 -> 四视口操作 -> 独立复审 -> 用户逐路径验收 | 全量新run、G4真实源码扫描、所有规则负例、中文报告/图纸、独立review与human签署 | 任何必需failed/deferred/pending阻止最终通过；不沿用partial，缺证据返回所属阶段修复后重跑受影响链及最终矩阵 |

### 9.1 每张执行卡共同的证据封存

阶段开始先保存输入索引：真实样本/授权/gold版本、实现与采集工具hash、合同版本、适用断言集合、执行环境与隔离目录。执行后保存实际命令exitCode/signal与raw日志、逐断言结果及失败原因、PRD/架构review、独立审查、交接说明。所有尚不存在的命令只可标PLANNED，不用预写成功log或脚本填入passed。

冻结顺序沿原PX无环原则：源码/工具snapshot -> 构建与输入索引 -> 原始run封存 -> 派生事实 -> 机器validation -> HTML -> exit manifest -> human签署 -> final disposition。生成器不回写raw；机器测试也不代签human。模型/源变化重建gold或样本版本，不能后改阈值，重跑集合由追踪矩阵决定。

RKM的最终机器判定以冻结的D05/D06为准，至少重算：必需断言集合完整、每个failed/pending/deferred正确阻塞、样本/查询/记忆/维护分母不混用、ID/scope/revision/epoch和因果一致、图片字节/视口/surface匹配、G4真实扫描范围、usage实际请求分母、gold/输出支持关系、人工签署的claim等级。不能只信summary/布尔值；每条非纯shape规则必须有改原始事实但report保持成功的负例。

### 9.2 DOC-Closure与G-1..G-7出门检查

当前DOC-Closure只检查文档权威一致性，不启动T05。S00通过需同时满足：Stage Gate只存在一套顺序；39个顶层断言集合逐项可枚举且无重复；D03无“可降级通过”；D04有四项事务兼容可证伪判据；D05四类Usage主分桶不互相计数；BarrierAck按barrierType隔离；UI区分本地阻止/远端待确认与远端已确认；Policy时区由所有者明确确认；gold作者不得自审。任何缺项均使DOC-Closure失败。

T05启动仍要求T01..04/PX-6通过、用户批准和T05预审计无Fatal/Major。T05出门时必须把上述要求转换为D01..09实际文件、正负根实例和可运行检查；当前自然语言不能计为机器合同通过。T06发现PRD必需DS能力不支持时只能标prd_blocker并回T05/用户决策，不允许以“可降级”、Mock、私有workspace读取或只改UI通过。

强制文档负例包括：把T05写成当前已启动；把顶层39改为36/37或漏RC子项；将prd_blocker改为degraded/pass；Usage eventKind映射错桶或同一事件进入两个主分桶；用maintenance_pause分支满足授权撤销或反向替代；remote pending显示“已暂停”；默认对象从部署机推导时区或daily未确认IANA时区；作者和gold审查者相同。DOC静态审查必须逐条拒绝。

### 9.3 ClaudeCode CLI需要复核的结论

REQ13后台无焦点抢占的补充验收S13-A：T09在专用真实浏览器会话中，用户持续在宿主输入框或Workspace Ask输入，后台维护分别完成、失败、产生待审建议。记录前后active window/tab、activeElement、焦点/blur事件、用户navigation动作和维护事件；没有用户显式导航/打开操作时，维护不得创建/激活tab、弹模态框、转移输入焦点或中断输入，违规次数=0。测试器不能先替应用restore焦点再截图；T10全量重跑。工具必须预告真实窗口/焦点测试，Headless仅能证明受控上下文，无法核实宿主焦点时明确pending，不以axe/四视口代替本项。

应分别回答“文档方案是否自洽且能指导分阶段实施”与“全部阶段现在能否直接编码”。前者可以在本轮文档审查形成限定结论；后者必须考虑PX前置、D01..09实际交付和真实DS spike，不可由字段清单代替。凡出现合同矛盾/原型缺行为/验收分母或状态失真，退回本阶段文档；凡实际服务不能满足删除/屏障、模型质量或兼容性，停止实现并提交实测路线取舍。不得承诺仅按计划写完代码就自然通过PRD验收。
