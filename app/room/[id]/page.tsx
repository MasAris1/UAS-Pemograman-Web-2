import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/server'

interface RoomDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function RoomDetailPage({ params }: RoomDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  // Fetch room details from Supabase
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !room) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Room not found</h1>
        <p>{error?.message || 'The room you are looking for does not exist.'}</p>
        <Link href="/" style={{ color: '#007bff' }}>Back to Catalog</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/" style={{ color: '#007bff', marginBottom: '20px', display: 'inline-block' }}>
        ← Back to Catalog
      </Link>
      
      {room.image_url && (
        <Image
          src={room.image_url}
          alt={room.name}
          width={1200}
          height={700}
          sizes="(max-width: 900px) 100vw, 800px"
          style={{ width: '100%', height: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '20px' }}
        />
      )}
      
      <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>{room.name}</h1>
      <p style={{ color: '#666', marginBottom: '16px', lineHeight: '1.6' }}>{room.description}</p>
      <p style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '24px' }}>
        Rp {room.base_price?.toLocaleString('id-ID')}/night
      </p>

      <form action={async (formData: FormData) => {
        'use server'
        const checkIn = formData.get('check_in') as string
        const checkOut = formData.get('check_out') as string
        
        if (!checkIn || !checkOut) {
          return
        }
        
        redirect(`/checkout?roomId=${id}&checkIn=${checkIn}&checkOut=${checkOut}`)
      }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Check-in Date
          </label>
          <input 
            type="date" 
            name="check_in"
            required
            min={new Date().toISOString().split('T')[0]}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '200px' }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Check-out Date
          </label>
          <input 
            type="date" 
            name="check_out"
            required
            min={new Date().toISOString().split('T')[0]}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '200px' }}
          />
        </div>

        <button 
          type="submit"
          style={{
            padding: '12px 24px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Book Now
        </button>
      </form>
    </div>
  )
}
