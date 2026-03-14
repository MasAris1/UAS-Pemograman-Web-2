import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getErrorMessage } from '../../lib/errors'
import { createClient } from '../../lib/server'
import { refundReservation } from '../../lib/reservation-admin'
import { getCurrentUserProfile } from '../../lib/user-profile'

const refundSchema = z.object({
  reservation_id: z.string().uuid(),
})

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

    // Parse and validate request body
    const body = await request.json()
    const validation = refundSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { reservation_id } = validation.data

    // Check user role (only admin can refund)
    const profile = await getCurrentUserProfile(supabase, user)
    const userRole = profile?.role ?? 'guest'
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    try {
      await refundReservation(reservation_id, user.id)

      return NextResponse.json({
        message: 'Refund processed successfully',
        reservation_id
      })

    } catch (midtransError) {
      console.error('Midtrans refund error:', midtransError)
      return NextResponse.json(
        { error: 'Refund failed', details: getErrorMessage(midtransError) },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Refund processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
