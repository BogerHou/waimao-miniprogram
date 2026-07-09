"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../utils/api");
const share_1 = require("../../utils/share");
const dialogue_format_1 = require("../../utils/dialogue-format");
Page({
    data: {
        courseId: '',
        courseTitle: '知识点',
        loading: true,
        error: '',
        sections: [],
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
            });
            return;
        }
        void this.loadKnowledge(courseId);
    },
    async loadKnowledge(courseId) {
        this.setData({
            loading: true,
            error: '',
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
            });
        }
    },
    applyDetail(detail) {
        const knowledge = detail.knowledge;
        const sections = [
            { title: '背景', content: knowledge?.background ?? '' },
            { title: '重点表达', content: knowledge?.phrases ?? '' },
            { title: '纠错提醒', content: knowledge?.correction ?? '' },
            { title: '讲解备注', content: knowledge?.notes ?? '' },
        ].filter(section => section.content.trim());
        const dialogue = (0, dialogue_format_1.formatKnowledgeDialogue)(knowledge?.dialogue ?? []);
        this.setData({
            courseTitle: detail.title || this.data.courseTitle,
            sections,
            dialogue,
            loading: false,
            error: sections.length || dialogue.length ? '' : '暂无知识点内容',
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
