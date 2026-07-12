"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHARE_POSTER_CARD_HEIGHT = exports.SHARE_POSTER_PALETTE = exports.SHARE_POSTER_ICON_PATH = exports.SHARE_POSTER_HEIGHT = exports.SHARE_POSTER_WIDTH = void 0;
exports.drawShareRoundedRect = drawShareRoundedRect;
exports.drawShareWrappedText = drawShareWrappedText;
exports.renderSharePoster = renderSharePoster;
exports.SHARE_POSTER_WIDTH = 600;
exports.SHARE_POSTER_HEIGHT = 840;
exports.SHARE_POSTER_ICON_PATH = '/assets/images/icon.png';
exports.SHARE_POSTER_PALETTE = {
    bgStart: '#F8FAFF',
    bgEnd: '#E9EFFA',
    circleLarge: '#DCE5F7',
    circleSmall: '#C6D4F0',
    badgeBg: '#E8EDFB',
    badgeText: '#1E40AF',
    tagBg: '#EEF1F7',
    tagText: '#475569',
    title: '#0F172A',
    snippetBg: '#F5F7FB',
    snippetText: '#1E293B',
    brandMuted: '#94A3B8',
    accent: '#1E40AF',
};
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
// 微信聊天分享卡封面按 5:4 展示：canvas 元素保持 600x840，绘制与导出只用顶部 600x480 区域。
exports.SHARE_POSTER_CARD_HEIGHT = 480;
async function renderSharePoster(scope, canvasId, card, accentLabel, options = {}) {
    const ctx = wx.createCanvasContext(canvasId, scope);
    const width = exports.SHARE_POSTER_WIDTH;
    const height = exports.SHARE_POSTER_CARD_HEIGHT;
    const tagline = options.tagline ?? '打开小程序，继续学习英语听力';
    const palette = exports.SHARE_POSTER_PALETTE;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, palette.bgStart);
    gradient.addColorStop(1, palette.bgEnd);
    ctx.setFillStyle(gradient);
    ctx.fillRect(0, 0, width, height);
    ctx.setFillStyle(palette.circleLarge);
    ctx.beginPath();
    ctx.arc(width - 52, 70, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.setFillStyle(palette.circleSmall);
    ctx.beginPath();
    ctx.arc(54, height - 56, 64, 0, Math.PI * 2);
    ctx.fill();
    drawShareRoundedRect(ctx, 36, 44, width - 72, height - 88, 24, '#FFFFFF');
    drawShareRoundedRect(ctx, 64, 74, 150, 40, 20, palette.badgeBg);
    ctx.setFillStyle(palette.badgeText);
    ctx.setFontSize(20);
    ctx.fillText(accentLabel, 90, 101);
    drawShareRoundedRect(ctx, width - 210, 74, 146, 40, 20, palette.tagBg);
    ctx.setFillStyle(palette.tagText);
    ctx.setFontSize(19);
    ctx.fillText(card.badge, width - 188, 101);
    ctx.setFillStyle(palette.title);
    ctx.setFontSize(32);
    drawShareWrappedText(ctx, card.title, 64, 168, width - 128, 44, 2);
    ctx.setFillStyle(options.highlightMuted ? palette.brandMuted : palette.accent);
    ctx.setFontSize(20);
    ctx.fillText(card.highlight, 64, 240);
    drawShareRoundedRect(ctx, 64, 258, width - 128, 104, 16, palette.snippetBg);
    ctx.setFillStyle(palette.snippetText);
    ctx.setFontSize(22);
    drawShareWrappedText(ctx, card.snippet, 88, 298, width - 176, 34, 2);
    // 品牌页脚（紧凑版）
    const iconSize = 40;
    const iconY = height - 96;
    let textX = 64;
    try {
        ctx.drawImage(exports.SHARE_POSTER_ICON_PATH, 64, iconY, iconSize, iconSize);
        textX = 64 + iconSize + 14;
    }
    catch (_error) {
        textX = 64;
    }
    ctx.setFillStyle(palette.brandMuted);
    ctx.setFontSize(17);
    ctx.fillText('外贸英语影子跟读', textX, iconY + 15);
    ctx.setFillStyle(palette.accent);
    ctx.setFontSize(19);
    ctx.fillText(tagline, textX, iconY + 40);
    await new Promise(resolve => {
        ctx.draw(false, () => resolve());
    });
    return await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
            canvasId,
            x: 0,
            y: 0,
            width,
            height,
            destWidth: width * 2,
            destHeight: height * 2,
            fileType: 'png',
            success: res => resolve(res.tempFilePath),
            fail: reject,
        }, scope);
    });
}
