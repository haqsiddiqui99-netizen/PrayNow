import type { AppUser } from '@/src/services/authStorage'

export type AppRole = 'admin' | 'mosque_manager' | 'app_user'

export function getRole(user: AppUser | null | undefined): AppRole | null {
  if (!user?.role) return null
  if (user.role === 'admin' || user.role === 'mosque_manager' || user.role === 'app_user') {
    return user.role
  }
  return 'app_user'
}

export function isAppAdmin(user: AppUser | null | undefined) {
  return getRole(user) === 'admin'
}

export function isMosqueAdmin(user: AppUser | null | undefined) {
  return getRole(user) === 'mosque_manager'
}

/** Can manage assigned (or all) mosques: timings + live azan. */
export function canManageMosques(user: AppUser | null | undefined) {
  const role = getRole(user)
  return role === 'admin' || role === 'mosque_manager'
}

export function roleLabel(user: AppUser | null | undefined) {
  const role = getRole(user)
  if (role === 'admin') return 'App Admin'
  if (role === 'mosque_manager') return 'Mosque Admin'
  return 'User'
}
