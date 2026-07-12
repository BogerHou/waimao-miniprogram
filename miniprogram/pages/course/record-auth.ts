// 录音功能的授权前置判定（纯逻辑，便于测试）。
// 微信要求敏感权限（录音）在调用前确认用户已同意隐私协议；系统权限被拒后
// 需要引导用户去设置页开启。页面侧负责实际调用 wx API，本模块只做决策。

export type RecordAuthState = {
  // 用户是否已授权 scope.record（wx.getSetting 的 authSetting['scope.record']）
  // undefined = 从未询问；true = 已授权；false = 曾拒绝
  recordAuth: boolean | undefined
}

export type RecordAuthDecision =
  | { action: 'start' } // 已授权，直接录
  | { action: 'request' } // 从未询问，走 wx.authorize 触发系统弹窗
  | { action: 'guide-setting' } // 曾拒绝，引导去 wx.openSetting

export function decideRecordAuthAction(state: RecordAuthState): RecordAuthDecision {
  if (state.recordAuth === true) {
    return { action: 'start' }
  }
  if (state.recordAuth === false) {
    return { action: 'guide-setting' }
  }
  return { action: 'request' }
}
