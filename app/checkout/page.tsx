'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'

import { getErrorMessage } from '../lib/errors'
import type { Room } from '../lib/supabase'
import { supabaseClient } from '../lib/supabase'

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

function getNextDate(dateString: string) {
  const nextDate = new Date(dateString)
  nextDate.setDate(nextDate.getDate() + 1)

  return nextDate.toISOString().split('T')[0]
}

function buildCheckoutPath(roomId?: string | null, checkIn?: string | null, checkOut?: string | null) {
  const params = new URLSearchParams()

  if (roomId) {
    params.set('roomId', roomId)
  }

  if (checkIn) {
    params.set('checkIn', checkIn)
  }

  if (checkOut) {
    params.set('checkOut', checkOut)
  }

  const query = params.toString()

  return query ? `/checkout?${query}` : '/checkout'
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const roomId = searchParams.get('roomId')
  const checkInParam = searchParams.get('checkIn')
  const checkOutParam = searchParams.get('checkOut')
  const [selectedCheckIn, setSelectedCheckIn] = useState(getTodayDate())
  const [selectedCheckOut, setSelectedCheckOut] = useState(getNextDate(getTodayDate()))

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [room, setRoom] = useState<Room | null>(null)

  useEffect(() => {
    const nextCheckIn = checkInParam || getTodayDate()
    const nextCheckOut = checkOutParam || getNextDate(nextCheckIn)

    setSelectedCheckIn(nextCheckIn)
    setSelectedCheckOut(nextCheckOut)
  }, [checkInParam, checkOutParam])

  useEffect(() => {
    const loadCheckoutState = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession()

      if (!session) {
        const redirectTo = buildCheckoutPath(roomId, checkInParam, checkOutParam)
        router.push(`/login?redirect=${encodeURIComponent(redirectTo)}`)
        return
      }

      setUser(session.user)

      if (!roomId) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabaseClient
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .is('deleted_at', null)
          .single()

        if (error) {
          throw error
        }

        setRoom(data)
      } catch (loadError) {
        setError(`Failed to load room: ${getErrorMessage(loadError)}`)
      } finally {
        setLoading(false)
      }
    }

    void loadCheckoutState()
  }, [checkInParam, checkOutParam, roomId, router])

  const handleDateSelection = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!roomId) {
      setError('Room is required')
      return
    }

    if (!selectedCheckIn || !selectedCheckOut) {
      setError('Please choose check-in and check-out dates')
      return
    }

    if (new Date(selectedCheckOut) <= new Date(selectedCheckIn)) {
      setError('Check-out date must be after check-in date')
      return
    }

    router.push(buildCheckoutPath(roomId, selectedCheckIn, selectedCheckOut))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Create reservation via API
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          room_id: roomId,
          check_in: checkInParam,
          check_out: checkOutParam
        })
      })

      if (!response.ok) {
        const err = await response.json()
        console.error('API Error:', err)
        throw new Error(err.error + (err.details ? `: ${err.details}` : '') || 'Failed to create reservation')
      }

      const { reservation } = await response.json()
      router.push(`/payment/${reservation.id}`)
    } catch (submitError) {
      setError(getErrorMessage(submitError))
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>
  }

  if (!roomId) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Invalid Request</h1>
        <Link href="/">Back to Catalog</Link>
      </div>
    )
  }

  if (!room) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Room not found</h1>
        <p>{error}</p>
        <Link href="/">Back to Catalog</Link>
      </div>
    )
  }

  const hasSelectedDates = Boolean(checkInParam && checkOutParam)
  const canCalculateTotal =
    hasSelectedDates &&
    new Date(checkOutParam as string).getTime() > new Date(checkInParam as string).getTime()

  const checkInDate = canCalculateTotal ? new Date(checkInParam as string) : null
  const checkOutDate = canCalculateTotal ? new Date(checkOutParam as string) : null
  const nights =
    checkInDate && checkOutDate
      ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0
  const baseTotal = room.base_price * nights

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href={`/room/${roomId}`} style={{ color: '#007bff', marginBottom: '20px', display: 'inline-block' }}>
        ← Back to Room
      </Link>

      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Checkout</h1>

      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Booking Summary</h2>
        
        <div style={{ marginBottom: '12px' }}>
          <strong>Room:</strong> {room.name}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <strong>Price per night:</strong> Rp {room.base_price?.toLocaleString('id-ID')}
        </div>

        {canCalculateTotal ? (
          <>
            <div style={{ marginBottom: '12px' }}>
              <strong>Check-in:</strong> {checkInDate?.toLocaleDateString('id-ID')}
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <strong>Check-out:</strong> {checkOutDate?.toLocaleDateString('id-ID')}
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <strong>Nights:</strong> {nights}
            </div>
            
            <div style={{ 
              fontSize: '20px', 
              fontWeight: 'bold',
              borderTop: '1px solid #ddd',
              paddingTop: '12px',
              marginTop: '12px'
            }}>
              Total: Rp {baseTotal.toLocaleString('id-ID')}
            </div>
          </>
        ) : (
          <p style={{ marginBottom: 0, color: '#64748b' }}>
            Pilih tanggal menginap terlebih dahulu untuk melanjutkan ke booking.
          </p>
        )}
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#fee', 
          color: '#c33',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleDateSelection} style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '12px' }}>Choose Your Stay</h3>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Check-in Date
            </label>
            <input
              type="date"
              name="check_in"
              required
              min={getTodayDate()}
              value={selectedCheckIn}
              onChange={(event) => {
                const nextValue = event.target.value
                setSelectedCheckIn(nextValue)
                setError(null)

                if (selectedCheckOut <= nextValue) {
                  setSelectedCheckOut(getNextDate(nextValue))
                }
              }}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '220px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Check-out Date
            </label>
            <input
              type="date"
              name="check_out"
              required
              min={getNextDate(selectedCheckIn)}
              value={selectedCheckOut}
              onChange={(event) => {
                setSelectedCheckOut(event.target.value)
                setError(null)
              }}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '220px' }}
            />
          </div>
        </div>

        <button
          type="submit"
          style={{
            padding: '12px 20px',
            backgroundColor: '#0f766e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Continue to Booking Summary
        </button>
      </form>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ marginBottom: '12px' }}>Guest Information</h3>
          <p><strong>Email:</strong> {user?.email}</p>
        </div>

        <button 
          type="submit"
          disabled={submitting || !canCalculateTotal}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: submitting || !canCalculateTotal ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '18px',
            cursor: submitting || !canCalculateTotal ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? 'Processing...' : 'Confirm Booking & Proceed to Payment'}
        </button>
      </form>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
