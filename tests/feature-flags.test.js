"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const feature_flags_1 = require("../miniprogram/config/feature-flags");
strict_1.default.equal(typeof feature_flags_1.INTERACTIVE_FEATURES_ENABLED, 'boolean');
strict_1.default.equal(feature_flags_1.FEATURE_FLAGS.membershipUnlock, feature_flags_1.INTERACTIVE_FEATURES_ENABLED);
strict_1.default.equal(feature_flags_1.FEATURE_FLAGS.audioPlayback, feature_flags_1.INTERACTIVE_FEATURES_ENABLED);
strict_1.default.equal((0, feature_flags_1.resolveInteractiveFeaturesEnabled)({ interactiveFeaturesEnabled: true }), true);
strict_1.default.equal((0, feature_flags_1.resolveInteractiveFeaturesEnabled)({ interactiveFeaturesEnabled: false }), false);
strict_1.default.equal((0, feature_flags_1.resolveInteractiveFeaturesEnabled)({}), feature_flags_1.INTERACTIVE_FEATURES_ENABLED);
console.log('feature flags tests passed.');
