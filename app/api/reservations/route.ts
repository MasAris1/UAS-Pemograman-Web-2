import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getErrorMessage } from '../../lib/errors'
import { createClient } from '../../lib/server'
import { supabaseAdmin } from '../../lib/supabase'

// Validation schema (Fase 3: Validasi Skema Server Zod)
const reservationSchema = z.object({
  room_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
})

export async function POST(request: NextRequest) {
  try {
    // Check if supabaseAdmin is initialized
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured', details: 'SUPABASE_SERVICE_ROLE_KEY is missing' },
        { status: 500 }
      )
    }

    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = reservationSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { room_id, check_in, check_out } = validation.data
    const user_id = user.id

    // Validate dates
    const checkInDate = new Date(check_in)
    const checkOutDate = new Date(check_out)
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    if (checkInDate < now) {
      return NextResponse.json(
        { error: 'Check-in date cannot be in the past' },
        { status: 400 }
      )
    }

    if (checkOutDate <= checkInDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      )
    }

    // Fetch room details
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', room_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (roomError) {
      console.error('Room fetch error:', roomError)
      return NextResponse.json(
        { error: 'Database error', details: roomError.message },
        { status: 500 }
      )
    }

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // Calculate total price server-side (Fase 3: Kalkulasi Harga Dinamis)
    // Check for dynamic rates for each date
    let totalPrice = 0
    const currentDate = new Date(checkInDate)
    
    while (currentDate < checkOutDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      
      const { data: rate } = await supabaseAdmin
        .from('room_rates')
        .select('price')
        .eq('room_id', room_id)
        .eq('rate_date', dateStr)
        .maybeSingle()

      if (rate) {
        totalPrice += rate.price
      } else {
        // Use base price if no special rate
        totalPrice += room.base_price
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Create reservation with status 'unpaid'
    // The EXCLUDE constraint in PostgreSQL will prevent double booking (Fase 3: Isolasi Transaksi Mutlak)
    const { data: reservation, error: insertError } = await supabaseAdmin
      .from('reservations')
      .insert({
        user_id,
        room_id,
        check_in,
        check_out,
        total_price: totalPrice,
        status: 'unpaid'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      console.error('Database insertion error:', insertError)
      // Check if it's a double booking error
      if (insertError.message.includes('overlap') || insertError.message.includes('exclude')) {
        return NextResponse.json(
          { error: 'Room is not available for the selected dates' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create reservation', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Reservation created successfully',
      reservation
    }, { status: 201 })

  } catch (error) {
    console.error('Reservation creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
