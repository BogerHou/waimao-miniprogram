import assert from 'node:assert/strict'
import { shouldPreserveCachedSessionAfterRefreshFailure } from '../miniprogram/utils/auth-session'

assert.equal(shouldPreserveCachedSessionAfterRefreshFailure('cached-token'), true)
assert.equal(shouldPreserveCachedSessionAfterRefreshFailure(null), false)
assert.equal(shouldPreserveCachedSessionAfterRefreshFailure(undefined), false)
assert.equal(shouldPreserveCachedSessionAfterRefreshFailure(''), false)

console.log('auth session tests passed.')
