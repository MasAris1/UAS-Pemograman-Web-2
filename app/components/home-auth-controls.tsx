'use client'

import Link from 'next/link'
import { useState } from 'react'

import { supabaseClient } from '../lib/supabase'

type HomeAuthControlsProps = {
  isAuthenticated: boolean
  displayName?: string | null
  email?: string | null
  role?: string | null
}

export default function HomeAuthControls({
  isAuthenticated,
  displayName,
  email,
  role,
}: HomeAuthControlsProps) {
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)

    try {
      const { error } = await supabaseClient.auth.signOut()

      if (error) {
        throw error
      }

      window.location.href = '/'
    } catch (error) {
      console.error('Failed to logout:', error)
      setLoggingOut(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 18px',
          backgroundColor: '#0f766e',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '999px',
          fontWeight: 600,
        }}
      >
        Login
      </Link>
    )
  }

  const isAdmin = role === 'admin'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      }}
    >
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 600, color: '#0f172a' }}>
          {displayName ? `Hi, ${displayName}` : 'Welcome back'}
        </div>
        {email && (
          <div style={{ fontSize: '13px', color: '#64748b' }}>{email}</div>
        )}
      </div>

      <Link
        href="/transactions"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 18px',
          backgroundColor: '#f1f5f9',
          color: '#0f172a',
          textDecoration: 'none',
          borderRadius: '999px',
          fontWeight: 600,
        }}
      >
        Transactions
      </Link>

      {isAdmin && (
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 18px',
            backgroundColor: '#e2e8f0',
            color: '#0f172a',
            textDecoration: 'none',
            borderRadius: '999px',
            fontWeight: 600,
          }}
        >
          Dashboard
        </Link>
      )}

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        style={{
          padding: '10px 18px',
          borderRadius: '999px',
          border: 'none',
          backgroundColor: loggingOut ? '#94a3b8' : '#0f172a',
          color: '#fff',
          cursor: loggingOut ? 'not-allowed' : 'pointer',
          fontWeight: 600,
        }}
      >
        {loggingOut ? 'Logging out...' : 'Logout'}
      </button>
    </div>
  )
}
