"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHARE_POSTER_PALETTE = exports.ACTIVE_SHARE_POSTER_THEME = exports.SHARE_POSTER_PALETTES = exports.SHARE_POSTER_ICON_PATH = exports.SHARE_POSTER_HEIGHT = exports.SHARE_POSTER_WIDTH = void 0;
exports.drawShareRoundedRect = drawShareRoundedRect;
exports.drawShareWrappedText = drawShareWrappedText;
exports.drawShareBrandFooter = drawShareBrandFooter;
exports.renderSharePoster = renderSharePoster;
exports.SHARE_POSTER_WIDTH = 600;
exports.SHARE_POSTER_HEIGHT = 840;
exports.SHARE_POSTER_ICON_PATH = '/assets/images/icon.png';
// 与 miniprogram/styles/theme.less 的主题切换保持一致：
// warm = 温暖学习风（橘），business = 商务专业风（藏青）。
exports.SHARE_POSTER_PALETTES = {
    warm: {
        bgStart: '#FFFBF4',
        bgEnd: '#FDEFDD',
        circleLarge: '#FDE3C3',
        circleSmall: '#FAD1A0',
        badgeBg: '#FFEDD5',
        badgeText: '#EA580C',
        tagBg: '#F4EEE3',
        tagText: '#57534E',
        title: '#292524',
        snippetBg: '#FAF6EF',
        snippetText: '#44403C',
        brandMuted: '#A8A29E',
        accent: '#EA580C',
    },
    business: {
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
    },
};
exports.ACTIVE_SHARE_POSTER_THEME = 'business';
exports.SHARE_POSTER_PALETTE = exports.SHARE_POSTER_PALETTES[exports.ACTIVE_SHARE_POSTER_THEME];
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
function drawShareBrandFooter(ctx, _width, height, tagline, accentColor = exports.SHARE_POSTER_PALETTE.accent) {
    const iconSize = 58;
    const iconX = 72;
    const iconY = height - 160;
    let textX = iconX;
    try {
        ctx.drawImage(exports.SHARE_POSTER_ICON_PATH, iconX, iconY, iconSize, iconSize);
        textX = iconX + iconSize + 18;
    }
    catch (_error) {
        textX = iconX;
    }
    ctx.setFillStyle(exports.SHARE_POSTER_PALETTE.brandMuted);
    ctx.setFontSize(22);
    ctx.fillText('外贸英语影子跟读', textX, height - 134);
    ctx.setFillStyle(accentColor);
    ctx.setFontSize(26);
    ctx.fillText(tagline, textX, height - 88);
}
async function renderSharePoster(scope, canvasId, card, accentLabel) {
    const ctx = wx.createCanvasContext(canvasId, scope);
    const width = exports.SHARE_POSTER_WIDTH;
    const height = exports.SHARE_POSTER_HEIGHT;
    const palette = exports.SHARE_POSTER_PALETTE;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, palette.bgStart);
    gradient.addColorStop(1, palette.bgEnd);
    ctx.setFillStyle(gradient);
    ctx.fillRect(0, 0, width, height);
    ctx.setFillStyle(palette.circleLarge);
    ctx.beginPath();
    ctx.arc(width - 70, 92, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.setFillStyle(palette.circleSmall);
    ctx.beginPath();
    ctx.arc(96, height - 120, 72, 0, Math.PI * 2);
    ctx.fill();
    drawShareRoundedRect(ctx, 40, 56, width - 80, height - 112, 28, '#FFFFFF');
    drawShareRoundedRect(ctx, 72, 92, 152, 42, 21, palette.badgeBg);
    ctx.setFillStyle(palette.badgeText);
    ctx.setFontSize(22);
    ctx.fillText(accentLabel, 102, 120);
    drawShareRoundedRect(ctx, width - 220, 92, 148, 42, 21, palette.tagBg);
    ctx.setFillStyle(palette.tagText);
    ctx.setFontSize(20);
    ctx.fillText(card.badge, width - 194, 120);
    ctx.setFillStyle(palette.title);
    ctx.setFontSize(38);
    drawShareWrappedText(ctx, card.title, 72, 190, width - 144, 54, 2);
    ctx.setFillStyle(palette.accent);
    ctx.setFontSize(24);
    ctx.fillText(card.highlight, 72, 288);
    drawShareRoundedRect(ctx, 72, 320, width - 144, 246, 24, palette.snippetBg);
    ctx.setFillStyle(palette.snippetText);
    ctx.setFontSize(30);
    drawShareWrappedText(ctx, card.snippet, 104, 378, width - 208, 48, 4);
    drawShareBrandFooter(ctx, width, height, '打开小程序，继续学习英语听力');
    await new Promise(resolve => {
        ctx.draw(false, () => resolve());
    });
    return await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
            canvasId,
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
