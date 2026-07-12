"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSceneSearchQuery = normalizeSceneSearchQuery;
exports.filterChaptersBySceneQuery = filterChaptersBySceneQuery;
exports.countChapterScenes = countChapterScenes;
function normalizeSceneSearchQuery(input) {
    return String(input ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function filterChaptersBySceneQuery(chapters, queryInput) {
    const query = normalizeSceneSearchQuery(queryInput);
    if (!query)
        return chapters;
    return chapters.flatMap(chapter => {
        const chapterMatch = searchable(`${chapter.label} ${chapter.title}`).includes(query);
        const scenes = chapterMatch
            ? chapter.scenes
            : chapter.scenes.filter(scene => searchable(`${scene.index} ${scene.title}`).includes(query));
        return scenes.length ? [{ ...chapter, scenes }] : [];
    });
}
function countChapterScenes(chapters) {
    return chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0);
}
function searchable(input) {
    return normalizeSceneSearchQuery(input);
}
