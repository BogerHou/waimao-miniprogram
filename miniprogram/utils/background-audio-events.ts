type AudioEventCallback = (...args: any[]) => void
type ManagerEvents = { subscribers: Map<string, Set<AudioEventCallback>> }
const managers = new WeakMap<object, ManagerEvents>()

// BackgroundAudioManager has no portable off-event API. Register one native
// listener per event, then dispose page listeners without retaining old pages.
export function subscribeBackgroundAudioEvent(
  manager: Record<string, any>,
  event: string,
  callback: AudioEventCallback,
): () => void {
  let registry = managers.get(manager)
  if (!registry) {
    registry = { subscribers: new Map() }
    managers.set(manager, registry)
  }
  let callbacks = registry.subscribers.get(event)
  if (!callbacks) {
    callbacks = new Set()
    registry.subscribers.set(event, callbacks)
    const listeners = callbacks
    manager[event]((...args: any[]) => listeners.forEach(listener => listener(...args)))
  }
  callbacks.add(callback)
  const listeners = callbacks
  return () => { listeners.delete(callback) }
}
