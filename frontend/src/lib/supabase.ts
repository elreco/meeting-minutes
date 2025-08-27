import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project-ref.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

export type User = {
  id: string
  email: string
  full_name?: string
  organization_id?: string
  role?: 'owner' | 'admin' | 'member'
}

export type Organization = {
  id: string
  name: string
  slug: string
  subscription_status: string
  subscription_tier: string
}
