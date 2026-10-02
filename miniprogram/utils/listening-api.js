"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeListeningResourceUrl = normalizeListeningResourceUrl;
exports.fetchListeningAlbums = fetchListeningAlbums;
exports.fetchListeningPlayback = fetchListeningPlayback;
const env_1 = require("../config/env");
const request_1 = require("./request");
function normalizeListeningResourceUrl(value) {
    const url = String(value ?? '').trim();
    if (!url)
        return '';
    if (/^https?:\/\//i.test(url))
        return url;
    if (url.startsWith('//'))
        return `https:${url}`;
    return `${env_1.API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}
// Catalog permissions and signed playback URLs always come from a fresh request.
// Persisting either would leave an account change or a paid-mode switch stale.
async function fetchListeningAlbums() {
    const response = await (0, request_1.request)({
        url: '/api/waimao-mini/listening/albums',
        method: 'GET',
    });
    return {
        ...response,
        data: response.data.map(album => ({
            ...album,
            coverUrl: normalizeListeningResourceUrl(album.coverUrl),
        })),
    };
}
async function fetchListeningPlayback(albumId) {
    const id = albumId.trim();
    if (!id)
        throw new Error('请选择听力专辑');
    const response = await (0, request_1.request)({
        url: `/api/waimao-mini/listening/albums/${encodeURIComponent(id)}/playback`,
        method: 'GET',
    });
    return {
        ...response,
        album: {
            ...response.album,
            coverUrl: normalizeListeningResourceUrl(response.album.coverUrl),
        },
        tracks: response.tracks.map(track => ({
            ...track,
            audioSources: track.audioSources.map(source => ({
                ...source,
                url: normalizeListeningResourceUrl(source.url),
            })),
        })),
    };
}
