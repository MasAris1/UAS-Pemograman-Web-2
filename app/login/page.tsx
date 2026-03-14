'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { supabaseClient } from '../lib/supabase'

function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loadingAction, setLoadingAction] = useState<'google' | 'password' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const authError = searchParams.get('error')

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (session) {
        window.location.href = redirect
      }
    }
    checkSession()
  }, [redirect])

  useEffect(() => {
    if (authError === 'auth_callback_failed') {
      setError('Login with Google failed. Please try again.')
    }
  }, [authError])

  const syncProfile = async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession()

    const response = await fetch('/api/auth/sync-profile', {
      method: 'POST',
      headers: session?.access_token
        ? {
            Authorization: `Bearer ${session.access_token}`,
          }
        : undefined,
    })

    if (!response.ok) {
      throw new Error('Failed to sync user profile')
    }
  }

  const finishAuthentication = async () => {
    await syncProfile()
    window.location.href = redirect
  }

  const handleGoogleLogin = async () => {
    setLoadingAction('google')
    setError(null)
    setMessage(null)

    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      })

      if (error) {
        setError(error.message)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoadingAction(null)
    }
  }

  const handlePasswordAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoadingAction('password')
    setError(null)
    setMessage(null)

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Email and password are required')
      }

      if (mode === 'signup') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long')
        }

        if (password !== confirmPassword) {
          throw new Error('Password confirmation does not match')
        }

        const { data, error } = await supabaseClient.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          },
        })

        if (error) {
          throw error
        }

        if (data.session) {
          await finishAuthentication()
          return
        }

        setMessage('Registration successful. Please check your email to confirm your account before logging in.')
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        return
      }

      const { error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        throw error
      }

      await finishAuthentication()
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : 'Authentication failed'
      setError(message)
    } finally {
      setLoadingAction(null)
    }
  }

  const isLoading = loadingAction !== null

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '40px', 
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '420px'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>
          Login to Hotel Reservation
        </h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '20px',
            backgroundColor: '#f1f5f9',
            padding: '6px',
            borderRadius: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
              setMessage(null)
            }}
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: mode === 'login' ? '#0f766e' : 'transparent',
              color: mode === 'login' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError(null)
              setMessage(null)
            }}
            style={{
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: mode === 'signup' ? '#0f766e' : 'transparent',
              color: mode === 'signup' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Register
          </button>
        </div>

        {redirect !== '/' && (
          <p style={{ 
            textAlign: 'center', 
            marginBottom: '20px',
            color: '#666',
            fontSize: '14px'
          }}>
            Please login to continue with your booking
          </p>
        )}

        {error && (
          <div style={{ 
            backgroundColor: '#fee', 
            color: '#c33',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              color: '#166534',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '16px',
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handlePasswordAuth} style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#334155' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#334155' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="confirmPassword"
                style={{ display: 'block', marginBottom: '6px', fontSize: '14px', color: '#334155' }}
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#0f766e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {loadingAction === 'password'
              ? 'Processing...'
              : mode === 'login'
                ? 'Login with Email'
                : 'Create Account'}
          </button>
        </form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            color: '#94a3b8',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
          <span style={{ fontSize: '13px' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {loadingAction === 'google' ? 'Loading...' : 'Login with Google'}
        </button>

        <p style={{ 
          textAlign: 'center', 
          marginTop: '20px',
          fontSize: '14px',
          color: '#666'
        }}>
          By logging in, you agree to our terms and conditions
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
