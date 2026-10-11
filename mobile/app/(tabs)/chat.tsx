import { useCallback } from 'react'
import { useBottomTabBarHeight } from 'expo-router/js-tabs'
import { AIGuideScreen, type AskFn } from '@/src/components/AIGuideScreen'
import { askIslamicQuestion } from '@/src/services/islamicChat'

export default function ChatScreen() {
  const tabBarHeight = useBottomTabBarHeight()

  const ask = useCallback<AskFn>(async (messages) => {
    const question = messages[messages.length - 1]?.content ?? ''
    return askIslamicQuestion(question, messages.slice(0, -1))
  }, [])

  return <AIGuideScreen ask={ask} bottomInset={tabBarHeight} />
}
