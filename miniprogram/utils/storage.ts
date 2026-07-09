const TOKEN_KEY = 'waimao_mini_token'
const USER_CACHE_KEY = 'waimao_mini_user_cache'
const PROGRESS_CACHE_KEY = 'waimao_mini_progress_cache'

export function getToken(): string | null {
  try {
    const value = wx.getStorageSync(TOKEN_KEY)
    return value ? String(value) : null
  } catch (error) {
    console.warn('Failed to read token from storage', error)
    return null
  }
}

export function setToken(token: string) {
  try {
    wx.setStorageSync(TOKEN_KEY, token)
  } catch (error) {
    console.warn('Failed to write token to storage', error)
  }
}

export function clearToken() {
  try {
    wx.removeStorageSync(TOKEN_KEY)
  } catch (error) {
    console.warn('Failed to clear token from storage', error)
  }
}

export function cacheUser(payload: unknown) {
  try {
    wx.setStorageSync(USER_CACHE_KEY, payload)
  } catch (error) {
    console.warn('Failed to cache user profile', error)
  }
}

export function getCachedUser<T = unknown>(): T | null {
  try {
    const value = wx.getStorageSync(USER_CACHE_KEY)
    return value ?? null
  } catch (error) {
    console.warn('Failed to read cached user profile', error)
    return null
  }
}

export function cacheProgress(payload: unknown) {
  try {
    wx.setStorageSync(PROGRESS_CACHE_KEY, payload)
  } catch (error) {
    console.warn('Failed to cache progress', error)
  }
}

export function getCachedProgress<T = unknown>(): T | null {
  try {
    const value = wx.getStorageSync(PROGRESS_CACHE_KEY)
    return value ?? null
  } catch (error) {
    console.warn('Failed to read cached progress', error)
    return null
  }
}

export function clearUserCache() {
  try {
    wx.removeStorageSync(USER_CACHE_KEY)
    wx.removeStorageSync(PROGRESS_CACHE_KEY)
  } catch (error) {
    console.warn('Failed to clear cached user data', error)
  }
}

// ==================== 高级缓存工具类 ====================

type CacheItem<T> = {
  data: T
  expireAt: number
}

type CacheStats = {
  hits: number
  misses: number
  hitRate: string
}

/**
 * 本地存储缓存工具类
 * 用于缓存课程列表、课程详情、用户进度等数据
 */
export class LocalCache<T> {
  private key: string
  private ttl: number // 毫秒
  private hits = 0
  private misses = 0

  /**
   * @param key - 缓存键名
   * @param ttl - 过期时间（毫秒），默认30分钟
   */
  constructor(key: string, ttl = 30 * 60 * 1000) {
    this.key = key
    this.ttl = ttl
  }

  /**
   * 获取缓存数据
   */
  get(): T | null {
    try {
      const value = wx.getStorageSync(this.key)
      if (!value) {
        this.misses++
        return null
      }

      const item = JSON.parse(value) as CacheItem<T>

      // 检查是否过期
      if (Date.now() > item.expireAt) {
        this.clear()
        this.misses++
        return null
      }

      this.hits++
      return item.data
    } catch (error) {
      console.warn(`[LocalCache] Failed to get ${this.key}:`, error)
      this.misses++
      return null
    }
  }

  /**
   * 设置缓存数据
   */
  set(data: T): boolean {
    try {
      const item: CacheItem<T> = {
        data,
        expireAt: Date.now() + this.ttl,
      }

      wx.setStorageSync(this.key, JSON.stringify(item))
      return true
    } catch (error) {
      console.warn(`[LocalCache] Failed to set ${this.key}:`, error)
      return false
    }
  }

  /**
   * 清除缓存
   */
  clear(): void {
    try {
      wx.removeStorageSync(this.key)
    } catch (error) {
      console.warn(`[LocalCache] Failed to clear ${this.key}:`, error)
    }
  }

  /**
   * 检查缓存是否存在且有效
   */
  has(): boolean {
    return this.get() !== null
  }

  /**
   * 获取缓存统计
   */
  stats(): CacheStats {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : '0%'

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
    }
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.hits = 0
    this.misses = 0
  }
}

/**
 * 字典型缓存，支持多个key-value对
 * 用于缓存课程详情（每个课程ID对应一个缓存项）
 */
export class DictCache<T> {
  private prefix: string
  private ttl: number

  constructor(prefix: string, ttl = 30 * 60 * 1000) {
    this.prefix = prefix
    this.ttl = ttl
  }

  /**
   * 获取指定key的缓存
   */
  get(key: string): T | null {
    try {
      const storageKey = `${this.prefix}:${key}`
      const value = wx.getStorageSync(storageKey)
      if (!value) {
        return null
      }

      const item = JSON.parse(value) as CacheItem<T>

      if (Date.now() > item.expireAt) {
        this.remove(key)
        return null
      }

      return item.data
    } catch (error) {
      console.warn(`[DictCache] Failed to get ${this.prefix}:${key}:`, error)
      return null
    }
  }

  /**
   * 设置指定key的缓存
   */
  set(key: string, data: T): boolean {
    try {
      const storageKey = `${this.prefix}:${key}`
      const item: CacheItem<T> = {
        data,
        expireAt: Date.now() + this.ttl,
      }

      wx.setStorageSync(storageKey, JSON.stringify(item))
      return true
    } catch (error) {
      console.warn(`[DictCache] Failed to set ${this.prefix}:${key}:`, error)
      return false
    }
  }

  /**
   * 删除指定key的缓存
   */
  remove(key: string): void {
    try {
      const storageKey = `${this.prefix}:${key}`
      wx.removeStorageSync(storageKey)
    } catch (error) {
      console.warn(`[DictCache] Failed to remove ${this.prefix}:${key}:`, error)
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    try {
      const info = wx.getStorageInfoSync()
      const keys = info.keys.filter(k => k.startsWith(this.prefix + ':'))
      keys.forEach(key => {
        wx.removeStorageSync(key)
      })
    } catch (error) {
      console.warn(`[DictCache] Failed to clear all ${this.prefix}:`, error)
    }
  }
}

// ==================== 防抖和节流函数 ====================

/**
 * 防抖函数 - 延迟执行，连续触发时重新计时
 * 适用于: 搜索输入、窗口resize、学习时长上报
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: number | null = null

  return function (this: any, ...args: Parameters<T>) {
    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, delay) as unknown as number
  }
}

/**
 * 节流函数 - 固定时间内只执行一次
 * 适用于: 滚动加载、按钮防连点
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()

    if (now - lastCall >= delay) {
      lastCall = now
      fn.apply(this, args)
    }
  }
}
