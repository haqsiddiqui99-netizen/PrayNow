import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, getAppUser, setAppToken, setAppUser, type AppUser } from '../services/api'

interface UserAuthContextValue {
  user: AppUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => void
}

const UserAuthContext = createContext<UserAuthContextValue | null>(null)

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => getAppUser())

  const refreshUser = useCallback(() => {
    setUser(getAppUser())
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: loggedIn } = await api.login(email, password)
    setAppToken(token)
    setAppUser(loggedIn)
    setUser(loggedIn)
  }, [])

  const logout = useCallback(() => {
    setAppToken(null)
    setAppUser(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      logout,
      refreshUser,
    }),
    [user, login, logout, refreshUser],
  )

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>
}

export function useUserAuth() {
  const ctx = useContext(UserAuthContext)
  if (!ctx) throw new Error('useUserAuth must be used within UserAuthProvider')
  return ctx
}
