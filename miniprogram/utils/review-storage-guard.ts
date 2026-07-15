import { STARRED_CUES_STORAGE_KEY } from './practice-marks'
import { REVIEW_LIBRARY_STORAGE_KEY } from './review-library'

type StorageAdapter = {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

const REVIEW_STORAGE_KEYS = [
  REVIEW_LIBRARY_STORAGE_KEY,
  STARRED_CUES_STORAGE_KEY,
] as const

export function createReviewStorageGuard(storage: StorageAdapter) {
  const snapshot = new Map<string, unknown>()
  for (const key of REVIEW_STORAGE_KEYS) {
    const value = storage.get(key)
    if (value !== undefined && value !== null && value !== '') {
      snapshot.set(key, value)
    }
  }

  return () => {
    for (const [key, value] of snapshot) {
      const current = storage.get(key)
      if (current === undefined || current === null || current === '') {
        storage.set(key, value)
      }
    }
  }
}

export function createWxReviewStorageGuard() {
  return createReviewStorageGuard({
    get: key => wx.getStorageSync(key),
    set: (key, value) => wx.setStorageSync(key, value),
  })
}
