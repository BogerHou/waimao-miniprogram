import { API_BASE_URL } from '../config/env'
import type { AppConfigResponse } from './api'
import { request } from './request'

export type ListeningTrack = {
  id: string
  title: string
  duration: number
  free: boolean
  locked: boolean
  chapterId?: string
  transcript?: string
}

export type ListeningAlbum = {
  id: string
  title: string
  description: string
  category: string
  coverUrl: string
  trackCount: number
  duration: number
  tracks: ListeningTrack[]
}

export type ListeningCatalogResponse = {
  data: ListeningAlbum[]
  appConfig: AppConfigResponse
}

export type ListeningPlaybackTrack = {
  id: string
  title: string
  duration: number
  chapterId?: string
  audioSources: Array<{ provider: 'qiniu' | 'server'; url: string }>
}

export type ListeningPlaybackResponse = {
  album: { id: string; title: string; coverUrl: string }
  tracks: ListeningPlaybackTrack[]
  expiresAt: number
}

export function normalizeListeningResourceUrl(value: string): string {
  const url = String(value ?? '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`
}

// Catalog permissions and signed playback URLs always come from a fresh request.
// Persisting either would leave an account change or a paid-mode switch stale.
export async function fetchListeningAlbums(): Promise<ListeningCatalogResponse> {
  const response = await request<ListeningCatalogResponse>({
    url: '/api/waimao-mini/listening/albums',
    method: 'GET',
  })
  return {
    ...response,
    data: response.data.map(album => ({
      ...album,
      coverUrl: normalizeListeningResourceUrl(album.coverUrl),
    })),
  }
}

export async function fetchListeningPlayback(albumId: string): Promise<ListeningPlaybackResponse> {
  const id = albumId.trim()
  if (!id) throw new Error('请选择听力专辑')
  const response = await request<ListeningPlaybackResponse>({
    url: `/api/waimao-mini/listening/albums/${encodeURIComponent(id)}/playback`,
    method: 'GET',
  })
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
  }
}
