import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { createClient } from '../../lib/server'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getPaymentLabel,
  getReservationDocumentData,
  getStatusColor,
  getStatusLabel,
  getViewerRole,
  listReservationDocumentsForViewer,
} from '../../lib/reservation-documents'
import { isAdminRole } from '../../lib/user-profile'

interface ReservationDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fromPayment?: string }>
}

export default async function ReservationDetailPage({
  params,
  searchParams,
}: ReservationDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/reservations/${id}`)}`)
  }

  const viewerRole = await getViewerRole(user)
  const reservationData = await getReservationDocumentData(id, user, viewerRole)

  if (!reservationData) {
    notFound()
  }

  const transactions = await listReservationDocumentsForViewer(user, viewerRole)
  const relatedHistory = transactions
    .filter((item) =>
      isAdminRole(viewerRole)
        ? item.reservation.user_id === reservationData.reservation.user_id
        : true
    )
    .slice(0, 8)
  const statusColor = getStatusColor(reservationData.reservation.status)

  return (
    <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <p style={{ margin: '0 0 8px', color: '#0f766e', fontWeight: 700 }}>Reservation Center</p>
          <h1 style={{ margin: 0, fontSize: '30px', color: '#0f172a' }}>
            {reservationData.bookingCode}
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>
            Kelola tiket reservasi, struk pembayaran, dan riwayat transaksi Anda di satu tempat.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 18px',
              borderRadius: '999px',
              textDecoration: 'none',
              backgroundColor: '#e2e8f0',
              color: '#0f172a',
              fontWeight: 600,
            }}
          >
            Back to Home
          </Link>
          <Link
            href="/transactions"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 18px',
              borderRadius: '999px',
              textDecoration: 'none',
              backgroundColor: '#0f766e',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            View All Transactions
          </Link>
        </div>
      </div>

      {query.fromPayment === '1' && (
        <div
          style={{
            padding: '16px 18px',
            marginBottom: '20px',
            borderRadius: '14px',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            color: '#166534',
          }}
        >
          Pembayaran berhasil. Tiket reservasi dan struk pembayaran Anda sudah siap.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Guest</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{reservationData.guestName}</div>
          <div style={{ color: '#64748b', marginTop: '6px' }}>{reservationData.guestEmail ?? '-'}</div>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Room</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{reservationData.room?.name ?? 'Hotel Room'}</div>
          <div style={{ color: '#64748b', marginTop: '6px' }}>
            {formatDate(reservationData.reservation.check_in)} - {formatDate(reservationData.reservation.check_out)}
          </div>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Payment Total</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatCurrency(reservationData.reservation.total_price)}</div>
          <div style={{ color: '#64748b', marginTop: '6px' }}>
            {getPaymentLabel(reservationData.reservation.payment_method)}
          </div>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Status</div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: '999px',
              backgroundColor: statusColor,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            {getStatusLabel(reservationData.reservation.status)}
          </div>
          <div style={{ color: '#64748b', marginTop: '6px' }}>
            Paid at: {formatDateTime(reservationData.reservation.paid_at)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        <section style={{ border: '1px solid #e2e8f0', borderRadius: '18px', padding: '22px', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#0f172a' }}>Reservation Ticket</h2>
              <p style={{ margin: 0, color: '#64748b' }}>Dokumen check-in dan identitas reservasi Anda.</p>
            </div>
            <Link
              href={`/reservations/${reservationData.reservation.id}/ticket`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 14px',
                borderRadius: '999px',
                textDecoration: 'none',
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                fontWeight: 700,
              }}
            >
              Download PDF
            </Link>
          </div>

          <div style={{ borderRadius: '16px', padding: '18px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: '12px', color: '#0f766e', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Ticket Code
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '18px' }}>
              {reservationData.bookingCode}
            </div>
            <p><strong>Guest:</strong> {reservationData.guestName}</p>
            <p><strong>Email:</strong> {reservationData.guestEmail ?? '-'}</p>
            <p><strong>Room:</strong> {reservationData.room?.name ?? 'Hotel Room'}</p>
            <p><strong>Check-in:</strong> {formatDate(reservationData.reservation.check_in)}</p>
            <p><strong>Check-out:</strong> {formatDate(reservationData.reservation.check_out)}</p>
            <p><strong>Status:</strong> {getStatusLabel(reservationData.reservation.status)}</p>
          </div>
        </section>

        <section style={{ border: '1px solid #e2e8f0', borderRadius: '18px', padding: '22px', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#0f172a' }}>Payment Receipt</h2>
              <p style={{ margin: 0, color: '#64748b' }}>Ringkasan transaksi pembayaran reservasi Anda.</p>
            </div>
            <Link
              href={`/reservations/${reservationData.reservation.id}/receipt`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 14px',
                borderRadius: '999px',
                textDecoration: 'none',
                backgroundColor: '#dcfce7',
                color: '#166534',
                fontWeight: 700,
              }}
            >
              Download PDF
            </Link>
          </div>

          <div style={{ borderRadius: '16px', padding: '18px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <p><strong>Order ID:</strong> {reservationData.reservation.midtrans_order_id ?? '-'}</p>
            <p><strong>Transaction ID:</strong> {reservationData.reservation.midtrans_transaction_id ?? '-'}</p>
            <p><strong>Payment Method:</strong> {getPaymentLabel(reservationData.reservation.payment_method)}</p>
            <p><strong>Paid At:</strong> {formatDateTime(reservationData.reservation.paid_at)}</p>
            <p><strong>Total:</strong> {formatCurrency(reservationData.reservation.total_price)}</p>
            <p><strong>Status:</strong> {getStatusLabel(reservationData.reservation.status)}</p>
          </div>
        </section>
      </div>

      <section style={{ border: '1px solid #e2e8f0', borderRadius: '18px', padding: '22px', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#0f172a' }}>Transaction History</h2>
            <p style={{ margin: 0, color: '#64748b' }}>
              {isAdminRole(viewerRole)
                ? 'Riwayat reservasi milik tamu ini yang bisa Anda pantau sebagai admin.'
                : 'Semua transaksi reservasi Anda, termasuk yang belum dibayar, selesai, atau direfund.'}
            </p>
          </div>
          <Link
            href="/transactions"
            style={{ color: '#0f766e', fontWeight: 700, textDecoration: 'none' }}
          >
            Open full history
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Code</th>
                {isAdminRole(viewerRole) && (
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Guest</th>
                )}
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Room</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Stay</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {relatedHistory.map((item) => (
                <tr key={item.reservation.id}>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <Link href={`/reservations/${item.reservation.id}`} style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 700 }}>
                      {item.bookingCode}
                    </Link>
                  </td>
                  {isAdminRole(viewerRole) && (
                    <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: 600 }}>{item.guestName}</div>
                      <div style={{ color: '#64748b', fontSize: '13px' }}>{item.guestEmail ?? '-'}</div>
                    </td>
                  )}
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{item.room?.name ?? 'Hotel Room'}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    {formatDate(item.reservation.check_in)} - {formatDate(item.reservation.check_out)}
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 10px',
                        borderRadius: '999px',
                        backgroundColor: getStatusColor(item.reservation.status),
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                    >
                      {getStatusLabel(item.reservation.status)}
                    </span>
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 700 }}>
                    {formatCurrency(item.reservation.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
