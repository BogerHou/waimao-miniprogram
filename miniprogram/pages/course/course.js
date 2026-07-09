"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const env_1 = require("../../config/env");
const storage_1 = require("../../utils/storage");
const index_1 = require("../../store/index");
const share_1 = require("../../utils/share");
const shadow_background_handoff_1 = require("./shadow-background-handoff");
const audio_source_fallback_1 = require("./audio-source-fallback");
const course_share_card_1 = require("./course-share-card");
const course_mode_config_1 = require("./course-mode-config");
const dialogue_format_1 = require("../../utils/dialogue-format");
const BACKGROUND_AUDIO_COVER_URL = `${env_1.API_BASE_URL}/static/images/icon.png`;
const COURSE_SHARE_CANVAS_ID = 'course-share-canvas';
const COURSE_SHARE_CANVAS_WIDTH = 600;
const COURSE_SHARE_CANVAS_HEIGHT = 840;
const COURSE_DEBUG_STORAGE_KEY = 'waimao_mini_debug_logs';
function getCourseWindowInfo() {
    const wxCompat = wx;
    return wxCompat.getWindowInfo?.() ?? wx.getSystemInfoSync();
}
function isCourseDebugEnabled() {
    try {
        return Boolean(wx.getStorageSync(COURSE_DEBUG_STORAGE_KEY));
    }
    catch (_error) {
        return false;
    }
}
const nativeConsole = globalThis.console;
const console = {
    log: (...args) => {
        if (isCourseDebugEnabled()) {
            nativeConsole.log(...args);
        }
    },
    warn: (...args) => {
        if (isCourseDebugEnabled()) {
            nativeConsole.warn(...args);
        }
    },
    error: (...args) => {
        if (isCourseDebugEnabled()) {
            nativeConsole.error(...args);
        }
    },
};
const audioRequestLogger = typeof nativeConsole.info === 'function'
    ? nativeConsole.info.bind(nativeConsole)
    : nativeConsole.log.bind(nativeConsole);
function getAudioRequestSource(url) {
    const value = String(url || '');
    if (/^https:\/\/audio\.englishecho\.site\/audio\//.test(value)) {
        return '七牛 CDN 整段';
    }
    if (/^https:\/\/englishecho\.site\/static\/audio-segments\//.test(value)) {
        return '服务器切片';
    }
    if (/^https:\/\/englishecho\.site\/static\/audio\//.test(value)) {
        return '服务器整段';
    }
    if (/^https:\/\/cdn\.jsdmirror\.com\//.test(value)) {
        return 'jsdmirror 整段';
    }
    if (/^https:\/\/audio\.qclawhub\.com\//.test(value)) {
        return 'Cloudflare R2 整段';
    }
    return '其他';
}
function logAudioRequest(event, url, extra = {}) {
    audioRequestLogger('[AudioRequest]', {
        event,
        source: getAudioRequestSource(url),
        url,
        ...extra,
    });
}
function drawShareRoundedRect(ctx, x, y, width, height, radius, fillColor) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
    ctx.closePath();
    ctx.setFillStyle(fillColor);
    ctx.fill();
}
function drawShareWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const content = String(text || '').trim();
    if (!content) {
        return;
    }
    const chars = content.split('');
    const lines = [];
    let current = '';
    for (let i = 0; i < chars.length; i += 1) {
        const next = current + chars[i];
        if (ctx.measureText(next).width <= maxWidth) {
            current = next;
            continue;
        }
        lines.push(current);
        current = chars[i];
        if (lines.length === maxLines - 1) {
            break;
        }
    }
    const consumedLength = lines.join('').length;
    const remaining = content.slice(consumedLength);
    const lastLine = current || remaining;
    if (lines.length < maxLines) {
        lines.push(lastLine);
    }
    const overflow = consumedLength + lastLine.length < content.length;
    if (overflow && lines.length) {
        let finalLine = lines[lines.length - 1];
        while (finalLine && ctx.measureText(`${finalLine}...`).width > maxWidth) {
            finalLine = finalLine.slice(0, -1);
        }
        lines[lines.length - 1] = `${finalLine}...`;
    }
    lines.slice(0, maxLines).forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
    });
}
const formatSeconds = (seconds) => {
    const value = Math.max(0, seconds);
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = Math.floor(value % 60);
    if (h > 0) {
        return `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
    }
    return `${padZero(m)}:${padZero(s)}`;
};
const padZero = (value) => value.toString().padStart(2, '0');
const AUDIO_LOAD_TIMEOUT_MS = 10000;
Page({
    data: {
        course: null,
        subtitles: [],
        loading: false,
        error: null,
        currentSubtitleId: null,
        playing: false,
        scrollIntoView: '',
        scrollTop: 0,
        leadText: '',
        playMode: 'echo',
        playbackRate: 1,
        showSpeedModal: false,
        speedPresets: [0.5, 0.75, 1, 1.25, 1.5, 2],
        isRepeating: false,
        repeatCount: 0,
        repeatTarget: 10,
        transcriptMode: 'all',
        showAiPopup: false,
        aiText: '',
        aiContext: '',
        audioLoading: true, // 默认音频加载中
        wordPopupVisible: false,
        wordPopupWord: '',
        wordPopupDefinition: '',
        wordPopupPhoneticUk: '',
        wordPopupPhoneticUs: '',
        wordPopupAudioUk: '',
        wordPopupAudioUs: '',
        wordPopupLeft: 0,
        wordPopupTop: 0,
        wordPopupPlacement: 'top',
        wordPopupLoading: false,
        wordPopupError: '',
        wordPopupReady: false,
        shareImageUrl: '',
        showModeSelector: true,
        showShadowMode: true,
        showPracticeControls: false,
    },
    courseId: '',
    // InnerAudioContext (用于 Shadow 模式)
    audioContext: null,
    audioSource: '',
    wordAudioContext: null,
    pendingWordLookup: '',
    wordTapLockUntil: 0,
    activeSubtitle: null,
    audioReady: false,
    pendingSubtitle: null,
    stopTimer: null,
    // Shadow模式音频降级：服务器备用地址
    serverAudioUrl: '',
    usingFallbackAudio: false,
    audioSourceOptions: [],
    activeAudioSourceProvider: '',
    // 其他
    storeUnsubscribe: undefined,
    studySessionStart: null,
    currentSubtitleIndex: 0,
    trackingTimer: null,
    backgroundAudioManager: null,
    shadowHandoffState: null,
    backgroundPlaybackActive: false,
    isRecoveringFromBackground: false,
    pendingBackgroundAudioRestore: false,
    pendingShadowResume: null,
    pendingShadowSeek: null,
    lastEchoCompletion: null,
    lastKnownCourseTime: 0,
    audioLoadTimeoutTimer: null,
    audioRequestStartedAt: 0,
    backgroundAudioRequestStartedAt: 0,
    audioLoadingMaskVisible: false,
    pendingAudioLoadSource: '',
    suppressMainAudioContextEvents: false,
    swipeStartX: null,
    swipeStartY: null,
    swipeTriggered: false,
    wordPopupBounds: null,
    courseRange: null,
    knowledgeContext: '',
    completionSyncing: false,
    debugShadowBackground(stage, extra) {
        const manager = this.backgroundAudioManager;
        console.log('[ShadowBG]', stage, {
            courseId: this.courseId,
            playMode: this.data.playMode,
            playing: this.data.playing,
            currentSubtitleId: this.data.currentSubtitleId,
            activeSubtitleId: this.activeSubtitle?.id ?? null,
            audioCurrentTime: this.audioContext?.currentTime,
            audioSource: this.audioSource,
            backgroundCurrentTime: manager?.currentTime,
            backgroundPaused: manager?.paused,
            backgroundSrc: manager?.src,
            backgroundPlaybackActive: this.backgroundPlaybackActive,
            hasHandoffState: !!this.shadowHandoffState,
            handoffState: this.shadowHandoffState,
            lastKnownCourseTime: this.lastKnownCourseTime,
            isRecoveringFromBackground: this.isRecoveringFromBackground,
            pendingShadowResume: this.pendingShadowResume,
            ...extra,
        });
    },
    shouldIgnoreMainAudioContextEvent() {
        return this.suppressMainAudioContextEvents || this.data.playMode === 'shadow';
    },
    clampCourseTimeToScene(courseTime, options = {}) {
        const safeTime = Math.max(0, Number(courseTime) || 0);
        const range = this.courseRange;
        if (!range) {
            return safeTime;
        }
        if (options.restartWhenPastEnd && safeTime >= range.end - 0.1) {
            return range.start;
        }
        return Math.min(Math.max(safeTime, range.start), range.end);
    },
    hasReachedSceneEnd(courseTime) {
        const range = this.courseRange;
        return Boolean(range && courseTime >= range.end - 0.08);
    },
    finishScenePlayback(showToast = false) {
        this.pauseShadowPlayback();
        this.stopTracking();
        this.setData({
            playing: false,
            isRepeating: false,
            repeatCount: 0,
            audioLoading: false,
        });
        this.lastKnownCourseTime = this.courseRange?.end ?? this.lastKnownCourseTime;
        void this.markSceneCompleted('scene-end');
        if (showToast) {
            wx.showToast({
                title: '本小节播放完成',
                icon: 'success',
            });
        }
    },
    getProgressCueIndex() {
        const subtitles = this.data.subtitles;
        const totalCues = subtitles.length;
        if (totalCues <= 0) {
            return 0;
        }
        const preferredSubtitleId = this.lastEchoCompletion?.subtitleId ||
            this.activeSubtitle?.id ||
            this.data.currentSubtitleId;
        const subtitleIndex = preferredSubtitleId
            ? subtitles.findIndex(subtitle => subtitle.id === preferredSubtitleId)
            : -1;
        if (subtitleIndex >= 0) {
            return subtitleIndex;
        }
        return Math.min(Math.max(this.currentSubtitleIndex, 0), totalCues - 1);
    },
    buildCompletionProgressPayload() {
        const totalCues = this.data.subtitles.length;
        return {
            totalCues,
            cueIndex: totalCues > 0
                ? Math.max(this.getProgressCueIndex(), totalCues - 1)
                : 0,
        };
    },
    scheduleCourseShareImage: (0, storage_1.debounce)(function () {
        void this.generateCourseShareImage();
    }, 280),
    scheduleSceneProgressSync: (0, storage_1.debounce)(function () {
        void this.syncCurrentSceneProgress('debounced');
    }, 1200),
    getCourseShareSnippetText() {
        const currentSubtitleId = this.data.currentSubtitleId;
        if (currentSubtitleId) {
            const currentSubtitle = this.data.subtitles.find(subtitle => subtitle.id === currentSubtitleId);
            if (currentSubtitle?.text) {
                return currentSubtitle.text;
            }
        }
        return this.data.leadText || '';
    },
    async generateCourseShareImage() {
        if (!this.data.course || this.data.loading || this.data.error) {
            return;
        }
        const card = (0, course_share_card_1.buildCourseShareCardModel)({
            title: this.data.course.title,
            tag: this.data.course.tag,
            playMode: this.data.playMode,
            currentText: this.getCourseShareSnippetText(),
            leadText: this.data.leadText,
        });
        const ctx = wx.createCanvasContext(COURSE_SHARE_CANVAS_ID);
        const width = COURSE_SHARE_CANVAS_WIDTH;
        const height = COURSE_SHARE_CANVAS_HEIGHT;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#F8FBFF');
        gradient.addColorStop(1, '#EAF2FF');
        ctx.setFillStyle(gradient);
        ctx.fillRect(0, 0, width, height);
        ctx.setFillStyle('#DCE8FF');
        ctx.beginPath();
        ctx.arc(width - 70, 92, 96, 0, Math.PI * 2);
        ctx.fill();
        ctx.setFillStyle('#C7DBFF');
        ctx.beginPath();
        ctx.arc(96, height - 120, 72, 0, Math.PI * 2);
        ctx.fill();
        drawShareRoundedRect(ctx, 40, 56, width - 80, height - 112, 28, '#FFFFFF');
        drawShareRoundedRect(ctx, 72, 92, 140, 42, 21, '#E8F1FF');
        ctx.setFillStyle('#2563EB');
        ctx.setFontSize(22);
        ctx.fillText(card.modeLabel, 104, 120);
        drawShareRoundedRect(ctx, width - 210, 92, 138, 42, 21, '#EEF2FF');
        ctx.setFillStyle('#4B5563');
        ctx.setFontSize(20);
        ctx.fillText(card.tagLabel, width - 184, 120);
        ctx.setFillStyle('#111827');
        ctx.setFontSize(38);
        drawShareWrappedText(ctx, card.title, 72, 190, width - 144, 54, 2);
        ctx.setFillStyle('#6B7280');
        ctx.setFontSize(22);
        ctx.fillText('当前课程内容', 72, 288);
        drawShareRoundedRect(ctx, 72, 320, width - 144, 246, 24, '#F8FAFC');
        ctx.setFillStyle('#1F2937');
        ctx.setFontSize(30);
        drawShareWrappedText(ctx, card.snippet, 104, 378, width - 208, 48, 4);
        ctx.setFillStyle('#94A3B8');
        ctx.setFontSize(22);
        ctx.fillText('外贸英语影子跟读', 72, height - 134);
        ctx.setFillStyle('#3B82F6');
        ctx.setFontSize(26);
        ctx.fillText('打开小程序，继续当前课程', 72, height - 88);
        try {
            await new Promise(resolve => {
                ctx.draw(false, () => resolve());
            });
            const tempFilePath = await new Promise((resolve, reject) => {
                wx.canvasToTempFilePath({
                    canvasId: COURSE_SHARE_CANVAS_ID,
                    width,
                    height,
                    destWidth: width * 2,
                    destHeight: height * 2,
                    fileType: 'png',
                    success: res => resolve(res.tempFilePath),
                    fail: reject,
                }, this);
            });
            this.setData({
                shareImageUrl: tempFilePath,
            });
        }
        catch (error) {
            console.warn('[Share] generate course share image failed', error);
        }
    },
    updateShadowCourseTimeFromManager(observedTime) {
        this.lastKnownCourseTime = this.clampCourseTimeToScene((0, shadow_background_handoff_1.resolveObservedShadowCourseTime)({
            observedTime,
            lastKnownCourseTime: this.lastKnownCourseTime,
            pendingTargetTime: this.pendingShadowSeek?.targetTime,
        }));
        return this.lastKnownCourseTime;
    },
    markEchoCompletionProgress(reason) {
        if (this.data.playMode !== 'echo' || !this.activeSubtitle) {
            return this.lastKnownCourseTime;
        }
        const completionTime = Math.max(this.lastKnownCourseTime, this.activeSubtitle.end);
        this.lastKnownCourseTime = completionTime;
        this.lastEchoCompletion = {
            subtitleId: this.activeSubtitle.id,
            courseTime: completionTime,
        };
        const subtitleIndex = this.data.subtitles.findIndex(subtitle => subtitle.id === this.activeSubtitle?.id);
        if (this.data.subtitles.length > 0 && subtitleIndex === this.data.subtitles.length - 1) {
            void this.markSceneCompleted('echo-last-subtitle');
        }
        console.log('[Audio] 记录 Echo 完成进度', {
            reason,
            subtitleId: this.activeSubtitle.id,
            completionTime,
        });
        return completionTime;
    },
    showAudioLoadingMask() {
        if (this.audioLoadingMaskVisible) {
            return;
        }
        this.audioLoadingMaskVisible = true;
        wx.showLoading({
            title: '音频加载中...',
            mask: true,
        });
    },
    hideAudioLoadingMask() {
        if (!this.audioLoadingMaskVisible) {
            return;
        }
        this.audioLoadingMaskVisible = false;
        wx.hideLoading();
    },
    setAudioLoading(isLoading) {
        if (this.data.audioLoading !== isLoading) {
            this.setData({ audioLoading: isLoading });
        }
        if (isLoading) {
            this.showAudioLoadingMask();
        }
        else {
            this.hideAudioLoadingMask();
        }
    },
    syncPendingShadowSeek(reason) {
        const pending = this.pendingShadowSeek;
        if (!pending) {
            return true;
        }
        const manager = this.ensureBackgroundAudioManager();
        const observedTime = typeof manager.currentTime === 'number' ? manager.currentTime : 0;
        const stableTime = this.updateShadowCourseTimeFromManager(observedTime);
        const currentSrc = String(manager.src || '');
        const shouldCorrect = (0, shadow_background_handoff_1.shouldApplyShadowSeekCorrection)({
            currentTime: observedTime,
            targetTime: pending.targetTime,
            tolerance: 0.35,
        });
        this.debugShadowBackground('sync pending shadow seek', {
            reason,
            observedTime,
            stableTime,
            pendingTargetTime: pending.targetTime,
            pendingShouldAutoplay: pending.shouldAutoplay,
            pendingSrc: pending.src,
            currentSrc,
            shouldCorrect,
        });
        if (pending.src && currentSrc && currentSrc !== pending.src) {
            return false;
        }
        if (shouldCorrect) {
            try {
                manager.seek(pending.targetTime);
            }
            catch (error) {
                this.debugShadowBackground('shadow seek correction failed', {
                    reason,
                    error,
                    targetTime: pending.targetTime,
                });
            }
            if (!pending.shouldAutoplay && typeof manager.pause === 'function') {
                try {
                    manager.pause();
                }
                catch (_error) {
                    // ignore
                }
            }
            return false;
        }
        if (pending.shouldAutoplay && typeof manager.play === 'function' && manager.paused) {
            try {
                manager.play();
            }
            catch (_error) {
                // ignore
            }
        }
        else if (!pending.shouldAutoplay && typeof manager.pause === 'function' && !manager.paused) {
            try {
                manager.pause();
            }
            catch (_error) {
                // ignore
            }
        }
        this.pendingShadowSeek = null;
        if (this.data.audioLoading) {
            this.setAudioLoading(false);
        }
        return true;
    },
    onLoad(query) {
        (0, share_1.enablePageShareMenu)();
        const id = query?.id;
        if (!id) {
            this.setData({
                error: 'Course id not found',
            });
            return;
        }
        this.courseId = id;
        this.pendingBackgroundAudioRestore = query?.fromBackgroundAudio === '1';
        this.storeUnsubscribe = (0, index_1.subscribe)(state => this.handleStoreUpdate(state));
        this.handleStoreUpdate((0, index_1.getState)());
        this.loadCourse(id);
    },
    // 清除 AI 讲解缓存
    clearAiExplainCache() {
        try {
            const keys = wx.getStorageInfoSync().keys;
            const aiKeys = keys.filter(k => k.startsWith('ai_explain_'));
            aiKeys.forEach(key => {
                wx.removeStorageSync(key);
            });
            if (aiKeys.length > 0) {
                console.log(`已清除 ${aiKeys.length} 条 AI 讲解缓存`);
            }
        }
        catch (e) {
            console.warn('清除 AI 缓存失败', e);
        }
    },
    onShow() {
        this.beginStudySession();
        this.debugShadowBackground('onShow');
        this.handleForegroundReturn();
    },
    onHide() {
        void this.syncCurrentSceneProgress('hide');
        void this.finalizeStudySession(false); // 使用防抖
        this.debugShadowBackground('onHide');
        this.handleBackgroundHandoff();
    },
    onUnload() {
        this.debugShadowBackground('onUnload');
        void this.syncCurrentSceneProgress('unload');
        void this.finalizeStudySession(true); // 立即上报，不防抖
        this.stopBackgroundPlayback(true);
        this.destroyAudioContext();
        this.destroyWordAudioContext();
        this.hideAudioLoadingMask();
        this.storeUnsubscribe?.();
        this.stopTracking();
        // 退出页面时清除 AI 讲解缓存
        this.clearAiExplainCache();
    },
    onShareAppMessage() {
        const title = this.data.course?.title
            ? `${this.data.course.title} | 外贸英语影子跟读`
            : '外贸英语影子跟读';
        const path = this.courseId
            ? `/pages/course/course?id=${this.courseId}`
            : '/pages/index/index';
        return (0, share_1.buildAppMessageShare)({
            title,
            path,
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    onShareTimeline() {
        const title = this.data.course?.title
            ? `${this.data.course.title} | 外贸英语影子跟读`
            : '外贸英语影子跟读';
        const query = this.courseId ? `id=${this.courseId}` : '';
        return (0, share_1.buildTimelineShare)({
            title,
            query,
            imageUrl: this.data.shareImageUrl || undefined,
        });
    },
    async loadCourse(id) {
        this.courseRange = null;
        this.knowledgeContext = '';
        this.setData({
            loading: true,
            error: null,
        });
        try {
            const detail = await (0, api_1.fetchCourseDetail)(id);
            const appConfig = (0, index_1.getState)().appConfig;
            const modePresentation = (0, course_mode_config_1.resolveCourseModePresentation)({
                currentPlayMode: this.data.playMode,
                shadowModeEnabled: appConfig.courseDetail.shadowModeEnabled,
            });
            // 音频策略：按服务端配置选择音频源，默认七牛 -> mirror -> 服务器
            const serverAudio = normalizeAudioUrl(detail.audio);
            const audioSourceConfig = (0, audio_source_fallback_1.normalizeAudioSourceConfig)(appConfig.courseDetail.audioSource);
            const audioSources = (0, audio_source_fallback_1.buildAudioSourceOptions)(serverAudio, audioSourceConfig);
            const selectedAudioSource = audioSources[0] ?? {
                provider: 'server',
                url: serverAudio,
            };
            // 存储服务器地址作为备用
            this.serverAudioUrl = serverAudio;
            this.usingFallbackAudio = false;
            this.audioSourceOptions = audioSources;
            this.activeAudioSourceProvider = selectedAudioSource.provider;
            const audio = selectedAudioSource.url;
            logAudioRequest('course:audio-source-selected', audio, {
                courseId: id,
                provider: selectedAudioSource.provider,
                priority: audioSourceConfig.priority,
            });
            const subtitles = mapSubtitles(detail.subtitles);
            const courseRange = normalizeCourseRange(detail, subtitles);
            const leadText = subtitles[0]?.text ?? '';
            this.courseRange = courseRange;
            this.knowledgeContext = buildKnowledgeContext(detail);
            this.setData({
                course: {
                    id: detail.id,
                    title: detail.title,
                    tag: detail.tag,
                    audio,
                },
                subtitles,
                loading: false,
                leadText,
                scrollIntoView: '',
                scrollTop: 0,
                shareImageUrl: '',
                showModeSelector: modePresentation.showModeSelector,
                showShadowMode: modePresentation.showShadowMode,
                showPracticeControls: modePresentation.showPracticeControls,
                playMode: modePresentation.effectivePlayMode,
            });
            // 只读模式不初始化课程音频，避免隐藏播放入口时仍产生音频请求。
            if (modePresentation.showPracticeControls) {
                this.ensureAudioContext(audio);
            }
            else {
                this.destroyAudioContext();
                this.setAudioLoading(false);
            }
            this.handleStoreUpdate((0, index_1.getState)());
            void this.syncCurrentSceneProgress('load');
            this.scheduleCourseShareImage();
            const restoredFromBackgroundAudio = modePresentation.showPracticeControls && this.pendingBackgroundAudioRestore
                ? this.restoreBackgroundAudioFromStorage()
                : false;
            if (!modePresentation.showPracticeControls) {
                this.pendingBackgroundAudioRestore = false;
            }
            // 影子跟读模式自动开始播放
            if (!restoredFromBackgroundAudio && modePresentation.effectivePlayMode === 'shadow' && subtitles.length > 0) {
                setTimeout(() => {
                    this.startShadowMode();
                }, 500);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load course, please retry.';
            this.setData({
                loading: false,
                error: message,
            });
            this.setAudioLoading(false);
        }
    },
    async markSceneCompleted(_reason) {
        const state = (0, index_1.getState)();
        if (!state.token || !this.courseId || !this.data.course || this.completionSyncing) {
            return;
        }
        this.completionSyncing = true;
        try {
            const response = await (0, api_1.updateUserProgress)(this.courseId, 'completed', this.buildCompletionProgressPayload());
            (0, index_1.setUser)(response.user);
            (0, index_1.setProgress)(response.progress);
        }
        catch (error) {
            console.warn('[Progress] auto complete scene failed', error);
        }
        finally {
            this.completionSyncing = false;
        }
    },
    async syncCurrentSceneProgress(_reason) {
        const state = (0, index_1.getState)();
        if (!state.token || !this.courseId || !this.data.course || this.data.loading) {
            return;
        }
        try {
            const response = await (0, api_1.recordUserProgress)(this.courseId, {
                totalCues: this.data.subtitles.length,
                cueIndex: this.getProgressCueIndex(),
            });
            (0, index_1.setUser)(response.user);
            (0, index_1.setProgress)(response.progress);
        }
        catch (error) {
            console.warn('[Progress] sync current scene failed', error);
        }
    },
    ensureAudioContext(src) {
        if (!src) {
            this.destroyAudioContext();
            return;
        }
        if (!this.audioContext) {
            console.log('[Audio] 创建新的音频上下文');
            const audioContext = wx.createInnerAudioContext();
            audioContext.autoplay = false;
            audioContext.obeyMuteSwitch = false;
            audioContext.playbackRate = this.data.playbackRate;
            audioContext.onPlay(() => {
                if (this.shouldIgnoreMainAudioContextEvent()) {
                    console.log('[Audio] 忽略 InnerAudio onPlay（shadow 模式）');
                    return;
                }
                console.log(`[Audio] 开始播放，currentTime=${audioContext.currentTime.toFixed(2)}`);
                this.lastKnownCourseTime = audioContext.currentTime;
                this.setData({ playing: true });
                // Shadow 模式：设置停止定时器（作为备用）
                // Echo 模式使用 M4A 片段会自然结束，不需要 stopTimer
                if (this.data.playMode === 'shadow' && this.data.isRepeating && this.activeSubtitle) {
                    // 清除旧的定时器
                    if (this.stopTimer) {
                        clearTimeout(this.stopTimer);
                    }
                    // 使用 activeSubtitle 的范围，而不是 currentTime
                    // 因为 seek 可能还没完全更新 currentTime
                    const subtitleStart = this.activeSubtitle.start;
                    const subtitleEnd = this.activeSubtitle.end;
                    const totalDuration = subtitleEnd - subtitleStart;
                    const playDuration = totalDuration / this.data.playbackRate;
                    // 备用定时器：如果 onTimeUpdate 失效，这个可以兜底
                    const compensation = 0.5; // 500ms补偿
                    const adjustedDuration = playDuration + compensation;
                    console.log(`[Audio] onPlay设置备用定时器: 段落${subtitleStart.toFixed(3)}-${subtitleEnd.toFixed(3)}s`);
                    console.log(`[Audio] 总时长${totalDuration.toFixed(3)}s, 播放${playDuration.toFixed(3)}s, 补偿后${adjustedDuration.toFixed(3)}s`);
                    this.stopTimer = setTimeout(() => {
                        if (this.audioContext) {
                            const finalTime = this.audioContext.currentTime;
                            console.log(`[Audio] 备用定时器触发`);
                            console.log(`[Audio] 当前currentTime: ${finalTime.toFixed(3)}s, 预期结束: ${subtitleEnd.toFixed(3)}s`);
                            this.audioContext.pause();
                            this.handleAudioPause();
                        }
                        this.stopTimer = null;
                        // 重复模式：检查是否继续重复
                        if (this.data.isRepeating && this.activeSubtitle) {
                            this.handleRepeatNext(this.activeSubtitle);
                        }
                    }, adjustedDuration * 1000);
                }
                // 影子跟读模式下启动定时器（包括重复模式）
                if (this.data.playMode === 'shadow') {
                    this.startTracking();
                }
            });
            audioContext.onPause(() => {
                if (this.shouldIgnoreMainAudioContextEvent()) {
                    console.log('[Audio] 忽略 InnerAudio onPause（shadow 模式）');
                    return;
                }
                console.log(`[Audio] 暂停播放，currentTime=${audioContext.currentTime.toFixed(2)}`);
                this.lastKnownCourseTime =
                    this.data.playMode === 'echo'
                        ? (0, shadow_background_handoff_1.resolveCourseTimeFromForeground)({
                            audioCurrentTime: audioContext.currentTime,
                            activeSubtitle: this.activeSubtitle,
                            lastKnownCourseTime: this.lastKnownCourseTime,
                        })
                        : audioContext.currentTime;
                this.handleAudioPause();
                // 暂停时也停止跟踪，但会在下次播放时重新启动
                // seekAndPlay 会调用 pause() 然后立即 play()，play() 会重新启动定时器
                this.stopTracking();
            });
            audioContext.onStop(() => {
                if (this.shouldIgnoreMainAudioContextEvent()) {
                    console.log('[Audio] 忽略 InnerAudio onStop（shadow 模式）');
                    return;
                }
                console.log('[Audio] 停止播放');
                this.lastKnownCourseTime =
                    this.data.playMode === 'echo'
                        ? (0, shadow_background_handoff_1.resolveCourseTimeFromForeground)({
                            audioCurrentTime: audioContext.currentTime,
                            activeSubtitle: this.activeSubtitle,
                            lastKnownCourseTime: this.lastKnownCourseTime,
                        })
                        : audioContext.currentTime;
                this.handleAudioPause();
                this.stopTracking();
            });
            audioContext.onEnded(() => {
                if (this.shouldIgnoreMainAudioContextEvent()) {
                    console.log('[Audio] 忽略 InnerAudio onEnded（shadow 模式）');
                    return;
                }
                console.log('[Audio] 播放结束');
                this.setData({ playing: false });
                // Echo 模式：M4A 片段播放完成
                if (this.data.playMode === 'echo') {
                    this.markEchoCompletionProgress('onEnded');
                    // 如果开启了重复模式，继续重复
                    if (this.data.isRepeating && this.activeSubtitle) {
                        this.handleRepeatNext(this.activeSubtitle);
                    }
                    return;
                }
                // Shadow 模式：onEnded 只在整个音频文件播放完才触发
                // 重复模式由 stopTimer 处理，所以这里只处理正常的音频结束
                // 如果是重复模式，不应该到这里，因为 stopTimer 会在段落结束时暂停
                // 如果到了这里，说明可能是用户手动操作或异常情况
                if (this.data.isRepeating) {
                    this.setData({
                        isRepeating: false,
                        repeatCount: 0,
                    });
                }
                // 影子跟读模式：音频播放完整结束
                if (this.data.playMode === 'shadow') {
                    this.handleAudioPause();
                    this.stopTracking();
                    wx.showToast({
                        title: '全部播放完成',
                        icon: 'success',
                    });
                    this.setData({
                        currentSubtitleId: null,
                    });
                }
                else {
                    this.handleAudioPause();
                }
            });
            audioContext.onCanplay(() => {
                if (this.shouldIgnoreMainAudioContextEvent()) {
                    console.log('[Audio] 忽略 InnerAudio onCanplay（shadow 模式）');
                    return;
                }
                const elapsedMs = this.audioRequestStartedAt
                    ? Date.now() - this.audioRequestStartedAt
                    : null;
                logAudioRequest('inneraudio:onCanplay', this.audioSource || audioContext.src || '', {
                    courseId: this.courseId,
                    playMode: this.data.playMode,
                    elapsedMs,
                    duration: audioContext.duration,
                });
                console.log('[Audio] 可以播放，duration=' + audioContext.duration);
                this.audioReady = true;
                this.clearAudioLoadTimeout();
                // 清除音频加载中状态
                if (this.data.audioLoading) {
                    this.setAudioLoading(false);
                }
                // 重新设置播放速度，防止切换音频源后速度被重置
                audioContext.playbackRate = this.data.playbackRate;
                // ✅ 关键修复：访问 paused 属性以重新激活 onTimeUpdate
                void audioContext.paused;
                if (this.pendingShadowResume) {
                    const pendingShadowResume = this.pendingShadowResume;
                    this.pendingShadowResume = null;
                    this.resumeForegroundShadowPlayback(pendingShadowResume.courseTime, pendingShadowResume.shouldAutoplay);
                    return;
                }
                if (this.pendingSubtitle) {
                    console.log('[Audio] 执行pending的字幕播放');
                    this.seekAndPlay(this.pendingSubtitle);
                    this.pendingSubtitle = null;
                }
            });
            // onTimeUpdate 用于精确的段落结束检测（仅 Shadow 模式需要）
            audioContext.onTimeUpdate(() => {
                if (this.shouldIgnoreMainAudioContextEvent()) {
                    return;
                }
                this.lastKnownCourseTime = audioContext.currentTime;
                // Shadow 模式且开启重复：实时检测是否到达段落结束位置
                // Echo 模式的 M4A 片段会自然结束，不需要检测
                if (this.data.playMode === 'shadow' && this.data.isRepeating && this.activeSubtitle) {
                    const currentTime = audioContext.currentTime;
                    const subtitleEnd = this.activeSubtitle.end;
                    // 到达或超过结束位置，立即停止
                    if (currentTime >= subtitleEnd) {
                        console.log(`[onTimeUpdate] ✅ 到达段落结束: currentTime=${currentTime.toFixed(3)}s >= end=${subtitleEnd.toFixed(3)}s`);
                        audioContext.pause();
                        this.handleAudioPause();
                        // 清除定时器（如果还在）
                        if (this.stopTimer) {
                            clearTimeout(this.stopTimer);
                            this.stopTimer = null;
                        }
                        // 重复模式：检查是否继续重复
                        if (this.data.isRepeating && this.activeSubtitle) {
                            this.handleRepeatNext(this.activeSubtitle);
                        }
                    }
                }
            });
            audioContext.onError(err => {
                if (this.shouldIgnoreMainAudioContextEvent()) {
                    console.log('[Audio] 忽略 InnerAudio onError（shadow 模式）', err);
                    return;
                }
                logAudioRequest('inneraudio:onError', this.audioSource || audioContext.src || '', {
                    courseId: this.courseId,
                    playMode: this.data.playMode,
                    errCode: err.errCode,
                    errMsg: err.errMsg,
                });
                console.error('[Audio] 播放错误代码:', err.errCode);
                console.error('[Audio] 播放错误消息:', err.errMsg);
                this.clearAudioLoadTimeout();
                // 🚀 CDN加载失败时降级处理
                const currentSource = this.audioSource || audioContext.src || '';
                if (this.fallbackToNextAudioSource('error', currentSource)) {
                    return;
                }
                if (!this.usingFallbackAudio && this.data.playMode === 'echo' && this.activeSubtitle && this.data.course) {
                    // Echo模式：切换到服务器切片音频
                    console.log('[Audio] Echo模式：切换到服务器切片');
                    const segmentUrl = `${env_1.API_BASE_URL}/static/audio-segments/${this.data.course.id}/segment_${this.activeSubtitle.id}.m4a`;
                    console.log('[Audio] Echo切片地址:', segmentUrl);
                    logAudioRequest('echo:error-fallback-segment:set-src', segmentUrl, {
                        courseId: this.data.course.id,
                        subtitleId: this.activeSubtitle.id,
                        playMode: this.data.playMode,
                    });
                    if (this.audioContext) {
                        this.audioContext.stop();
                        this.audioContext.src = segmentUrl;
                        this.audioRequestStartedAt = Date.now();
                        this.audioContext.startTime = 0;
                        this.audioSource = segmentUrl;
                        this.audioContext.play();
                    }
                }
                let tip = err.errMsg || '播放失败';
                if (err.errCode === 10001)
                    tip = '系统错误 (iOS 格式或压缩问题)';
                if (err.errCode === 10002)
                    tip = '网络错误';
                if (err.errCode === 10004)
                    tip = '格式错误';
                if (this.data.audioLoading) {
                    this.setAudioLoading(false);
                }
                wx.showToast({
                    title: tip,
                    icon: 'none',
                });
            });
            this.audioContext = audioContext;
        }
        if (this.audioSource !== src && this.audioContext) {
            console.log(`[Audio] 加载新音频: ${src}`);
            logAudioRequest('inneraudio:set-src', src, {
                courseId: this.courseId,
                playMode: this.data.playMode,
            });
            this.audioReady = false;
            this.pendingSubtitle = null;
            this.clearAudioLoadTimeout();
            this.pendingAudioLoadSource = src;
            this.setAudioLoading(true);
            this.audioContext.stop();
            this.audioContext.src = src;
            this.audioRequestStartedAt = Date.now();
            this.audioSource = src;
            this.scheduleAudioLoadTimeout(src);
        }
    },
    destroyAudioContext() {
        this.clearAudioLoadTimeout();
        if (this.audioContext) {
            this.audioContext.stop();
            this.audioContext.destroy();
            this.audioContext = null;
        }
        this.audioSource = '';
        this.audioReady = false;
        this.pendingSubtitle = null;
        this.activeSubtitle = null;
        if (this.stopTimer) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }
        this.stopTracking();
    },
    destroyWordAudioContext() {
        if (this.wordAudioContext) {
            this.wordAudioContext.stop();
            this.wordAudioContext.destroy();
            this.wordAudioContext = null;
        }
    },
    clearAudioLoadTimeout() {
        if (this.audioLoadTimeoutTimer) {
            clearTimeout(this.audioLoadTimeoutTimer);
            this.audioLoadTimeoutTimer = null;
        }
        this.pendingAudioLoadSource = '';
    },
    scheduleAudioLoadTimeout(src) {
        this.clearAudioLoadTimeout();
        if (!(0, audio_source_fallback_1.isCdnAudioUrl)(src)) {
            return;
        }
        this.pendingAudioLoadSource = src;
        console.log('[Audio] 启动 CDN 加载超时计时器', {
            src,
            timeoutMs: AUDIO_LOAD_TIMEOUT_MS,
        });
        this.audioLoadTimeoutTimer = setTimeout(() => {
            const currentSource = this.audioSource || this.audioContext?.src || '';
            const nextAudioSource = (0, audio_source_fallback_1.getNextAudioSourceOption)({
                timedOutSource: src,
                currentSource,
                audioSources: this.audioSourceOptions,
            });
            console.warn('[Audio] CDN 加载超时检查', {
                timedOutSource: src,
                currentSource,
                nextProvider: nextAudioSource?.provider ?? null,
                nextSource: nextAudioSource?.url ?? null,
                audioReady: this.audioReady,
            });
            this.audioLoadTimeoutTimer = null;
            this.pendingAudioLoadSource = '';
            if (nextAudioSource) {
                this.fallbackToNextAudioSource('timeout', src);
            }
        }, AUDIO_LOAD_TIMEOUT_MS);
    },
    fallbackToNextAudioSource(reason, source) {
        const currentSource = this.audioSource || this.audioContext?.src || '';
        const nextAudioSource = (0, audio_source_fallback_1.getNextAudioSourceOption)({
            timedOutSource: source,
            currentSource,
            audioSources: this.audioSourceOptions,
        });
        console.warn('[Audio] 尝试切换到下一个音频源', {
            reason,
            source,
            currentSource,
            nextProvider: nextAudioSource?.provider ?? null,
            nextSource: nextAudioSource?.url ?? null,
        });
        if (!nextAudioSource) {
            return false;
        }
        const activeSubtitle = this.activeSubtitle ? { ...this.activeSubtitle } : null;
        const pendingSubtitle = this.pendingSubtitle ? { ...this.pendingSubtitle } : null;
        const wasPlaying = this.data.playing;
        this.activeAudioSourceProvider = nextAudioSource.provider;
        this.usingFallbackAudio = nextAudioSource.provider === 'server';
        this.clearAudioLoadTimeout();
        if (this.data.course) {
            this.setData({
                course: {
                    ...this.data.course,
                    audio: nextAudioSource.url
                }
            });
        }
        this.setAudioLoading(true);
        this.destroyAudioContext();
        logAudioRequest(`fallback:${nextAudioSource.provider}:set-src`, nextAudioSource.url, {
            courseId: this.courseId,
            reason,
            fromSource: source,
        });
        this.ensureAudioContext(nextAudioSource.url);
        const resumeSubtitle = activeSubtitle || pendingSubtitle;
        if (resumeSubtitle && this.audioContext) {
            this.pendingSubtitle = resumeSubtitle;
            if (wasPlaying) {
                console.log('[Audio] 服务器音频准备接管后续播放', {
                    subtitleId: resumeSubtitle.id,
                    reason,
                });
                this.audioContext.play();
            }
        }
        return true;
    },
    ensureBackgroundAudioManager() {
        if (this.backgroundAudioManager) {
            this.debugShadowBackground('reuse background manager');
            return this.backgroundAudioManager;
        }
        const manager = wx.getBackgroundAudioManager();
        this.debugShadowBackground('create background manager');
        manager.onPlay(() => {
            this.debugShadowBackground('background onPlay');
            this.updateShadowCourseTimeFromManager(typeof manager.currentTime === 'number' ? manager.currentTime : undefined);
            this.syncPendingShadowSeek('onPlay');
            if (this.data.playMode === 'shadow') {
                this.setData({ playing: true });
                this.startTracking();
            }
            if (this.shadowHandoffState?.active) {
                this.backgroundPlaybackActive = true;
                this.shadowHandoffState = {
                    ...this.shadowHandoffState,
                    wasPlaying: true,
                };
            }
        });
        manager.onPause(() => {
            this.debugShadowBackground('background onPause');
            this.updateShadowCourseTimeFromManager(typeof manager.currentTime === 'number' ? manager.currentTime : undefined);
            if (this.data.playMode === 'shadow') {
                this.handleAudioPause();
                this.stopTracking();
            }
            if (this.shadowHandoffState?.active) {
                this.shadowHandoffState = {
                    ...this.shadowHandoffState,
                    wasPlaying: false,
                };
            }
        });
        manager.onStop(() => {
            this.debugShadowBackground('background onStop');
            this.updateShadowCourseTimeFromManager(typeof manager.currentTime === 'number' ? manager.currentTime : undefined);
            this.backgroundPlaybackActive = false;
            if (this.data.playMode === 'shadow') {
                this.handleAudioPause();
                this.stopTracking();
            }
            if (!this.isRecoveringFromBackground) {
                this.shadowHandoffState = null;
            }
        });
        if (typeof manager.onEnded === 'function') {
            manager.onEnded(() => {
                this.debugShadowBackground('background onEnded');
            });
        }
        if (typeof manager.onWaiting === 'function') {
            manager.onWaiting(() => {
                this.debugShadowBackground('background onWaiting');
            });
        }
        if (typeof manager.onCanplay === 'function') {
            manager.onCanplay(() => {
                const elapsedMs = this.backgroundAudioRequestStartedAt
                    ? Date.now() - this.backgroundAudioRequestStartedAt
                    : null;
                logAudioRequest('background:onCanplay', String(manager.src || ''), {
                    courseId: this.courseId,
                    playMode: this.data.playMode,
                    elapsedMs,
                    currentTime: typeof manager.currentTime === 'number' ? manager.currentTime : null,
                });
                this.debugShadowBackground('background onCanplay');
                this.syncPendingShadowSeek('onCanplay');
                if (this.data.playMode === 'shadow' && this.data.audioLoading) {
                    this.setAudioLoading(false);
                }
            });
        }
        if (typeof manager.onTimeUpdate === 'function') {
            manager.onTimeUpdate(() => {
                this.updateShadowCourseTimeFromManager(typeof manager.currentTime === 'number' ? manager.currentTime : undefined);
                this.syncPendingShadowSeek('onTimeUpdate');
            });
        }
        if (typeof manager.onNext === 'function') {
            manager.onNext(() => {
                this.debugShadowBackground('background onNext');
            });
        }
        if (typeof manager.onPrev === 'function') {
            manager.onPrev(() => {
                this.debugShadowBackground('background onPrev');
            });
        }
        if (typeof manager.onError === 'function') {
            manager.onError((error) => {
                logAudioRequest('background:onError', String(manager.src || ''), {
                    courseId: this.courseId,
                    playMode: this.data.playMode,
                    error,
                });
                this.debugShadowBackground('background onError', { error });
            });
        }
        this.backgroundAudioManager = manager;
        return manager;
    },
    getShadowCurrentTime() {
        const manager = this.ensureBackgroundAudioManager();
        return this.clampCourseTimeToScene((0, shadow_background_handoff_1.resolveObservedShadowCourseTime)({
            observedTime: typeof manager.currentTime === 'number' ? manager.currentTime : 0,
            lastKnownCourseTime: (0, shadow_background_handoff_1.resolveShadowPlaybackStartTime)({
                backgroundCurrentTime: typeof manager.currentTime === 'number' ? manager.currentTime : 0,
                lastKnownCourseTime: this.lastKnownCourseTime,
            }),
            pendingTargetTime: this.pendingShadowSeek?.targetTime,
        }));
    },
    playShadowCourseAt(courseTime, shouldAutoplay = true, options = {}) {
        if (!this.data.course) {
            return false;
        }
        const targetCourseTime = this.clampCourseTimeToScene(courseTime, {
            restartWhenPastEnd: true,
        });
        const manager = this.ensureBackgroundAudioManager();
        const meta = (0, shadow_background_handoff_1.buildBackgroundPlaybackMeta)(this.data.course, targetCourseTime);
        const currentSrc = String(manager.src || '');
        const shouldSwitchSrc = currentSrc !== meta.src;
        const shouldShowLoading = shouldSwitchSrc && options.showLoading !== false;
        this.debugShadowBackground('play shadow course at', {
            courseTime: targetCourseTime,
            requestedCourseTime: courseTime,
            shouldAutoplay,
            shouldSwitchSrc,
            shouldShowLoading,
            currentSrc,
            targetSrc: meta.src,
        });
        manager.title = meta.title;
        manager.epname = meta.epname;
        manager.singer = meta.singer;
        manager.coverImgUrl = meta.coverImgUrl || BACKGROUND_AUDIO_COVER_URL;
        if ('playbackRate' in manager) {
            try {
                manager.playbackRate = this.data.playbackRate;
            }
            catch (_error) {
                // ignore
            }
        }
        this.backgroundPlaybackActive = true;
        this.lastKnownCourseTime = targetCourseTime;
        this.pendingShadowSeek = {
            targetTime: meta.startTime,
            shouldAutoplay,
            src: meta.src,
        };
        this.setAudioLoading(shouldShowLoading);
        if (shouldSwitchSrc) {
            try {
                manager.startTime = meta.startTime;
            }
            catch (_error) {
                // ignore
            }
            logAudioRequest('background:set-src', meta.src, {
                courseId: this.courseId,
                courseTime: meta.startTime,
                shouldAutoplay,
            });
            manager.src = meta.src;
            this.backgroundAudioRequestStartedAt = Date.now();
            setTimeout(() => {
                this.syncPendingShadowSeek('post-src-assign');
                try {
                    manager.seek(meta.startTime);
                }
                catch (_error) {
                    // ignore
                }
                if (shouldAutoplay && typeof manager.play === 'function') {
                    manager.play();
                }
                else if (!shouldAutoplay && typeof manager.pause === 'function') {
                    manager.pause();
                }
            }, 80);
            return true;
        }
        try {
            manager.seek(meta.startTime);
        }
        catch (_error) {
            // ignore
        }
        if (shouldAutoplay && typeof manager.play === 'function') {
            manager.play();
        }
        else if (!shouldAutoplay && typeof manager.pause === 'function') {
            manager.pause();
        }
        setTimeout(() => {
            this.syncPendingShadowSeek('post-direct-seek');
        }, 0);
        return true;
    },
    pauseShadowPlayback() {
        const manager = this.ensureBackgroundAudioManager();
        this.debugShadowBackground('pause shadow playback');
        if (typeof manager.pause === 'function') {
            manager.pause();
        }
        this.backgroundPlaybackActive = false;
    },
    getCurrentCourseTime() {
        const audioCurrentTime = this.data.playMode === 'shadow'
            ? this.getShadowCurrentTime()
            : this.audioContext?.currentTime;
        return this.clampCourseTimeToScene((0, shadow_background_handoff_1.resolveCourseTimeFromForeground)({
            audioCurrentTime,
            activeSubtitle: this.activeSubtitle,
            lastKnownCourseTime: this.lastKnownCourseTime,
        }));
    },
    readBackgroundAudioResumeState() {
        try {
            return (0, shadow_background_handoff_1.normalizeBackgroundAudioResumeState)(wx.getStorageSync(shadow_background_handoff_1.BACKGROUND_AUDIO_RESUME_KEY));
        }
        catch (error) {
            this.debugShadowBackground('read background audio resume state failed', { error });
            return null;
        }
    },
    saveBackgroundAudioResumeState(courseTime, manager) {
        if (!this.data.course) {
            return;
        }
        const state = {
            courseId: this.courseId,
            courseTime,
            subtitleId: this.data.currentSubtitleId,
            audioSrc: String(manager?.src || this.data.course.audio || ''),
            wasPlaying: this.data.playing,
            savedAt: Date.now(),
        };
        try {
            wx.setStorageSync(shadow_background_handoff_1.BACKGROUND_AUDIO_RESUME_KEY, state);
            this.debugShadowBackground('saved background audio resume state', state);
        }
        catch (error) {
            this.debugShadowBackground('save background audio resume state failed', { error });
        }
    },
    clearBackgroundAudioResumeState() {
        try {
            wx.removeStorageSync(shadow_background_handoff_1.BACKGROUND_AUDIO_RESUME_KEY);
        }
        catch (error) {
            this.debugShadowBackground('clear background audio resume state failed', { error });
        }
    },
    restoreBackgroundAudioFromStorage() {
        if (!this.data.showPracticeControls) {
            this.pendingBackgroundAudioRestore = false;
            this.stopBackgroundPlayback(true);
            return false;
        }
        const state = this.readBackgroundAudioResumeState();
        if (!state || state.courseId !== this.courseId || !this.data.course) {
            this.pendingBackgroundAudioRestore = false;
            return false;
        }
        const manager = this.ensureBackgroundAudioManager();
        const managerSrc = String(manager.src || '');
        const courseAudio = this.data.course.audio;
        const audioMatches = !managerSrc ||
            managerSrc === courseAudio ||
            (!!state.audioSrc && managerSrc === state.audioSrc);
        if (!audioMatches && !this.pendingBackgroundAudioRestore) {
            this.pendingBackgroundAudioRestore = false;
            return false;
        }
        const managerTime = typeof manager.currentTime === 'number' && manager.currentTime > 0
            ? manager.currentTime
            : 0;
        const courseTime = this.clampCourseTimeToScene(managerTime > 0 ? managerTime : state.courseTime, {
            restartWhenPastEnd: true,
        });
        const shouldAutoplay = typeof manager.paused === 'boolean'
            ? !manager.paused
            : state.wasPlaying;
        const resume = (0, shadow_background_handoff_1.resolveForegroundResumeState)({
            subtitles: this.data.subtitles,
            courseTime,
            tolerance: 0.3,
            wasPlayingInBackground: shouldAutoplay,
        });
        this.debugShadowBackground('restore background audio from storage', {
            state,
            managerSrc,
            courseAudio,
            managerTime,
            courseTime,
            shouldAutoplay,
            resume,
        });
        this.pendingBackgroundAudioRestore = false;
        if (!resume) {
            return false;
        }
        this.lastKnownCourseTime = resume.resumeTime;
        this.currentSubtitleIndex = resume.index;
        this.activeSubtitle = resume.subtitle;
        this.backgroundPlaybackActive = shouldAutoplay;
        this.shadowHandoffState = null;
        this.setData({
            playMode: 'shadow',
            currentSubtitleId: resume.subtitle.id,
            scrollIntoView: '',
            playing: resume.shouldAutoplay,
            audioLoading: false,
        });
        this.hideAudioLoadingMask();
        this.centerSubtitle(resume.subtitle.id);
        if (resume.shouldAutoplay) {
            this.startTracking();
        }
        else {
            this.stopTracking();
        }
        if (!managerSrc) {
            this.playShadowCourseAt(resume.resumeTime, resume.shouldAutoplay, {
                showLoading: false,
            });
        }
        return true;
    },
    syncShadowSubtitleByCourseTime(courseTime) {
        const matched = (0, shadow_background_handoff_1.findSubtitleByCourseTime)(this.data.subtitles, courseTime, 0.3);
        if (!matched) {
            return null;
        }
        this.currentSubtitleIndex = matched.index;
        this.activeSubtitle = matched.subtitle;
        this.setData({
            currentSubtitleId: matched.subtitle.id,
            scrollIntoView: '',
        });
        this.centerSubtitle(matched.subtitle.id);
        return matched;
    },
    handleBackgroundHandoff() {
        if (this.data.playMode !== 'shadow' ||
            !this.data.course) {
            this.debugShadowBackground('skip background handoff', {
                reason: {
                    playMode: this.data.playMode,
                    playing: this.data.playing,
                    hasCourse: !!this.data.course,
                },
            });
            return;
        }
        const courseTime = this.getCurrentCourseTime();
        const manager = this.ensureBackgroundAudioManager();
        this.debugShadowBackground('start background handoff', { courseTime });
        if (this.stopTimer) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }
        if (this.data.isRepeating) {
            this.setData({
                isRepeating: false,
                repeatCount: 0,
            });
        }
        this.lastKnownCourseTime = courseTime;
        this.backgroundPlaybackActive = true;
        this.shadowHandoffState = {
            active: true,
            wasPlaying: this.data.playing,
            courseId: this.courseId,
            subtitleId: this.data.currentSubtitleId,
            handoffAt: Date.now(),
        };
        this.saveBackgroundAudioResumeState(courseTime, manager);
        this.lastKnownCourseTime = typeof manager.currentTime === 'number' ? manager.currentTime : courseTime;
    },
    handleForegroundReturn() {
        if (this.data.playMode !== 'shadow' ||
            !this.data.course ||
            !this.shadowHandoffState?.active ||
            this.shadowHandoffState.courseId !== this.courseId) {
            this.debugShadowBackground('skip foreground return', {
                reason: {
                    playMode: this.data.playMode,
                    hasCourse: !!this.data.course,
                    handoffActive: this.shadowHandoffState?.active ?? false,
                    handoffCourseId: this.shadowHandoffState?.courseId ?? null,
                },
            });
            return;
        }
        const manager = this.ensureBackgroundAudioManager();
        const resume = (0, shadow_background_handoff_1.resolveForegroundResumeState)({
            subtitles: this.data.subtitles,
            courseTime: typeof manager.currentTime === 'number' ? manager.currentTime : this.lastKnownCourseTime,
            tolerance: 0.3,
            wasPlayingInBackground: this.shadowHandoffState.wasPlaying,
        });
        this.debugShadowBackground('foreground return resolved', { resume });
        if (!resume) {
            this.debugShadowBackground('foreground return aborted', { reason: 'resume state not resolved' });
            return;
        }
        this.isRecoveringFromBackground = true;
        this.lastKnownCourseTime = resume.resumeTime;
        this.currentSubtitleIndex = resume.index;
        this.activeSubtitle = resume.subtitle;
        this.setData({
            currentSubtitleId: resume.subtitle.id,
            scrollIntoView: '',
            playing: resume.shouldAutoplay,
        });
        this.centerSubtitle(resume.subtitle.id);
        if (resume.shouldAutoplay) {
            this.startTracking();
        }
        else {
            this.stopTracking();
        }
        this.shadowHandoffState = null;
        this.isRecoveringFromBackground = false;
    },
    resumeForegroundShadowPlayback(courseTime, shouldAutoplay) {
        const manager = this.ensureBackgroundAudioManager();
        this.lastKnownCourseTime = courseTime;
        this.debugShadowBackground('resume foreground playback start', { courseTime, shouldAutoplay });
        if (this.stopTimer) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }
        try {
            manager.seek(courseTime);
        }
        catch (_error) {
            // ignore
        }
        if (shouldAutoplay && typeof manager.play === 'function') {
            this.debugShadowBackground('resume foreground autoplay');
            manager.play();
            this.startTracking();
            this.setData({ playing: true });
        }
        else if (!shouldAutoplay && typeof manager.pause === 'function') {
            this.debugShadowBackground('resume foreground without autoplay');
            manager.pause();
            this.setData({ playing: false });
            this.stopTracking();
        }
        this.backgroundPlaybackActive = shouldAutoplay;
        this.shadowHandoffState = null;
        this.isRecoveringFromBackground = false;
    },
    stopBackgroundPlayback(stopPlayback) {
        this.debugShadowBackground('stop background playback', { stopPlayback });
        this.pendingShadowResume = null;
        this.pendingShadowSeek = null;
        this.backgroundPlaybackActive = false;
        this.isRecoveringFromBackground = false;
        this.shadowHandoffState = null;
        if (stopPlayback) {
            this.clearBackgroundAudioResumeState();
        }
        if (!this.backgroundAudioManager) {
            return;
        }
        try {
            if (stopPlayback) {
                this.backgroundAudioManager.stop();
            }
            else {
                this.backgroundAudioManager.pause();
            }
        }
        catch (_error) {
            this.debugShadowBackground('stop background playback failed', { error: _error, stopPlayback });
            // ignore
        }
    },
    handleStoreUpdate(state) {
        const modePresentation = (0, course_mode_config_1.resolveCourseModePresentation)({
            currentPlayMode: this.data.playMode,
            shadowModeEnabled: state.appConfig.courseDetail.shadowModeEnabled,
        });
        if (this.data.playMode === 'shadow' && modePresentation.effectivePlayMode === 'echo') {
            this.stopBackgroundPlayback(true);
            this.pauseShadowPlayback();
        }
        if (!this.data.showPracticeControls && modePresentation.showPracticeControls && this.data.course?.audio) {
            this.ensureAudioContext(this.data.course.audio);
        }
        if (this.data.showPracticeControls && !modePresentation.showPracticeControls) {
            this.stopTracking();
            this.stopBackgroundPlayback(true);
            this.destroyAudioContext();
            if (this.stopTimer) {
                clearTimeout(this.stopTimer);
                this.stopTimer = null;
            }
            this.activeSubtitle = null;
            this.pendingSubtitle = null;
            this.setAudioLoading(false);
        }
        this.setData({
            showModeSelector: modePresentation.showModeSelector,
            showShadowMode: modePresentation.showShadowMode,
            showPracticeControls: modePresentation.showPracticeControls,
            playMode: modePresentation.effectivePlayMode,
            playing: modePresentation.showPracticeControls ? this.data.playing : false,
            isRepeating: modePresentation.showPracticeControls ? this.data.isRepeating : false,
            repeatCount: modePresentation.showPracticeControls ? this.data.repeatCount : 0,
            showSpeedModal: modePresentation.showPracticeControls ? this.data.showSpeedModal : false,
            currentSubtitleId: this.data.showPracticeControls && !modePresentation.showPracticeControls
                ? null
                : this.data.currentSubtitleId,
        });
    },
    handleRetry() {
        if (this.courseId) {
            this.loadCourse(this.courseId);
        }
    },
    beginStudySession() {
        this.studySessionStart = Date.now();
    },
    // 使用防抖的学习时长上报函数（5秒防抖）- 用于页面在显示时
    debouncedReportStudyTime: (0, storage_1.debounce)(async function (seconds) {
        const state = (0, index_1.getState)();
        if (!state.token || !state.user) {
            return;
        }
        try {
            const response = await (0, api_1.reportStudyTime)(seconds);
            (0, index_1.setUser)(response.user);
        }
        catch (error) {
            console.warn('Failed to report study time', error);
        }
    }, 5000),
    // 立即上报学习时长（不防抖）- 用于页面卸载时
    async immediateReportStudyTime(seconds) {
        const state = (0, index_1.getState)();
        if (!state.token || !state.user) {
            return;
        }
        try {
            const response = await (0, api_1.reportStudyTime)(seconds);
            (0, index_1.setUser)(response.user);
        }
        catch (error) {
            console.warn('Failed to immediately report study time', error);
        }
    },
    async finalizeStudySession(immediate = false) {
        const start = this.studySessionStart;
        if (start === null) {
            return;
        }
        this.studySessionStart = null;
        const elapsedMs = Date.now() - start;
        if (elapsedMs <= 0) {
            return;
        }
        const seconds = Math.floor(elapsedMs / 1000);
        if (seconds <= 0) {
            return;
        }
        const cappedSeconds = Math.min(seconds, 3600);
        if (immediate) {
            // 页面卸载时立即上报，不使用防抖
            await this.immediateReportStudyTime(cappedSeconds);
        }
        else {
            // 页面隐藏时使用防抖函数
            ;
            this.debouncedReportStudyTime(cappedSeconds);
        }
    },
    handleSubtitleTap(event) {
        if (this.wordTapLockUntil && Date.now() < this.wordTapLockUntil) {
            return;
        }
        const index = event.currentTarget.dataset.index;
        if (index === undefined) {
            return;
        }
        const target = this.data.subtitles[index];
        if (!target) {
            return;
        }
        console.log(`\n============== 用户点击段落 ==============`);
        console.log(`索引: ${index}`);
        console.log(`ID: ${target.id}`);
        console.log(`文本: "${target.text}"`);
        console.log(`时间: ${target.start.toFixed(3)}s - ${target.end.toFixed(3)}s`);
        console.log(`==========================================\n`);
        if (!this.data.showPracticeControls) {
            this.setData({
                currentSubtitleId: target.id,
            });
            return;
        }
        // 使用节流版本的播放函数（避免快速点击）
        ;
        this.throttledPlaySubtitle(target);
    },
    handleWordLongPress(event) {
        const dataset = event.currentTarget.dataset;
        const word = dataset.word?.trim() ?? '';
        console.log('[Word] longpress', {
            word,
            raw: dataset.raw,
            wordId: dataset.wordId,
            time: Date.now(),
            target: event.target?.dataset,
        });
        if (!word) {
            return;
        }
        this.wordTapLockUntil = Date.now() + 600;
        this.setData({
            wordPopupVisible: true,
            wordPopupWord: dataset.raw?.trim() || word,
            wordPopupDefinition: '',
            wordPopupPhoneticUk: '',
            wordPopupPhoneticUs: '',
            wordPopupAudioUk: '',
            wordPopupAudioUs: '',
            wordPopupLeft: -9999,
            wordPopupTop: -9999,
            wordPopupLoading: true,
            wordPopupError: '',
            wordPopupReady: false,
        });
        this.wordPopupBounds = null;
        this.updateWordPopupPosition(dataset.wordId);
        const lookupKey = word;
        this.pendingWordLookup = lookupKey;
        let fallbackTranslation = null;
        (0, api_1.fetchWordBasics)(lookupKey)
            .then(basics => {
            if (this.pendingWordLookup !== lookupKey) {
                return;
            }
            fallbackTranslation = basics.translation || null;
            this.setData({
                wordPopupWord: basics.word || dataset.raw || word,
                wordPopupPhoneticUk: basics.phoneticUk ?? '',
                wordPopupPhoneticUs: basics.phoneticUs ?? '',
                wordPopupAudioUk: basics.audioUk ?? '',
                wordPopupAudioUs: basics.audioUs ?? '',
            });
        })
            .catch(error => {
            console.warn('[WordLookup] Basic fetch failed:', error);
        });
        (0, api_1.fetchWordDefinitionViaBackend)(lookupKey)
            .then(definition => {
            console.log('[Word] backend AI definition', definition);
            if (this.pendingWordLookup !== lookupKey) {
                return;
            }
            this.setData({
                wordPopupDefinition: definition || '暂无释义',
                wordPopupLoading: false,
                wordPopupError: '',
            });
            this.updateWordPopupPosition(dataset.wordId);
        })
            .catch(error => {
            console.warn('[WordLookup] Backend AI failed:', error);
            if (this.pendingWordLookup !== lookupKey) {
                return;
            }
            if (fallbackTranslation) {
                this.setData({
                    wordPopupDefinition: fallbackTranslation,
                    wordPopupLoading: false,
                    wordPopupError: '',
                });
                this.updateWordPopupPosition(dataset.wordId);
                return;
            }
            (0, api_1.fetchWordLookup)(lookupKey)
                .then(result => {
                if (this.pendingWordLookup !== lookupKey) {
                    return;
                }
                this.setData({
                    wordPopupDefinition: result.translation || '暂无释义',
                    wordPopupPhoneticUk: result.phoneticUk ?? '',
                    wordPopupPhoneticUs: result.phoneticUs ?? '',
                    wordPopupAudioUk: result.audioUk ?? '',
                    wordPopupAudioUs: result.audioUs ?? '',
                    wordPopupLoading: false,
                    wordPopupError: '',
                });
                this.updateWordPopupPosition(dataset.wordId);
            })
                .catch(() => {
                if (this.pendingWordLookup !== lookupKey) {
                    return;
                }
                this.setData({
                    wordPopupLoading: false,
                    wordPopupError: '暂未找到词义',
                });
            });
        });
    },
    handleHideWordPopup() {
        if (!this.data.wordPopupVisible) {
            return;
        }
        this.pendingWordLookup = '';
        this.wordPopupBounds = null;
        this.setData({
            wordPopupVisible: false,
            wordPopupLoading: false,
            wordPopupError: '',
            wordPopupReady: false,
        });
    },
    updateWordPopupPosition(wordId) {
        if (!wordId) {
            console.log('[Word] popup position skipped: no wordId');
            return;
        }
        wx.nextTick(() => {
            const query = wx.createSelectorQuery().in(this);
            query.select(`#${wordId}`).boundingClientRect();
            query.select('#word-popup').boundingClientRect();
            query.select('.course-navbar').boundingClientRect();
            query.select('.playback-controls').boundingClientRect();
            query.exec(result => {
                if (!this.data.wordPopupVisible) {
                    return;
                }
                const rect = result?.[0];
                const popupRect = result?.[1];
                const navRect = result?.[2];
                const controlsRect = result?.[3];
                if (!rect || !popupRect) {
                    console.log('[Word] popup position failed: no rect', { wordId });
                    return;
                }
                const info = getCourseWindowInfo();
                const safeTop = info.safeArea?.top ?? 0;
                const safeBottom = info.safeArea?.bottom ?? info.windowHeight;
                const navHeight = navRect?.height ?? 0;
                const controlsHeight = controlsRect?.height ?? 0;
                const topLimit = safeTop + navHeight;
                const bottomLimit = safeBottom - controlsHeight;
                const margin = 8;
                let left = rect.left + rect.width / 2;
                const halfWidth = popupRect.width / 2;
                const minLeft = margin + halfWidth;
                const maxLeft = info.windowWidth - margin - halfWidth;
                left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));
                let placement = 'top';
                let top = rect.top - margin;
                const minTopForTop = topLimit + margin + popupRect.height;
                if (top < minTopForTop) {
                    placement = 'bottom';
                    top = rect.bottom + margin;
                }
                if (placement === 'bottom') {
                    const maxTop = bottomLimit - margin - popupRect.height;
                    if (top > maxTop) {
                        placement = 'top';
                        top = Math.max(minTopForTop, rect.top - margin);
                    }
                }
                this.setData({
                    wordPopupLeft: left,
                    wordPopupTop: top,
                    wordPopupPlacement: placement,
                    wordPopupReady: true,
                });
                const popupLeft = left - popupRect.width / 2;
                const popupTop = placement === 'top' ? top - popupRect.height : top;
                this.wordPopupBounds = {
                    left: popupLeft,
                    right: popupLeft + popupRect.width,
                    top: popupTop,
                    bottom: popupTop + popupRect.height,
                };
            });
        });
    },
    handlePlayWordAudio(event) {
        const variant = event.currentTarget.dataset.variant;
        const url = variant === 'uk' ? this.data.wordPopupAudioUk : this.data.wordPopupAudioUs;
        console.log('[WordAudio] play', { variant, url });
        if (!url) {
            wx.showToast({
                title: '暂无发音',
                icon: 'none',
            });
            return;
        }
        this.ensureWordAudioContext();
        if (this.wordAudioContext) {
            this.wordAudioContext.stop();
            this.wordAudioContext.src = url;
            this.wordAudioContext.play();
        }
    },
    ensureWordAudioContext() {
        if (this.wordAudioContext) {
            return;
        }
        const audioContext = wx.createInnerAudioContext();
        audioContext.autoplay = false;
        audioContext.obeyMuteSwitch = true;
        audioContext.onError(err => {
            console.warn('[WordAudio] 播放失败', err);
            wx.showToast({
                title: '发音播放失败',
                icon: 'none',
            });
        });
        this.wordAudioContext = audioContext;
    },
    // 节流版本的播放字幕（500ms内最多执行一次）
    throttledPlaySubtitle: (0, storage_1.throttle)(function (subtitle) {
        this.playSubtitle(subtitle);
    }, 500),
    playSubtitle(subtitle) {
        if (!this.data.showPracticeControls) {
            return;
        }
        if (!this.data.course) {
            wx.showToast({
                title: '音频未就绪',
                icon: 'none',
            });
            return;
        }
        // 音频加载中时提示用户稍等
        if (this.data.playMode === 'echo' && this.data.audioLoading) {
            logAudioRequest('echo:click-blocked-audio-loading', this.audioSource || this.data.course.audio || '', {
                courseId: this.data.course.id,
                subtitleId: subtitle.id,
                audioReady: this.audioReady,
            });
            this.setAudioLoading(true);
            return;
        }
        console.log(`[播放] 模式=${this.data.playMode}, 段落=${subtitle.id}`);
        // Echo 模式：优先使用完整音频 + seek，失败时回退到切片
        if (this.data.playMode === 'echo') {
            if (!this.audioContext) {
                wx.showToast({
                    title: '音频未就绪',
                    icon: 'none',
                });
                return;
            }
            const context = this.audioContext;
            this.lastEchoCompletion = null;
            // 更新状态
            this.activeSubtitle = subtitle;
            const index = this.data.subtitles.findIndex(s => s.id === subtitle.id);
            if (index >= 0) {
                this.currentSubtitleIndex = index;
            }
            if (this.data.currentSubtitleId !== subtitle.id && this.data.isRepeating) {
                this.setData({ repeatCount: 0 });
            }
            this.setData({
                currentSubtitleId: subtitle.id,
                scrollIntoView: '',
            });
            this.scheduleSceneProgressSync();
            this.centerSubtitle(subtitle.id);
            // Echo模式优先使用完整音频 + seek
            if (!this.usingFallbackAudio && this.data.course.audio) {
                console.log(`[Echo] 使用完整音频 + seek 方式播放`);
                const audioSrc = this.data.course.audio;
                const needSwitchSrc = context.src !== audioSrc || this.audioSource !== audioSrc;
                logAudioRequest('echo:click-full-audio', audioSrc, {
                    courseId: this.data.course.id,
                    subtitleId: subtitle.id,
                    needSwitchSrc,
                    audioReady: this.audioReady,
                    usingFallbackAudio: this.usingFallbackAudio,
                    start: subtitle.start,
                    end: subtitle.end,
                });
                if (needSwitchSrc) {
                    console.log(`[Echo] 切换到完整音频: ${audioSrc}`);
                    logAudioRequest('echo:full-audio:set-src', audioSrc, {
                        courseId: this.data.course.id,
                        subtitleId: subtitle.id,
                        usingFallbackAudio: this.usingFallbackAudio,
                    });
                    context.stop();
                    this.audioReady = false;
                    this.pendingSubtitle = subtitle;
                    context.src = audioSrc;
                    this.audioRequestStartedAt = Date.now();
                    this.audioSource = audioSrc;
                    return;
                }
                // 音频源相同，直接 seek 播放
                if (this.audioReady) {
                    const startPosition = Math.max(subtitle.start, 0);
                    context.pause();
                    // 设置停止定时器
                    if (this.stopTimer) {
                        clearTimeout(this.stopTimer);
                    }
                    const duration = (subtitle.end - subtitle.start) / this.data.playbackRate;
                    this.stopTimer = setTimeout(() => {
                        this.lastKnownCourseTime = Math.max(this.lastKnownCourseTime, subtitle.end);
                        console.log('[Audio] Echo 定时暂停，记录句末进度', {
                            subtitleId: subtitle.id,
                            completionTime: this.lastKnownCourseTime,
                        });
                        if (this.audioContext) {
                            this.audioContext.pause();
                            this.handleAudioPause();
                        }
                        this.stopTimer = null;
                        // 重复模式
                        if (this.data.isRepeating && this.activeSubtitle) {
                            this.handleRepeatNext(this.activeSubtitle);
                        }
                    }, duration * 1000 + 200);
                    context.seek(startPosition);
                    context.play();
                }
                else {
                    this.pendingSubtitle = subtitle;
                    context.play();
                }
                return;
            }
            // 降级：使用服务器切片音频
            const segmentUrl = `${env_1.API_BASE_URL}/static/audio-segments/${this.data.course.id}/segment_${subtitle.id}.m4a`;
            console.log(`[Echo] 降级使用切片: ${segmentUrl}`);
            logAudioRequest('echo:segment:set-src', segmentUrl, {
                courseId: this.data.course.id,
                subtitleId: subtitle.id,
            });
            context.stop();
            context.src = segmentUrl;
            this.audioRequestStartedAt = Date.now();
            context.startTime = 0;
            this.audioSource = segmentUrl;
            context.play();
            return;
        }
        // Shadow 模式：播放完整 MP3
        this.activeSubtitle = subtitle;
        // 更新当前索引
        const index = this.data.subtitles.findIndex(s => s.id === subtitle.id);
        if (index >= 0) {
            this.currentSubtitleIndex = index;
        }
        this.setData({
            currentSubtitleId: subtitle.id,
            scrollIntoView: '',
        });
        this.scheduleSceneProgressSync();
        this.centerSubtitle(subtitle.id);
        if (this.stopTimer) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }
        this.playShadowCourseAt(Math.max(subtitle.start, 0), true);
    },
    seekAndPlay(subtitle) {
        const startPosition = subtitle.start;
        console.log(`[seekAndPlay] ==========================================`);
        console.log(`[seekAndPlay] 点击段落: ID=${subtitle.id}, 文本="${this.data.subtitles.find(s => s.id === subtitle.id)?.text || ''}"`);
        console.log(`[seekAndPlay] 时间范围: ${startPosition.toFixed(3)}s - ${subtitle.end.toFixed(3)}s (时长${(subtitle.end - startPosition).toFixed(3)}s)`);
        console.log(`[seekAndPlay] seek前currentTime: ${this.getCurrentCourseTime().toFixed(3)}s`);
        // 清除旧的定时器
        if (this.stopTimer) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }
        if (this.data.playMode === 'shadow') {
            this.playShadowCourseAt(startPosition, true);
            return;
        }
        if (!this.audioContext) {
            return;
        }
        const context = this.audioContext;
        context.pause();
        context.stop();
        console.log(`[seekAndPlay] 执行 play() + seek(${startPosition})`);
        if (context.src === this.audioSource && this.audioReady) {
            context.seek(startPosition);
            context.play();
            return;
        }
        context.startTime = startPosition;
        context.play();
    },
    // 处理重复播放的下一次
    handleRepeatNext(subtitle) {
        const currentCount = this.data.repeatCount + 1;
        console.log(`[Repeat] 当前次数: ${currentCount}/${this.data.repeatTarget}`);
        if (currentCount < this.data.repeatTarget) {
            // 还没达到目标次数，继续重复
            this.setData({ repeatCount: currentCount });
            setTimeout(() => {
                if (!this.data.isRepeating) {
                    console.log(`[Repeat] 重复已取消，停止`);
                    return;
                }
                // Echo 模式：使用 playSubtitle 播放 M4A 片段
                if (this.data.playMode === 'echo') {
                    const subtitleView = this.data.subtitles.find(s => s.id === subtitle.id);
                    if (subtitleView) {
                        console.log(`[Repeat] Echo 模式重复播放`);
                        this.playSubtitle(subtitleView);
                    }
                    return;
                }
                // Shadow 模式：使用 seekAndPlay
                console.log(`[Repeat] Shadow 模式重复播放`);
                this.seekAndPlay(subtitle);
            }, 100);
        }
        else {
            // 达到目标次数，停止重复
            console.log(`[Repeat] 完成 ${this.data.repeatTarget} 次重复`);
            wx.showToast({
                title: `已重复${this.data.repeatTarget}次`,
                icon: 'success',
                duration: 2000,
            });
            this.setData({
                isRepeating: false,
                repeatCount: 0,
            });
            // 影子跟读模式：重复完成后继续播放下一个段落
            if (this.data.playMode === 'shadow') {
                setTimeout(() => {
                    this.playNextInShadowMode();
                }, 200);
            }
            // Echo模式：重复完成后停止，等待用户操作
        }
    },
    handleAudioPause() {
        this.setData({ playing: false });
    },
    handleToggleLanguage() {
        const modes = ['all', 'en', 'zh'];
        const currentMode = this.data.transcriptMode;
        const nextIndex = (modes.indexOf(currentMode) + 1) % modes.length;
        const nextMode = modes[nextIndex];
        this.setData({
            transcriptMode: nextMode
        });
        const toastMap = {
            'all': '中英双语',
            'en': '仅英文',
            'zh': '仅中文'
        };
        wx.showToast({
            title: toastMap[nextMode],
            icon: 'none',
            duration: 1000
        });
    },
    handleOpenPDFPage() {
        if (!this.data.course)
            return;
        wx.navigateTo({
            url: `/pages/knowledge/knowledge?id=${this.data.course.id}&title=${encodeURIComponent(this.data.course.title)}`
        });
    },
    handleOpenPDF() {
        this.handleOpenPDFPage();
    },
    handleExplain() {
        if (!this.data.showPracticeControls) {
            return;
        }
        const currentId = this.data.currentSubtitleId;
        if (!currentId) {
            wx.showToast({
                title: '请先选择一个句子',
                icon: 'none'
            });
            return;
        }
        const subtitle = this.data.subtitles.find(s => s.id === currentId);
        if (!subtitle)
            return;
        // 获取上下文（前后各一句）
        const index = this.data.subtitles.findIndex(s => s.id === currentId);
        let context = '';
        if (index >= 0) {
            const prev = this.data.subtitles[index - 1]?.text || '';
            const next = this.data.subtitles[index + 1]?.text || '';
            context = `Preceding: "${prev}"\nTarget: "${subtitle.text}"\nFollowing: "${next}"`;
        }
        if (this.knowledgeContext) {
            context = `${context}\n\n${this.knowledgeContext}`.trim();
        }
        this.setData({
            showAiPopup: true,
            aiText: subtitle.text,
            aiContext: context,
            // 暂停播放
            playing: false
        });
        if (this.data.playMode === 'shadow') {
            this.pauseShadowPlayback();
        }
        else if (this.audioContext) {
            this.audioContext.pause();
        }
    },
    handleAiPopupClose() {
        this.setData({
            showAiPopup: false
        });
    },
    // 模式切换
    handleModeChange(event) {
        const mode = event.currentTarget.dataset.mode;
        if (mode === 'shadow' && !this.data.showShadowMode) {
            return;
        }
        if (!mode || mode === this.data.playMode) {
            return;
        }
        const previousMode = this.data.playMode;
        const wasPlaying = this.data.playing;
        const modeSwitchCourseTime = this.getCurrentCourseTime();
        this.lastKnownCourseTime = modeSwitchCourseTime;
        this.debugShadowBackground('mode change requested', {
            fromMode: previousMode,
            toMode: mode,
            wasPlaying,
            modeSwitchCourseTime,
        });
        const currentSubtitleId = this.data.currentSubtitleId;
        const targetSubtitleView = currentSubtitleId
            ? this.data.subtitles.find(subtitle => subtitle.id === currentSubtitleId) ?? null
            : this.data.subtitles[0] ?? null;
        const targetSubtitle = targetSubtitleView
            ? {
                id: targetSubtitleView.id,
                start: targetSubtitleView.start,
                end: targetSubtitleView.end,
            }
            : null;
        // 停止当前播放和跟踪
        this.stopTracking();
        if (this.stopTimer) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }
        if (previousMode === 'shadow' && mode === 'echo') {
            this.stopBackgroundPlayback(true);
        }
        if (previousMode === 'echo' && this.audioContext) {
            this.suppressMainAudioContextEvents = true;
            try {
                this.audioContext.pause();
            }
            catch (error) {
                console.warn('[Audio] echo->shadow pause failed during mode switch', error);
            }
        }
        // 更新模式，关闭重复模式
        this.setData({
            playMode: mode,
            playing: false,
            isRepeating: false, // 切换模式时关闭重复
            repeatCount: 0, // 重置计数器
        });
        this.suppressMainAudioContextEvents = false;
        if (!targetSubtitle || !targetSubtitleView) {
            return;
        }
        const index = this.data.subtitles.findIndex(subtitle => subtitle.id === targetSubtitleView.id);
        if (index >= 0) {
            this.currentSubtitleIndex = index;
        }
        this.setData({
            currentSubtitleId: targetSubtitleView.id,
        });
        this.scheduleSceneProgressSync();
        this.activeSubtitle = targetSubtitle;
        this.centerSubtitle(targetSubtitleView.id);
        if (mode === 'shadow') {
            const nextShadowState = previousMode === 'echo'
                ? (0, shadow_background_handoff_1.resolveEchoToShadowSwitchState)({
                    subtitles: this.data.subtitles,
                    audioCurrentTime: this.audioContext?.currentTime,
                    activeSubtitle: targetSubtitle,
                    lastKnownCourseTime: this.lastKnownCourseTime,
                    fallbackSubtitleId: targetSubtitleView.id,
                    echoCompletedCourseTime: this.lastEchoCompletion?.courseTime ?? null,
                    echoCompletedSubtitleId: this.lastEchoCompletion?.subtitleId ?? null,
                    tolerance: 0.3,
                })
                : (0, shadow_background_handoff_1.resolveShadowModeSwitchState)({
                    subtitles: this.data.subtitles,
                    courseTime: modeSwitchCourseTime,
                    fallbackSubtitleId: targetSubtitleView.id,
                    shouldAutoplay: wasPlaying,
                    tolerance: 0.3,
                });
            if (!nextShadowState) {
                return;
            }
            this.debugShadowBackground('mode change resolved shadow resume', {
                resumeTime: nextShadowState.resumeTime,
                shouldAutoplay: nextShadowState.shouldAutoplay,
                subtitleId: nextShadowState.subtitle.id,
                subtitleIndex: nextShadowState.index,
            });
            this.currentSubtitleIndex = nextShadowState.index;
            this.activeSubtitle = nextShadowState.subtitle;
            this.setData({
                currentSubtitleId: nextShadowState.subtitle.id,
                playing: nextShadowState.shouldAutoplay,
            });
            this.centerSubtitle(nextShadowState.subtitle.id);
            const targetCourseAudio = this.data.course?.audio || '';
            const canSkipShadowLoadingMask = previousMode === 'echo' &&
                this.audioReady &&
                !!targetCourseAudio &&
                this.audioSource === targetCourseAudio &&
                this.audioContext?.src === targetCourseAudio;
            if (canSkipShadowLoadingMask) {
                this.debugShadowBackground('skip shadow loading mask: foreground audio ready', {
                    audioSource: this.audioSource,
                    targetSrc: targetCourseAudio,
                });
            }
            this.playShadowCourseAt(nextShadowState.resumeTime, nextShadowState.shouldAutoplay, {
                showLoading: !canSkipShadowLoadingMask,
            });
            if (nextShadowState.shouldAutoplay) {
                this.startTracking();
            }
            else {
                this.stopTracking();
            }
            this.lastEchoCompletion = null;
            return;
        }
        // Echo 模式：不需要预加载，等待用户点击
        this.lastEchoCompletion = null;
        console.log(`[ModeChange] 切换到 Echo 模式，等待用户点击段落`);
    },
    // 开始影子跟读模式
    startShadowMode() {
        this.currentSubtitleIndex = 0;
        const firstSubtitle = this.data.subtitles[0];
        if (firstSubtitle) {
            this.playShadowCourseAt(firstSubtitle.start, true);
            // 设置初始字幕
            this.activeSubtitle = firstSubtitle;
            this.setData({
                currentSubtitleId: firstSubtitle.id,
                scrollIntoView: '',
            });
            this.scheduleSceneProgressSync();
            this.centerSubtitle(firstSubtitle.id);
        }
    },
    // 影子跟读模式播放下一个
    playNextInShadowMode() {
        if (this.data.playMode !== 'shadow') {
            return;
        }
        // 如果开启了重复模式，不自动播放下一个
        if (this.data.isRepeating) {
            return;
        }
        const nextIndex = this.currentSubtitleIndex + 1;
        if (nextIndex < this.data.subtitles.length) {
            this.currentSubtitleIndex = nextIndex;
            const nextSubtitle = this.data.subtitles[nextIndex];
            if (nextSubtitle) {
                // 不需要延迟，直接播放下一个
                this.playSubtitle(nextSubtitle);
            }
        }
        else {
            // 播放完所有段落
            this.finishScenePlayback(true);
        }
    },
    // 实时跟踪字幕位置（优化版 + 真机适配）
    trackSubtitlePosition() {
        if (this.data.playMode !== 'shadow') {
            return;
        }
        const currentTime = this.getShadowCurrentTime();
        if (this.hasReachedSceneEnd(currentTime) && !this.data.isRepeating) {
            this.finishScenePlayback(true);
            return;
        }
        if (this.data.isRepeating && this.activeSubtitle) {
            if (currentTime >= this.activeSubtitle.end) {
                this.pauseShadowPlayback();
                this.handleRepeatNext(this.activeSubtitle);
            }
            return;
        }
        // 真机适配：增加容错范围（从0.1秒增加到0.3秒）
        const tolerance = 0.3;
        let found = false;
        // 优先检查当前字幕索引
        if (this.currentSubtitleIndex < this.data.subtitles.length) {
            const currentSubtitle = this.data.subtitles[this.currentSubtitleIndex];
            if (currentSubtitle && currentTime >= currentSubtitle.start - tolerance && currentTime <= currentSubtitle.end + tolerance) {
                found = true;
                if (this.data.currentSubtitleId !== currentSubtitle.id) {
                    this.activeSubtitle = currentSubtitle;
                    this.setData({
                        currentSubtitleId: currentSubtitle.id,
                        scrollIntoView: '',
                    });
                    this.scheduleSceneProgressSync();
                    this.centerSubtitle(currentSubtitle.id);
                }
            }
        }
        // 检查下一个字幕
        if (!found && this.currentSubtitleIndex + 1 < this.data.subtitles.length) {
            const nextSubtitle = this.data.subtitles[this.currentSubtitleIndex + 1];
            if (nextSubtitle && currentTime >= nextSubtitle.start - tolerance) {
                this.currentSubtitleIndex++;
                this.activeSubtitle = nextSubtitle;
                this.setData({
                    currentSubtitleId: nextSubtitle.id,
                    scrollIntoView: '',
                });
                this.centerSubtitle(nextSubtitle.id);
                found = true;
            }
        }
        // 如果还没找到，遍历查找（处理跳转等情况）
        if (!found) {
            for (let i = 0; i < this.data.subtitles.length; i++) {
                const subtitle = this.data.subtitles[i];
                if (currentTime >= subtitle.start - tolerance && currentTime <= subtitle.end + tolerance) {
                    this.currentSubtitleIndex = i;
                    this.activeSubtitle = subtitle;
                    this.setData({
                        currentSubtitleId: subtitle.id,
                        scrollIntoView: '',
                    });
                    this.centerSubtitle(subtitle.id);
                    break;
                }
            }
        }
    },
    // 开始跟踪（使用定时器 + 真机优化）
    startTracking() {
        // 如果定时器已经在运行，不需要重新创建
        if (this.trackingTimer) {
            return;
        }
        // 真机优化：降低检查频率从100ms到150ms，减少性能压力
        this.trackingTimer = setInterval(() => {
            // 只在影子跟读模式下工作
            if (this.data.playMode !== 'shadow') {
                this.stopTracking();
                return;
            }
            // 只在播放时执行跟踪
            if (!this.data.playing) {
                return; // 暂停时不跟踪，但不停止定时器
            }
            this.trackSubtitlePosition();
        }, 150);
    },
    // 停止跟踪
    stopTracking() {
        if (this.trackingTimer) {
            clearInterval(this.trackingTimer);
            this.trackingTimer = null;
        }
    },
    // 播放/暂停控制
    handlePlayPause() {
        if (!this.data.showPracticeControls) {
            return;
        }
        // Echo 模式：使用 InnerAudioContext
        if (this.data.playMode === 'echo') {
            if (!this.audioContext) {
                wx.showToast({
                    title: '音频未准备好',
                    icon: 'none',
                });
                return;
            }
            if (this.data.playing) {
                // 暂停当前播放
                this.audioContext.pause();
            }
            else {
                // 继续播放或重新播放当前段落
                if (!this.data.currentSubtitleId) {
                    const firstSubtitle = this.data.subtitles[0];
                    if (firstSubtitle) {
                        this.playSubtitle(firstSubtitle);
                    }
                }
                else {
                    const currentSubtitle = this.data.subtitles.find(s => s.id === this.data.currentSubtitleId);
                    if (currentSubtitle) {
                        this.playSubtitle(currentSubtitle);
                    }
                }
            }
            return;
        }
        // Shadow 模式：使用 BackgroundAudioManager
        if (!this.data.course) {
            wx.showToast({
                title: '音频未准备好',
                icon: 'none',
            });
            return;
        }
        if (this.data.playing) {
            this.pauseShadowPlayback();
        }
        else {
            if (!this.data.currentSubtitleId) {
                this.startShadowMode();
            }
            else {
                const resumeTime = this.clampCourseTimeToScene(this.getShadowCurrentTime(), {
                    restartWhenPastEnd: true,
                });
                this.debugShadowBackground('handle play pause resume shadow', {
                    resumeTime,
                });
                this.playShadowCourseAt(resumeTime, true);
            }
        }
    },
    handleTouchStart(event) {
        if (this.data.wordPopupVisible && this.wordPopupBounds) {
            const touch = event.touches?.[0];
            if (touch) {
                const { left, right, top, bottom } = this.wordPopupBounds;
                if (touch.pageX >= left && touch.pageX <= right && touch.pageY >= top && touch.pageY <= bottom) {
                    return;
                }
            }
            this.handleHideWordPopup();
        }
        const touch = event.touches?.[0];
        if (!touch) {
            return;
        }
        this.swipeStartX = touch.pageX;
        this.swipeStartY = touch.pageY;
        this.swipeTriggered = false;
    },
    handleTouchMove(event) {
        if (this.swipeStartX === null || this.swipeTriggered) {
            return;
        }
        const touch = event.touches?.[0];
        if (!touch) {
            return;
        }
        const startX = this.swipeStartX;
        const startY = this.swipeStartY ?? touch.pageY;
        if (startX > 60) {
            return;
        }
        const deltaX = touch.pageX - startX;
        const deltaY = Math.abs(touch.pageY - startY);
        if (deltaX > 80 && deltaY < 60) {
            this.swipeTriggered = true;
            this.handleSwipeBack();
        }
    },
    handleTouchEnd() {
        this.swipeStartX = null;
        this.swipeStartY = null;
        this.swipeTriggered = false;
    },
    handleSwipeBack() {
        const stack = getCurrentPages();
        if (stack.length > 1) {
            wx.navigateBack({ delta: 1 });
        }
    },
    handleRepeat() {
        if (!this.data.showPracticeControls) {
            return;
        }
        const newRepeating = !this.data.isRepeating;
        let subtitleToRepeat = null;
        if (newRepeating) {
            subtitleToRepeat = this.getCurrentSubtitleForRepeat();
            if (!subtitleToRepeat) {
                wx.showToast({
                    title: '请先选择段落',
                    icon: 'none',
                });
                return;
            }
        }
        const repeatUpdates = {
            isRepeating: newRepeating,
            repeatCount: 0, // 重置计数器
        };
        if (newRepeating && this.data.playMode === 'shadow') {
            repeatUpdates.repeatTarget = 10;
        }
        this.setData(repeatUpdates);
        if (newRepeating) {
            const targetTimes = repeatUpdates.repeatTarget ?? this.data.repeatTarget;
            this.activeSubtitle = subtitleToRepeat;
            wx.showToast({
                title: `重复播放${targetTimes}次`,
                icon: 'success',
                duration: 1500,
            });
            // Echo 模式：直接调用 playSubtitle
            if (this.data.playMode === 'echo') {
                if (!this.audioContext) {
                    return;
                }
                const subtitle = this.data.subtitles.find(s => s.id === subtitleToRepeat.id);
                if (subtitle) {
                    this.playSubtitle(subtitle);
                }
                return;
            }
            // Shadow 模式：使用 seekAndPlay
            this.seekAndPlay(subtitleToRepeat);
        }
        else {
            wx.showToast({
                title: '重复播放已关闭',
                icon: 'none',
                duration: 1500,
            });
            // 关闭重复时，如果是影子跟读模式
            if (this.data.playMode === 'shadow') {
                if (this.stopTimer) {
                    clearTimeout(this.stopTimer);
                    this.stopTimer = null;
                }
                if (!this.data.playing) {
                    // 恢复顺序播放，让跟读流程继续向下推进
                    this.playShadowCourseAt(this.getCurrentCourseTime(), true);
                }
            }
        }
    },
    getCurrentSubtitleForRepeat() {
        const { currentSubtitleId } = this.data;
        if (!currentSubtitleId) {
            return null;
        }
        if (this.activeSubtitle && this.activeSubtitle.id === currentSubtitleId) {
            return this.activeSubtitle;
        }
        const match = this.data.subtitles.find(subtitle => subtitle.id === currentSubtitleId);
        if (!match) {
            return null;
        }
        return {
            id: match.id,
            start: match.start,
            end: match.end,
        };
    },
    // 字幕滚动的核心实现（不直接调用，通过节流函数调用）
    _centerSubtitleImpl(subtitleId) {
        if (!subtitleId) {
            return;
        }
        wx.nextTick(() => {
            const query = wx.createSelectorQuery().in(this);
            query
                .select('.subtitle-scroll')
                .fields({ size: true, rect: true, scrollOffset: true });
            query.select(`#subtitle-${subtitleId}`).boundingClientRect();
            query.exec(results => {
                if (!Array.isArray(results) || results.length < 2) {
                    return;
                }
                const container = results[0];
                const itemRect = results[1];
                if (!container || !itemRect) {
                    return;
                }
                const containerHeight = container.height ?? 0;
                if (containerHeight <= 0) {
                    return;
                }
                const containerTop = container.top ?? 0;
                const currentScrollTop = container.scrollTop ?? 0;
                const itemCenterOffset = itemRect.top - containerTop + itemRect.height / 2;
                // 让item显示在屏幕上方约1/3的位置，而不是正中间
                // 这样可以看到更多下面的内容
                const targetScrollTop = currentScrollTop + itemCenterOffset - containerHeight * 0.35;
                this.setData({
                    scrollTop: Math.max(targetScrollTop, 0),
                });
            });
        });
    },
    // 节流版本的字幕滚动（300ms内最多执行一次）
    centerSubtitle: (0, storage_1.throttle)(function (subtitleId) {
        this._centerSubtitleImpl(subtitleId);
        this.scheduleCourseShareImage();
    }, 300),
    // 调节播放速度
    handleShowSpeedModal() {
        if (!this.data.showPracticeControls) {
            return;
        }
        this.setData({
            showSpeedModal: true,
        });
    },
    handleHideSpeedModal() {
        this.setData({
            showSpeedModal: false,
        });
    },
    handleStopPropagation() {
        // 阻止事件冒泡
    },
    handleSpeedSliderChange(event) {
        const speed = event.detail.value / 100; // slider returns 50-200, convert to 0.5-2.0
        console.log(`[Speed] 滑块调整速度至: ${speed}x`);
        this.applyPlaybackRate(speed);
    },
    // 兼容 WXML 中的函数名
    handleSpeedChange(event) {
        this.handleSpeedSliderChange(event);
    },
    handleSpeedSliderChanging(event) {
        const speed = event.detail.value / 100;
        this.setData({
            playbackRate: speed,
        });
        // 拖动过程中不立即应用，只更新显示
    },
    handleSpeedPreset(event) {
        const speed = event.currentTarget.dataset.speed;
        if (speed === undefined) {
            return;
        }
        console.log(`[Speed] 预设速度按钮: ${speed}x`);
        this.applyPlaybackRate(speed);
    },
    // 应用播放速度（强制生效）
    applyPlaybackRate(speed) {
        this.setData({
            playbackRate: speed,
        });
        if (this.data.playMode === 'shadow') {
            const manager = this.ensureBackgroundAudioManager();
            if ('playbackRate' in manager) {
                try {
                    manager.playbackRate = speed;
                    this.debugShadowBackground('apply shadow playbackRate', { speed });
                }
                catch (_error) {
                    this.debugShadowBackground('apply shadow playbackRate failed', { speed, error: _error });
                }
            }
            return;
        }
        if (!this.audioContext) {
            return;
        }
        const context = this.audioContext;
        const wasPlaying = this.data.playing;
        // 微信小程序的 playbackRate 在播放中可能不会立即生效
        // 需要通过暂停-设置-恢复的方式强制应用
        if (wasPlaying) {
            const currentTime = context.currentTime;
            context.pause();
            context.playbackRate = speed;
            // 短暂延迟后恢复播放
            setTimeout(() => {
                context.seek(currentTime);
                context.play();
                console.log(`[Speed] 已应用速度 ${speed}x，恢复播放位置 ${currentTime.toFixed(2)}s`);
            }, 50);
        }
        else {
            context.playbackRate = speed;
            console.log(`[Speed] 已设置 playbackRate = ${speed}`);
        }
    },
});
function normalizeCourseRange(detail, subtitles) {
    const start = Number(detail.range?.start);
    const end = Number(detail.range?.end);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return {
            start: Math.max(0, start),
            end,
        };
    }
    const first = subtitles[0];
    const last = subtitles[subtitles.length - 1];
    if (first && last && last.end > first.start) {
        return {
            start: Math.max(0, first.start),
            end: last.end,
        };
    }
    return null;
}
function buildKnowledgeContext(detail) {
    const knowledge = detail.knowledge;
    if (!knowledge) {
        return '';
    }
    const parts = [
        '【外贸英语影子跟读场景】',
        detail.chapterTitle ? `章节：${detail.chapterLabel || ''} ${detail.chapterTitle}`.trim() : '',
        detail.title ? `小节：${detail.title}` : '',
        knowledge.background ? `背景：${knowledge.background}` : '',
        knowledge.phrases ? `重点表达：${knowledge.phrases}` : '',
        knowledge.correction ? `纠错提醒：${knowledge.correction}` : '',
        knowledge.notes ? `讲解备注：${knowledge.notes}` : '',
    ].filter(Boolean);
    return parts.join('\n');
}
function normalizeAudioUrl(audio) {
    console.log(`[normalizeAudioUrl] 输入: "${audio}"`);
    if (!audio) {
        console.log(`[normalizeAudioUrl] 输出: "" (空)`);
        return '';
    }
    // 临时修复：强制替换 .ogg 为 .mp3
    let processedAudio = audio.replace(/\.ogg$/, '.mp3');
    console.log(`[normalizeAudioUrl] 替换后: "${processedAudio}"`);
    if (/^https?:\/\//.test(processedAudio)) {
        console.log(`[normalizeAudioUrl] 输出: "${processedAudio}" (已是完整URL)`);
        return processedAudio;
    }
    const result = `${env_1.API_BASE_URL}${processedAudio}`;
    console.log(`[normalizeAudioUrl] 输出: "${result}" (拼接后)`);
    return result;
}
function mapSubtitles(entries) {
    const speakerToneIndexes = new Map();
    const subtitles = [];
    entries.forEach((entry, entryIndex) => {
        const speaker = entry.speaker || `speaker-${entryIndex}`;
        const toneClass = (0, dialogue_format_1.resolveSpeakerToneClass)(speaker, speakerToneIndexes);
        const segments = (0, dialogue_format_1.buildTimedDialogueSentences)({
            text: entry.text,
            translation: entry.translation,
            start: entry.start,
            end: entry.end,
        });
        const safeSegments = segments.length
            ? segments
            : [{
                    text: entry.text,
                    translation: entry.translation ?? '',
                    start: entry.start,
                    end: entry.end,
                }];
        safeSegments.forEach((segment, segmentIndex) => {
            const id = safeSegments.length === 1
                ? entry.id
                : `${entry.id}-s${segmentIndex + 1}`;
            const start = segment.start;
            const end = segment.end;
            subtitles.push({
                ...entry,
                id,
                index: subtitles.length,
                text: segment.text,
                translation: segment.translation || undefined,
                start,
                end,
                rawStart: start,
                rawEnd: end,
                timeLabel: formatSeconds(start),
                durationLabel: formatSeconds(end - start),
                tokens: tokenizeSubtitle(segment.text),
                toneClass,
                sourceSubtitleId: entry.id,
                sourceIndex: entry.index ?? entryIndex,
                segmentIndex,
                segmentCount: safeSegments.length,
            });
        });
    });
    return subtitles;
}
function tokenizeSubtitle(text) {
    const tokens = [];
    const pattern = /[A-Za-z]+(?:['-][A-Za-z]+)*/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
        if (match.index > lastIndex) {
            tokens.push({
                text: text.slice(lastIndex, match.index),
                isWord: false,
            });
        }
        const raw = match[0];
        const normalized = raw.replace(/[’‘]/g, "'").toLowerCase();
        tokens.push({
            text: raw,
            word: normalized,
            isWord: true,
        });
        lastIndex = match.index + raw.length;
    }
    if (lastIndex < text.length) {
        tokens.push({
            text: text.slice(lastIndex),
            isWord: false,
        });
    }
    return tokens;
}
