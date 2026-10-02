"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAudioFocusOwner = getAudioFocusOwner;
exports.claimAudioFocus = claimAudioFocus;
exports.releaseAudioFocus = releaseAudioFocus;
exports.subscribeAudioFocus = subscribeAudioFocus;
let owner = null;
const listeners = new Set();
function getAudioFocusOwner() {
    return owner;
}
function claimAudioFocus(next) {
    if (owner === next)
        return;
    const previous = owner;
    // Notify before replacing the owner so the old player can safely pause its manager.
    listeners.forEach(listener => listener(next, previous));
    owner = next;
}
function releaseAudioFocus(previous) {
    if (owner !== previous)
        return;
    listeners.forEach(listener => listener(null, previous));
    owner = null;
}
function subscribeAudioFocus(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
