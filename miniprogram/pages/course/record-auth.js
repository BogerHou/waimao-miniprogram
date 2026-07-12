"use strict";
// 录音功能的授权前置判定（纯逻辑，便于测试）。
// 微信要求敏感权限（录音）在调用前确认用户已同意隐私协议；系统权限被拒后
// 需要引导用户去设置页开启。页面侧负责实际调用 wx API，本模块只做决策。
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideRecordAuthAction = decideRecordAuthAction;
function decideRecordAuthAction(state) {
    if (state.recordAuth === true) {
        return { action: 'start' };
    }
    if (state.recordAuth === false) {
        return { action: 'guide-setting' };
    }
    return { action: 'request' };
}
