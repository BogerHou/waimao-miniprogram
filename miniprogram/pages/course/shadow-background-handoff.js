"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BACKGROUND_AUDIO_RESUME_TTL_MS = exports.BACKGROUND_AUDIO_RESUME_KEY = void 0;
exports.normalizeCourseTime = normalizeCourseTime;
exports.resolveCourseTimeFromForeground = resolveCourseTimeFromForeground;
exports.findSubtitleByCourseTime = findSubtitleByCourseTime;
exports.resolveForegroundResumeState = resolveForegroundResumeState;
exports.resolveShadowModeSwitchState = resolveShadowModeSwitchState;
exports.resolveEchoToShadowSwitchState = resolveEchoToShadowSwitchState;
exports.resolveShadowPlaybackStartTime = resolveShadowPlaybackStartTime;
exports.resolveObservedShadowCourseTime = resolveObservedShadowCourseTime;
exports.shouldApplyShadowSeekCorrection = shouldApplyShadowSeekCorrection;
exports.buildCourseNavigationUrl = buildCourseNavigationUrl;
exports.normalizeBackgroundAudioResumeState = normalizeBackgroundAudioResumeState;
exports.shouldRestoreBackgroundAudioRoute = shouldRestoreBackgroundAudioRoute;
exports.buildBackgroundPlaybackMeta = buildBackgroundPlaybackMeta;
exports.createBackgroundResumeStore = createBackgroundResumeStore;
exports.BACKGROUND_AUDIO_RESUME_KEY = 'waimao_mini_background_audio_resume';
exports.BACKGROUND_AUDIO_RESUME_TTL_MS = 12 * 60 * 60 * 1000;
function normalizeCourseTime(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, value);
}
function resolveCourseTimeFromForeground(options) {
    const audioCurrentTime = normalizeCourseTime(options.audioCurrentTime);
    const lastKnownCourseTime = normalizeCourseTime(options.lastKnownCourseTime);
    const activeSubtitle = options.activeSubtitle;
    if (activeSubtitle) {
        const subtitleStart = normalizeCourseTime(activeSubtitle.start);
        if (audioCurrentTime + 0.2 < subtitleStart && lastKnownCourseTime >= subtitleStart - 0.2) {
            return lastKnownCourseTime;
        }
        if (audioCurrentTime + 0.2 < subtitleStart) {
            return subtitleStart;
        }
    }
    if (audioCurrentTime > 0) {
        return audioCurrentTime;
    }
    if (activeSubtitle) {
        return normalizeCourseTime(activeSubtitle.start);
    }
    return lastKnownCourseTime;
}
function findSubtitleByCourseTime(subtitles, courseTime, tolerance = 0.3) {
    if (!subtitles.length) {
        return null;
    }
    const safeTime = normalizeCourseTime(courseTime);
    const safeTolerance = Math.max(0, tolerance);
    for (let index = 0; index < subtitles.length; index += 1) {
        const subtitle = subtitles[index];
        if (safeTime >= subtitle.start - safeTolerance && safeTime <= subtitle.end + safeTolerance) {
            const nextSubtitle = subtitles[index + 1];
            if (nextSubtitle &&
                safeTime >= nextSubtitle.start - safeTolerance &&
                safeTime >= subtitle.end) {
                return { subtitle: nextSubtitle, index: index + 1 };
            }
            return { subtitle, index };
        }
    }
    for (let index = subtitles.length - 1; index >= 0; index -= 1) {
        const subtitle = subtitles[index];
        if (safeTime >= subtitle.start) {
            return { subtitle, index };
        }
    }
    return { subtitle: subtitles[0], index: 0 };
}
function resolveForegroundResumeState(options) {
    const resumeTime = normalizeCourseTime(options.courseTime);
    const matched = findSubtitleByCourseTime(options.subtitles, resumeTime, options.tolerance ?? 0.3);
    if (!matched) {
        return null;
    }
    return {
        subtitle: matched.subtitle,
        index: matched.index,
        resumeTime,
        shouldAutoplay: options.wasPlayingInBackground,
    };
}
function resolveShadowModeSwitchState(options) {
    const resumeTime = normalizeCourseTime(options.courseTime);
    const matched = findSubtitleByCourseTime(options.subtitles, resumeTime, options.tolerance ?? 0.3);
    if (matched) {
        return {
            subtitle: matched.subtitle,
            index: matched.index,
            resumeTime,
            shouldAutoplay: options.shouldAutoplay,
        };
    }
    if (options.fallbackSubtitleId) {
        const fallbackIndex = options.subtitles.findIndex(subtitle => subtitle.id === options.fallbackSubtitleId);
        if (fallbackIndex >= 0) {
            const fallbackSubtitle = options.subtitles[fallbackIndex];
            return {
                subtitle: fallbackSubtitle,
                index: fallbackIndex,
                resumeTime: normalizeCourseTime(fallbackSubtitle.start),
                shouldAutoplay: options.shouldAutoplay,
            };
        }
    }
    if (!options.subtitles.length) {
        return null;
    }
    return {
        subtitle: options.subtitles[0],
        index: 0,
        resumeTime: normalizeCourseTime(options.subtitles[0].start),
        shouldAutoplay: options.shouldAutoplay,
    };
}
function resolveEchoToShadowSwitchState(options) {
    const tolerance = options.tolerance ?? 0.3;
    const activeSubtitle = options.activeSubtitle;
    const completedCourseTime = normalizeCourseTime(options.echoCompletedCourseTime ?? undefined);
    const completionMatchesActiveSubtitle = !!activeSubtitle &&
        !!options.echoCompletedSubtitleId &&
        options.echoCompletedSubtitleId === activeSubtitle.id;
    const courseTime = completionMatchesActiveSubtitle && completedCourseTime > 0
        ? completedCourseTime
        : resolveCourseTimeFromForeground({
            audioCurrentTime: options.audioCurrentTime,
            activeSubtitle,
            lastKnownCourseTime: options.lastKnownCourseTime,
        });
    return resolveShadowModeSwitchState({
        subtitles: options.subtitles,
        courseTime,
        fallbackSubtitleId: options.fallbackSubtitleId,
        shouldAutoplay: true,
        tolerance,
    });
}
function resolveShadowPlaybackStartTime(options) {
    const backgroundCurrentTime = normalizeCourseTime(options.backgroundCurrentTime);
    const lastKnownCourseTime = normalizeCourseTime(options.lastKnownCourseTime);
    if (backgroundCurrentTime > 0.2) {
        return backgroundCurrentTime;
    }
    return lastKnownCourseTime;
}
function resolveObservedShadowCourseTime(options) {
    const observedTime = normalizeCourseTime(options.observedTime);
    const lastKnownCourseTime = normalizeCourseTime(options.lastKnownCourseTime);
    const pendingTargetTime = normalizeCourseTime(options.pendingTargetTime);
    const tolerance = Math.max(0, options.tolerance ?? 0.35);
    if (pendingTargetTime > tolerance &&
        observedTime + tolerance < pendingTargetTime) {
        return pendingTargetTime;
    }
    if (observedTime > 0.2) {
        return observedTime;
    }
    if (pendingTargetTime > 0.2) {
        return pendingTargetTime;
    }
    return lastKnownCourseTime;
}
function shouldApplyShadowSeekCorrection(options) {
    const currentTime = normalizeCourseTime(options.currentTime);
    const targetTime = normalizeCourseTime(options.targetTime);
    const tolerance = Math.max(0, options.tolerance ?? 0.35);
    if (targetTime <= tolerance) {
        return false;
    }
    return currentTime + tolerance < targetTime;
}
function encodeQueryParam(value) {
    return encodeURIComponent(String(value));
}
function buildCourseNavigationUrl(courseId, params = {}) {
    const id = String(courseId || '').trim();
    const queryEntries = [];
    if (id) {
        queryEntries.push(`id=${encodeQueryParam(id)}`);
    }
    Object.keys(params).forEach(key => {
        const value = params[key];
        if (value === undefined || value === null || value === '') {
            return;
        }
        queryEntries.push(`${encodeQueryParam(key)}=${encodeQueryParam(value)}`);
    });
    return queryEntries.length
        ? `/pages/course/course?${queryEntries.join('&')}`
        : '/pages/index/index';
}
function normalizeBackgroundAudioResumeState(value, now = Date.now()) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const raw = value;
    const courseId = String(raw.courseId || '').trim();
    const savedAt = Number(raw.savedAt);
    if (!courseId || !Number.isFinite(savedAt)) {
        return null;
    }
    if (now - savedAt > exports.BACKGROUND_AUDIO_RESUME_TTL_MS) {
        return null;
    }
    return {
        courseId,
        courseTime: normalizeCourseTime(Number(raw.courseTime)),
        subtitleId: typeof raw.subtitleId === 'string' && raw.subtitleId
            ? raw.subtitleId
            : null,
        audioSrc: typeof raw.audioSrc === 'string' ? raw.audioSrc : '',
        wasPlaying: Boolean(raw.wasPlaying),
        savedAt,
    };
}
function shouldRestoreBackgroundAudioRoute(options) {
    const resumeState = normalizeBackgroundAudioResumeState(options.resumeState, options.now);
    if (!resumeState) {
        return false;
    }
    if (options.currentRoute === 'pages/course/course' &&
        options.currentCourseId === resumeState.courseId) {
        return false;
    }
    const managerSrc = String(options.managerSrc || '');
    const hasMatchingAudio = !resumeState.audioSrc ||
        !managerSrc ||
        managerSrc === resumeState.audioSrc;
    if (!hasMatchingAudio) {
        return false;
    }
    return true;
}
function buildBackgroundPlaybackMeta(course, courseTime) {
    return {
        src: course.audio,
        startTime: normalizeCourseTime(courseTime),
        title: course.title || '外贸英语影子跟读',
        epname: '外贸英语影子跟读',
        singer: '外贸英语影子跟读',
        coverImgUrl: '',
    };
}
// 后台音频恢复状态的存取封装：storage 可注入，读取时统一走 normalize 校验，
// 任一 storage 异常都吞掉并通过 onError 上报调试信息，不阻断播放主流程。
function createBackgroundResumeStore(options) {
    return {
        read() {
            try {
                return normalizeBackgroundAudioResumeState(options.storage.get(exports.BACKGROUND_AUDIO_RESUME_KEY));
            }
            catch (error) {
                options.onError?.('read', error);
                return null;
            }
        },
        save(state) {
            try {
                options.storage.set(exports.BACKGROUND_AUDIO_RESUME_KEY, state);
                return true;
            }
            catch (error) {
                options.onError?.('save', error);
                return false;
            }
        },
        clear() {
            try {
                options.storage.remove(exports.BACKGROUND_AUDIO_RESUME_KEY);
                return true;
            }
            catch (error) {
                options.onError?.('clear', error);
                return false;
            }
        },
    };
}
