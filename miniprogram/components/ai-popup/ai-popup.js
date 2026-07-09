"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../../config/env");
const storage_1 = require("../../utils/storage");
const render_state_1 = require("./render-state");
const stream_renderer_1 = require("./stream-renderer");
const AI_USAGE_KEY = 'ai_usage_limit_v1';
// 激励广告 ID，请替换为您的真实 ID
const AD_UNIT_ID = 'adunit-bc26e124b291cea0';
const STREAM_RENDER_INTERVAL = 40;
const STREAM_CHARS_PER_TICK = 3;
class UTF8StreamDecoder {
    constructor() {
        this.decoder = null;
        this.leftover = new Uint8Array(0);
        if (typeof TextDecoder !== 'undefined') {
            this.decoder = new TextDecoder('utf-8');
        }
    }
    decode(buffer) {
        if (this.decoder) {
            return this.decoder.decode(buffer, { stream: true });
        }
        // Fallback if no TextDecoder
        const newBytes = new Uint8Array(buffer);
        const bytes = new Uint8Array(this.leftover.length + newBytes.length);
        bytes.set(this.leftover);
        bytes.set(newBytes, this.leftover.length);
        let result = '';
        let i = 0;
        while (i < bytes.length) {
            const byte1 = bytes[i];
            if (byte1 < 0x80) {
                result += String.fromCharCode(byte1);
                i += 1;
            }
            else if (byte1 < 0xE0) {
                if (i + 1 >= bytes.length)
                    break;
                const byte2 = bytes[i + 1];
                result += String.fromCharCode(((byte1 & 0x1F) << 6) | (byte2 & 0x3F));
                i += 2;
            }
            else if (byte1 < 0xF0) {
                if (i + 2 >= bytes.length)
                    break;
                const byte2 = bytes[i + 1];
                const byte3 = bytes[i + 2];
                result += String.fromCharCode(((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F));
                i += 3;
            }
            else {
                if (i + 3 >= bytes.length)
                    break;
                const byte2 = bytes[i + 1];
                const byte3 = bytes[i + 2];
                const byte4 = bytes[i + 3];
                const codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F);
                const offset = codePoint - 0x10000;
                result += String.fromCharCode(0xD800 + (offset >> 10), 0xDC00 + (offset & 0x3FF));
                i += 4;
            }
        }
        this.leftover = bytes.slice(i);
        return result;
    }
}
Component({
    properties: {
        show: {
            type: Boolean,
            value: false
        },
        text: {
            type: String,
            value: ''
        },
        context: {
            type: String,
            value: ''
        }
    },
    data: {
        visible: false,
        loading: false,
        messages: [],
        inputValue: '',
        animationData: {},
        scrollToView: '',
        scrollTop: 0,
        currentRequestId: '' // 用于防止并发缓存错乱
    },
    observers: {
        'show, text': function (show, text) {
            if (show && text && this.data.messages.length === 0) {
                this.setData({ visible: true });
                this.animateShow();
                this.initConversation(text, this.properties.context);
            }
            else if (show && !text) {
                this.setData({ visible: true });
                this.animateShow();
            }
            else if (!show) {
                this.animateHide();
            }
        }
    },
    methods: {
        buildAssistantMessage(content, options) {
            const message = {
                role: 'assistant',
                content,
                displayText: options?.displayText ?? content,
                parsedNodes: options?.parsedNodes,
                isStreaming: !!options?.isStreaming
            };
            return {
                ...message,
                ...(0, render_state_1.getAssistantDisplayState)(message)
            };
        },
        resetStreamingRenderState() {
            const state = this;
            if (state.streamRenderTimer) {
                clearInterval(state.streamRenderTimer);
                state.streamRenderTimer = null;
            }
            state.streamPendingText = '';
            state.streamDisplayedText = '';
            state.streamFullText = '';
            state.streamMessageIndex = -1;
            state.streamRequestId = '';
        },
        startStreamingRenderTimer(msgIndex, requestId) {
            const state = this;
            state.streamMessageIndex = msgIndex;
            state.streamRequestId = requestId;
            if (state.streamRenderTimer)
                return;
            state.streamRenderTimer = setInterval(() => {
                this.flushStreamingRender(false);
            }, STREAM_RENDER_INTERVAL);
        },
        enqueueStreamingText(textChunk, fullText, msgIndex, requestId) {
            if (!textChunk)
                return;
            const state = this;
            state.streamPendingText = `${state.streamPendingText || ''}${textChunk}`;
            state.streamFullText = fullText;
            this.startStreamingRenderTimer(msgIndex, requestId);
            this.flushStreamingRender(false);
        },
        flushStreamingRender(forceAll) {
            const state = this;
            if (!state.streamRequestId || this.data.currentRequestId !== state.streamRequestId) {
                this.resetStreamingRenderState();
                return;
            }
            const drained = (0, stream_renderer_1.drainStreamingBuffer)({
                pendingText: state.streamPendingText || '',
                displayedText: state.streamDisplayedText || '',
                charsPerTick: STREAM_CHARS_PER_TICK,
                flushAll: forceAll
            });
            state.streamPendingText = drained.pendingText;
            state.streamDisplayedText = drained.displayedText;
            const msgIndex = typeof state.streamMessageIndex === 'number' ? state.streamMessageIndex : -1;
            if (msgIndex < 0)
                return;
            this.setData({
                [`messages[${msgIndex}]`]: this.buildAssistantMessage(state.streamFullText || drained.displayedText, {
                    displayText: drained.displayedText,
                    isStreaming: true
                })
            });
            if (!state.streamPendingText && state.streamRenderTimer) {
                clearInterval(state.streamRenderTimer);
                state.streamRenderTimer = null;
            }
        },
        finalizeAssistantMessage(msgIndex, finalMessageContent) {
            this.flushStreamingRender(true);
            const finalParsedNodes = this.parseContent(finalMessageContent);
            const finalMessage = this.buildAssistantMessage(finalMessageContent, {
                displayText: finalMessageContent,
                parsedNodes: finalParsedNodes,
                isStreaming: false
            });
            this.setData({
                [`messages[${msgIndex}]`]: finalMessage
            });
            this.resetStreamingRenderState();
            return finalMessage;
        },
        close() {
            this.resetStreamingRenderState();
            this.animateHide();
            this.triggerEvent('close');
        },
        onTouchStart(e) {
            if (e.touches.length === 1) {
                this.touchStartY = e.touches[0].clientY;
                this.lastTranslateY = 0;
            }
        },
        onTouchMove(e) {
            if (e.touches.length === 1) {
                const clientY = e.touches[0].clientY;
                const deltaY = clientY - this.touchStartY;
                // 只允许向下拖动
                if (deltaY > 0) {
                    const animation = wx.createAnimation({
                        duration: 0,
                        timingFunction: 'linear',
                    });
                    animation.translateY(deltaY).step();
                    this.setData({
                        animationData: animation.export()
                    });
                    this.lastTranslateY = deltaY;
                }
            }
        },
        onTouchEnd() {
            const threshold = 100; // 下拉超过 100px 则关闭
            const lastTranslateY = this.lastTranslateY || 0;
            if (lastTranslateY > threshold) {
                this.close();
            }
            else if (lastTranslateY > 0) {
                // 回弹
                this.animateShow();
            }
            ;
            this.lastTranslateY = 0;
        },
        animateShow() {
            const animation = wx.createAnimation({
                duration: 300,
                timingFunction: 'ease-out',
            });
            animation.translateY(0).step();
            this.setData({
                animationData: animation.export()
            });
        },
        animateHide() {
            const animation = wx.createAnimation({
                duration: 300,
                timingFunction: 'ease-in',
            });
            animation.translateY('100%').step();
            this.setData({
                animationData: animation.export()
            }, () => {
                setTimeout(() => {
                    this.setData({
                        visible: false,
                        messages: [],
                        inputValue: '',
                        currentRequestId: '' // 清除请求 ID，取消正在进行的请求
                    });
                }, 300);
            });
        },
        // 生成缓存 key
        getCacheKey(text) {
            return `ai_explain_${text.substring(0, 50).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`;
        },
        // 从缓存加载
        loadFromCache(text) {
            try {
                const key = this.getCacheKey(text);
                const cached = wx.getStorageSync(key);
                if (cached && Array.isArray(cached) && cached.length >= 2) {
                    const lastMsg = cached[cached.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content && !lastMsg.content.includes('抱歉，')) {
                        console.log('使用缓存的讲解结果');
                        return cached;
                    }
                }
            }
            catch (e) {
                console.warn('读取缓存失败', e);
            }
            return null;
        },
        // 保存到缓存
        saveToCache(text, messages) {
            try {
                const key = this.getCacheKey(text);
                wx.setStorageSync(key, messages);
                console.log('讲解结果已缓存');
            }
            catch (e) {
                console.warn('保存缓存失败', e);
            }
        },
        // 检查并记录使用次数
        checkAndIncrUsage(callback) {
            const today = new Date().toISOString().split('T')[0];
            let stats = wx.getStorageSync(AI_USAGE_KEY) || { date: today, count: 0, unlocked: false };
            // 跨天重置
            if (stats.date !== today) {
                stats = { date: today, count: 0, unlocked: false };
                wx.setStorageSync(AI_USAGE_KEY, stats);
            }
            // 检查权限
            if (stats.unlocked)
                return true;
            if (stats.count < 10)
                return true;
            // 到达上限，触发广告弹窗，传入回调以便接续
            this.showAdUnlock(callback);
            return false;
        },
        // 记录一次使用
        incrUsageCount() {
            const today = new Date().toISOString().split('T')[0];
            const stats = wx.getStorageSync(AI_USAGE_KEY) || { date: today, count: 0, unlocked: false };
            if (!stats.unlocked) {
                stats.count += 1;
                wx.setStorageSync(AI_USAGE_KEY, stats);
            }
        },
        // 弹窗提示看广告
        showAdUnlock(callback) {
            wx.showModal({
                title: '每日限额',
                content: '您今日的 10 次免费讲解已用完。看一个短视频，即可解锁今日全天无限次免费讲解！',
                confirmText: '去观看',
                cancelText: '取消',
                success: (res) => {
                    if (res.confirm) {
                        // 延迟执行，确保模态框完全关闭
                        setTimeout(() => {
                            this.playRewardVideoAd(callback);
                        }, 100);
                    }
                }
            });
        },
        // 播放激励视频广告
        playRewardVideoAd(callback) {
            if (!wx.createRewardedVideoAd) {
                wx.showToast({ title: '当前环境不支持广告', icon: 'none' });
                return;
            }
            // 显示加载中提示
            wx.showLoading({ title: '广告加载中...' });
            const videoAd = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
            const onAdClose = (res) => {
                videoAd.offClose(onAdClose);
                if (res && res.isEnded) {
                    // 解锁
                    const today = new Date().toISOString().split('T')[0];
                    const stats = wx.getStorageSync(AI_USAGE_KEY) || { date: today, count: 10, unlocked: false };
                    stats.unlocked = true;
                    wx.setStorageSync(AI_USAGE_KEY, stats);
                    wx.showToast({ title: '已解锁全天无限次', icon: 'success' });
                    if (callback) {
                        callback();
                    }
                    else if (this.properties.text) {
                        this.initConversation(this.properties.text, this.properties.context);
                    }
                }
                else {
                    wx.showToast({ title: '观看完才能解锁哦', icon: 'none' });
                }
            };
            videoAd.onClose(onAdClose);
            videoAd.load()
                .then(() => {
                wx.hideLoading();
                return videoAd.show();
            })
                .catch(err => {
                wx.hideLoading();
                console.error('广告加载失败', err);
                wx.showToast({ title: '暂时没有广告哦，请稍后再试', icon: 'none' });
            });
        },
        initConversation(text, context) {
            // 1. 先检查是否有缓存（缓存不计入次数）
            const cachedMessages = this.loadFromCache(text);
            if (cachedMessages && cachedMessages.length > 0) {
                this.setData({
                    messages: cachedMessages,
                    scrollToView: 'msg-0'
                });
                return;
            }
            // 2. 无缓存需发起请求，检查次数
            if (!this.checkAndIncrUsage(() => {
                // 解锁后的回调：重新初始化对话
                this.initConversation(text, context);
            })) {
                return;
            }
            // 3. 构建初始用户态
            this.setData({
                messages: [{
                        role: 'user',
                        content: `请帮我讲解 "${text}"`
                    }]
            });
            this.requestAI(text, context);
        },
        async requestAI(text, context, isFollowUp) {
            if (this.data.loading)
                return;
            // 生成请求 ID，用于防止并发问题
            const requestId = Date.now().toString();
            // 保存当前请求的原始句子（用于缓存 key）
            const originalText = this.properties.text;
            // 先清空 scrollToView，然后设置 scrollTop 滚动到底部
            this.setData({
                loading: true,
                currentRequestId: requestId,
                scrollToView: '',
                scrollTop: this.data.scrollTop // 先保持不变
            });
            // 延迟后滚动到底部，确保 UI 已更新
            setTimeout(() => {
                this.setData({
                    scrollTop: 99999 // 滚动到底部
                });
            }, 50);
            // 添加一个空的 Assistant 消息用于流式接收
            const messages = this.data.messages;
            const msgIndex = messages.length;
            this.setData({
                [`messages[${msgIndex}]`]: {
                    ...this.buildAssistantMessage('', {
                        displayText: '',
                        isStreaming: true
                    })
                },
                scrollToView: `msg-${msgIndex}` // 滚动到 AI 回答位置
            });
            this.resetStreamingRenderState();
            this.streamMessageIndex = msgIndex;
            this.streamRequestId = requestId;
            // 构建发送给后端的历史消息
            const history = messages
                .filter(m => m.content && m.content.trim())
                .map((m, index) => ({
                role: m.role || (index % 2 === 0 ? 'user' : 'assistant'),
                content: m.content
            }));
            // 构建请求体
            const requestBody = {
                text,
                isFollowUp: !!isFollowUp,
                messages: history
            };
            if (context) {
                requestBody.context = context;
            }
            console.log('=== 发送到后端讲解接口 ===', JSON.stringify(requestBody, null, 2));
            try {
                let fullText = '';
                // 用于 SSE 解析的 buffer
                let sseBuffer = '';
                const utf8Decoder = new UTF8StreamDecoder();
                let chunkCount = 0;
                let parsedEventCount = 0;
                let contentChunkCount = 0;
                let serverErrorCount = 0;
                // 使用 wx.request 的 enableChunkedTransfer 实现流式接收
                // enableChunkedTransfer 和 onChunkReceived 需要基础库 2.20.1+
                // 类型定义可能未包含，使用 as any
                const requestUrl = `${env_1.API_BASE_URL}/api/explanations/stream`;
                console.log('[Explain] request url', requestUrl);
                const requestTask = wx.request({
                    url: requestUrl,
                    method: 'POST',
                    data: requestBody,
                    header: {
                        'Content-Type': 'application/json',
                        ...((0, storage_1.getToken)() ? { 'Authorization': `Bearer ${(0, storage_1.getToken)()}` } : {})
                    },
                    enableChunkedTransfer: true,
                    responseType: 'text',
                    success: (res) => {
                        // 非流式 fallback：如果服务器返回了完整的 JSON 响应
                        if (res.statusCode !== 200) {
                            const errMsg = res.data?.error || `请求失败 (${res.statusCode})`;
                            const finalErrorText = `抱歉，遇到错误: ${errMsg}`;
                            this.finalizeAssistantMessage(msgIndex, finalErrorText);
                            this.setData({
                                loading: false
                            });
                            return;
                        }
                        // 流式模式下，success 回调的 data 可能是完整的文本
                        // 但实际内容已通过 onChunkReceived 处理过了
                        let finalMessageContent = fullText || this.data.messages[msgIndex]?.content || '';
                        let fallbackSource = 'stream';
                        if (!finalMessageContent) {
                            const fallback = this.extractTextFromResponseData(res.data);
                            fallbackSource = fallback.source;
                            if (fallback.content) {
                                finalMessageContent = fallback.content;
                            }
                        }
                        const finalizedMessage = finalMessageContent && !finalMessageContent.includes('抱歉，')
                            ? this.finalizeAssistantMessage(msgIndex, finalMessageContent)
                            : null;
                        console.log('[Explain] request complete', {
                            requestId,
                            statusCode: res.statusCode,
                            chunkCount,
                            parsedEventCount,
                            contentChunkCount,
                            serverErrorCount,
                            responseDataType: typeof res.data,
                            fallbackSource,
                            finalMessageLength: finalMessageContent.length
                        });
                        this.setData({ loading: false });
                        // 验证请求 ID，防止并发缓存错乱
                        if (this.data.currentRequestId === requestId && originalText) {
                            if (finalMessageContent && !finalMessageContent.includes('抱歉，')) {
                                const messagesForCache = [...this.data.messages];
                                messagesForCache[msgIndex] = {
                                    ...(finalizedMessage || this.data.messages[msgIndex] || this.buildAssistantMessage(finalMessageContent, {
                                        displayText: finalMessageContent,
                                        parsedNodes: this.parseContent(finalMessageContent),
                                        isStreaming: false
                                    }))
                                };
                                this.incrUsageCount();
                                this.saveToCache(originalText, messagesForCache);
                            }
                            else {
                                console.warn('Explanation answered error or empty, skip cache.', finalMessageContent);
                            }
                        }
                    },
                    fail: (err) => {
                        console.error('Explanation request error', err);
                        const errorText = `抱歉，网络错误: ${err.errMsg || '请重试'}`;
                        this.finalizeAssistantMessage(msgIndex, errorText);
                        this.setData({
                            loading: false
                        });
                    }
                });
                requestTask.onChunkReceived((response) => {
                    // 检查请求是否已被取消
                    if (this.data.currentRequestId !== requestId) {
                        requestTask.abort();
                        return;
                    }
                    // 将 ArrayBuffer 转为文本，安全处理跨 chunk 的 UTF-8 多字节字符
                    const chunkText = utf8Decoder.decode(response.data);
                    chunkCount += 1;
                    sseBuffer += chunkText;
                    // 按行解析 SSE 数据
                    const lines = sseBuffer.split('\n');
                    // 保留最后一行（可能不完整）
                    sseBuffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed)
                            continue;
                        if (!trimmed.startsWith('data: '))
                            continue;
                        const dataStr = trimmed.slice(6); // 去掉 "data: " 前缀
                        if (dataStr === '[DONE]') {
                            continue;
                        }
                        try {
                            const data = JSON.parse(dataStr);
                            parsedEventCount += 1;
                            const errorMsg = data?.error;
                            if (errorMsg) {
                                serverErrorCount += 1;
                                // 如果后端返回了业务级错误
                                const errMsgStr = `抱歉，服务端返回错误: ${errorMsg}`;
                                this.finalizeAssistantMessage(msgIndex, errMsgStr);
                                requestTask.abort();
                                break;
                            }
                            const textChunk = data?.choices?.[0]?.delta?.content;
                            if (textChunk) {
                                contentChunkCount += 1;
                                const isFirstChunk = fullText === '';
                                fullText += textChunk;
                                const updateData = {};
                                // 第一个 chunk 时滚动到底部
                                if (isFirstChunk) {
                                    updateData.scrollTop = 99999;
                                }
                                this.setData(updateData);
                                this.enqueueStreamingText(textChunk, fullText, msgIndex, requestId);
                            }
                        }
                        catch (e) {
                            // JSON 解析失败，可能是不完整的 chunk，放回 buffer
                            // 注意：只有当前行不完整时才需要放回
                            console.warn('SSE parse warning (may be partial):', {
                                requestId,
                                chunkCount,
                                preview: trimmed.slice(0, 120)
                            });
                        }
                    }
                });
            }
            catch (err) {
                console.error('Explanation request error', err);
                // 添加错误消息
                const errMsgStr = `抱歉，遇到错误: ${err.message || '请重试'}`;
                this.finalizeAssistantMessage(msgIndex, errMsgStr);
                this.setData({
                    loading: false
                });
            }
        },
        parseContent(text) {
            // 使用中文标记和 Markdown 解析内容
            const lines = text.split('\n');
            const nodes = [];
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed)
                    return;
                // 检测中文标记标题：【xxx】
                if (/^【.+】$/.test(trimmed)) {
                    nodes.push({
                        type: 'header',
                        content: trimmed.replace(/^【|】$/g, '')
                    });
                }
                // 检测 Markdown 标题：###
                else if (/^#{1,3}\s+/.test(trimmed)) {
                    nodes.push({
                        type: 'header',
                        content: trimmed.replace(/^#{1,3}\s+/, '')
                    });
                }
                // 检测列表项：1. 或 - 或 *
                else if (/^(\d+\.|-|\*)\s+/.test(trimmed)) {
                    nodes.push({
                        type: 'list-item',
                        content: this.processInlineMarkdown(trimmed)
                    });
                }
                // 普通文本行
                else {
                    nodes.push({
                        type: 'paragraph',
                        content: this.processInlineMarkdown(trimmed)
                    });
                }
            });
            return nodes;
        },
        extractTextFromResponseData(raw) {
            if (raw == null) {
                return { content: '', source: 'empty' };
            }
            if (typeof raw === 'string') {
                const trimmed = raw.trim();
                if (!trimmed) {
                    return { content: '', source: 'empty-string' };
                }
                if (trimmed.includes('data: ')) {
                    let text = '';
                    const lines = trimmed.split('\n');
                    for (const line of lines) {
                        const current = line.trim();
                        if (!current.startsWith('data: '))
                            continue;
                        const dataStr = current.slice(6);
                        if (!dataStr || dataStr === '[DONE]')
                            continue;
                        try {
                            const payload = JSON.parse(dataStr);
                            if (payload?.error) {
                                return { content: `抱歉，服务端返回错误: ${payload.error}`, source: 'sse-error-text' };
                            }
                            const piece = payload?.choices?.[0]?.delta?.content ||
                                payload?.choices?.[0]?.message?.content ||
                                payload?.choices?.[0]?.content ||
                                '';
                            if (piece) {
                                text += piece;
                            }
                        }
                        catch {
                            // 纯兜底解析，不在这里打日志
                        }
                    }
                    return { content: text.trim(), source: 'sse-text' };
                }
                try {
                    return this.extractTextFromResponseData(JSON.parse(trimmed));
                }
                catch {
                    return { content: trimmed, source: 'plain-text' };
                }
            }
            if (typeof raw === 'object') {
                if (raw.error) {
                    return { content: `抱歉，服务端返回错误: ${raw.error}`, source: 'json-error' };
                }
                const content = raw?.choices?.[0]?.message?.content ||
                    raw?.choices?.[0]?.delta?.content ||
                    raw?.choices?.[0]?.content ||
                    raw?.text ||
                    raw?.outputText ||
                    raw?.content ||
                    '';
                return { content: String(content || '').trim(), source: 'json-object' };
            }
            return { content: String(raw).trim(), source: typeof raw };
        },
        // 处理行内 Markdown：**粗体** 和 `代码`
        processInlineMarkdown(text) {
            let result = text;
            // 处理加粗 **text** -> text
            result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
            // 处理加粗 __text__ -> text
            result = result.replace(/__([^_]+)__/g, '$1');
            // 处理斜体 *text* -> text
            result = result.replace(/\*([^*]+)\*/g, '$1');
            // 处理代码 `text` -> text
            result = result.replace(/`([^`]+)`/g, '$1');
            return result;
        },
        handleInput(e) {
            this.setData({
                inputValue: e.detail.value
            });
        },
        handleSend() {
            const content = this.data.inputValue.trim();
            if (!content || this.data.loading)
                return;
            // 先添加用户消息到界面
            const messages = this.data.messages;
            const userMsgIndex = messages.length;
            this.setData({
                inputValue: '',
                [`messages[${userMsgIndex}]`]: {
                    role: 'user',
                    content: content
                },
                scrollToView: `msg-${userMsgIndex}` // 滚动到用户消息位置
            });
            // 检查次数并传入回调接续
            if (!this.checkAndIncrUsage(() => {
                this.requestAI(content, undefined, true);
            }))
                return;
            // 发送请求 (context 传 undefined 表示后续对话，isFollowUp 标记避免重复添加)
            this.requestAI(content, undefined, true);
        }
    }
});
