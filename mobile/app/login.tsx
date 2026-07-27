import { Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
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
import { useAuth } from '@/src/context/AuthContext'
import { getApiBaseUrl } from '@/src/config/api'
import { isAppAdmin, isMosqueAdmin } from '@/src/utils/roles'

type AuthMode = 'signin' | 'signup'

const bw = {
  bg: '#ffffff',
  fg: '#0a0a0a',
  muted: '#737373',
  border: '#d4d4d4',
  soft: '#f5f5f5',
  inverse: '#000000',
} as const

const DEMO_ACCOUNTS = [
  { label: 'Khairul Manazil', mobile: '7777777777', password: 'Khairul12345' },
  { label: 'All mosques', mobile: '8888888888', password: 'Manager@12345' },
  { label: 'App owner', mobile: '9999999999', password: 'Admin@12345' },
] as const

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { login, register, continueAsGuest, user } = useAuth()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)

  if (user) {
    return <Redirect href="/(tabs)" />
  }

  const resetError = () => setError('')

  const fillDemo = (mobileValue: string, passwordValue: string) => {
    setMode('signin')
    setMobile(mobileValue)
    setPassword(passwordValue)
    setShowPassword(true)
    setError('')
  }

  const submit = async () => {
    const digits = mobile.replace(/\D/g, '')
    const normalized = digits.length > 10 ? digits.slice(-10) : digits
    if (normalized.length < 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    if (!password) {
      setError('Enter your password')
      return
    }
    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Enter your full name')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      if (mode === 'signup') {
        await register(name.trim(), normalized, password)
        router.replace('/(tabs)')
      } else {
        const loggedIn = await login(normalized, password)
        if (isAppAdmin(loggedIn)) router.replace('/admin')
        else if (isMosqueAdmin(loggedIn)) router.replace('/admin/my-mosques')
        else router.replace('/(tabs)')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
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

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Text style={styles.logoEmoji}>🕌</Text>
          </View>
          <Text style={styles.brand}>PrayNow</Text>
          <Text style={styles.tagline}>Mosques & prayer times for your city</Text>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
            onPress={() => {
              setMode('signin')
              resetError()
            }}>
            <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Sign in</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
            onPress={() => {
              setMode('signup')
              resetError()
            }}>
            <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Sign up</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {mode === 'signup' && (
            <>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={bw.muted}
                autoCapitalize="words"
              />
            </>
          )}

          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            placeholder="10-digit mobile"
            placeholderTextColor={bw.muted}
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={bw.muted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {mode === 'signup' && (
            <>
              <Text style={styles.label}>Confirm password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor={bw.muted}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}>
                  <Text style={styles.eyeText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={() => void submit()}
            disabled={loading || guestLoading}>
            {loading ? (
              <ActivityIndicator color={bw.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.outlineBtn, guestLoading && styles.btnDisabled]}
            onPress={() => void onGuest()}
            disabled={loading || guestLoading}>
            {guestLoading ? (
              <ActivityIndicator color={bw.fg} />
            ) : (
              <Text style={styles.outlineBtnText}>Continue as guest</Text>
            )}
          </Pressable>

          {mode === 'signin' ? (
            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Quick demo fill</Text>
              {DEMO_ACCOUNTS.map((a) => (
                <Pressable
                  key={a.mobile}
                  style={styles.demoBtn}
                  onPress={() => fillDemo(a.mobile, a.password)}>
                  <Text style={styles.demoBtnText}>
                    {a.label}: {a.mobile}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.hint}>
            API: {getApiBaseUrl()}
            {'\n'}Khairul Manazil: 7777777777 / Khairul12345
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: bw.bg },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  hero: { alignItems: 'center', marginBottom: 28 },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: bw.fg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoEmoji: { fontSize: 34 },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: bw.fg,
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 14,
    color: bw.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  modeSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: bw.border,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    backgroundColor: bw.soft,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: bw.inverse },
  modeText: { fontSize: 13, fontWeight: '700', color: bw.muted },
  modeTextActive: { color: bw.bg },
  form: {},
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: bw.fg,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: bw.bg,
    borderWidth: 1.5,
    borderColor: bw.fg,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: bw.fg,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: bw.fg,
    borderRadius: 8,
    backgroundColor: bw.bg,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: bw.fg,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  eyeText: { fontSize: 13, fontWeight: '800', color: bw.fg },
  error: { color: '#dc2626', fontSize: 13, fontWeight: '600', marginTop: 12 },
  primaryBtn: {
    backgroundColor: bw.inverse,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: bw.bg, fontWeight: '800', fontSize: 16 },
  outlineBtn: {
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: bw.fg,
  },
  outlineBtnText: { color: bw.fg, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.65 },
  demoBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: bw.border,
    backgroundColor: bw.soft,
    gap: 8,
  },
  demoTitle: { fontSize: 11, fontWeight: '800', color: bw.muted, textTransform: 'uppercase' },
  demoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: bw.bg,
    borderWidth: 1,
    borderColor: bw.border,
  },
  demoBtnText: { fontSize: 13, fontWeight: '700', color: bw.fg },
  hint: {
    fontSize: 11,
    color: bw.muted,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 17,
  },
})
