'use client'

import { useEffect, useState } from 'react'
import type { RealtimePostgresUpdatePayload } from '@supabase/supabase-js'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { getErrorMessage } from '../../lib/errors'
import type { Reservation } from '../../lib/supabase'
import { supabaseClient } from '../../lib/supabase'

type SnapResult = Record<string, unknown>

type PaymentReservation = Reservation & {
  rooms?: {
    name?: string
  } | null
}

declare global {
  interface Window {
    snap: {
      pay: (token: string, options: {
        onSuccess: (result: SnapResult) => void
        onPending: (result: SnapResult) => void
        onError: (result: SnapResult) => void
        onClose: () => void
      }) => void
    }
  }
}

export default function PaymentPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const reservationId = params.reservationId as string
  const transactionStatus = searchParams.get('transaction_status')
  const statusCode = searchParams.get('status_code')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reservation, setReservation] = useState<PaymentReservation | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')

  useEffect(() => {
    // Load Midtrans Snap.js
    const script = document.createElement('script')
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js'
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '')
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  useEffect(() => {
    if (paymentStatus !== 'success') {
      return
    }

    const redirectTimer = window.setTimeout(() => {
      window.location.href = `/reservations/${reservationId}?fromPayment=1`
    }, 2500)

    return () => {
      window.clearTimeout(redirectTimer)
    }
  }, [paymentStatus, reservationId])

  useEffect(() => {
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      setPaymentStatus('success')
      setError(null)
      return
    }

    if (transactionStatus === 'pending') {
      setPaymentStatus('processing')
      return
    }

    if (
      transactionStatus === 'deny' ||
      transactionStatus === 'cancel' ||
      transactionStatus === 'expire' ||
      transactionStatus === 'failure' ||
      (statusCode && statusCode !== '200')
    ) {
      setPaymentStatus('failed')
      setError('Payment was not completed. Please try again.')
    }
  }, [statusCode, transactionStatus])

  useEffect(() => {
    const fetchReservation = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession()
        
        if (!session) {
          setError('Please login to continue')
          setLoading(false)
          return
        }

        const response = await fetch(`/api/reservations/${reservationId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch reservation')
        }

        const data = await response.json() as {
          reservation?: PaymentReservation
        }

        if (!data.reservation) {
          throw new Error('Reservation not found')
        }

        setReservation(data.reservation)
        
        if (data.reservation.status === 'paid') {
          setPaymentStatus('success')
        }
      } catch (fetchError) {
        setError(getErrorMessage(fetchError))
      } finally {
        setLoading(false)
      }
    }

    void fetchReservation()
    
    // Subscribe to real-time updates (Fase 6: Sinkronisasi Waktu Nyata)
    const subscription = supabaseClient
      .channel(`reservation-${reservationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
          filter: `id=eq.${reservationId}`
        },
        (payload: RealtimePostgresUpdatePayload<Record<string, unknown>>) => {
          const nextStatus = typeof payload.new.status === 'string' ? payload.new.status : null

          if (nextStatus === 'paid') {
            setPaymentStatus('success')
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [reservationId])

  const handlePayment = async () => {
    setPaymentStatus('processing')
    
    try {
      const { data: { session } } = await supabaseClient.auth.getSession()
      
      if (!session) {
        setError('Please login to continue')
        setPaymentStatus('idle')
        return
      }

      // Get Snap token from API (Fase 4: Integrasi Pembayaran)
      const response = await fetch('/api/payments/snap-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ reservation_id: reservationId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to initialize payment')
      }

      const { token } = await response.json()

      // Open Midtrans Snap payment popup (Fase 4: Tampilan UI Pembayaran)
      window.snap.pay(token, {
        onSuccess: function(result: SnapResult) {
          console.log('Payment success:', result)
          setPaymentStatus('success')
          setError(null)
        },
        onPending: function(result: SnapResult) {
          console.log('Payment pending:', result)
          setPaymentStatus('processing')
          setError('Payment is still pending. Please complete the payment and wait for confirmation.')
        },
        onError: function(result: SnapResult) {
          console.error('Payment error:', result)
          setPaymentStatus('failed')
          setError('Payment failed. Please try again.')
        },
        onClose: function() {
          setPaymentStatus((currentStatus) =>
            currentStatus === 'success' ? currentStatus : 'idle'
          )
        }
      })

    } catch (paymentError) {
      setError(getErrorMessage(paymentError))
      setPaymentStatus('idle')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (error && !reservation) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Error</h1>
        <p style={{ color: 'red' }}>{error}</p>
        <Link href="/" style={{ color: '#007bff' }}>Back to Home</Link>
      </div>
    )
  }

  if (paymentStatus === 'success') {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ 
          backgroundColor: '#d4edda', 
          color: '#155724',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h1 style={{ marginBottom: '12px' }}>Payment Successful!</h1>
          <p>Your reservation has been confirmed.</p>
          <p>An e-voucher has been sent to your email.</p>
          <p style={{ marginTop: '8px' }}>You will be redirected to your reservation ticket shortly.</p>
        </div>
        <Link 
          href={`/reservations/${reservationId}`}
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px'
          }}
        >
          View Reservation
        </Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <Link href="/" style={{ color: '#007bff', marginBottom: '20px', display: 'inline-block' }}>
        ← Back to Home
      </Link>

      <h1 style={{ marginBottom: '20px' }}>Complete Payment</h1>

      {reservation && (
        <div style={{ 
          border: '1px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h2 style={{ marginBottom: '16px' }}>Reservation Details</h2>
          <p><strong>Room:</strong> {reservation.rooms?.name}</p>
          <p><strong>Check-in:</strong> {new Date(reservation.check_in).toLocaleDateString('id-ID')}</p>
          <p><strong>Check-out:</strong> {new Date(reservation.check_out).toLocaleDateString('id-ID')}</p>
          <p style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '16px' }}>
            Total: Rp {reservation.total_price?.toLocaleString('id-ID')}
          </p>
        </div>
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

      {paymentStatus === 'processing' && !error && (
        <div style={{ 
          backgroundColor: '#fff3cd', 
          color: '#856404',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          Payment is being processed. This page will update automatically after Midtrans confirms it.
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={paymentStatus === 'processing'}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: paymentStatus === 'processing' ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '18px',
          cursor: paymentStatus === 'processing' ? 'not-allowed' : 'pointer'
        }}
      >
        {paymentStatus === 'processing' ? 'Processing...' : 'Pay Now'}
      </button>

      <p style={{ 
        textAlign: 'center', 
        marginTop: '16px',
        fontSize: '14px',
        color: '#666'
      }}>
        Secure payment powered by Midtrans
      </p>
    </div>
  )
}
