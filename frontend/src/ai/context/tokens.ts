function estimateTokenCount(text: string): number {
  if (!text) return 0

  const chars = text.length
  const avgCharsPerToken = 4

  return Math.ceil(chars / avgCharsPerToken)
}

function estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
  let total = 0

  for (const message of messages) {
    total += estimateTokenCount(message.content)
    total += 4
    total += estimateTokenCount(message.role)
  }

  total += 2

  return total
}

export { estimateTokenCount, estimateMessageTokens }
