"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_FLAGS = exports.INTERACTIVE_FEATURES_ENABLED = void 0;
exports.resolveInteractiveFeaturesEnabled = resolveInteractiveFeaturesEnabled;
/**
 * 服务端配置读取失败时的安全回退值。
 *
 * 正常运行时，以服务端 app-config.json 的 interactiveFeaturesEnabled 为真源。
 * false 时仍展示全部章节，但隐藏会员与音频能力并让课程保持只读。
 */
exports.INTERACTIVE_FEATURES_ENABLED = false;
exports.FEATURE_FLAGS = Object.freeze({
    membershipUnlock: exports.INTERACTIVE_FEATURES_ENABLED,
    audioPlayback: exports.INTERACTIVE_FEATURES_ENABLED,
});
function resolveInteractiveFeaturesEnabled(appConfig) {
    return typeof appConfig?.interactiveFeaturesEnabled === 'boolean'
        ? appConfig.interactiveFeaturesEnabled
        : exports.INTERACTIVE_FEATURES_ENABLED;
}
