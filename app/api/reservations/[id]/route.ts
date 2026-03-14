import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server reservation configuration is incomplete' },
        { status: 500 }
      )
    }

    // Fetch reservation with room details
    const { data: reservation, error } = await supabaseAdmin
      .from('reservations')
      .select(`
        *,
        rooms:room_id (name, description, image_url)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ reservation })

  } catch (error) {
    console.error('Fetch reservation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
