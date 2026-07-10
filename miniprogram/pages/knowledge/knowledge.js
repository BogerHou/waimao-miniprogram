"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const share_1 = require("../../utils/share");
const dialogue_format_1 = require("../../utils/dialogue-format");
const knowledge_format_1 = require("../../utils/knowledge-format");
Page({
    data: {
        courseId: '',
        courseTitle: '知识点',
        loading: true,
        error: '',
        isEmpty: false,
        backgroundParagraphs: [],
        phraseItems: [],
        correction: {
            hasContent: false,
            promptLines: [],
            chinglishLines: [],
            nativeLines: [],
            extraLines: [],
        },
        noteParagraphs: [],
        hasKnowledgeContent: false,
        dialogue: [],
    },
    onLoad(query) {
        (0, share_1.enablePageShareMenu)();
        const courseId = query.id || query.courseId || '';
        const courseTitle = query.title ? decodeURIComponent(query.title) : '知识点';
        this.setData({ courseId, courseTitle });
        if (!courseId) {
            this.setData({
                loading: false,
                error: '小节ID未找到',
                isEmpty: false,
            });
            return;
        }
        void this.loadKnowledge(courseId);
    },
    async loadKnowledge(courseId) {
        this.setData({
            loading: true,
            error: '',
            isEmpty: false,
        });
        try {
            const detail = await (0, api_1.fetchCourseDetail)(courseId);
            this.applyDetail(detail);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '知识点加载失败，请稍后重试';
            this.setData({
                loading: false,
                error: message,
                isEmpty: false,
            });
        }
    },
    applyDetail(detail) {
        const knowledge = detail.knowledge;
        const formattedKnowledge = (0, knowledge_format_1.formatKnowledgeContent)({
            background: knowledge?.background,
            phrases: knowledge?.phrases,
            correction: knowledge?.correction,
            notes: knowledge?.notes,
        });
        const dialogue = detail.subtitles.length
            ? (0, dialogue_format_1.formatKnowledgeDialogueFromSubtitles)(detail.subtitles)
            : (0, dialogue_format_1.formatKnowledgeDialogue)(knowledge?.dialogue ?? []);
        const hasContent = formattedKnowledge.hasKnowledgeContent || dialogue.length > 0;
        this.setData({
            courseTitle: detail.title || this.data.courseTitle,
            ...formattedKnowledge,
            dialogue,
            loading: false,
            error: '',
            isEmpty: !hasContent,
        });
    },
    handleRetry() {
        if (this.data.courseId) {
            void this.loadKnowledge(this.data.courseId);
        }
    },
    onShareAppMessage() {
        const encodedTitle = encodeURIComponent(this.data.courseTitle || '知识点');
        return (0, share_1.buildAppMessageShare)({
            title: `${this.data.courseTitle || '知识点'} | 外贸英语影子跟读`,
            path: `/pages/knowledge/knowledge?id=${this.data.courseId}&title=${encodedTitle}`,
        });
    },
    onShareTimeline() {
        const encodedTitle = encodeURIComponent(this.data.courseTitle || '知识点');
        return (0, share_1.buildTimelineShare)({
            title: `${this.data.courseTitle || '知识点'} | 外贸英语影子跟读`,
            query: this.data.courseId
                ? `id=${this.data.courseId}&title=${encodedTitle}`
                : '',
        });
    },
});
