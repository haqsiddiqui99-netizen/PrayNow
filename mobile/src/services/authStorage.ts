import AsyncStorage from '@react-native-async-storage/async-storage'

export interface AppUser {
  id: string
  email: string
  name: string
  mobile: string
  role: string
}

const TOKEN_KEY = 'praynow_user_token'
const USER_KEY = 'praynow_user'
const GUEST_KEY = 'praynow_guest_session'

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY)
}

export async function getStoredUser(): Promise<AppUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AppUser
  } catch {
    return null
  }
}

export async function getGuestSession(): Promise<boolean> {
  return (await AsyncStorage.getItem(GUEST_KEY)) === '1'
}

export async function saveAuthSession(token: string, user: AppUser): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
    [GUEST_KEY, '0'],
  ])
}

export async function saveGuestSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY])
  await AsyncStorage.setItem(GUEST_KEY, '1')
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, GUEST_KEY])
}
