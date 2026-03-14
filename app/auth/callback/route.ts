import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../lib/server'
import { getPostLoginRedirect, normalizeUserRole } from '../../lib/user-profile'
import { syncUserProfileFromAuth } from '../../lib/user-profile-server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/'
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const profile = await syncUserProfileFromAuth(user)
        const userRole = profile?.role ?? normalizeUserRole(user.app_metadata?.role)
        const redirectTo = getPostLoginRedirect(userRole, redirect)

        return NextResponse.redirect(`${origin}${redirectTo}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
