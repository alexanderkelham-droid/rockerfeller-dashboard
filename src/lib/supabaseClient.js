import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nohouhstbuysnimquvtx.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaG91aHN0YnV5c25pbXF1dnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NzAwMTksImV4cCI6MjA4NTM0NjAxOX0.gfNaAfR3KB5SGAXIPLCQ21pXvmNPOFIdx40qv48e_80';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
