"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enablePageShareMenu = enablePageShareMenu;
exports.buildAppMessageShare = buildAppMessageShare;
exports.buildTimelineShare = buildTimelineShare;
const DEFAULT_SHARE_IMAGE = '/assets/images/icon.png';
function enablePageShareMenu() {
    if (typeof wx.showShareMenu !== 'function') {
        return;
    }
    try {
        wx.showShareMenu({
            menus: ['shareAppMessage', 'shareTimeline'],
        });
    }
    catch (error) {
        console.warn('[Share] showShareMenu failed', error);
    }
}
function buildAppMessageShare(options) {
    return {
        title: options.title,
        path: options.path || '/pages/index/index',
        imageUrl: options.imageUrl || DEFAULT_SHARE_IMAGE,
    };
}
function buildTimelineShare(options) {
    return {
        title: options.title,
        query: options.query || '',
        imageUrl: options.imageUrl || DEFAULT_SHARE_IMAGE,
    };
}
