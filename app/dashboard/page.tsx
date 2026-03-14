import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { refundReservation, changeReservationStatus } from '../lib/reservation-admin'
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
import { createClient } from '../lib/server'
import { supabaseAdmin, type Room } from '../lib/supabase'
import { getManagedUserRole, getUserDisplayName, isAdminRole } from '../lib/user-profile'

type DashboardUserRow = {
  id: string
  email: string | null
  displayName: string
  role: string
  createdAt: string | null
  isManagedAdmin: boolean
}

async function requireAdmin(redirectPath = '/dashboard') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`)
  }

  const role = await getViewerRole(user)

  if (!isAdminRole(role)) {
    redirect('/')
  }

  return { supabase, user, role }
}

function parseNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null
  }

  const result = Number(value)

  if (!Number.isFinite(result)) {
    return null
  }

  return result
}

export default async function DashboardPage() {
  const { user } = await requireAdmin()

  if (!supabaseAdmin) {
    return (
      <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Admin Dashboard</h1>
        <p>Server dashboard configuration is incomplete.</p>
        <Link href="/" style={{ color: '#007bff' }}>← Back to Home</Link>
      </div>
    )
  }

  async function createRoom(formData: FormData) {
    'use server'

    await requireAdmin('/dashboard')

    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const imageUrl = String(formData.get('image_url') ?? '').trim()
    const basePrice = parseNumber(formData.get('base_price'))

    if (!name || !basePrice || basePrice <= 0) {
      redirect('/dashboard')
    }

    await supabaseAdmin!
      .from('rooms')
      .insert({
        name,
        description: description || null,
        image_url: imageUrl || null,
        base_price: basePrice,
      })

    revalidatePath('/')
    revalidatePath('/dashboard')
    redirect('/dashboard')
  }

  async function updateRoom(formData: FormData) {
    'use server'

    await requireAdmin('/dashboard')

    const roomId = String(formData.get('room_id') ?? '')
    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const imageUrl = String(formData.get('image_url') ?? '').trim()
    const basePrice = parseNumber(formData.get('base_price'))

    if (!roomId || !name || !basePrice || basePrice <= 0) {
      redirect('/dashboard')
    }

    await supabaseAdmin!
      .from('rooms')
      .update({
        name,
        description: description || null,
        image_url: imageUrl || null,
        base_price: basePrice,
      })
      .eq('id', roomId)

    revalidatePath('/')
    revalidatePath('/dashboard')
    redirect('/dashboard')
  }

  async function toggleRoomArchive(formData: FormData) {
    'use server'

    await requireAdmin('/dashboard')

    const roomId = String(formData.get('room_id') ?? '')
    const shouldRestore = String(formData.get('action') ?? '') === 'restore'

    if (!roomId) {
      redirect('/dashboard')
    }

    await supabaseAdmin!
      .from('rooms')
      .update({
        deleted_at: shouldRestore ? null : new Date().toISOString(),
      })
      .eq('id', roomId)

    revalidatePath('/')
    revalidatePath('/dashboard')
    redirect('/dashboard')
  }

  async function updateUserRole(formData: FormData) {
    'use server'

    await requireAdmin('/dashboard')

    const targetUserId = String(formData.get('user_id') ?? '')
    const nextRole = String(formData.get('role') ?? 'guest')

    if (!targetUserId || !['guest', 'admin'].includes(nextRole)) {
      redirect('/dashboard')
    }

    await supabaseAdmin!
      .from('profiles')
      .upsert({
        id: targetUserId,
        role: nextRole,
      })

    revalidatePath('/dashboard')
    redirect('/dashboard')
  }

  async function updateReservation(formData: FormData) {
    'use server'

    const { user } = await requireAdmin('/dashboard')
    const reservationId = String(formData.get('reservation_id') ?? '')
    const nextStatus = String(formData.get('status') ?? '')

    if (!reservationId || !['checked_in', 'checked_out'].includes(nextStatus)) {
      redirect('/dashboard')
    }

    await changeReservationStatus(
      reservationId,
      nextStatus as 'checked_in' | 'checked_out',
      user.id
    )

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    redirect('/dashboard')
  }

  async function processRefund(formData: FormData) {
    'use server'

    const { user } = await requireAdmin('/dashboard')
    const reservationId = String(formData.get('reservation_id') ?? '')

    if (!reservationId) {
      redirect('/dashboard')
    }

    await refundReservation(reservationId, user.id)

    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    redirect('/dashboard')
  }

  const [roomsResponse, transactions, profilesResponse, usersResponse] = await Promise.all([
    supabaseAdmin
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false }),
    listReservationDocumentsForViewer(user, 'admin'),
    supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, role, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const rooms = (roomsResponse.data ?? []) as Room[]
  const profileById = new Map(
    (profilesResponse.data ?? []).map((profile) => [profile.id, profile])
  )
  const userRows: DashboardUserRow[] = usersResponse.data.users.map((authUser) => {
    const profile = profileById.get(authUser.id)
    const managedRole = getManagedUserRole(authUser)
    const role = managedRole ?? profile?.role ?? 'guest'

    return {
      id: authUser.id,
      email: authUser.email ?? null,
      displayName: getUserDisplayName(authUser, profile),
      role,
      createdAt: profile?.created_at ?? authUser.created_at ?? null,
      isManagedAdmin: managedRole === 'admin',
    }
  })

  const paidTransactions = transactions.filter((item) => item.reservation.status === 'paid').length
  const unpaidTransactions = transactions.filter((item) => item.reservation.status === 'unpaid').length
  const refundedTransactions = transactions.filter((item) => item.reservation.status === 'refunded').length

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <p style={{ margin: '0 0 8px', color: '#0f766e', fontWeight: 700 }}>Admin Control Center</p>
          <h1 style={{ margin: 0, fontSize: '32px', color: '#0f172a' }}>Admin Dashboard</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>
            Kelola kamar, pengguna, reservasi, transaksi, dan dokumen reservasi dari satu dashboard.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            href="/transactions"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 18px',
              borderRadius: '999px',
              textDecoration: 'none',
              backgroundColor: '#dbeafe',
              color: '#1d4ed8',
              fontWeight: 700,
            }}
          >
            All Transactions
          </Link>
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
              fontWeight: 700,
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div style={{ padding: '20px', borderRadius: '18px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Rooms</div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a' }}>{rooms.length}</div>
        </div>
        <div style={{ padding: '20px', borderRadius: '18px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Registered Users</div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a' }}>{userRows.length}</div>
        </div>
        <div style={{ padding: '20px', borderRadius: '18px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Paid Transactions</div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#166534' }}>{paidTransactions}</div>
        </div>
        <div style={{ padding: '20px', borderRadius: '18px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          <div style={{ color: '#64748b', marginBottom: '8px', fontSize: '14px' }}>Unpaid / Refunded</div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#b45309' }}>
            {unpaidTransactions} / {refundedTransactions}
          </div>
        </div>
      </div>

      <section style={{ marginBottom: '28px', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '22px', backgroundColor: '#fff' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#0f172a' }}>Create New Room</h2>
        <p style={{ margin: '0 0 18px', color: '#64748b' }}>
          Tambahkan kamar baru beserta harga dasar dan URL gambar.
        </p>

        <form action={createRoom} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <input name="name" placeholder="Room name" required style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
          <input name="base_price" placeholder="Base price" type="number" min="1" required style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
          <input name="image_url" placeholder="Image URL" style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
          <input name="description" placeholder="Description" style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
          <button type="submit" style={{ padding: '12px 18px', borderRadius: '10px', border: 'none', backgroundColor: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Add Room
          </button>
        </form>
      </section>

      <section style={{ marginBottom: '28px', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '22px', backgroundColor: '#fff' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: '24px', color: '#0f172a' }}>Room Management</h2>

        <div style={{ display: 'grid', gap: '16px' }}>
          {rooms.map((room) => (
            <form
              key={room.id}
              action={updateRoom}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '18px',
                backgroundColor: room.deleted_at ? '#f8fafc' : '#fff',
              }}
            >
              <input type="hidden" name="room_id" value={room.id} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <input name="name" defaultValue={room.name} required style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
                <input name="base_price" defaultValue={room.base_price} type="number" min="1" required style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
                <input name="image_url" defaultValue={room.image_url ?? ''} style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
                <input name="description" defaultValue={room.description ?? ''} style={{ padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '14px' }}>
                  Status: {room.deleted_at ? 'Archived' : 'Active'}
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="submit" style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: '#0f766e', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                    Save Room
                  </button>
                  <button
                    type="submit"
                    formAction={toggleRoomArchive}
                    name="action"
                    value={room.deleted_at ? 'restore' : 'archive'}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: room.deleted_at ? '#2563eb' : '#dc2626',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {room.deleted_at ? 'Restore Room' : 'Archive Room'}
                  </button>
                </div>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '28px', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '22px', backgroundColor: '#fff' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: '24px', color: '#0f172a' }}>User Management</h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>User</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Role</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Joined</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{row.displayName}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{row.email ?? '-'}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', textTransform: 'uppercase', fontWeight: 700 }}>{row.role}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{formatDateTime(row.createdAt)}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    {row.isManagedAdmin ? (
                      <span style={{ color: '#0f766e', fontWeight: 700 }}>System Admin</span>
                    ) : (
                      <form action={updateUserRole} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input type="hidden" name="user_id" value={row.id} />
                        <select name="role" defaultValue={row.role} style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                          <option value="guest">Guest</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button type="submit" style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                          Save Role
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ border: '1px solid #e2e8f0', borderRadius: '18px', padding: '22px', backgroundColor: '#fff' }}>
        <h2 style={{ margin: '0 0 18px', fontSize: '24px', color: '#0f172a' }}>Reservations & Transactions</h2>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Booking</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Guest</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Room</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Stay</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Payment</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>Total</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => (
                <tr key={item.reservation.id}>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <Link href={`/reservations/${item.reservation.id}`} style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 700 }}>
                      {item.bookingCode}
                    </Link>
                    <div style={{ color: '#64748b', fontSize: '13px' }}>{formatDateTime(item.reservation.created_at)}</div>
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 700 }}>{item.guestName}</div>
                    <div style={{ color: '#64748b', fontSize: '13px' }}>{item.guestEmail ?? '-'}</div>
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{item.room?.name ?? 'Hotel Room'}</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    {formatDate(item.reservation.check_in)} - {formatDate(item.reservation.check_out)}
                  </td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <div>{getPaymentLabel(item.reservation.payment_method)}</div>
                    <div style={{ color: '#64748b', fontSize: '13px' }}>{formatDateTime(item.reservation.paid_at)}</div>
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
                  <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {item.reservation.status === 'paid' && (
                        <form action={updateReservation}>
                          <input type="hidden" name="reservation_id" value={item.reservation.id} />
                          <input type="hidden" name="status" value="checked_in" />
                          <button type="submit" style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', backgroundColor: '#0891b2', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                            Check In
                          </button>
                        </form>
                      )}
                      {item.reservation.status === 'checked_in' && (
                        <form action={updateReservation}>
                          <input type="hidden" name="reservation_id" value={item.reservation.id} />
                          <input type="hidden" name="status" value="checked_out" />
                          <button type="submit" style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                            Check Out
                          </button>
                        </form>
                      )}
                      {(item.reservation.status === 'paid' || item.reservation.status === 'checked_in') && (
                        <form action={processRefund}>
                          <input type="hidden" name="reservation_id" value={item.reservation.id} />
                          <button type="submit" style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                            Refund
                          </button>
                        </form>
                      )}
                      <Link href={`/reservations/${item.reservation.id}/ticket`} style={{ alignSelf: 'center', color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}>
                        Ticket PDF
                      </Link>
                    </div>
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
