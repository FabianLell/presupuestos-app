import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://zzwdjgwqnbyxjhygofat.supabase.co'
const supabaseKey =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_1YQ4-lv2IT_rXEeXG-7YrA_1yoJqT0u'

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id
}