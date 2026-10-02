"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeBackgroundAudioEvent = subscribeBackgroundAudioEvent;
const managers = new WeakMap();
// BackgroundAudioManager has no portable off-event API. Register one native
// listener per event, then dispose page listeners without retaining old pages.
function subscribeBackgroundAudioEvent(manager, event, callback) {
    let registry = managers.get(manager);
    if (!registry) {
        registry = { subscribers: new Map() };
        managers.set(manager, registry);
    }
    let callbacks = registry.subscribers.get(event);
    if (!callbacks) {
        callbacks = new Set();
        registry.subscribers.set(event, callbacks);
        const listeners = callbacks;
        manager[event]((...args) => listeners.forEach(listener => listener(...args)));
    }
    callbacks.add(callback);
    const listeners = callbacks;
    return () => { listeners.delete(callback); };
}
