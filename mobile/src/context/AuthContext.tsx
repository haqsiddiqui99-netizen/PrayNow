import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { login as apiLogin, register as apiRegister } from '@/src/services/api'
import {
  clearAuthSession,
  getGuestSession,
  getStoredUser,
  saveAuthSession,
  saveGuestSession,
  type AppUser,
} from '@/src/services/authStorage'

interface AuthContextValue {
  user: AppUser | null
  isGuest: boolean
  isAuthenticated: boolean
  isReady: boolean
  login: (mobile: string, password: string) => Promise<AppUser>
  register: (name: string, mobile: string, password: string) => Promise<AppUser>
  continueAsGuest: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isGuest, setIsGuest] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [storedUser, guest] = await Promise.all([getStoredUser(), getGuestSession()])
        if (storedUser) setUser(storedUser)
        else if (guest) setIsGuest(true)
      } finally {
        setIsReady(true)
      }
    })()
  }, [])

  const login = useCallback(async (mobile: string, password: string) => {
    const { token, user: loggedIn } = await apiLogin(mobile, password)
    await saveAuthSession(token, loggedIn)
    setUser(loggedIn)
    setIsGuest(false)
    return loggedIn
  }, [])

  const register = useCallback(async (name: string, mobile: string, password: string) => {
    const { token, user: registered } = await apiRegister(name, mobile, password)
    await saveAuthSession(token, registered)
    setUser(registered)
    setIsGuest(false)
    return registered
  }, [])

  const continueAsGuest = useCallback(async () => {
    await saveGuestSession()
    setUser(null)
    setIsGuest(true)
  }, [])

  const logout = useCallback(async () => {
    await clearAuthSession()
    setUser(null)
    setIsGuest(false)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isGuest,
      isAuthenticated: user !== null || isGuest,
      isReady,
      login,
      register,
      continueAsGuest,
      logout,
    }),
    [user, isGuest, isReady, login, register, continueAsGuest, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
