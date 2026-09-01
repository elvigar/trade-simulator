'use client'

import { useCallback, useState } from 'react'
import { ApiError, api } from '@/lib/api'
import type { ChatMessage } from '@/lib/types'

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `msg-${idCounter}-${Date.now()}`
}

export function useChat(onActionsExecuted?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || sending) return

      const userMessage: ChatMessage = { id: nextId(), role: 'user', content: trimmed }
      const pendingId = nextId()
      const pendingMessage: ChatMessage = { id: pendingId, role: 'assistant', content: '', pending: true }

      setMessages((prev) => [...prev, userMessage, pendingMessage])
      setSending(true)

      try {
        const response = await api.sendChatMessage(trimmed)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: response.message, actionResults: response.action_results, pending: false }
              : m,
          ),
        )
        if (response.action_results?.length) {
          onActionsExecuted?.()
        }
      } catch (e) {
        const message = e instanceof ApiError ? e.message : 'Something went wrong reaching the AI assistant.'
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? { ...m, content: message, pending: false, isError: true } : m)),
        )
      } finally {
        setSending(false)
      }
    },
    [sending, onActionsExecuted],
  )

  return { messages, sending, sendMessage }
}
