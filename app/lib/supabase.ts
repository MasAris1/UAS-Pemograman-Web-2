import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side Supabase client
export const supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations
type AdminClient = SupabaseClient | null

export const supabaseAdmin = supabaseServiceKey 
  ? createSupabaseClient(supabaseUrl, supabaseServiceKey)
  : null as AdminClient

// Database types
export type Room = {
  id: string
  name: string
  description: string | null
  base_price: number
  image_url: string | null
  deleted_at: string | null
  created_at: string
}

export type RoomRate = {
  id: string
  room_id: string
  rate_date: string
  price: number
}

export type Reservation = {
  id: string
  user_id: string
  room_id: string
  check_in: string
  check_out: string
  total_price: number
  status: 'unpaid' | 'paid' | 'expired' | 'checked_in' | 'checked_out' | 'refunded'
  midtrans_order_id?: string
  midtrans_transaction_id?: string
  payment_method?: string
  paid_at?: string
  refunded_at?: string
  refunded_by?: string
  created_at: string
  updated_at: string
}

export type AuditLog = {
  id: string
  table_name: string
  record_id: string
  action: string
  old_data: unknown
  new_data: unknown
  performed_by: string
  created_at: string
}
