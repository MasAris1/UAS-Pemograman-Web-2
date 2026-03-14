import Link from 'next/link'

export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer
      style={{
        marginTop: '48px',
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px 20px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a' }}>
            Hotel Reservation System
          </h2>
          <p style={{ margin: 0, color: '#64748b', maxWidth: '420px', lineHeight: 1.6 }}>
            Temukan kamar terbaik, selesaikan booking lebih cepat, dan pantau pembayaran
            dengan alur yang lebih nyaman.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: '#334155', textDecoration: 'none', fontWeight: 600 }}>
            Home
          </Link>
          <Link href="/#rooms" style={{ color: '#334155', textDecoration: 'none', fontWeight: 600 }}>
            Rooms
          </Link>
          <Link href="/login" style={{ color: '#334155', textDecoration: 'none', fontWeight: 600 }}>
            Login
          </Link>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px 24px',
          color: '#94a3b8',
          fontSize: '14px',
        }}
      >
        Copyright {year} Hotel Reservation System. All rights reserved.
      </div>
    </footer>
  )
}
