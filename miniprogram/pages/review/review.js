"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWordAudioTapAction = resolveWordAudioTapAction;
exports.buildReviewSourceUrl = buildReviewSourceUrl;
const api_1 = require("../../utils/api");
const review_library_1 = require("../../utils/review-library");
const practice_marks_1 = require("../../utils/practice-marks");
function resolveWordAudioTapAction(current, targetId) {
    if (current.id !== targetId)
        return 'start';
    if (current.status === 'playing')
        return 'pause';
    if (current.status === 'paused')
        return 'resume';
    if (current.status === 'loading')
        return 'cancel';
    return 'start';
}
function buildReviewSourceUrl(item, reviewOnly = false) {
    if (!item?.courseId || !item.cueId)
        return '';
    const query = [
        `id=${encodeURIComponent(item.courseId)}`,
        `cueId=${encodeURIComponent(item.cueId)}`,
        'stage=practice',
        'autoplay=1',
        reviewOnly ? 'review=1' : '',
    ].filter(Boolean).join('&');
    return `/pages/course/course?${query}`;
}
Page({
    wordAudioContext: null,
    data: {
        tab: 'words',
        words: [],
        cues: [],
        wordCount: 0,
        cueCount: 0,
        loading: false,
        activeWordAudioId: '',
        wordAudioStatus: 'idle',
    },
    onShow() {
        this.loadLibrary();
        void this.hydrateLegacyCueDetails();
    },
    onHide() {
        this.resetWordAudio();
    },
    onUnload() {
        this.wordAudioContext?.destroy();
        this.wordAudioContext = null;
    },
    loadLibrary() {
        const library = this.readLibrary();
        this.setData({
            words: library.words,
            cues: library.cues,
            wordCount: library.words.length,
            cueCount: library.cues.length,
        });
    },
    handleTabChange(event) {
        const tab = event.currentTarget.dataset.tab;
        if (tab && tab !== this.data.tab) {
            this.resetWordAudio();
            this.setData({ tab });
        }
    },
    handleOpenWordSource(event) {
        const normalized = String(event.currentTarget.dataset.id ?? '');
        const item = this.data.words.find(word => word.normalized === normalized);
        this.openSource(item);
    },
    handleOpenCueSource(event) {
        const { courseId, cueId } = event.currentTarget.dataset;
        const item = this.data.cues.find(cue => cue.courseId === courseId && cue.cueId === cueId);
        this.openSource(item, true);
    },
    openSource(item, reviewOnly = false) {
        const url = buildReviewSourceUrl(item, reviewOnly);
        if (!url) {
            wx.showToast({ title: '这条记录暂无来源句', icon: 'none' });
            return;
        }
        wx.navigateTo({ url });
    },
    handleDeleteWord(event) {
        const normalized = String(event.currentTarget.dataset.id ?? '');
        if (this.data.activeWordAudioId === normalized)
            this.resetWordAudio();
        this.writeLibrary((0, review_library_1.removeReviewWord)(this.readLibrary(), normalized));
        this.loadLibrary();
    },
    handleDeleteCue(event) {
        const { courseId, cueId } = event.currentTarget.dataset;
        if (!courseId || !cueId)
            return;
        const map = (0, practice_marks_1.normalizeStarredCueMap)(wx.getStorageSync(practice_marks_1.STARRED_CUES_STORAGE_KEY));
        const nextMap = (0, practice_marks_1.isCueStarred)(map, courseId, cueId)
            ? (0, practice_marks_1.toggleStarredCue)(map, courseId, cueId)
            : map;
        wx.setStorageSync(practice_marks_1.STARRED_CUES_STORAGE_KEY, nextMap);
        this.writeLibrary((0, review_library_1.removeReviewCue)(this.readLibrary(), courseId, cueId));
        this.loadLibrary();
    },
    handlePlayWordAudio(event) {
        const { id, url } = event.currentTarget.dataset;
        const audioId = String(id ?? '');
        const audioUrl = String(url ?? '');
        if (!audioId || !audioUrl)
            return;
        const action = resolveWordAudioTapAction({
            id: this.data.activeWordAudioId,
            status: this.data.wordAudioStatus,
        }, audioId);
        if (action === 'pause') {
            this.setData({ wordAudioStatus: 'paused' });
            this.wordAudioContext?.pause();
            return;
        }
        if (action === 'resume') {
            if (!this.wordAudioContext) {
                this.resetWordAudio();
                return;
            }
            this.setData({ wordAudioStatus: 'loading' });
            this.wordAudioContext.play();
            return;
        }
        if (action === 'cancel') {
            this.resetWordAudio();
            return;
        }
        const context = this.ensureWordAudioContext();
        context.stop();
        this.setData({ activeWordAudioId: audioId, wordAudioStatus: 'loading' });
        context.src = audioUrl;
        context.play();
    },
    ensureWordAudioContext() {
        if (this.wordAudioContext)
            return this.wordAudioContext;
        const context = wx.createInnerAudioContext();
        context.autoplay = false;
        context.obeyMuteSwitch = true;
        context.onPlay(() => {
            if (this.data.activeWordAudioId)
                this.setData({ wordAudioStatus: 'playing' });
        });
        context.onPause(() => {
            if (this.data.activeWordAudioId && this.data.wordAudioStatus === 'playing') {
                this.setData({ wordAudioStatus: 'paused' });
            }
        });
        context.onWaiting(() => {
            if (this.data.activeWordAudioId && this.data.wordAudioStatus !== 'paused') {
                this.setData({ wordAudioStatus: 'loading' });
            }
        });
        context.onCanplay(() => {
            if (this.data.activeWordAudioId && this.data.wordAudioStatus === 'loading' && !context.paused) {
                this.setData({ wordAudioStatus: 'playing' });
            }
        });
        context.onEnded(() => this.resetWordAudio());
        context.onError(() => {
            if (!this.data.activeWordAudioId)
                return;
            this.resetWordAudio();
            wx.showToast({ title: '发音播放失败', icon: 'none' });
        });
        this.wordAudioContext = context;
        return context;
    },
    resetWordAudio() {
        this.setData({ activeWordAudioId: '', wordAudioStatus: 'idle' });
        this.wordAudioContext?.stop();
    },
    async hydrateLegacyCueDetails() {
        const map = (0, practice_marks_1.normalizeStarredCueMap)(wx.getStorageSync(practice_marks_1.STARRED_CUES_STORAGE_KEY));
        let library = this.readLibrary();
        const known = new Set(library.cues.map(item => `${item.courseId}:${item.cueId}`));
        const pendingCourses = Object.entries(map).filter(([courseId, cueIds]) => cueIds.some(cueId => !known.has(`${courseId}:${cueId}`)));
        if (!pendingCourses.length)
            return;
        this.setData({ loading: true });
        for (const [courseId, cueIds] of pendingCourses) {
            try {
                const detail = await (0, api_1.fetchCourseDetail)(courseId);
                for (const cueId of cueIds) {
                    const cue = detail.subtitles.find(item => item.id === cueId);
                    if (!cue)
                        continue;
                    library = (0, review_library_1.upsertReviewCue)(library, {
                        courseId,
                        courseTitle: detail.title,
                        cueId,
                        cueText: cue.text,
                        cueTranslation: cue.translation ?? '',
                    });
                }
            }
            catch (error) {
                console.warn('[Review] hydrate legacy cue failed', { courseId, error });
            }
        }
        this.writeLibrary(library);
        this.setData({ loading: false });
        this.loadLibrary();
    },
    readLibrary() {
        return (0, review_library_1.normalizeReviewLibrary)(wx.getStorageSync(review_library_1.REVIEW_LIBRARY_STORAGE_KEY));
    },
    writeLibrary(library) {
        wx.setStorageSync(review_library_1.REVIEW_LIBRARY_STORAGE_KEY, library);
    },
});
