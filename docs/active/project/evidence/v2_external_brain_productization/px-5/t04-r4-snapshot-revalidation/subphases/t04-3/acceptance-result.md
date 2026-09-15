# T04-3 R4-E 新鲜真实 Chrome 验收结果

日期：2026-09-14  
Run：`t04-r4-snapshot-revalidation-20260914t105407z`  
Source run：`t04-r4-fresh-raw-20260914110011682`  
结论：`PASS / Fatal=0 / Major=0`

新 raw SHA-256 `4f8e8e8d510152e197925cf83aedef07fccdfce7816eaa3008b72e005442d110`，canonical seal `06fc51f08ca75c11c2cbcf3e7ec0b7fc1bc24c82f73b5df9d65782429907ee03`，source commit `e0e7ca9a...`。input-readiness Fatal=0/Major=0；12 source=6+3+3、5x4 route、两类 invalid recovery、3x4 Forget、Axe 0/0、Keyboard 5/5、T01 36/36。collector 17/17、frontend 169/169、Runtime 307/307；cleanup browser/runtime/fixture/profile 四项通过，Windows 临时 profile 根已删除。
