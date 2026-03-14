import Link from 'next/link'

import { createClient } from '../lib/server'
import { getCurrentUserProfile, getUserDisplayName } from '../lib/user-profile'
import HomeAuthControls from './home-auth-controls'

export default async function SiteHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profile = user ? await getCurrentUserProfile(supabase, user) : null
  const displayName = user ? getUserDisplayName(user, profile) : null

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backgroundColor: 'rgba(248, 250, 252, 0.92)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: '#0f172a', textDecoration: 'none' }}>
            <div style={{ fontWeight: 800, fontSize: '18px' }}>Hotel Reservation System</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Simple booking experience</div>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: '#334155', textDecoration: 'none', fontWeight: 600 }}>
              Home
            </Link>
            <Link href="/#rooms" style={{ color: '#334155', textDecoration: 'none', fontWeight: 600 }}>
              Rooms
            </Link>
          </nav>
        </div>

        <HomeAuthControls
          isAuthenticated={Boolean(user)}
          displayName={displayName}
          email={user?.email ?? null}
          role={profile?.role ?? null}
        />
      </div>
    </header>
  )
}
