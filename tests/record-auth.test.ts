import assert from "node:assert/strict"

import { decideRecordAuthAction } from "../miniprogram/pages/course/record-auth"

// 已授权 → 直接录
assert.deepEqual(decideRecordAuthAction({ recordAuth: true }), { action: "start" })

// 从未询问 → 走系统授权弹窗
assert.deepEqual(decideRecordAuthAction({ recordAuth: undefined }), { action: "request" })

// 曾拒绝 → 引导去设置页
assert.deepEqual(decideRecordAuthAction({ recordAuth: false }), { action: "guide-setting" })

console.log("record auth tests passed.")
