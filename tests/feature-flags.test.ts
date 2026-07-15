import assert from 'node:assert/strict'

import {
  FEATURE_FLAGS,
  INTERACTIVE_FEATURES_ENABLED,
  resolveInteractiveFeaturesEnabled,
} from '../miniprogram/config/feature-flags'

assert.equal(typeof INTERACTIVE_FEATURES_ENABLED, 'boolean')
assert.equal(FEATURE_FLAGS.membershipUnlock, INTERACTIVE_FEATURES_ENABLED)
assert.equal(FEATURE_FLAGS.audioPlayback, INTERACTIVE_FEATURES_ENABLED)
assert.equal(resolveInteractiveFeaturesEnabled({ interactiveFeaturesEnabled: true }), true)
assert.equal(resolveInteractiveFeaturesEnabled({ interactiveFeaturesEnabled: false }), false)
assert.equal(resolveInteractiveFeaturesEnabled({}), INTERACTIVE_FEATURES_ENABLED)

console.log('feature flags tests passed.')
