import assert from 'node:assert/strict'

import {
  formatEntitlementExpiry,
  formatInviteErrorMessage,
} from '../miniprogram/utils/util'

function testFormatsExpiryDate() {
  const expiresAt = new Date(2027, 6, 10, 12, 0, 0).getTime()
  assert.equal(formatEntitlementExpiry(expiresAt), '有效期至 2027 年 7 月 10 日')
  assert.equal(formatEntitlementExpiry(null), '1 年访问权限已生效')
}

function testNormalizesInviteErrors() {
  assert.equal(
    formatInviteErrorMessage(new Error('邀请码已被使用。')),
    '邀请码已被使用，请联系购买微信',
  )
  assert.equal(
    formatInviteErrorMessage(new Error('邀请码无效。如果还没有邀请码，请添加微信获取。')),
    '邀请码无效，请检查后重新输入',
  )
}

testFormatsExpiryDate()
testNormalizesInviteErrors()
console.log('unlock format tests passed.')
