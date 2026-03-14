import type { User } from '@supabase/supabase-js'

import { supabaseAdmin } from './supabase'
import { buildProfileSeed, normalizeUserRole, type UserProfile } from './user-profile'

export async function syncUserProfileFromAuth(user: User) {
  const fallbackProfile = buildProfileSeed(user)

  if (!supabaseAdmin) {
    return fallbackProfile
  }

  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Failed to read user profile:', profileError)
    return fallbackProfile
  }

  if (!existingProfile) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert(fallbackProfile)
      .select('id, first_name, last_name, role')
      .single()

    if (error) {
      console.error('Failed to create user profile:', error)
      return fallbackProfile
    }

    return {
      ...data,
      role: normalizeUserRole(data.role),
    } as UserProfile
  }

  const updates: Partial<UserProfile> = {}

  if (!existingProfile.first_name && fallbackProfile.first_name) {
    updates.first_name = fallbackProfile.first_name
  }

  if (!existingProfile.last_name && fallbackProfile.last_name) {
    updates.last_name = fallbackProfile.last_name
  }

  if (!existingProfile.role || existingProfile.role !== fallbackProfile.role) {
    updates.role = fallbackProfile.role
  }

  if (Object.keys(updates).length === 0) {
    return {
      ...existingProfile,
      role: normalizeUserRole(existingProfile.role),
    } as UserProfile
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, first_name, last_name, role')
    .single()

  if (error) {
    console.error('Failed to update user profile:', error)
    return {
      ...existingProfile,
      role: normalizeUserRole(existingProfile.role),
    } as UserProfile
  }

  return {
    ...data,
    role: normalizeUserRole(data.role),
  } as UserProfile
}
