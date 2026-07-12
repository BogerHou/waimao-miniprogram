"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const review_library_1 = require("../../utils/review-library");
const practice_marks_1 = require("../../utils/practice-marks");
Page({
    wordAudioContext: null,
    data: {
        tab: 'words',
        words: [],
        cues: [],
        wordCount: 0,
        cueCount: 0,
        loading: false,
    },
    onShow() {
        this.loadLibrary();
        void this.hydrateLegacyCueDetails();
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
        if (tab && tab !== this.data.tab)
            this.setData({ tab });
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
        if (!item?.courseId || !item.cueId) {
            wx.showToast({ title: '这条记录暂无来源句', icon: 'none' });
            return;
        }
        const query = [
            `id=${encodeURIComponent(item.courseId)}`,
            `cueId=${encodeURIComponent(item.cueId)}`,
            'stage=practice',
            reviewOnly ? 'review=1' : '',
        ].filter(Boolean).join('&');
        wx.navigateTo({ url: `/pages/course/course?${query}` });
    },
    handleDeleteWord(event) {
        const normalized = String(event.currentTarget.dataset.id ?? '');
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
        const url = String(event.currentTarget.dataset.url ?? '');
        if (!url)
            return;
        if (!this.wordAudioContext) {
            this.wordAudioContext = wx.createInnerAudioContext();
            this.wordAudioContext.obeyMuteSwitch = true;
            this.wordAudioContext.onError(() => wx.showToast({ title: '发音播放失败', icon: 'none' }));
        }
        this.wordAudioContext.stop();
        this.wordAudioContext.src = url;
        this.wordAudioContext.play();
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
