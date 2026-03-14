import { NextResponse } from 'next/server'

import { createClient } from '../../../lib/server'
import { syncUserProfileFromAuth } from '../../../lib/user-profile-server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
  const {
    data: { user },
  } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await syncUserProfileFromAuth(user)

  return NextResponse.json({ profile })
}
