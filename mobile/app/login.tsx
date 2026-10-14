import { Redirect, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/src/context/AuthContext'
import { useLanguage } from '@/src/context/LanguageContext'
import { makeStyles, useTheme } from '@/src/context/ThemeContext'
import { isAppAdmin, isMosqueAdmin } from '@/src/utils/roles'

type AuthMode = 'signin' | 'signup'

const DEMO_ACCOUNTS = [
  { label: 'Everyday', mobile: '6666666666', password: 'User@12345' },
  { label: 'Mosque admin', mobile: '8888888888', password: 'Manager@12345' },
  { label: 'Khairul', mobile: '7777777777', password: 'Khairul12345' },
  { label: 'App owner', mobile: '9999999999', password: 'Admin@12345' },
] as const

const PALETTE = {
  light: {
    page: '#F7F4EE',
    ink: '#1A1814',
    muted: '#6E675F',
    soft: '#A39B92',
    line: 'rgba(26,24,20,0.16)',
    button: '#1A1814',
    buttonText: '#F7F4EE',
  },
  dark: {
    page: '#141311',
    ink: '#F4F0E8',
    muted: '#C4BBB0',
    soft: '#8A837A',
    line: 'rgba(244,240,232,0.22)',
    button: '#F4F0E8',
    buttonText: '#161616',
  },
} as const

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const styles = useStyles()
  const { mode } = useTheme()
  const c = PALETTE[mode]
  const { login, register, continueAsGuest, user } = useAuth()
  const { t } = useLanguage()
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [demosOpen, setDemosOpen] = useState(false)

  if (user) {
    if (isMosqueAdmin(user)) return <Redirect href="/my-mosque" />
    return <Redirect href="/(tabs)" />
  }

  const resetError = () => setError('')

  const fillDemo = (mobileValue: string, passwordValue: string) => {
    setAuthMode('signin')
    setMobile(mobileValue)
    setPassword(passwordValue)
    setShowPassword(false)
    setDemosOpen(false)
    setError('')
  }

  const submit = async () => {
    const digits = mobile.replace(/\D/g, '')
    const normalized = digits.length > 10 ? digits.slice(-10) : digits
    if (normalized.length < 10) {
      setError(t('auth.badMobile'))
      return
    }
    if (!password) {
      setError(t('auth.needPassword'))
      return
    }
    if (authMode === 'signup') {
      if (!name.trim()) {
        setError(t('auth.needName'))
        return
      }
      if (password.length < 6) {
        setError(t('auth.shortPassword'))
        return
      }
      if (password !== confirmPassword) {
        setError(t('auth.mismatch'))
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      if (authMode === 'signup') {
        await register(name.trim(), normalized, password)
        router.replace('/(tabs)')
      } else {
        const loggedIn = await login(normalized, password)
        if (isAppAdmin(loggedIn)) router.replace('/admin')
        else if (isMosqueAdmin(loggedIn)) router.replace('/my-mosque')
        else router.replace('/(tabs)')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.failed'))
    } finally {
      setLoading(false)
    }
  }

  const onGuest = async () => {
    setGuestLoading(true)
    try {
      await continueAsGuest()
      router.replace('/(tabs)')
    } finally {
      setGuestLoading(false)
    }
  }

  const localMobile = mobile.replace(/\D/g, '').slice(-10)
  const busy = loading || guestLoading

  return (
    <View style={styles.page}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.brand}>PrayNow</Text>
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>

          <View style={styles.modes}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAuthMode('signin')
                resetError()
              }}
              style={styles.modeBtn}>
              <Text style={[styles.modeText, authMode === 'signin' && styles.modeTextActive]}>{t('auth.signIn')}</Text>
              <View style={[styles.modeRule, authMode === 'signin' && styles.modeRuleActive]} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAuthMode('signup')
                resetError()
              }}
              style={styles.modeBtn}>
              <Text style={[styles.modeText, authMode === 'signup' && styles.modeTextActive]}>{t('auth.signUp')}</Text>
              <View style={[styles.modeRule, authMode === 'signup' && styles.modeRuleActive]} />
            </Pressable>
          </View>

          {authMode === 'signup' ? (
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('auth.name')}
                placeholderTextColor={c.soft}
                autoCapitalize="words"
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              style={styles.input}
              value={localMobile}
              onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
              placeholder={t('auth.mobile')}
              placeholderTextColor={c.soft}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={10}
            />
          </View>

          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              placeholderTextColor={c.soft}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={authMode === 'signup' ? 'new-password' : 'password'}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
              <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {authMode === 'signup' ? (
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.confirm')}
                placeholderTextColor={c.soft}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                <Text style={styles.showText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={() => void submit()}
            disabled={busy}>
            {loading ? (
              <ActivityIndicator color={c.buttonText} />
            ) : (
              <Text style={styles.primaryBtnText}>{authMode === 'signup' ? t('auth.create') : t('auth.signIn')}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={styles.guestBtn}
            onPress={() => void onGuest()}
            disabled={busy}>
            {guestLoading ? (
              <ActivityIndicator color={c.ink} />
            ) : (
              <Text style={styles.guestText}>{t('auth.guest')}</Text>
            )}
          </Pressable>

          {authMode === 'signin' ? (
            <Pressable
              accessibilityRole="button"
              style={styles.demoLink}
              onPress={() => setDemosOpen((open) => !open)}>
              <Text style={styles.demoLinkText}>{t('auth.demo')}</Text>
            </Pressable>
          ) : null}

          {authMode === 'signin' && demosOpen ? (
            <View style={styles.demoList}>
              {DEMO_ACCOUNTS.map((account) => (
                <Pressable
                  key={account.mobile}
                  accessibilityRole="button"
                  style={styles.demoRow}
                  onPress={() => fillDemo(account.mobile, account.password)}>
                  <Text style={styles.demoName}>{account.label === 'Everyday' ? t('auth.demoEveryday') : account.label === 'Mosque admin' ? t('auth.demoMosque') : account.label === 'App owner' ? t('auth.demoApp') : account.label}</Text>
                  <Text style={styles.demoMeta}>{account.mobile}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const useStyles = makeStyles(({ mode }) => {
  const c = PALETTE[mode]
  const webInput = Platform.OS === 'web' ? { outlineWidth: 0, outlineStyle: 'none' as const } : null

  return {
    page: { flex: 1, backgroundColor: c.page },
    flex: { flex: 1 },
    content: {
      flexGrow: 1,
      paddingHorizontal: 28,
      maxWidth: 440,
      width: '100%',
      alignSelf: 'center',
    },
    brand: {
      fontFamily: 'Newsreader_600SemiBold',
      fontSize: 46,
      letterSpacing: -0.8,
      color: c.ink,
      textAlign: 'center',
    },
    tagline: {
      fontFamily: 'Figtree_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: c.muted,
      textAlign: 'center',
      marginTop: 8,
    },
    modes: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 28,
      marginTop: 36,
      marginBottom: 8,
    },
    modeBtn: { alignItems: 'center', paddingVertical: 6 },
    modeText: {
      fontFamily: 'Figtree_500Medium',
      fontSize: 15,
      color: c.soft,
    },
    modeTextActive: { color: c.ink },
    modeRule: {
      marginTop: 6,
      height: 1,
      width: 22,
      backgroundColor: 'transparent',
    },
    modeRuleActive: { backgroundColor: c.ink },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: c.line,
      minHeight: 54,
      marginTop: 8,
    },
    prefix: {
      fontFamily: 'Figtree_500Medium',
      fontSize: 16,
      color: c.ink,
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontFamily: 'Figtree_400Regular',
      fontSize: 16,
      color: c.ink,
      paddingVertical: 14,
      borderWidth: 0,
      backgroundColor: 'transparent',
      ...webInput,
    },
    showText: {
      fontFamily: 'Figtree_500Medium',
      fontSize: 13,
      color: c.muted,
      marginLeft: 8,
    },
    error: {
      fontFamily: 'Figtree_500Medium',
      color: '#A33B32',
      fontSize: 13,
      lineHeight: 18,
      marginTop: 14,
    },
    primaryBtn: {
      backgroundColor: c.button,
      borderRadius: 999,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 28,
    },
    primaryBtnText: {
      fontFamily: 'Figtree_600SemiBold',
      fontSize: 16,
      color: c.buttonText,
    },
    guestBtn: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    guestText: {
      fontFamily: 'Figtree_500Medium',
      fontSize: 14,
      color: c.muted,
    },
    btnDisabled: { opacity: 0.65 },
    demoLink: {
      alignSelf: 'center',
      marginTop: 18,
      paddingVertical: 6,
    },
    demoLinkText: {
      fontFamily: 'Figtree_500Medium',
      fontSize: 13,
      color: c.ink,
      textDecorationLine: 'underline',
    },
    demoList: { marginTop: 8 },
    demoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.line,
    },
    demoName: {
      fontFamily: 'Figtree_500Medium',
      fontSize: 14,
      color: c.ink,
    },
    demoMeta: {
      fontFamily: 'Figtree_400Regular',
      fontSize: 13,
      color: c.muted,
    },
  }
})
