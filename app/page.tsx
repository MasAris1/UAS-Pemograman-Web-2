import Image from 'next/image'
import Link from 'next/link'

import { createClient } from './lib/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <section
        style={{
          marginBottom: '28px',
          padding: '20px 24px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)',
          border: '1px solid #dbeafe',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 8px',
              color: '#0f766e',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: '12px',
            }}
          >
            Hotel Reservation System
          </p>
          <h1 style={{ fontSize: '28px', margin: '0 0 8px', color: '#0f172a' }}>
            Hotel Room Catalog
          </h1>
          <p style={{ margin: 0, color: '#475569', maxWidth: '620px' }}>
            Pilih kamar favorit Anda, lanjutkan ke checkout, lalu selesaikan pembayaran
            dengan alur yang lebih rapi.
          </p>
        </div>
      </section>

      {error ? (
        <div style={{ padding: '20px', border: '1px solid #fecaca', borderRadius: '12px' }}>
          <h2 style={{ marginTop: 0 }}>Error loading rooms</h2>
          <p>{error.message}</p>
          <p>Please check your Supabase configuration.</p>
        </div>
      ) : rooms && rooms.length > 0 ? (
        <div
          id="rooms"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}
        >
          {rooms.map((room) => (
            <div key={room.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px' }}>
              {room.image_url && (
                <Image
                  src={room.image_url}
                  alt={room.name}
                  width={640}
                  height={400}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
                />
              )}
              <h2 style={{ fontSize: '18px', margin: '12px 0 8px' }}>{room.name}</h2>
              <p style={{ color: '#666', marginBottom: '8px' }}>{room.description}</p>
              <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                Rp {room.base_price?.toLocaleString('id-ID')}/night
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link 
                  href={`/checkout?roomId=${room.id}`}
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px'
                  }}
                >
                  Book Now
                </Link>
                <Link
                  href={`/room/${room.id}`}
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    backgroundColor: '#e2e8f0',
                    color: '#0f172a',
                    textDecoration: 'none',
                    borderRadius: '4px'
                  }}
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <p>No rooms available.</p>
          <p>Please add rooms in your Supabase database.</p>
        </div>
      )}
    </div>
  )
}
