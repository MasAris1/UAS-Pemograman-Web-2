import { NextRequest, NextResponse } from 'next/server'
import { snap } from '../../../lib/midtrans'
import { getErrorMessage } from '../../../lib/errors'
import { createClient } from '../../../lib/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { getCurrentUserProfile, getUserDisplayName } from '../../../lib/user-profile'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const profile = await getCurrentUserProfile(supabase, user)

    const body = await request.json()
    const { reservation_id } = body

    if (!reservation_id) {
      return NextResponse.json(
        { error: 'Reservation ID is required' },
        { status: 400 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server payment configuration is incomplete' },
        { status: 500 }
      )
    }

    // Fetch reservation details
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select(`
        *,
        rooms:room_id (name)
      `)
      .eq('id', reservation_id)
      .eq('user_id', user.id)
      .eq('status', 'unpaid')
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found or already paid' },
        { status: 404 }
      )
    }

    // Generate order ID (max 50 chars for Midtrans)
    const timestamp = Date.now().toString().slice(-6)
    const orderId = `HOTEL-${reservation.id}-${timestamp}`
    const finishUrl = new URL(`/payment/${reservation.id}`, request.nextUrl.origin)

    // Create Midtrans Snap token (Fase 4: Integrasi Pembayaran)
    try {
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: reservation.total_price
        },
        customer_details: {
          first_name: getUserDisplayName(user, profile),
          email: user.email
        },
        item_details: [{
          id: reservation.room_id,
          price: reservation.total_price,
          quantity: 1,
          name: `Room: ${reservation.rooms?.name || 'Hotel Room'}`,
          category: 'Hotel Reservation'
        }],
        callbacks: {
          finish: finishUrl.toString()
        }
      }

      const transaction = await snap.createTransaction(parameter)

      // Store order_id in reservation for webhook verification
      await supabaseAdmin
        .from('reservations')
        .update({ 
          midtrans_order_id: orderId,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservation_id)

      return NextResponse.json({
        token: transaction.token,
        order_id: orderId,
        redirect_url: transaction.redirect_url
      })

    } catch (midtransError) {
      // Fase 4: Penanganan Kegagalan - Graceful Degradation
      console.error('Midtrans error:', midtransError)
      console.error('Midtrans error message:', getErrorMessage(midtransError))
      
      // Update reservation to expired to free up the room
      await supabaseAdmin
        .from('reservations')
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', reservation_id)

      return NextResponse.json(
        { 
          error: 'Payment service temporarily unavailable. Please try again later.',
          details: getErrorMessage(
            midtransError,
            'Your reservation has been cancelled. Please create a new reservation.'
          )
        },
        { status: 503 }
      )
    }

  } catch (error) {
    console.error('Snap token generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
