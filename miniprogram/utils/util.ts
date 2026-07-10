export const formatTime = (date: Date) => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return (
    [year, month, day].map(formatNumber).join('/') +
    ' ' +
    [hour, minute, second].map(formatNumber).join(':')
  )
}

export function formatEntitlementExpiry(expiresAt?: number | null): string {
  if (!expiresAt || !Number.isFinite(expiresAt)) {
    return '1 年访问权限已生效'
  }

  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) {
    return '1 年访问权限已生效'
  }

  return `有效期至 ${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function formatInviteErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : String(error || '').trim()
  if (!message) {
    return '暂时无法解锁，请稍后重试'
  }
  if (/已被使用|already.*used/i.test(message)) {
    return '邀请码已被使用，请联系购买微信'
  }
  if (/无效|不存在|not.*found|invalid/i.test(message)) {
    return '邀请码无效，请检查后重新输入'
  }
  if (/过期|expired/i.test(message)) {
    return '邀请码已过期，请联系购买微信'
  }
  if (/登录|unauthorized|token/i.test(message)) {
    return '登录状态已失效，请返回首页重新登录'
  }
  return message
}

const formatNumber = (n: number) => {
  const s = n.toString()
  return s[1] ? s : '0' + s
}
