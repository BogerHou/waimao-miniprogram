export type AudioFocusOwner = 'listening' | 'course' | 'review'
type FocusListener = (next: AudioFocusOwner | null, previous: AudioFocusOwner | null) => void

let owner: AudioFocusOwner | null = null
const listeners = new Set<FocusListener>()

export function getAudioFocusOwner(): AudioFocusOwner | null {
  return owner
}

export function claimAudioFocus(next: AudioFocusOwner): void {
  if (owner === next) return
  const previous = owner
  // Notify before replacing the owner so the old player can safely pause its manager.
  listeners.forEach(listener => listener(next, previous))
  owner = next
}

export function releaseAudioFocus(previous: AudioFocusOwner): void {
  if (owner !== previous) return
  listeners.forEach(listener => listener(null, previous))
  owner = null
}

export function subscribeAudioFocus(listener: FocusListener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
