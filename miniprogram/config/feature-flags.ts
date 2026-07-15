/**
 * 服务端配置读取失败时的安全回退值。
 *
 * 正常运行时，以服务端 app-config.json 的 interactiveFeaturesEnabled 为真源。
 * false 时仍展示全部章节，但隐藏会员与音频能力并让课程保持只读。
 */
export const INTERACTIVE_FEATURES_ENABLED = false

export const FEATURE_FLAGS = Object.freeze({
  membershipUnlock: INTERACTIVE_FEATURES_ENABLED,
  audioPlayback: INTERACTIVE_FEATURES_ENABLED,
})

export function resolveInteractiveFeaturesEnabled(
  appConfig?: { interactiveFeaturesEnabled?: boolean },
) {
  return typeof appConfig?.interactiveFeaturesEnabled === 'boolean'
    ? appConfig.interactiveFeaturesEnabled
    : INTERACTIVE_FEATURES_ENABLED
}
