"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCompletionStatsLabel = buildCompletionStatsLabel;
exports.renderCourseCompletionPoster = renderCourseCompletionPoster;
const share_poster_1 = require("../../utils/share-poster");
const WIDTH = 600;
const HEIGHT = 480;
const COMPLETION_SHARE_BG_PATH = '/assets/images/completion-share-bg.jpg';
const GOLD = '#E0A93E';
const GOLD_SOFT = '#F6DFAE';
function buildCompletionStatsLabel(stats) {
    return stats.practicedCount > 0
        ? `共 ${stats.totalCues} 句 · 本次精练 ${stats.practicedCount} 句`
        : `共 ${stats.totalCues} 句`;
}
async function renderCourseCompletionPoster(scope, canvasId, courseTitle, stats) {
    const ctx = wx.createCanvasContext(canvasId, scope);
    const palette = share_poster_1.SHARE_POSTER_PALETTE;
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, palette.bgStart);
    gradient.addColorStop(1, palette.bgEnd);
    ctx.setFillStyle(gradient);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.setFillStyle(palette.circleLarge);
    ctx.beginPath();
    ctx.arc(WIDTH - 40, 70, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.setFillStyle(palette.circleSmall);
    ctx.beginPath();
    ctx.arc(40, HEIGHT - 60, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.setFillStyle(GOLD_SOFT);
    ctx.beginPath();
    ctx.arc(70, 80, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.setFillStyle(GOLD);
    ctx.beginPath();
    ctx.arc(120, 44, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(WIDTH - 70, HEIGHT - 90, 9, 0, Math.PI * 2);
    ctx.fill();
    try {
        ctx.drawImage(COMPLETION_SHARE_BG_PATH, 0, 0, WIDTH, HEIGHT);
    }
    catch (_error) {
        // 插画底图缺失时保留上面的主题渐变兜底。
    }
    (0, share_poster_1.drawShareRoundedRect)(ctx, 52, 60, WIDTH - 104, HEIGHT - 120, 26, GOLD_SOFT);
    (0, share_poster_1.drawShareRoundedRect)(ctx, 56, 64, WIDTH - 112, HEIGHT - 128, 24, '#FFFFFF');
    ctx.setFillStyle(GOLD_SOFT);
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 130, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.setFillStyle(GOLD);
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 130, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.setTextAlign('center');
    ctx.setFillStyle('#FFFFFF');
    ctx.setFontSize(34);
    ctx.fillText('✓', WIDTH / 2, 142);
    ctx.setFillStyle(palette.title);
    ctx.setFontSize(32);
    ctx.fillText('本小节完成', WIDTH / 2, 218);
    ctx.setFillStyle(palette.snippetText);
    ctx.setFontSize(25);
    (0, share_poster_1.drawShareWrappedText)(ctx, courseTitle, WIDTH / 2, 262, WIDTH - 220, 36, 2);
    ctx.setFillStyle(palette.tagText);
    ctx.setFontSize(21);
    ctx.fillText(buildCompletionStatsLabel(stats), WIDTH / 2, 344);
    ctx.setFillStyle(palette.brandMuted);
    ctx.setFontSize(19);
    ctx.fillText('外贸英语影子跟读 · 一起来练口语', WIDTH / 2, 388);
    ctx.setTextAlign('left');
    await new Promise(resolve => ctx.draw(false, () => resolve()));
    return await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
            canvasId,
            x: 0,
            y: 0,
            width: WIDTH,
            height: HEIGHT,
            destWidth: WIDTH * 2,
            destHeight: HEIGHT * 2,
            fileType: 'png',
            success: res => resolve(res.tempFilePath),
            fail: reject,
        }, scope);
    });
}
