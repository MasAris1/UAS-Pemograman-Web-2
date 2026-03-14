import type { User } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { supabaseAdmin, type Reservation, type Room } from './supabase'
import { getCurrentUserProfile, getManagedUserRole, getUserDisplayName, isAdminRole, type UserProfile } from './user-profile'

export type ReservationDocumentData = {
  reservation: Reservation
  room: Room | null
  guestProfile: UserProfile | null
  guestEmail: string | null
  guestName: string
  bookingCode: string
}

function getAdminClient() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
  }

  return supabaseAdmin
}

function buildGuestName(profile: UserProfile | null, email: string | null) {
  return getUserDisplayName(
    {
      email: email ?? undefined,
      user_metadata: {},
    },
    profile
  )
}

export function getBookingCode(reservationId: string) {
  return `RSV-${reservationId.split('-')[0].toUpperCase()}`
}

export function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

export function formatDate(dateString?: string | null) {
  if (!dateString) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function formatDateTime(dateString?: string | null) {
  if (!dateString) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function getPaymentLabel(paymentMethod?: string | null) {
  if (!paymentMethod) {
    return 'Menunggu pembayaran'
  }

  return paymentMethod
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getStatusLabel(status: Reservation['status']) {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'unpaid':
      return 'Unpaid'
    case 'expired':
      return 'Expired'
    case 'checked_in':
      return 'Checked In'
    case 'checked_out':
      return 'Checked Out'
    case 'refunded':
      return 'Refunded'
    default:
      return status
  }
}

export function getStatusColor(status: Reservation['status']) {
  switch (status) {
    case 'paid':
      return '#16a34a'
    case 'unpaid':
      return '#d97706'
    case 'expired':
      return '#64748b'
    case 'checked_in':
      return '#0891b2'
    case 'checked_out':
      return '#2563eb'
    case 'refunded':
      return '#dc2626'
    default:
      return '#475569'
  }
}

export async function getViewerRole(user: User) {
  const adminRole = getManagedUserRole(user)

  if (adminRole) {
    return adminRole
  }

  const admin = getAdminClient()
  const profile = await getCurrentUserProfile(admin, user)

  return profile.role
}

export async function getReservationDocumentData(
  reservationId: string,
  viewer: User,
  viewerRole: string
) {
  const admin = getAdminClient()
  let query = admin
    .from('reservations')
    .select('*')
    .eq('id', reservationId)

  if (!isAdminRole(viewerRole)) {
    query = query.eq('user_id', viewer.id)
  }

  const { data: reservation, error } = await query.maybeSingle()

  if (error || !reservation) {
    return null
  }

  const [{ data: room }, { data: guestProfile }, authResponse] = await Promise.all([
    admin
      .from('rooms')
      .select('*')
      .eq('id', reservation.room_id)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('id', reservation.user_id)
      .maybeSingle(),
    admin.auth.admin.getUserById(reservation.user_id),
  ])

  const guestEmail =
    authResponse.data.user?.email ??
    (reservation.user_id === viewer.id ? viewer.email ?? null : null)
  const profile: UserProfile | null = guestProfile
    ? {
        ...guestProfile,
        role: guestProfile.role === 'admin' ? 'admin' : 'guest',
      }
    : null

  return {
    reservation,
    room: room ?? null,
    guestProfile: profile,
    guestEmail,
    guestName: buildGuestName(profile, guestEmail),
    bookingCode: getBookingCode(reservation.id),
  } as ReservationDocumentData
}

export async function listReservationDocumentsForViewer(
  viewer: User,
  viewerRole: string
) {
  const admin = getAdminClient()
  let query = admin
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdminRole(viewerRole)) {
    query = query.eq('user_id', viewer.id)
  }

  const { data: reservations, error } = await query

  if (error || !reservations) {
    return []
  }

  const roomIds = [...new Set(reservations.map((reservation) => reservation.room_id))]
  const userIds = [...new Set(reservations.map((reservation) => reservation.user_id))]

  const [{ data: rooms }, { data: profiles }, authUsersResponse] = await Promise.all([
    admin
      .from('rooms')
      .select('*')
      .in('id', roomIds),
    admin
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('id', userIds),
    isAdminRole(viewerRole)
      ? admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      : Promise.resolve({ data: { users: [viewer] }, error: null }),
  ])

  const roomById = new Map((rooms ?? []).map((room) => [room.id, room]))
  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        ...profile,
        role: profile.role === 'admin' ? 'admin' : 'guest',
      } as UserProfile,
    ])
  )
  const emailById = new Map<string, string | null>()

  authUsersResponse.data.users.forEach((user) => {
    emailById.set(user.id, user.email ?? null)
  })

  if (!isAdminRole(viewerRole)) {
    emailById.set(viewer.id, viewer.email ?? null)
  }

  return reservations.map((reservation) => {
    const guestProfile = profileById.get(reservation.user_id) ?? null
    const guestEmail = emailById.get(reservation.user_id) ?? null

    return {
      reservation,
      room: roomById.get(reservation.room_id) ?? null,
      guestProfile,
      guestEmail,
      guestName: buildGuestName(guestProfile, guestEmail),
      bookingCode: getBookingCode(reservation.id),
    } satisfies ReservationDocumentData
  })
}

function wrapText(text: string, maxWidth: number, font: { widthOfTextAtSize: (value: string, size: number) => number }, fontSize: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(nextLine, fontSize)

    if (width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
      return
    }

    currentLine = nextLine
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

export async function generateReservationPdf(
  documentType: 'ticket' | 'receipt',
  data: ReservationDocumentData
) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const title = documentType === 'ticket' ? 'Reservation Ticket' : 'Payment Receipt'
  const statusLabel = getStatusLabel(data.reservation.status)
  const lineColor = rgb(0.88, 0.91, 0.95)
  const textColor = rgb(0.1, 0.14, 0.2)
  const secondaryColor = rgb(0.36, 0.44, 0.55)
  let y = 790

  const drawLabelValue = (label: string, value: string) => {
    page.drawText(label, {
      x: 48,
      y,
      size: 10,
      font: boldFont,
      color: secondaryColor,
    })

    const lines = wrapText(value, 310, regularFont, 12)
    let currentY = y - 16

    lines.forEach((line) => {
      page.drawText(line, {
        x: 48,
        y: currentY,
        size: 12,
        font: regularFont,
        color: textColor,
      })
      currentY -= 16
    })

    y = currentY - 8
  }

  page.drawText('Hotel Reservation System', {
    x: 48,
    y,
    size: 13,
    font: boldFont,
    color: rgb(0.06, 0.46, 0.43),
  })
  y -= 28

  page.drawText(title, {
    x: 48,
    y,
    size: 24,
    font: boldFont,
    color: textColor,
  })

  page.drawText(data.bookingCode, {
    x: 400,
    y: y + 4,
    size: 12,
    font: boldFont,
    color: secondaryColor,
  })
  y -= 26

  page.drawLine({
    start: { x: 48, y },
    end: { x: 547, y },
    thickness: 1,
    color: lineColor,
  })
  y -= 28

  drawLabelValue('Guest Name', data.guestName)
  drawLabelValue('Guest Email', data.guestEmail ?? '-')
  drawLabelValue('Room', data.room?.name ?? 'Hotel Room')
  drawLabelValue('Check-in', formatDate(data.reservation.check_in))
  drawLabelValue('Check-out', formatDate(data.reservation.check_out))
  drawLabelValue('Reservation Status', statusLabel)

  if (documentType === 'ticket') {
    drawLabelValue('Issued At', formatDateTime(data.reservation.paid_at ?? data.reservation.created_at))
    drawLabelValue('Notes', 'Please show this ticket at the reception desk during check-in.')
  } else {
    drawLabelValue('Order ID', data.reservation.midtrans_order_id ?? '-')
    drawLabelValue('Transaction ID', data.reservation.midtrans_transaction_id ?? '-')
    drawLabelValue('Payment Method', getPaymentLabel(data.reservation.payment_method))
    drawLabelValue('Paid At', formatDateTime(data.reservation.paid_at))
  }

  y -= 8
  page.drawLine({
    start: { x: 48, y },
    end: { x: 547, y },
    thickness: 1,
    color: lineColor,
  })
  y -= 28

  page.drawText('Total Payment', {
    x: 48,
    y,
    size: 11,
    font: boldFont,
    color: secondaryColor,
  })
  page.drawText(formatCurrency(data.reservation.total_price), {
    x: 48,
    y: y - 24,
    size: 22,
    font: boldFont,
    color: rgb(0.08, 0.42, 0.24),
  })

  page.drawText(`Generated ${formatDateTime(new Date().toISOString())}`, {
    x: 48,
    y: 48,
    size: 10,
    font: regularFont,
    color: secondaryColor,
  })

  return pdfDoc.save()
}
