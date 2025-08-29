import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if environment variables are configured
if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-ref') || supabaseKey.includes('your-anon-key')) {
  console.error('🚨 SUPABASE CONFIG ERROR!')
  console.error('❌ Missing or invalid Supabase configuration')
  console.error('📁 Create /frontend/.env.local with:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key')
  console.error('🔗 Get these values from: https://supabase.com/dashboard > Settings > API')
}

// Create client with fallback values (will fail but won't crash)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
)

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
