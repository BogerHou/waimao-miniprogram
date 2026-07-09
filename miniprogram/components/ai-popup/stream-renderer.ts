type DrainStreamingBufferOptions = {
  pendingText: string
  displayedText: string
  charsPerTick: number
  flushAll?: boolean
}

export function drainStreamingBuffer(options: DrainStreamingBufferOptions) {
  const pendingText = String(options.pendingText || '')
  if (!pendingText) {
    return {
      displayedText: options.displayedText,
      pendingText: '',
    }
  }

  const charsPerTick = options.flushAll
    ? pendingText.length
    : Math.max(1, Math.floor(options.charsPerTick || 1))

  const nextChunk = pendingText.slice(0, charsPerTick)

  return {
    displayedText: `${options.displayedText || ''}${nextChunk}`,
    pendingText: pendingText.slice(nextChunk.length),
  }
}
