/// <reference path="./types/index.d.ts" />

interface IUserProfile {
  id: string
  nickname: string
  avatarUrl: string
  streakCount: number
  totalCompleted: number
  currentCourseId?: string | null
  studySeconds: number
}

interface IUserProgress {
  currentCourseId?: string | null
  currentSceneId?: string | null
  completedCourseIds: string[]
  completedSceneIds?: string[]
  streakCount: number
  totalCompleted: number
  lastStudyDate: string | null
}

interface IAppGlobalData {
  token: string | null
  user?: IUserProfile
  progress?: IUserProgress
  fullAccess?: boolean
  appConfig?: {
    home?: {
      unlockPromptEnabled?: boolean
      unlockPromptTitle?: string
      unlockPromptDescription?: string
      unlockPromptCta?: string
    }
    courseDetail: {
      shadowModeEnabled: boolean
    }
  }
  readyPromise?: Promise<void>
  requestIndexAction?: 'login' | 'unlock' | null
}

interface IAppOption {
  globalData: IAppGlobalData
  ensureAuth: (profileOverride?: { nickname?: string; avatarUrl?: string }) => Promise<void>
  refreshProgress: () => Promise<void>
  refreshAppConfig: () => Promise<void>
  restoreBackgroundAudioRoute: () => void
  initializeAuth: (force?: boolean, profileOverride?: { nickname?: string; avatarUrl?: string }) => Promise<void>
  fetchUserData: () => Promise<void>
  syncFromStore: () => void
  storeUnsubscribe?: () => void
}
