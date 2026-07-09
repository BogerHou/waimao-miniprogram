"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DictCache = exports.LocalCache = void 0;
exports.getToken = getToken;
exports.setToken = setToken;
exports.clearToken = clearToken;
exports.cacheUser = cacheUser;
exports.getCachedUser = getCachedUser;
exports.cacheProgress = cacheProgress;
exports.getCachedProgress = getCachedProgress;
exports.clearUserCache = clearUserCache;
exports.debounce = debounce;
exports.throttle = throttle;
const TOKEN_KEY = 'waimao_mini_token';
const USER_CACHE_KEY = 'waimao_mini_user_cache';
const PROGRESS_CACHE_KEY = 'waimao_mini_progress_cache';
function getToken() {
    try {
        const value = wx.getStorageSync(TOKEN_KEY);
        return value ? String(value) : null;
    }
    catch (error) {
        console.warn('Failed to read token from storage', error);
        return null;
    }
}
function setToken(token) {
    try {
        wx.setStorageSync(TOKEN_KEY, token);
    }
    catch (error) {
        console.warn('Failed to write token to storage', error);
    }
}
function clearToken() {
    try {
        wx.removeStorageSync(TOKEN_KEY);
    }
    catch (error) {
        console.warn('Failed to clear token from storage', error);
    }
}
function cacheUser(payload) {
    try {
        wx.setStorageSync(USER_CACHE_KEY, payload);
    }
    catch (error) {
        console.warn('Failed to cache user profile', error);
    }
}
function getCachedUser() {
    try {
        const value = wx.getStorageSync(USER_CACHE_KEY);
        return value ?? null;
    }
    catch (error) {
        console.warn('Failed to read cached user profile', error);
        return null;
    }
}
function cacheProgress(payload) {
    try {
        wx.setStorageSync(PROGRESS_CACHE_KEY, payload);
    }
    catch (error) {
        console.warn('Failed to cache progress', error);
    }
}
function getCachedProgress() {
    try {
        const value = wx.getStorageSync(PROGRESS_CACHE_KEY);
        return value ?? null;
    }
    catch (error) {
        console.warn('Failed to read cached progress', error);
        return null;
    }
}
function clearUserCache() {
    try {
        wx.removeStorageSync(USER_CACHE_KEY);
        wx.removeStorageSync(PROGRESS_CACHE_KEY);
    }
    catch (error) {
        console.warn('Failed to clear cached user data', error);
    }
}
/**
 * 本地存储缓存工具类
 * 用于缓存课程列表、课程详情、用户进度等数据
 */
class LocalCache {
    /**
     * @param key - 缓存键名
     * @param ttl - 过期时间（毫秒），默认30分钟
     */
    constructor(key, ttl = 30 * 60 * 1000) {
        this.hits = 0;
        this.misses = 0;
        this.key = key;
        this.ttl = ttl;
    }
    /**
     * 获取缓存数据
     */
    get() {
        try {
            const value = wx.getStorageSync(this.key);
            if (!value) {
                this.misses++;
                return null;
            }
            const item = JSON.parse(value);
            // 检查是否过期
            if (Date.now() > item.expireAt) {
                this.clear();
                this.misses++;
                return null;
            }
            this.hits++;
            return item.data;
        }
        catch (error) {
            console.warn(`[LocalCache] Failed to get ${this.key}:`, error);
            this.misses++;
            return null;
        }
    }
    /**
     * 设置缓存数据
     */
    set(data) {
        try {
            const item = {
                data,
                expireAt: Date.now() + this.ttl,
            };
            wx.setStorageSync(this.key, JSON.stringify(item));
            return true;
        }
        catch (error) {
            console.warn(`[LocalCache] Failed to set ${this.key}:`, error);
            return false;
        }
    }
    /**
     * 清除缓存
     */
    clear() {
        try {
            wx.removeStorageSync(this.key);
        }
        catch (error) {
            console.warn(`[LocalCache] Failed to clear ${this.key}:`, error);
        }
    }
    /**
     * 检查缓存是否存在且有效
     */
    has() {
        return this.get() !== null;
    }
    /**
     * 获取缓存统计
     */
    stats() {
        const total = this.hits + this.misses;
        const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) + '%' : '0%';
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate,
        };
    }
    /**
     * 重置统计
     */
    resetStats() {
        this.hits = 0;
        this.misses = 0;
    }
}
exports.LocalCache = LocalCache;
/**
 * 字典型缓存，支持多个key-value对
 * 用于缓存课程详情（每个课程ID对应一个缓存项）
 */
class DictCache {
    constructor(prefix, ttl = 30 * 60 * 1000) {
        this.prefix = prefix;
        this.ttl = ttl;
    }
    /**
     * 获取指定key的缓存
     */
    get(key) {
        try {
            const storageKey = `${this.prefix}:${key}`;
            const value = wx.getStorageSync(storageKey);
            if (!value) {
                return null;
            }
            const item = JSON.parse(value);
            if (Date.now() > item.expireAt) {
                this.remove(key);
                return null;
            }
            return item.data;
        }
        catch (error) {
            console.warn(`[DictCache] Failed to get ${this.prefix}:${key}:`, error);
            return null;
        }
    }
    /**
     * 设置指定key的缓存
     */
    set(key, data) {
        try {
            const storageKey = `${this.prefix}:${key}`;
            const item = {
                data,
                expireAt: Date.now() + this.ttl,
            };
            wx.setStorageSync(storageKey, JSON.stringify(item));
            return true;
        }
        catch (error) {
            console.warn(`[DictCache] Failed to set ${this.prefix}:${key}:`, error);
            return false;
        }
    }
    /**
     * 删除指定key的缓存
     */
    remove(key) {
        try {
            const storageKey = `${this.prefix}:${key}`;
            wx.removeStorageSync(storageKey);
        }
        catch (error) {
            console.warn(`[DictCache] Failed to remove ${this.prefix}:${key}:`, error);
        }
    }
    /**
     * 清除所有缓存
     */
    clearAll() {
        try {
            const info = wx.getStorageInfoSync();
            const keys = info.keys.filter(k => k.startsWith(this.prefix + ':'));
            keys.forEach(key => {
                wx.removeStorageSync(key);
            });
        }
        catch (error) {
            console.warn(`[DictCache] Failed to clear all ${this.prefix}:`, error);
        }
    }
}
exports.DictCache = DictCache;
// ==================== 防抖和节流函数 ====================
/**
 * 防抖函数 - 延迟执行，连续触发时重新计时
 * 适用于: 搜索输入、窗口resize、学习时长上报
 */
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            fn.apply(this, args);
            timer = null;
        }, delay);
    };
}
/**
 * 节流函数 - 固定时间内只执行一次
 * 适用于: 滚动加载、按钮防连点
 */
function throttle(fn, delay) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            fn.apply(this, args);
        }
    };
}
