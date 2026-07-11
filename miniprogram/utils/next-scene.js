"use strict";
// 小节完成后"学下一节"的目标解析：同章下一小节优先，本章学完则跳到后续章节
// 第一个未锁定的小节；全部学完或找不到当前小节时返回 null。
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNextScene = resolveNextScene;
function resolveNextScene(chapters, currentSceneId) {
    const flat = [];
    for (const chapter of chapters) {
        for (const scene of chapter.scenes ?? []) {
            flat.push({
                id: scene.id,
                title: scene.title,
                chapterLabel: chapter.label,
                locked: Boolean(scene.locked ?? chapter.locked),
            });
        }
    }
    const currentIndex = flat.findIndex(scene => scene.id === currentSceneId);
    if (currentIndex < 0) {
        return null;
    }
    for (let i = currentIndex + 1; i < flat.length; i += 1) {
        if (!flat[i].locked) {
            const { id, title, chapterLabel } = flat[i];
            return { id, title, chapterLabel };
        }
    }
    return null;
}
