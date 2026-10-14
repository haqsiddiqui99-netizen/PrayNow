import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AIGuideScreen, type AskFn } from '@/src/components/AIGuideScreen'
import { askIslamicQuestion } from '@/src/services/islamicChat'

export default function AIChatScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const ask = useCallback<AskFn>(async (messages) => {
    const question = messages[messages.length - 1]?.content ?? ''
    return askIslamicQuestion(question, messages.slice(0, -1))
  }, [])

  const close = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [router])

  return <AIGuideScreen ask={ask} bottomInset={insets.bottom} onClose={close} />
}
