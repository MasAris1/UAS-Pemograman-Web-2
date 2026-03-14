import { NextRequest, NextResponse } from 'next/server'
import { verifyMidtransSignature } from '../../../lib/midtrans'
import { supabaseAdmin } from '../../../lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status
    } = body

    // Fase 5: Validasi Kriptografi - Verify signature
    const isValidSignature = verifyMidtransSignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    )

    if (!isValidSignature) {
      console.error('Invalid signature received')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server webhook configuration is incomplete' },
        { status: 500 }
      )
    }

    const { data: existingReservation } = await supabaseAdmin
      .from('reservations')
      .select('id, status')
      .eq('midtrans_order_id', order_id)
      .single()

    if (!existingReservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }

    // Idempotency check - if already paid, return success
    if (existingReservation.status === 'paid') {
      console.log(`Reservation ${existingReservation.id} already paid, skipping`)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Only process successful payments
    const isSuccess = transaction_status === 'capture' || transaction_status === 'settlement'
    const isChallenge = transaction_status === 'challenge' && fraud_status === 'challenge'
    
    if (!isSuccess && !isChallenge) {
      // Payment failed or pending, don't update status
      console.log(`Payment status for ${existingReservation.id}: ${transaction_status}`)
      return NextResponse.json({ success: true, message: 'Status recorded' })
    }

    // Fase 5: Pembaruan & Trigger Otomatis - Update reservation status
    // This will trigger PostgreSQL trigger to create audit log
    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({
        status: 'paid',
        midtrans_transaction_id: body.transaction_id,
        payment_method: body.payment_type,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', existingReservation.id)

    if (updateError) {
      console.error('Failed to update reservation:', updateError)
      return NextResponse.json(
        { error: 'Failed to update reservation' },
        { status: 500 }
      )
    }

    // Fase 5: Distribusi Tiket - Generate and send e-voucher (mock implementation)
    // In production, this would generate a PDF and send via email
    console.log(`E-voucher would be sent to customer for reservation ${existingReservation.id}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Payment processed successfully' 
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
