import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../lib/server'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getPaymentLabel,
  getStatusColor,
  getStatusLabel,
  getViewerRole,
  listReservationDocumentsForViewer,
} from '../lib/reservation-documents'
import { isAdminRole } from '../lib/user-profile'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/transactions')
  }

  const viewerRole = await getViewerRole(user)
  const transactions = await listReservationDocumentsForViewer(user, viewerRole)
  const paidCount = transactions.filter((item) => item.reservation.status === 'paid').length
  const refundedCount = transactions.filter((item) => item.reservation.status === 'refunded').length
  const pendingCount = transactions.filter((item) => item.reservation.status === 'unpaid').length

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <p style={{ margin: '0 0 8px', color: '#0f766e', fontWeight: 700 }}>
            {isAdminRole(viewerRole) ? 'Admin Transaction Center' : 'My Transactions'}
          </p>
          <h1 style={{ margin: 0, fontSize: '30px', color: '#0f172a' }}>
            {isAdminRole(viewerRole) ? 'All Reservation Transactions' : 'Reservation History'}
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>
            {isAdminRole(viewerRole)
              ? 'Pantau seluruh pembayaran, status reservasi, dan akses dokumen pengguna.'
              : 'Lihat semua reservasi Anda, dokumen tiket, dan struk pembayaran kapan saja.'}
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
          {isAdminRole(viewerRole) && (
            <Link
              href="/dashboard"
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
              Open Dashboard
            </Link>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Total Transactions</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>{transactions.length}</div>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Paid</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#166534' }}>{paidCount}</div>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Refunded</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>{refundedCount}</div>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Unpaid</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706' }}>{pendingCount}</div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '18px', backgroundColor: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Booking</th>
              {isAdminRole(viewerRole) && (
                <th style={{ padding: '14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Guest</th>
              )}
              <th style={{ padding: '14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Room</th>
              <th style={{ padding: '14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Stay</th>
              <th style={{ padding: '14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Payment</th>
              <th style={{ padding: '14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
              <th style={{ padding: '14px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Total</th>
              <th style={{ padding: '14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.reservation.id}>
                <td style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.bookingCode}</div>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>
                    Created {formatDateTime(item.reservation.created_at)}
                  </div>
                </td>
                {isAdminRole(viewerRole) && (
                  <td style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 600 }}>{item.guestName}</div>
                    <div style={{ color: '#64748b', fontSize: '13px' }}>{item.guestEmail ?? '-'}</div>
                  </td>
                )}
                <td style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>{item.room?.name ?? 'Hotel Room'}</td>
                <td style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>
                  {formatDate(item.reservation.check_in)} - {formatDate(item.reservation.check_out)}
                </td>
                <td style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>{getPaymentLabel(item.reservation.payment_method)}</div>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>
                    {formatDateTime(item.reservation.paid_at)}
                  </div>
                </td>
                <td style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>
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
                <td style={{ padding: '14px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 700 }}>
                  {formatCurrency(item.reservation.total_price)}
                </td>
                <td style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Link href={`/reservations/${item.reservation.id}`} style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 700 }}>
                      Details
                    </Link>
                    <Link href={`/reservations/${item.reservation.id}/ticket`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}>
                      Ticket PDF
                    </Link>
                    <Link href={`/reservations/${item.reservation.id}/receipt`} style={{ color: '#166534', textDecoration: 'none', fontWeight: 700 }}>
                      Receipt PDF
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
