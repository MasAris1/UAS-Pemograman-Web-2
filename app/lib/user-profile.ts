import type { SupabaseClient, User } from '@supabase/supabase-js'

export const USER_ROLES = ['guest', 'admin'] as const
export const MANAGED_ADMIN_EMAILS = ['aris.maulana.am57@gmail.com'] as const

export type UserRole = (typeof USER_ROLES)[number]

export type UserProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  role: UserRole
}

type ProfileClient = Pick<SupabaseClient, 'from'>

function isUserRole(value: string | null | undefined): value is UserRole {
  return USER_ROLES.includes((value ?? '') as UserRole)
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null
}

export function getManagedUserRole(user: Pick<User, 'email'> | { email?: string | null }) {
  const email = normalizeEmail(user.email)

  if (email && MANAGED_ADMIN_EMAILS.includes(email as (typeof MANAGED_ADMIN_EMAILS)[number])) {
    return 'admin' as const
  }

  return null
}

export function isAdminRole(role?: string | null) {
  return role === 'admin'
}

function splitName(fullName?: string | null) {
  const normalized = fullName?.trim()

  if (!normalized) {
    return { firstName: null, lastName: null }
  }

  const [firstName, ...rest] = normalized.split(/\s+/)
  const lastName = rest.join(' ').trim() || null

  return {
    firstName: firstName || null,
    lastName,
  }
}

export function normalizeUserRole(value?: string | null): UserRole {
  if (isUserRole(value)) {
    return value
  }

  return 'guest'
}

export function buildProfileSeed(user: User): UserProfile {
  const managedRole = getManagedUserRole(user)
  const fullName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    null

  const parsedName = splitName(fullName)
  const firstName =
    user.user_metadata?.first_name ??
    parsedName.firstName
  const lastName =
    user.user_metadata?.last_name ??
    parsedName.lastName

  return {
    id: user.id,
    first_name: firstName ?? null,
    last_name: lastName ?? null,
    role:
      managedRole ??
      normalizeUserRole(
        user.app_metadata?.role ??
          user.user_metadata?.role ??
          null
      ),
  }
}

export function getUserDisplayName(
  user: Pick<User, 'email' | 'user_metadata'>,
  profile?: Partial<UserProfile> | null
) {
  const fullName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  if (fullName) {
    return fullName
  }

  const metadataName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    null

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim()
  }

  return user.email?.split('@')[0] ?? 'Guest'
}

export async function getCurrentUserProfile(
  supabase: ProfileClient,
  user: User
) {
  const fallbackProfile = buildProfileSeed(user)
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) {
    return fallbackProfile
  }

  const managedRole = getManagedUserRole(user)

  return {
    ...data,
    role: managedRole ?? normalizeUserRole(data.role),
  } as UserProfile
}

export async function resolveUserRole(
  supabase: ProfileClient,
  user: User
) {
  const profile = await getCurrentUserProfile(supabase, user)

  return profile?.role ?? buildProfileSeed(user).role
}

export function sanitizeRedirectPath(redirect?: string | null) {
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return null
  }

  return redirect
}

export function getPostLoginRedirect(
  role: UserRole,
  requestedRedirect?: string | null
) {
  if (role === 'admin') {
    return '/dashboard'
  }

  return sanitizeRedirectPath(requestedRedirect) ?? '/'
}
