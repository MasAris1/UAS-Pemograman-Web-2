import { NextResponse } from 'next/server'

import { createClient } from '../../../lib/server'
import { generateReservationPdf, getReservationDocumentData, getViewerRole } from '../../../lib/reservation-documents'

interface ReservationReceiptRouteProps {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: Request,
  { params }: ReservationReceiptRouteProps
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = await getViewerRole(user)
  const reservationData = await getReservationDocumentData(id, user, role)

  if (!reservationData) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  const bytes = await generateReservationPdf('receipt', reservationData)
  const body = Buffer.from(bytes)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${reservationData.bookingCode}.pdf"`,
    },
  })
}
