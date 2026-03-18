import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ftuvwzrvfzhgcxszfvbg.supabase.co'
const supabaseAnonKey = 'sb_publishable_PCVTeWnP9i4nUqqr7qa_vA_X9HH2tnK'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
