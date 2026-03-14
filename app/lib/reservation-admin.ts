import { coreApi } from './midtrans'
import { supabaseAdmin, type Reservation } from './supabase'

type MidtransRefundResponse = {
  status_code: string
  status_message: string
}

type MidtransRefundClient = {
  transaction: {
    refund: (
      transactionId: string,
      payload: { amount: number; reason: string }
    ) => Promise<MidtransRefundResponse>
  }
}

function getAdminClient() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
  }

  return supabaseAdmin
}

export async function changeReservationStatus(
  reservationId: string,
  status: Reservation['status'],
  actorId: string
) {
  const admin = getAdminClient()
  const { data, error } = await admin.rpc('update_reservation_status', {
    p_actor_id: actorId,
    p_reservation_id: reservationId,
    p_status: status,
  })

  if (!error) {
    return data
  }

  const { data: fallbackData, error: fallbackError } = await admin
    .from('reservations')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId)
    .select()
    .single()

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return fallbackData
}

export async function refundReservation(
  reservationId: string,
  actorId: string
) {
  const admin = getAdminClient()
  const { data: reservation, error: reservationError } = await admin
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .single()

  if (reservationError || !reservation) {
    throw new Error('Reservation not found')
  }

  if (reservation.status !== 'paid' && reservation.status !== 'checked_in') {
    throw new Error('Reservation cannot be refunded')
  }

  if (reservation.midtrans_transaction_id) {
    const refundClient = coreApi as unknown as MidtransRefundClient
    const refundResponse = await refundClient.transaction.refund(
      reservation.midtrans_transaction_id,
      {
        amount: reservation.total_price,
        reason: 'Customer requested refund',
      }
    )

    if (refundResponse.status_code !== '200') {
      throw new Error(`Midtrans refund failed: ${refundResponse.status_message}`)
    }
  }

  const { data, error } = await admin.rpc('mark_reservation_refunded', {
    p_actor_id: actorId,
    p_reservation_id: reservationId,
  })

  if (!error) {
    return data
  }

  const { data: fallbackData, error: fallbackError } = await admin
    .from('reservations')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      refunded_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId)
    .select()
    .single()

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return fallbackData
}
