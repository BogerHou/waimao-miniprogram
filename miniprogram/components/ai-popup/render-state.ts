export type AiPopupMessage = {
  role: 'user' | 'assistant'
  content: string
  displayText?: string
  parsedNodes?: any[]
  isStreaming?: boolean
}

export function getAssistantDisplayState(message?: AiPopupMessage | null) {
  const parsedNodes = Array.isArray(message?.parsedNodes) ? message!.parsedNodes : []
  const hasParsedNodes = parsedNodes.length > 0
  const text = String(message?.displayText || message?.content || '')
  const showParsedNodes = !!message && message.role === 'assistant' && !message.isStreaming && hasParsedNodes
  const showStreamingText = !!message && message.role === 'assistant' && !showParsedNodes

  return {
    text,
    showParsedNodes,
    showStreamingText,
  }
}
