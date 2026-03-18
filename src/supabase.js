import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ftuvwzrvfzhgcxszfvbg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dXZ3enJ2ZnpoZ2N4c3pmdmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzE5MDQsImV4cCI6MjA4OTQ0NzkwNH0.y26fppJAVe1pMipuOPxlKwbodbrWD-wGnPM1xCd7wAY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
