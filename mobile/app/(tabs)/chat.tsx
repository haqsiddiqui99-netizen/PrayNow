import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { AppIcon } from '@/src/components/AppIcon'
import { colors } from '@/src/constants/theme'
import {
  askIslamicQuestion,
  createMessage,
  SUGGESTED_QUESTIONS,
  type ChatMessage,
} from '@/src/services/islamicChat'

const WELCOME_MESSAGE = createMessage(
  'assistant',
  'As-salamu alaykum! I\'m your Islamic guidance assistant. Ask me about prayers, fasting, Quran, Hadith, Halal/Haram, or any aspect of Islamic life.',
)

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
      <AppIcon name="ai" size={28} variant="avatar" style={styles.avatarIcon} />
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    </View>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      {!isUser && <AppIcon name="ai" size={28} variant="avatar" style={styles.avatarIcon} />}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.content}</Text>
      </View>
    </View>
  )
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const tabBarHeight = useBottomTabBarHeight()
  const scrollRef = useRef<ScrollView>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [])

  useEffect(() => {
    scrollToEnd()
  }, [messages, isTyping, scrollToEnd])

  const sendQuestion = async (text: string) => {
    const question = text.trim()
    if (!question || isTyping) return

    setInput('')
    setMessages((prev) => [...prev, createMessage('user', question)])
    setIsTyping(true)

    const history = messages.slice(1).map(({ role, content }) => ({ role, content }))

    try {
      const answer = await askIslamicQuestion(question, history)
      setMessages((prev) => [...prev, createMessage('assistant', answer)])
    } finally {
      setIsTyping(false)
    }
  }

  const showSuggestions = messages.length === 1 && !isTyping

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <View style={styles.flex}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerIcon}>
          <AppIcon name="ai" size={36} variant="header" />
        </View>
          <View>
            <Text style={styles.headerTitle}>Islamic AI Guide</Text>
            <Text style={styles.headerSub}>Powered by OpenAI · Ask about Islam</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={[styles.messagesContent, { paddingBottom: tabBarHeight + 16 }]}
          keyboardShouldPersistTaps="handled">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isTyping && <TypingIndicator />}

          {showSuggestions && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsLabel}>Try asking:</Text>
              {SUGGESTED_QUESTIONS.map((q) => (
                <Pressable key={q} style={styles.suggestionChip} onPress={() => void sendQuestion(q)}>
                  <Text style={styles.suggestionText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: tabBarHeight + Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={styles.input}
            placeholder="Ask about Islam..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            editable={!isTyping}
            returnKeyType="send"
            onSubmitEditing={() => void sendQuestion(input)}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || isTyping) && styles.sendBtnDisabled]}
            disabled={!input.trim() || isTyping}
            onPress={() => void sendQuestion(input)}>
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.primary,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  bubbleRow: { flexDirection: 'row', gap: 8, maxWidth: '88%' },
  bubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleRowAssistant: { alignSelf: 'flex-start' },
  avatarIcon: { marginTop: 2 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '100%',
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 21, color: colors.textPrimary },
  bubbleTextUser: { color: '#fff' },
  typingBubble: { paddingHorizontal: 20, paddingVertical: 14 },
  suggestions: { marginTop: 8, gap: 8 },
  suggestionsLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  suggestionChip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  suggestionText: { fontSize: 13, color: colors.primary, lineHeight: 19 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.surface2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    backgroundColor: colors.surface0,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
